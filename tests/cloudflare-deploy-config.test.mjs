import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildCloudflareProductionConfig,
  CLOUDFLARE_COMPATIBILITY_DATE,
  REQUIRED_PRODUCTION_SECRETS,
} from "../scripts/prepare-cloudflare-deploy.mjs";
import { withSecurityHeaders } from "../worker/security-headers.ts";

const BASE_ENV = {
  CF_D1_DATABASE_ID: "123e4567-e89b-42d3-a456-426614174000",
  CF_D1_DATABASE_NAME: "qabl-almushahada-prod",
  CF_WORKER_NAME: "qabl-almushahada",
};

const ACCESS_ENV = {
  ...BASE_ENV,
  CF_ACCESS_TEAM_DOMAIN: "https://hosy.cloudflareaccess.com",
  CF_ACCESS_AUD: "access-audience-tag",
  INTERNAL_BOOTSTRAP_ADMIN_EMAIL: "Admin@Example.COM",
};

test("production config binds real D1, static assets, Images, Workers AI and current compatibility date", () => {
  const config = buildCloudflareProductionConfig(BASE_ENV);

  assert.equal(config.name, "qabl-almushahada");
  assert.equal(config.main, "../../worker/index.ts");
  assert.equal(config.compatibility_date, CLOUDFLARE_COMPATIBILITY_DATE);
  assert.deepEqual(config.compatibility_flags, ["nodejs_compat"]);
  assert.equal(config.workers_dev, true);
  assert.deepEqual(config.assets, {
    not_found_handling: "none",
    binding: "ASSETS",
  });
  assert.deepEqual(config.images, { binding: "IMAGES" });
  assert.deepEqual(config.ai, { binding: "AI" });
  assert.deepEqual(config.d1_databases, [
    {
      binding: "DB",
      database_name: "qabl-almushahada-prod",
      database_id: BASE_ENV.CF_D1_DATABASE_ID,
      migrations_dir: "../../drizzle",
    },
  ]);
  assert.deepEqual(REQUIRED_PRODUCTION_SECRETS, ["PUBLIC_REPORT_HMAC_SECRET"]);
  assert.deepEqual(config.secrets, { required: ["PUBLIC_REPORT_HMAC_SECRET"] });
  assert.equal("vars" in config, false, "Internal auth must remain fail-closed until Access is configured.");
});

test("Cloudflare Access vars are emitted only when the complete pair is supplied", () => {
  const config = buildCloudflareProductionConfig(ACCESS_ENV);
  assert.equal(config.vars.INTERNAL_AUTH_MODE, "cloudflare_access");
  assert.equal(config.vars.CF_ACCESS_TEAM_DOMAIN, "https://hosy.cloudflareaccess.com");
  assert.equal(config.vars.CF_ACCESS_AUD, "access-audience-tag");
  assert.equal(config.vars.INTERNAL_BOOTSTRAP_ADMIN_EMAIL, "admin@example.com");

  assert.throws(
    () => buildCloudflareProductionConfig({ ...BASE_ENV, CF_ACCESS_TEAM_DOMAIN: ACCESS_ENV.CF_ACCESS_TEAM_DOMAIN }),
    /must be provided together/,
  );
  assert.throws(
    () => buildCloudflareProductionConfig({ ...BASE_ENV, CF_ACCESS_AUD: ACCESS_ENV.CF_ACCESS_AUD }),
    /must be provided together/,
  );
});

test("production config fails closed without the real D1 identifiers", () => {
  assert.throws(() => buildCloudflareProductionConfig({}), /CF_D1_DATABASE_ID is required/);
  assert.throws(
    () => buildCloudflareProductionConfig({ ...BASE_ENV, CF_ACCESS_TEAM_DOMAIN: "https://example.com", CF_ACCESS_AUD: "aud" }),
    /cloudflareaccess\.com/,
  );
});

test("local placeholder D1 id is forbidden in production config", () => {
  assert.throws(
    () =>
      buildCloudflareProductionConfig({
        ...BASE_ENV,
        CF_D1_DATABASE_ID: "00000000-0000-4000-8000-000000000000",
      }),
    /placeholder database id/,
  );
});

test("bootstrap admin cannot be configured without Cloudflare Access", () => {
  assert.throws(
    () => buildCloudflareProductionConfig({ ...BASE_ENV, INTERNAL_BOOTSTRAP_ADMIN_EMAIL: "admin@example.com" }),
    /must be provided together/,
  );
});

test("API tokens, account credentials and secret values are never copied into Worker config", () => {
  const config = buildCloudflareProductionConfig({
    ...ACCESS_ENV,
    CLOUDFLARE_API_TOKEN: "top-secret-token",
    CLOUDFLARE_ACCOUNT_ID: "account-id",
    PUBLIC_REPORT_HMAC_SECRET: "must-never-be-serialized",
  });
  const serialized = JSON.stringify(config);
  assert.equal(serialized.includes("top-secret-token"), false);
  assert.equal(serialized.includes("account-id"), false);
  assert.equal(serialized.includes("must-never-be-serialized"), false);
  assert.match(serialized, /PUBLIC_REPORT_HMAC_SECRET/u);
});

test("HTML responses receive clickjacking, MIME and referrer protections without losing response semantics", async () => {
  const response = withSecurityHeaders(new Response("<main>ok</main>", {
    status: 201,
    statusText: "Created",
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "X-Powered-By": "vinext",
    },
  }));

  assert.equal(response.status, 201);
  assert.equal(response.statusText, "Created");
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=60");
  assert.equal(response.headers.get("X-Powered-By"), null);
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(response.headers.get("Content-Security-Policy"), "frame-ancestors 'none'");
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
  assert.equal(await response.text(), "<main>ok</main>");
});

test("non-HTML responses get base protections but no document-only framing policy", async () => {
  const response = withSecurityHeaders(new Response('{"ok":true}', {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  }));

  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(response.headers.get("Content-Security-Policy"), null);
  assert.equal(response.headers.get("X-Frame-Options"), null);
  assert.equal(await response.json().then((value) => value.ok), true);
});

test("Worker routes both application and optimized-image responses through security wrapper without broad script CSP", async () => {
  const [workerSource, helperSource] = await Promise.all([
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/security-headers.ts", import.meta.url), "utf8"),
  ]);

  assert.match(workerSource, /return withSecurityHeaders\(await handler\.fetch\(request, env, ctx\)\)/u);
  assert.match(workerSource, /return withSecurityHeaders\(response\)/u);
  assert.doesNotMatch(helperSource, /default-src|script-src|style-src|unsafe-inline|unsafe-eval/u);
});
