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

test("favicon stays square, search-sized, and linked from root metadata", async () => {
  const [rootLayout, favicon] = await Promise.all([
    source("app/layout.tsx"),
    source("public/favicon.svg"),
  ]);

  assert.match(rootLayout, /icon: "\/favicon\.svg"/u);
  assert.match(rootLayout, /shortcut: "\/favicon\.svg"/u);

  const width = Number(favicon.match(/<svg[^>]+width="(\d+)"/u)?.[1]);
  const height = Number(favicon.match(/<svg[^>]+height="(\d+)"/u)?.[1]);
  assert.equal(Number.isFinite(width), true);
  assert.equal(width, height);
  assert.equal(width >= 48, true);
  assert.match(favicon, /viewBox="0 0 24 24"/u);
});
