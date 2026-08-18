import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const homepageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("homepage links do not prefetch routes the visitor has not requested", () => {
  const openingLinks = homepageSource.match(/<Link\b[^>]*>/g) ?? [];
  assert.ok(openingLinks.length >= 10, `Expected homepage navigation links, found ${openingLinks.length}.`);

  for (const openingLink of openingLinks) {
    assert.match(
      openingLink,
      /\bprefetch=\{false\}/,
      `Homepage Link must remain opt-in on slow connections: ${openingLink}`,
    );
  }
});
