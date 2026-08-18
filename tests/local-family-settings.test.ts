import assert from "node:assert/strict";
import test from "node:test";

import {
  LOCAL_FAMILY_SETTINGS_STORAGE_KEY,
  parseLocalFamilySettings,
  serializeLocalFamilySettings,
} from "../lib/local-family-settings.ts";
import {
  clearFamilySettingsStore,
  createFamilySettingsSessionFallback,
  decodeFamilySettingsStoreSnapshot,
  readFamilySettingsStoreSnapshot,
  writeFamilySettingsStore,
  type FamilySettingsStorageLike,
} from "../lib/local-family-settings-store.ts";

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

test("family settings store uses persistent local storage when available", () => {
  const values = new Map<string, string>();
  const storage: FamilySettingsStorageLike = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
  const fallback = createFamilySettingsSessionFallback();
  const raw = serializeLocalFamilySettings({ childAge: 10, fearLimit: 1, avoidBullying: false });

  assert.equal(writeFamilySettingsStore(() => storage, fallback, raw), "local");
  assert.deepEqual(decodeFamilySettingsStoreSnapshot(readFamilySettingsStoreSnapshot(() => storage, fallback)), {
    mode: "local",
    raw,
  });
  assert.equal(clearFamilySettingsStore(() => storage, fallback), "local");
  assert.deepEqual(decodeFamilySettingsStoreSnapshot(readFamilySettingsStoreSnapshot(() => storage, fallback)), {
    mode: "local",
    raw: null,
  });
});

test("family settings store falls back to session memory when local storage is unavailable", () => {
  const unavailable = (): FamilySettingsStorageLike => {
    throw new DOMException("Blocked", "SecurityError");
  };
  const fallback = createFamilySettingsSessionFallback();
  const raw = serializeLocalFamilySettings({ childAge: 8, fearLimit: 0, avoidBullying: true });

  assert.deepEqual(decodeFamilySettingsStoreSnapshot(readFamilySettingsStoreSnapshot(unavailable, fallback)), {
    mode: "session",
    raw: null,
  });
  assert.equal(writeFamilySettingsStore(unavailable, fallback, raw), "session");
  assert.deepEqual(decodeFamilySettingsStoreSnapshot(readFamilySettingsStoreSnapshot(unavailable, fallback)), {
    mode: "session",
    raw,
  });
  assert.equal(clearFamilySettingsStore(unavailable, fallback), "session");
  assert.deepEqual(decodeFamilySettingsStoreSnapshot(readFamilySettingsStoreSnapshot(unavailable, fallback)), {
    mode: "session",
    raw: null,
  });
});

test("a write quota failure switches to session memory without losing the selected settings", () => {
  const storage: FamilySettingsStorageLike = {
    getItem: () => null,
    setItem: () => { throw new DOMException("Full", "QuotaExceededError"); },
    removeItem: () => undefined,
  };
  const fallback = createFamilySettingsSessionFallback();
  const raw = serializeLocalFamilySettings({ childAge: 13, fearLimit: 2, avoidBullying: false });

  assert.equal(writeFamilySettingsStore(() => storage, fallback, raw), "session");
  assert.deepEqual(decodeFamilySettingsStoreSnapshot(readFamilySettingsStoreSnapshot(() => storage, fallback)), {
    mode: "session",
    raw,
  });
});
