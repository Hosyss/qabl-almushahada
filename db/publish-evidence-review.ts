import { env } from "cloudflare:workers";

import {
  prepareEvidencePublication,
  type EvidencePublicationInput,
  type PreparedEvidencePublication,
} from "@/lib/evidence-publication";
import type { AnalysisEvidenceSourceProvenanceRecord } from "@/lib/source-provenance";

interface ExistingEvidenceSourceRow {
  id: string;
  versionId: string;
  policySnapshotId: string;
  sourceUrl: string;
  sourceRevision: string | null;
  sourceLicense: string;
  licenseUrl: string;
  attributionText: string | null;
  retrievedAt: string;
  contentSha256: string;
  ingestionMode: string;
}

interface EvidencePublicationHeadRow {
  currentPublicationId: string;
  revision: number;
}

type BoundValue = string | number | null;

type PublicationRows = ReturnType<typeof buildPublicationRows>;

export async function publishEvidenceReview(input: EvidencePublicationInput) {
  const preparation = prepareEvidencePublication(input);
  if (!preparation.allowed) {
    return {
      published: false as const,
      reason: "publication_gate" as const,
      assessment: preparation.assessment,
      blockers: preparation.blockers,
    };
  }

  const db = requireD1();
  const publication = preparation.publication;
  const version = await db
    .prepare("SELECT id, status FROM title_versions WHERE id = ? LIMIT 1")
    .bind(publication.versionId)
    .first<{ id: string; status: string }>();
  if (!version || version.status !== "active") {
    return { published: false as const, reason: "version_not_active" as const };
  }

  const missingProvenance = await resolveMissingProvenance(db, publication);
  const head = await db
    .prepare(
      `SELECT current_publication_id AS currentPublicationId, revision
       FROM evidence_review_publication_heads
       WHERE version_id = ?
       LIMIT 1`,
    )
    .bind(publication.versionId)
    .first<EvidencePublicationHeadRow>();

  if (head && (!isNonEmptyString(head.currentPublicationId) || !Number.isInteger(head.revision) || head.revision < 1)) {
    throw new Error("Stored evidence publication head is malformed; refusing to publish.");
  }

  const revision = head ? head.revision + 1 : 1;
  const publicationId = `evpub:${crypto.randomUUID()}`;
  const transitionId = `evpub-transition:${crypto.randomUUID()}`;
  const publishedAt = new Date().toISOString();
  const rows = buildPublicationRows(publicationId, publication);
  const statements: D1PreparedStatement[] = [];

  for (const provenanceChunk of chunk(missingProvenance, 12)) {
    statements.push(buildProvenanceInsert(db, provenanceChunk));
  }

  statements.push(
    db.prepare(
      `INSERT INTO evidence_review_publications
         (id, version_id, revision, supersedes_publication_id, review_method,
          human_watch_confirmed, publication_gate_version, published_at)
       VALUES (?, ?, ?, ?, 'evidence_based', 0, ?, ?)`,
    ).bind(
      publicationId,
      publication.versionId,
      revision,
      head?.currentPublicationId ?? null,
      publication.publicationGateVersion,
      publishedAt,
    ),
  );

  for (const sourceChunk of chunk(publication.sources, 100)) {
    const values = sourceChunk.map(() => "(?, ?)").join(", ");
    const bindings = sourceChunk.flatMap((item) => [publicationId, item.ref.id]);
    statements.push(
      db.prepare(
        `INSERT INTO evidence_publication_sources (publication_id, evidence_source_id)
         VALUES ${values}`,
      ).bind(...bindings),
    );
  }

  for (const assertionChunk of chunk(rows.assertions, 45)) {
    const values = assertionChunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const bindings: BoundValue[] = [];
    for (const row of assertionChunk) {
      bindings.push(
        row.id,
        publicationId,
        row.evidenceSourceId,
        row.sourceAssertionId,
        row.category,
        row.result,
        row.extractionMethod,
        row.extractorVersion,
        row.sourceLocator,
        row.summaryAr,
      );
    }
    statements.push(
      db.prepare(
        `INSERT INTO evidence_publication_assertions
           (id, publication_id, evidence_source_id, source_assertion_id, category, result,
            extraction_method, extractor_version, source_locator, summary_ar)
         VALUES ${values}`,
      ).bind(...bindings),
    );
  }

  for (const factChunk of chunk(rows.facts, 35)) {
    const values = factChunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const bindings: BoundValue[] = [];
    for (const row of factChunk) {
      bindings.push(
        row.id,
        publicationId,
        row.assertionId,
        row.sourceFactId,
        row.category,
        row.severity,
        row.frequency,
        row.context,
        row.spoilerLevel,
        row.summaryAr,
        row.startSecond,
        row.endSecond,
      );
    }
    statements.push(
      db.prepare(
        `INSERT INTO evidence_publication_facts
           (id, publication_id, assertion_id, source_fact_id, category, severity,
            frequency, context, spoiler_level, summary_ar, start_second, end_second)
         VALUES ${values}`,
      ).bind(...bindings),
    );
  }

  for (const flagChunk of chunk(rows.flags, 300)) {
    const values = flagChunk.map(() => "(?, ?)").join(", ");
    const bindings = flagChunk.flatMap((row) => [row.factId, row.flag]);
    statements.push(
      db.prepare(
        `INSERT INTO evidence_publication_fact_flags (fact_id, flag)
         VALUES ${values}`,
      ).bind(...bindings),
    );
  }

  if (head) {
    statements.push(
      db.prepare(
        `UPDATE evidence_review_publication_heads
         SET current_publication_id = ?,
             revision = ?,
             last_transition_id = ?,
             updated_at = ?
         WHERE version_id = ?
           AND revision = ?
           AND current_publication_id = ?`,
      ).bind(
        publicationId,
        revision,
        transitionId,
        publishedAt,
        publication.versionId,
        head.revision,
        head.currentPublicationId,
      ),
    );
  } else {
    statements.push(
      db.prepare(
        `INSERT INTO evidence_review_publication_heads
           (version_id, current_publication_id, revision, last_transition_id, updated_at)
         VALUES (?, ?, 1, ?, ?)`,
      ).bind(publication.versionId, publicationId, transitionId, publishedAt),
    );
  }

  const results = await db.batch(statements);
  const headChanges = results.at(-1)?.meta?.changes ?? 0;
  if (headChanges !== 1) {
    throw new Error("Concurrent evidence publication prevented finalization; rebuild from current state.");
  }

  return {
    published: true as const,
    publicationId,
    revision,
    publishedAt,
    assessment: publication.assessment,
  };
}

async function resolveMissingProvenance(
  db: D1Database,
  publication: PreparedEvidencePublication,
): Promise<AnalysisEvidenceSourceProvenanceRecord[]> {
  const ids = publication.sources.map((item) => item.provenance.id);
  const placeholders = ids.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT
         id,
         version_id AS versionId,
         policy_snapshot_id AS policySnapshotId,
         source_url AS sourceUrl,
         source_revision AS sourceRevision,
         source_license AS sourceLicense,
         license_url AS licenseUrl,
         attribution_text AS attributionText,
         retrieved_at AS retrievedAt,
         content_sha256 AS contentSha256,
         ingestion_mode AS ingestionMode
       FROM version_evidence_sources
       WHERE id IN (${placeholders})`,
    )
    .bind(...ids)
    .all<ExistingEvidenceSourceRow>();

  const existing = new Map((result.results ?? []).map((row) => [row.id, row]));
  const missing: AnalysisEvidenceSourceProvenanceRecord[] = [];

  for (const item of publication.sources) {
    const stored = existing.get(item.provenance.id);
    if (!stored) {
      missing.push(item.provenance);
      continue;
    }
    if (!sameProvenance(stored, item.provenance)) {
      throw new Error(`Stored evidence provenance differs from publication input: ${item.provenance.id}`);
    }
  }

  return missing;
}

function buildProvenanceInsert(
  db: D1Database,
  rows: readonly AnalysisEvidenceSourceProvenanceRecord[],
): D1PreparedStatement {
  const values = rows.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
  const bindings: BoundValue[] = [];
  for (const row of rows) {
    bindings.push(
      row.id,
      row.versionId,
      row.policySnapshotId,
      row.sourceUrl,
      row.sourceRevision,
      row.sourceLicense,
      row.licenseUrl,
      row.attributionText,
      row.retrievedAt,
      row.contentSha256,
      row.ingestionMode,
    );
  }
  return db.prepare(
    `INSERT INTO version_evidence_sources
       (id, version_id, policy_snapshot_id, source_url, source_revision, source_license,
        license_url, attribution_text, retrieved_at, content_sha256, ingestion_mode)
     VALUES ${values}`,
  ).bind(...bindings);
}

function buildPublicationRows(publicationId: string, publication: PreparedEvidencePublication) {
  const assertionIds = new Map<string, string>();
  const assertions = publication.assertions.map((assertion) => {
    const id = `evassert:${crypto.randomUUID()}`;
    assertionIds.set(assertion.id, id);
    return {
      id,
      evidenceSourceId: assertion.evidenceSourceId,
      sourceAssertionId: assertion.id,
      category: assertion.category,
      result: assertion.result,
      extractionMethod: assertion.extractionMethod,
      extractorVersion: assertion.extractorVersion,
      sourceLocator: assertion.sourceLocator,
      summaryAr: assertion.summaryAr,
    };
  });

  const flags: Array<{ factId: string; flag: string }> = [];
  const facts = publication.facts.map((fact) => {
    const assertionId = assertionIds.get(fact.assertionId);
    if (!assertionId) {
      throw new Error(`Publication fact lost its validated assertion: ${fact.id}`);
    }
    const id = `evfact:${crypto.randomUUID()}`;
    for (const flag of fact.flags) flags.push({ factId: id, flag });
    return {
      id,
      assertionId,
      sourceFactId: fact.id,
      category: fact.category,
      severity: fact.severity,
      frequency: fact.frequency,
      context: fact.context,
      spoilerLevel: fact.spoilerLevel,
      summaryAr: fact.summaryAr,
      startSecond: fact.startSecond,
      endSecond: fact.endSecond,
    };
  });

  return { publicationId, assertions, facts, flags };
}

function sameProvenance(
  row: ExistingEvidenceSourceRow,
  expected: AnalysisEvidenceSourceProvenanceRecord,
): boolean {
  return (
    row.id === expected.id &&
    row.versionId === expected.versionId &&
    row.policySnapshotId === expected.policySnapshotId &&
    row.sourceUrl === expected.sourceUrl &&
    row.sourceRevision === expected.sourceRevision &&
    row.sourceLicense === expected.sourceLicense &&
    row.licenseUrl === expected.licenseUrl &&
    row.attributionText === expected.attributionText &&
    row.retrievedAt === expected.retrievedAt &&
    row.contentSha256 === expected.contentSha256 &&
    row.ingestionMode === expected.ingestionMode
  );
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function requireD1(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("D1 binding DB is required.");
  return db;
}
