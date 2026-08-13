-- P4-03B3: D1-backed alternate title names for conservative public search.
-- This migration adds no titles and does not touch review/evidence/judgment data.
ALTER TABLE titles ADD COLUMN search_aliases_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(search_aliases_json));
--> statement-breakpoint
UPDATE titles
SET search_aliases_json = '["Harry Potter and the Sorcerer''s Stone"]',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'wd:Q102438';
