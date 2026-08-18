import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const WORKFLOWS = path.join(process.cwd(), ".github", "workflows");
const FULL_SHA = /^[0-9a-f]{40}$/iu;

test("every external GitHub Action is pinned to a full-length commit SHA", async () => {
  const files = (await readdir(WORKFLOWS)).filter((name) => /\.ya?ml$/u.test(name)).sort();
  assert.ok(files.length > 0);
  const seen = [];
  for (const file of files) {
    const text = await readFile(path.join(WORKFLOWS, file), "utf8");
    for (const line of text.split(/\r?\n/u)) {
      const match = line.match(/^\s*-?\s*uses:\s*([^#\s]+)/u);
      if (!match) continue;
      const reference = match[1];
      if (reference.startsWith("./")) continue;
      const at = reference.lastIndexOf("@");
      assert.ok(at > 0, `${file} has an external action without a ref: ${reference}`);
      const action = reference.slice(0, at);
      const ref = reference.slice(at + 1);
      assert.match(ref, FULL_SHA, `${file} must pin ${action} to a full 40-character commit SHA, not ${ref}`);
      seen.push({ file, action, ref });
    }
  }
  assert.ok(seen.some(({ action }) => action === "actions/checkout"));
  assert.ok(seen.some(({ action }) => action === "actions/setup-node"));
  assert.ok(seen.some(({ action }) => action === "actions/upload-artifact"));
});

test("workflows explicitly keep the default GITHUB_TOKEN at read-only contents access", async () => {
  const files = (await readdir(WORKFLOWS)).filter((name) => /\.ya?ml$/u.test(name)).sort();
  for (const file of files) {
    const text = await readFile(path.join(WORKFLOWS, file), "utf8");
    assert.match(text, /(?:^|\n)permissions:\s*\n\s{2}contents:\s*read(?:\n|$)/u, `${file} must declare read-only contents permission`);
  }
});
