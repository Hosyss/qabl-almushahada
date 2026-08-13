import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCloudflareProductionConfig,
  CLOUDFLARE_COMPATIBILITY_DATE,
} from "../scripts/prepare-cloudflare-deploy.mjs";

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

test("API tokens and account credentials are never copied into Worker config", () => {
  const config = buildCloudflareProductionConfig({
    ...ACCESS_ENV,
    CLOUDFLARE_API_TOKEN: "top-secret-token",
    CLOUDFLARE_ACCOUNT_ID: "account-id",
  });
  const serialized = JSON.stringify(config);
  assert.equal(serialized.includes("top-secret-token"), false);
  assert.equal(serialized.includes("account-id"), false);
});
