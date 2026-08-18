import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (file: string) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("homepage publishes an explicit self canonical without setting a global inherited canonical", async () => {
  const [home, rootLayout] = await Promise.all([
    source("app/page.tsx"),
    source("app/layout.tsx"),
  ]);

  assert.match(home, /alternates: \{ canonical: `\$\{PUBLIC_SITE_ORIGIN\}\/` \}/u);
  assert.match(rootLayout, /metadataBase: new URL\(PUBLIC_SITE_ORIGIN\)/u);
  assert.doesNotMatch(rootLayout, /alternates:\s*\{\s*canonical:/u);
});
