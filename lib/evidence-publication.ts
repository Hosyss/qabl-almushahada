import {
  CONTENT_SOURCE_POLICIES,
  type ContentSourceKey,
} from "./content-source-policy.ts";
import {
  assessEvidenceReview,
  type EvidenceCategoryAssertion,
  type EvidenceFact,
  type EvidenceReviewAssessment,
  type EvidenceSourceRef,
} from "./evidence-review.ts";
import {
  assertAnalysisEvidenceSourceReady,
  type AnalysisEvidenceSourceProvenanceRecord,
} from "./source-provenance.ts";

export const EVIDENCE_PUBLICATION_GATE_VERSION = "2026-08-13.1";
export const EVIDENCE_PUBLICATION_MAX_SOURCES = 8;
export const EVIDENCE_PUBLICATION_MAX_ASSERTIONS = 80;
export const EVIDENCE_PUBLICATION_MAX_FACTS = 480;
export const EVIDENCE_PUBLIC_DISCLOSURE_AR =
  "نحن لا ننقل مراجعة الآخرين؛ المصادر تمدنا بالدليل، والمراجعة النهائية وتجميع الوقائع وقرار الأسرة من منهج «قبل المشاهدة». هذه الصفحة لا تدّعي أن إنسانًا من فريقنا شاهد النسخة ما لم يُذكر ذلك صراحة في مسار مراجعة بشري منفصل.";

export interface EvidencePublicationInput {
  versionId: string;
  sources: EvidenceSourceRef[];
  provenance: AnalysisEvidenceSourceProvenanceRecord[];
  assertions: EvidenceCategoryAssertion[];
  facts: EvidenceFact[];
}

export interface PreparedEvidencePublicationSource {
  ref: EvidenceSourceRef;
  provenance: AnalysisEvidenceSourceProvenanceRecord;
}

export interface PreparedEvidencePublication {
  versionId: string;
  reviewMethod: "evidence_based";
  humanWatchConfirmed: false;
  publicationGateVersion: string;
  disclosureAr: string;
  assessment: EvidenceReviewAssessment;
  sources: PreparedEvidencePublicationSource[];
  assertions: EvidenceCategoryAssertion[];
  facts: EvidenceFact[];
}

export type EvidencePublicationBlockCode =
  | "INPUT_BOUNDS_INVALID"
  | "EVIDENCE_NOT_READY"
  | "PROVENANCE_SET_MISMATCH"
  | "PROVENANCE_IDENTITY_MISMATCH"
  | "SOURCE_POLICY_NOT_CURRENT"
  | "MODEL_ASSISTED_NONE_FORBIDDEN";

export type EvidencePublicationPreparation =
  | {
      allowed: true;
      publication: PreparedEvidencePublication;
    }
  | {
      allowed: false;
      assessment: EvidenceReviewAssessment;
      blockers: EvidencePublicationBlockCode[];
    };

export function prepareEvidencePublication(
  input: EvidencePublicationInput,
): EvidencePublicationPreparation {
  const assessment = assessEvidenceReview({
    versionId: input.versionId,
    sources: input.sources,
    assertions: input.assertions,
    facts: input.facts,
  });
  const blockers: EvidencePublicationBlockCode[] = [];

  if (
    input.sources.length < 1 ||
    input.sources.length > EVIDENCE_PUBLICATION_MAX_SOURCES ||
    input.assertions.length < 1 ||
    input.assertions.length > EVIDENCE_PUBLICATION_MAX_ASSERTIONS ||
    input.facts.length > EVIDENCE_PUBLICATION_MAX_FACTS
  ) {
    blockers.push("INPUT_BOUNDS_INVALID");
  }

  if (assessment.status !== "ready" || !assessment.engineEligible) {
    blockers.push("EVIDENCE_NOT_READY");
  }

  if (
    input.assertions.some(
      (assertion) => assertion.extractionMethod === "model_assisted" && assertion.result === "none",
    )
  ) {
    blockers.push("MODEL_ASSISTED_NONE_FORBIDDEN");
  }

  const sourceIds = new Set(input.sources.map((source) => source.id));
  const provenanceIds = new Set(input.provenance.map((record) => record.id));
  if (
    sourceIds.size !== input.sources.length ||
    provenanceIds.size !== input.provenance.length ||
    sourceIds.size !== provenanceIds.size ||
    [...sourceIds].some((id) => !provenanceIds.has(id))
  ) {
    blockers.push("PROVENANCE_SET_MISMATCH");
  }

  const provenanceById = new Map(input.provenance.map((record) => [record.id, record]));
  const preparedSources: PreparedEvidencePublicationSource[] = [];

  for (const source of input.sources) {
    const provenance = provenanceById.get(source.id);
    if (!provenance) continue;

    if (
      provenance.versionId !== input.versionId ||
      provenance.versionId !== source.versionId ||
      provenance.policySnapshotId !== source.policySnapshotId ||
      provenance.sourceUrl !== source.sourceUrl ||
      provenance.sourceRevision !== source.sourceRevision ||
      provenance.contentSha256 !== source.contentSha256
    ) {
      blockers.push("PROVENANCE_IDENTITY_MISMATCH");
      continue;
    }

    if (!isContentSourceKey(source.sourceKey)) {
      blockers.push("SOURCE_POLICY_NOT_CURRENT");
      continue;
    }

    try {
      const policy = assertAnalysisEvidenceSourceReady(source.sourceKey, provenance.ingestionMode);
      if (
        source.policySnapshotId !== policy.id ||
        provenance.policySnapshotId !== policy.id ||
        provenance.sourceLicense !== policy.licenseLabel ||
        provenance.licenseUrl !== policy.licenseUrl ||
        (policy.attributionRequired &&
          (!provenance.attributionText || provenance.attributionText.trim().length < 20))
      ) {
        blockers.push("SOURCE_POLICY_NOT_CURRENT");
        continue;
      }
    } catch {
      blockers.push("SOURCE_POLICY_NOT_CURRENT");
      continue;
    }

    preparedSources.push({ ref: source, provenance });
  }

  const uniqueBlockers = [...new Set(blockers)];
  if (uniqueBlockers.length > 0) {
    return { allowed: false, assessment, blockers: uniqueBlockers };
  }

  return {
    allowed: true,
    publication: {
      versionId: input.versionId,
      reviewMethod: "evidence_based",
      humanWatchConfirmed: false,
      publicationGateVersion: EVIDENCE_PUBLICATION_GATE_VERSION,
      disclosureAr: EVIDENCE_PUBLIC_DISCLOSURE_AR,
      assessment,
      sources: preparedSources,
      assertions: input.assertions.map((assertion) => ({ ...assertion })),
      facts: input.facts.map((fact) => ({ ...fact, flags: [...fact.flags] })),
    },
  };
}

function isContentSourceKey(value: string): value is ContentSourceKey {
  return Object.hasOwn(CONTENT_SOURCE_POLICIES, value);
}
