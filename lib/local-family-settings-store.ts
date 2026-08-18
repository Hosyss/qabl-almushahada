import { LOCAL_FAMILY_SETTINGS_STORAGE_KEY } from "./local-family-settings.ts";

export type FamilySettingsStorageMode = "local" | "session";

export interface FamilySettingsSessionFallback {
  active: boolean;
  raw: string | null;
}

export interface FamilySettingsStoreSnapshot {
  mode: FamilySettingsStorageMode;
  raw: string | null;
}

export interface FamilySettingsStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type FamilySettingsStorageProvider = () => FamilySettingsStorageLike;

export function createFamilySettingsSessionFallback(): FamilySettingsSessionFallback {
  return { active: false, raw: null };
}

export function readFamilySettingsStoreSnapshot(
  provider: FamilySettingsStorageProvider,
  fallback: FamilySettingsSessionFallback,
): string {
  if (fallback.active) return encodeSnapshot({ mode: "session", raw: fallback.raw });

  try {
    return encodeSnapshot({
      mode: "local",
      raw: provider().getItem(LOCAL_FAMILY_SETTINGS_STORAGE_KEY),
    });
  } catch {
    fallback.active = true;
    return encodeSnapshot({ mode: "session", raw: fallback.raw });
  }
}

export function writeFamilySettingsStore(
  provider: FamilySettingsStorageProvider,
  fallback: FamilySettingsSessionFallback,
  raw: string,
): FamilySettingsStorageMode {
  if (fallback.active) {
    fallback.raw = raw;
    return "session";
  }

  try {
    provider().setItem(LOCAL_FAMILY_SETTINGS_STORAGE_KEY, raw);
    fallback.raw = null;
    return "local";
  } catch {
    fallback.active = true;
    fallback.raw = raw;
    return "session";
  }
}

export function clearFamilySettingsStore(
  provider: FamilySettingsStorageProvider,
  fallback: FamilySettingsSessionFallback,
): FamilySettingsStorageMode {
  fallback.raw = null;

  try {
    provider().removeItem(LOCAL_FAMILY_SETTINGS_STORAGE_KEY);
    fallback.active = false;
    return "local";
  } catch {
    fallback.active = true;
    return "session";
  }
}

export function decodeFamilySettingsStoreSnapshot(value: string): FamilySettingsStoreSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { mode: "session", raw: null };
  }

  if (!Array.isArray(parsed) || parsed.length !== 2) {
    return { mode: "session", raw: null };
  }
  const [mode, raw] = parsed;
  if ((mode !== "local" && mode !== "session") || (raw !== null && typeof raw !== "string")) {
    return { mode: "session", raw: null };
  }
  return { mode, raw };
}

function encodeSnapshot(snapshot: FamilySettingsStoreSnapshot): string {
  return JSON.stringify([snapshot.mode, snapshot.raw]);
}
