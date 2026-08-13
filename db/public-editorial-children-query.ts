export const EDITORIAL_SOURCES_QUERY = `
SELECT source_key AS sourceKey,publisher,source_type AS sourceType,source_url AS sourceUrl,
  accessed_on AS accessedOn,independence_group_id AS independenceGroupId,usage_basis AS usageBasis,
  rights_label AS rightsLabel,rights_url AS rightsUrl,usage_note_ar AS usageNoteAr,source_version AS sourceVersion
FROM editorial_publication_sources WHERE publication_revision_id=?1 ORDER BY source_key ASC`;

export const EDITORIAL_CLAIMS_QUERY = `
SELECT claim_key AS claimKey,category,summary_ar AS summaryAr,verification
FROM editorial_publication_claims WHERE publication_revision_id=?1 ORDER BY claim_key ASC`;

export const EDITORIAL_CLAIM_SOURCES_QUERY = `
SELECT c.claim_key AS claimKey,s.source_key AS sourceKey
FROM editorial_publication_claim_sources l
INNER JOIN editorial_publication_claims c ON c.id=l.claim_id AND c.publication_revision_id=l.publication_revision_id
INNER JOIN editorial_publication_sources s ON s.id=l.source_id AND s.publication_revision_id=l.publication_revision_id
WHERE l.publication_revision_id=?1 ORDER BY c.claim_key ASC,s.source_key ASC`;

export const EDITORIAL_UNCERTAIN_QUERY = `
SELECT category FROM editorial_publication_uncertain_categories
WHERE publication_revision_id=?1 ORDER BY category ASC`;
