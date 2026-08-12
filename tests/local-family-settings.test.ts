import assert from "node:assert/strict";
import test from "node:test";

import {
  LOCAL_FAMILY_SETTINGS_STORAGE_KEY,
  parseLocalFamilySettings,
  serializeLocalFamilySettings,
} from "../lib/local-family-settings.ts";

test("local family settings round-trip only the approved non-identifying fields", () => {
  const serialized = serializeLocalFamilySettings({
    childAge: 9,
    fearLimit: 2,
    avoidBullying: true,
  });

  assert.equal(LOCAL_FAMILY_SETTINGS_STORAGE_KEY, "qabl-almushahada.family-settings.v1");
  assert.deepEqual(JSON.parse(serialized), {
    version: 1,
    childAge: 9,
    fearLimit: 2,
    avoidBullying: true,
  });
  assert.deepEqual(parseLocalFamilySettings(serialized), {
    childAge: 9,
    fearLimit: 2,
    avoidBullying: true,
  });
  assert.equal(/name|birth|dob/i.test(serialized), false);
});

test("stored family settings reject extra fields instead of silently retaining personal data", () => {
  assert.equal(
    parseLocalFamilySettings(JSON.stringify({
      version: 1,
      childAge: 9,
      fearLimit: 2,
      avoidBullying: true,
      childName: "example",
    })),
    null,
  );
  assert.equal(
    parseLocalFamilySettings(JSON.stringify({
      version: 1,
      childAge: 9,
      fearLimit: 2,
      avoidBullying: true,
      dateOfBirth: "2017-01-01",
    })),
    null,
  );
});

test("stored family settings fail safely when malformed, stale, or outside UI bounds", () => {
  assert.equal(parseLocalFamilySettings(null), null);
  assert.equal(parseLocalFamilySettings("not-json"), null);
  assert.equal(parseLocalFamilySettings(JSON.stringify({ version: 2, childAge: 9, fearLimit: 2, avoidBullying: true })), null);
  assert.equal(parseLocalFamilySettings(JSON.stringify({ version: 1, childAge: 2, fearLimit: 2, avoidBullying: true })), null);
  assert.equal(parseLocalFamilySettings(JSON.stringify({ version: 1, childAge: 9, fearLimit: 4, avoidBullying: true })), null);
  assert.equal(parseLocalFamilySettings(JSON.stringify({ version: 1, childAge: 9, fearLimit: 2, avoidBullying: "yes" })), null);

  assert.throws(
    () => serializeLocalFamilySettings({ childAge: 18, fearLimit: 2, avoidBullying: true }),
    /childAge/,
  );
  assert.throws(
    () => serializeLocalFamilySettings({ childAge: 9, fearLimit: 4, avoidBullying: true }),
    /fearLimit/,
  );
});
