import {
  assessEvidenceReview,
  type EvidenceReviewAssessment,
  type EvidenceSourceRef,
} from "./evidence-review.ts";
import type { EvidencePublicationInput } from "./evidence-publication.ts";
import type { AnalysisEvidenceSourceProvenanceRecord } from "./source-provenance.ts";
import {
  fetchWikipediaEvidencePage,
  prepareWikipediaEvidenceForVersion,
  type WikipediaEvidenceLanguage,
  type WikipediaEvidencePage,
} from "./wikipedia-evidence.ts";
import {
  extractEvidenceWithWorkersAi,
  type ModelEvidenceExtraction,
  type WorkersAiRunner,
} from "./workers-ai-evidence-extractor.ts";

export interface AutomatedEvidenceReviewCandidate {
  versionId: string;
  source: EvidenceSourceRef;
  provenance: AnalysisEvidenceSourceProvenanceRecord;
  wikipedia: WikipediaEvidencePage;
  extraction: ModelEvidenceExtraction;
  assessment: EvidenceReviewAssessment;
  publishable: false;
}

/**
 * Builds an evidence-backed review candidate without publishing anything.
 *
 * The candidate stays explicitly `publishable: false`: P3S-05 is extraction and
 * evidence assessment only. P3S-06 owns persistence/publication and re-checks the
 * evidence and provenance instead of trusting this candidate as publish authority.
 */
export async function buildWikipediaEvidenceReviewCandidate(options: {
  versionId: string;
  language: WikipediaEvidenceLanguage;
  wikipediaTitle: string;
  ai: WorkersAiRunner;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}): Promise<AutomatedEvidenceReviewCandidate> {
  const wikipedia = await fetchWikipediaEvidencePage({
    language: options.language,
    title: options.wikipediaTitle,
    fetchImpl: options.fetchImpl,
    now: options.now,
  });

  const prepared = prepareWikipediaEvidenceForVersion({
    versionId: options.versionId,
    page: wikipedia,
  });

  const source: EvidenceSourceRef = {
    id: prepared.provenance.id,
    versionId: prepared.provenance.versionId,
    policySnapshotId: prepared.provenance.policySnapshotId,
    sourceKey: "wikipedia",
    sourceUrl: prepared.provenance.sourceUrl,
    sourceRevision: prepared.provenance.sourceRevision,
    contentSha256: prepared.provenance.contentSha256,
  };

  const extraction = await extractEvidenceWithWorkersAi({
    ai: options.ai,
    source,
    articleText: wikipedia.articleText,
  });

  const assessment = assessEvidenceReview({
    versionId: options.versionId,
    sources: [source],
    assertions: extraction.assertions,
    facts: extraction.facts,
  });

  return {
    versionId: options.versionId,
    source,
    provenance: prepared.provenance,
    wikipedia,
    extraction,
    assessment,
    publishable: false,
  };
}

export function toEvidencePublicationInput(
  candidate: AutomatedEvidenceReviewCandidate,
): EvidencePublicationInput {
  return {
    versionId: candidate.versionId,
    sources: [{ ...candidate.source }],
    provenance: [{ ...candidate.provenance }],
    assertions: candidate.extraction.assertions.map((assertion) => ({ ...assertion })),
    facts: candidate.extraction.facts.map((fact) => ({ ...fact, flags: [...fact.flags] })),
  };
}
