import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCloudflareProductionConfig,
  CLOUDFLARE_COMPATIBILITY_DATE,
} from "../scripts/prepare-cloudflare-deploy.mjs";

const VALID_ENV = {
  CF_D1_DATABASE_ID: "123e4567-e89b-42d3-a456-426614174000",
  CF_D1_DATABASE_NAME: "qabl-almushahada-prod",
  CF_ACCESS_TEAM_DOMAIN: "https://hosy.cloudflareaccess.com",
  CF_ACCESS_AUD: "access-audience-tag",
  CF_WORKER_NAME: "qabl-almushahada",
  INTERNAL_BOOTSTRAP_ADMIN_EMAIL: "Admin@Example.COM",
};

test("production config binds real D1, Images, Access vars and current compatibility date", () => {
  const config = buildCloudflareProductionConfig(VALID_ENV);

  assert.equal(config.name, "qabl-almushahada");
  assert.equal(config.main, "../../worker/index.ts");
  assert.equal(config.compatibility_date, CLOUDFLARE_COMPATIBILITY_DATE);
  assert.deepEqual(config.compatibility_flags, ["nodejs_compat"]);
  assert.equal(config.workers_dev, true);
  assert.deepEqual(config.images, { binding: "IMAGES" });
  assert.deepEqual(config.d1_databases, [
    {
      binding: "DB",
      database_name: "qabl-almushahada-prod",
      database_id: VALID_ENV.CF_D1_DATABASE_ID,
      migrations_dir: "../../drizzle",
    },
  ]);
  assert.equal(config.vars.INTERNAL_AUTH_MODE, "cloudflare_access");
  assert.equal(config.vars.CF_ACCESS_TEAM_DOMAIN, "https://hosy.cloudflareaccess.com");
  assert.equal(config.vars.CF_ACCESS_AUD, "access-audience-tag");
  assert.equal(config.vars.INTERNAL_BOOTSTRAP_ADMIN_EMAIL, "admin@example.com");
});

test("production config fails closed without the real D1 and Access identifiers", () => {
  assert.throws(() => buildCloudflareProductionConfig({}), /CF_D1_DATABASE_ID is required/);
  assert.throws(
    () => buildCloudflareProductionConfig({ ...VALID_ENV, CF_ACCESS_AUD: "" }),
    /CF_ACCESS_AUD/,
  );
  assert.throws(
    () => buildCloudflareProductionConfig({ ...VALID_ENV, CF_ACCESS_TEAM_DOMAIN: "https://example.com" }),
    /cloudflareaccess\.com/,
  );
});

test("local placeholder D1 id is forbidden in production config", () => {
  assert.throws(
    () =>
      buildCloudflareProductionConfig({
        ...VALID_ENV,
        CF_D1_DATABASE_ID: "00000000-0000-4000-8000-000000000000",
      }),
    /placeholder database id/,
  );
});

test("bootstrap admin is optional after initial provisioning", () => {
  const { INTERNAL_BOOTSTRAP_ADMIN_EMAIL: _removed, ...withoutBootstrap } = VALID_ENV;
  const config = buildCloudflareProductionConfig(withoutBootstrap);
  assert.equal("INTERNAL_BOOTSTRAP_ADMIN_EMAIL" in config.vars, false);
});

test("API tokens and account credentials are never copied into Worker vars", () => {
  const config = buildCloudflareProductionConfig({
    ...VALID_ENV,
    CLOUDFLARE_API_TOKEN: "top-secret-token",
    CLOUDFLARE_ACCOUNT_ID: "account-id",
  });
  const serialized = JSON.stringify(config);
  assert.equal(serialized.includes("top-secret-token"), false);
  assert.equal(serialized.includes("account-id"), false);
});
