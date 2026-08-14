import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(root, "data", "editorial-bootstrap");

export async function loadEditorialBootstrapFixtures() {
  const files = (await readdir(fixtureDir)).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(files.map(async (name) => JSON.parse(await readFile(path.join(fixtureDir, name), "utf8"))));
}

export function buildEditorialBootstrapSql(fixtures) {
  const sql = [];
  for (const fixture of fixtures) appendFixture(sql, fixture);
  return `${sql.join("\n")}\n`;
}

function appendFixture(sql, { review, presentation, fingerprint }) {
  const snapshotId = `${review.id}:r${presentation.revision}`;
  const isInitialPublication = presentation.revision === 1;
  const revisionKind = isInitialPublication ? "initial" : "legacy_bootstrap";
  const transitionId = `${isInitialPublication ? "c1-initial" : "b4-bootstrap"}:${review.id}:r${presentation.revision}`;

  sql.push(`INSERT INTO editorial_publication_revisions
    (id,public_id,title_id,revision,supersedes_revision_id,revision_kind,publication_state,title_label,title_ar,title_en,
     release_year,kind,policy_version,published_at,updated_at,scope_ar,analysis_ar,decision_status,decision_eligible,content_fingerprint)
    SELECT ${q(snapshotId)},${q(review.id)},${q(review.titleId)},${presentation.revision},NULL,${q(revisionKind)},'published',
      ${q(review.titleLabel)},${q(presentation.titleAr)},${q(presentation.titleEn)},${review.releaseYear},${q(review.kind)},${q(review.policyVersion)},
      ${q(review.publishedAt)},${q(presentation.updatedAt)},${q(review.scopeAr)},${q(review.analysisAr)},'insufficient_data',0,${q(fingerprint)}
    WHERE EXISTS (SELECT 1 FROM titles WHERE id=${q(review.titleId)})
      AND NOT EXISTS (SELECT 1 FROM editorial_publication_revisions WHERE id=${q(snapshotId)});`);

  for (const source of review.sources) {
    const rowId = `${snapshotId}:source:${source.id}`;
    const attribution = source.usageBasis === "open_license" ? `${source.publisher} — ${source.sourceUrl} — ${source.rightsLabel}` : null;
    sql.push(`INSERT INTO editorial_publication_sources
      (id,publication_revision_id,source_key,publisher,source_type,source_url,accessed_on,independence_group_id,usage_basis,rights_label,rights_url,usage_note_ar,source_version,attribution_text)
      SELECT ${q(rowId)},${q(snapshotId)},${q(source.id)},${q(source.publisher)},${q(source.sourceType)},${q(source.sourceUrl)},${q(source.accessedOn)},
        ${q(source.independenceGroupId)},${q(source.usageBasis)},${q(source.rightsLabel)},${q(source.rightsUrl)},${q(source.usageNoteAr)},${q(source.sourceVersion ?? null)},${q(attribution)}
      WHERE EXISTS (SELECT 1 FROM editorial_publication_revisions WHERE id=${q(snapshotId)})
        AND NOT EXISTS (SELECT 1 FROM editorial_publication_sources WHERE id=${q(rowId)});`);
  }

  for (const claim of review.claims) {
    const claimId = `${snapshotId}:claim:${claim.id}`;
    sql.push(`INSERT INTO editorial_publication_claims (id,publication_revision_id,claim_key,category,summary_ar,verification)
      SELECT ${q(claimId)},${q(snapshotId)},${q(claim.id)},${q(claim.category)},${q(claim.summaryAr)},${q(claim.verification)}
      WHERE EXISTS (SELECT 1 FROM editorial_publication_revisions WHERE id=${q(snapshotId)})
        AND NOT EXISTS (SELECT 1 FROM editorial_publication_claims WHERE id=${q(claimId)});`);
    for (const sourceKey of claim.sourceIds) {
      const sourceId = `${snapshotId}:source:${sourceKey}`;
      sql.push(`INSERT INTO editorial_publication_claim_sources (publication_revision_id,claim_id,source_id)
        SELECT ${q(snapshotId)},${q(claimId)},${q(sourceId)}
        WHERE EXISTS (SELECT 1 FROM editorial_publication_claims WHERE id=${q(claimId)})
          AND EXISTS (SELECT 1 FROM editorial_publication_sources WHERE id=${q(sourceId)})
          AND NOT EXISTS (SELECT 1 FROM editorial_publication_claim_sources WHERE claim_id=${q(claimId)} AND source_id=${q(sourceId)});`);
    }
  }

  for (const category of review.uncertainCategories) {
    sql.push(`INSERT INTO editorial_publication_uncertain_categories (publication_revision_id,category)
      SELECT ${q(snapshotId)},${q(category)}
      WHERE EXISTS (SELECT 1 FROM editorial_publication_revisions WHERE id=${q(snapshotId)})
        AND NOT EXISTS (SELECT 1 FROM editorial_publication_uncertain_categories WHERE publication_revision_id=${q(snapshotId)} AND category=${q(category)});`);
  }

  sql.push(`INSERT INTO editorial_publication_heads (title_id,public_id,current_revision_id,revision,last_transition_id,updated_at)
    SELECT ${q(review.titleId)},${q(review.id)},${q(snapshotId)},${presentation.revision},${q(transitionId)},${q(presentation.updatedAt)}
    WHERE EXISTS (SELECT 1 FROM editorial_publication_revisions WHERE id=${q(snapshotId)})
      AND NOT EXISTS (SELECT 1 FROM editorial_publication_heads WHERE title_id=${q(review.titleId)});`);
}

function q(value) {
  return value === null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fixtures = await loadEditorialBootstrapFixtures();
  const sql = buildEditorialBootstrapSql(fixtures);
  const outputArg = process.argv.indexOf("--out");
  if (outputArg >= 0) await writeFile(path.resolve(process.argv[outputArg + 1]), sql, "utf8");
  else process.stdout.write(sql);
}
