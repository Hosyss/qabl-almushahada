import type { Severity } from "./review-engine/index.ts";

export const LOCAL_FAMILY_SETTINGS_STORAGE_KEY = "qabl-almushahada.family-settings.v1";

export interface LocalFamilySettings {
  childAge: number;
  fearLimit: Severity;
  avoidBullying: boolean;
}

interface StoredLocalFamilySettings extends LocalFamilySettings {
  version: 1;
}

const STORED_KEYS = ["avoidBullying", "childAge", "fearLimit", "version"] as const;

export function parseLocalFamilySettings(raw: string | null): LocalFamilySettings | null {
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isPlainObject(value)) return null;
  const keys = Object.keys(value).sort();
  if (keys.length !== STORED_KEYS.length || keys.some((key, index) => key !== STORED_KEYS[index])) {
    return null;
  }

  if (value.version !== 1) return null;
  if (!isValidChildAge(value.childAge)) return null;
  if (!isValidFearLimit(value.fearLimit)) return null;
  if (typeof value.avoidBullying !== "boolean") return null;

  return {
    childAge: value.childAge,
    fearLimit: value.fearLimit,
    avoidBullying: value.avoidBullying,
  };
}

export function serializeLocalFamilySettings(settings: LocalFamilySettings): string {
  if (!isValidChildAge(settings.childAge)) {
    throw new RangeError("childAge must be an integer between 3 and 17");
  }
  if (!isValidFearLimit(settings.fearLimit)) {
    throw new RangeError("fearLimit must be an integer between 0 and 3");
  }
  if (typeof settings.avoidBullying !== "boolean") {
    throw new TypeError("avoidBullying must be a boolean");
  }

  const stored: StoredLocalFamilySettings = {
    version: 1,
    childAge: settings.childAge,
    fearLimit: settings.fearLimit,
    avoidBullying: settings.avoidBullying,
  };
  return JSON.stringify(stored);
}

function isValidChildAge(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 3 && Number(value) <= 17;
}

function isValidFearLimit(value: unknown): value is Severity {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 3;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
