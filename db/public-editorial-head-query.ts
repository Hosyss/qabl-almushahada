export const EDITORIAL_CURRENT_SELECT = `
SELECT r.id AS snapshotId,r.public_id AS publicId,r.title_id AS titleId,r.title_label AS titleLabel,
  r.title_ar AS titleAr,r.title_en AS titleEn,r.release_year AS releaseYear,r.kind AS kind,
  r.policy_version AS policyVersion,r.published_at AS publishedAt,r.updated_at AS updatedAt,
  r.scope_ar AS scopeAr,r.analysis_ar AS analysisAr,r.decision_status AS decisionStatus,
  r.decision_eligible AS decisionEligible,r.content_fingerprint AS contentFingerprint,h.revision AS revision
FROM editorial_publication_heads h
INNER JOIN editorial_publication_revisions r ON r.id=h.current_revision_id
`;

export const CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY = `${EDITORIAL_CURRENT_SELECT}
WHERE h.public_id=?1 AND r.public_id=h.public_id AND r.title_id=h.title_id AND r.revision=h.revision
  AND r.publication_state='published' AND r.decision_status='insufficient_data' AND r.decision_eligible=0
LIMIT 1`;

export const CURRENT_EDITORIAL_BY_TITLE_ID_QUERY = `${EDITORIAL_CURRENT_SELECT}
WHERE h.title_id=?1 AND r.public_id=h.public_id AND r.title_id=h.title_id AND r.revision=h.revision
  AND r.publication_state='published' AND r.decision_status='insufficient_data' AND r.decision_eligible=0
LIMIT 1`;

export const CURRENT_EDITORIAL_LIST_QUERY = `${EDITORIAL_CURRENT_SELECT}
WHERE r.public_id=h.public_id AND r.title_id=h.title_id AND r.revision=h.revision
  AND r.publication_state='published' AND r.decision_status='insufficient_data' AND r.decision_eligible=0
ORDER BY r.published_at DESC,r.public_id ASC LIMIT ?1`;
