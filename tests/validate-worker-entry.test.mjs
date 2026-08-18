import assert from "node:assert/strict";
import test from "node:test";

import { assertWorkerDefaultFetch } from "../scripts/validate-worker-entry.mjs";

test("accepts a generated alias default export with async fetch", () => {
  const source = `
    import { env } from "cloudflare:workers";
    var worker_entry_default = { async fetch(request, env, ctx) { return new Response("ok"); } };
    export { worker_entry_default as default };
  `;
  assert.equal(assertWorkerDefaultFetch(source, "generated-worker.js"), true);
});

test("accepts a direct default object with fetch", () => {
  const source = `export default { fetch(request) { return new Response(request.url); } };`;
  assert.equal(assertWorkerDefaultFetch(source, "direct-worker.js"), true);
});

test("accepts a default identifier backed by a fetch arrow function property", () => {
  const source = `
    const handler = async () => new Response("ok");
    const worker = { fetch: handler };
    export default worker;
  `;
  assert.equal(assertWorkerDefaultFetch(source, "arrow-worker.js"), true);
});

test("rejects a default export without fetch", () => {
  assert.throws(
    () => assertWorkerDefaultFetch(`export default { scheduled() {} };`, "missing-fetch.js"),
    /callable fetch handler/,
  );
});

test("rejects a module without a default export", () => {
  assert.throws(
    () => assertWorkerDefaultFetch(`export const fetch = () => new Response("wrong shape");`, "named-only.js"),
    /ESM default export/,
  );
});
