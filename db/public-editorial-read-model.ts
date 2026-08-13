export interface EditorialHeadRow {
  snapshotId: string;
  publicId: string;
  titleId: string;
  titleLabel: string;
  titleAr: string;
  titleEn: string;
  releaseYear: number;
  kind: string;
  policyVersion: string;
  publishedAt: string;
  updatedAt: string;
  scopeAr: string;
  analysisAr: string;
  decisionStatus: string;
  decisionEligible: number;
  contentFingerprint: string;
  revision: number;
}

export interface EditorialSourceRow {
  sourceKey: string; publisher: string; sourceType: string; sourceUrl: string; accessedOn: string;
  independenceGroupId: string; usageBasis: string; rightsLabel: string; rightsUrl: string;
  usageNoteAr: string; sourceVersion: string | null;
}
export interface EditorialClaimRow { claimKey: string; category: string; summaryAr: string; verification: string; }
export interface EditorialClaimSourceRow { claimKey: string; sourceKey: string; }
export interface EditorialUncertainRow { category: string; }
