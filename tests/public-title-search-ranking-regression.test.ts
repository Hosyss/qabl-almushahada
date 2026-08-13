import assert from "node:assert/strict";
import test from "node:test";

import {
  parsePublicTitleSearchRequest,
  rankPublicTitleSearchDiscovery,
  type PublicTitleSearchCandidate,
} from "../lib/public-title-search.ts";

function harry(id: string, year: number, title: string): PublicTitleSearchCandidate {
  return {
    id,
    canonicalName: `هاري بوتر ${year}`,
    originalName: title,
    aliases: [],
    kind: "movie",
    releaseYear: year,
    hasVerifiedReview: false,
    hasReviewInProgress: false,
    verifiedBundleId: null,
    verifiedMaxSeverity: null,
  };
}

test("equal HarryPotter compact suggestions keep B3 oldest-first tie-break", () => {
  const candidates = [
    harry("wd:Q232009", 2011, "Harry Potter and the Deathly Hallows – Part 2"),
    harry("wd:Q161678", 2010, "Harry Potter and the Deathly Hallows – Part 1"),
    harry("wd:Q161687", 2009, "Harry Potter and the Half-Blood Prince"),
    harry("wd:Q102235", 2007, "Harry Potter and the Order of the Phoenix"),
    harry("wd:Q102225", 2005, "Harry Potter and the Goblet of Fire"),
    harry("wd:Q102438", 2001, "Harry Potter and the Philosopher's Stone"),
  ];

  const discovery = rankPublicTitleSearchDiscovery(
    parsePublicTitleSearchRequest({ query: "HarryPotter" }),
    candidates,
  );

  assert.deepEqual(discovery.matches, []);
  assert.equal(discovery.didYouMean.length, 5);
  assert.equal(discovery.didYouMean[0]?.id, "wd:Q102438");
  assert.equal(discovery.didYouMean[0]?.releaseYear, 2001);
  assert.equal(discovery.didYouMean[0]?.matchKind, "compact_match");
  assert.deepEqual(discovery.didYouMean.map((item) => item.releaseYear), [2001, 2005, 2007, 2009, 2010]);
});
