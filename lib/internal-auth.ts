export const INTERNAL_AUTH_MODES = ["chatgpt", "cloudflare_access"] as const;

export type InternalAuthMode = (typeof INTERNAL_AUTH_MODES)[number];

export interface InternalAuthenticatedUser {
  provider: InternalAuthMode;
  email: string;
  displayName: string;
  fullName: string | null;
}

export type InternalAuthErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_TOKEN"
  | "CONFIGURATION_ERROR";

export class InternalAuthError extends Error {
  constructor(
    public readonly code: InternalAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "InternalAuthError";
  }
}

export async function authenticateInternalRequest(input: {
  headers: Headers;
  env: Record<string, unknown>;
  fetcher?: typeof fetch;
  nowMs?: number;
}): Promise<InternalAuthenticatedUser> {
  const mode = parseAuthMode(input.env.INTERNAL_AUTH_MODE);

  if (mode === "chatgpt") {
    return authenticateChatGPTHeaders(input.headers);
  }

  return authenticateCloudflareAccess({
    headers: input.headers,
    env: input.env,
    fetcher: input.fetcher ?? fetch,
    nowMs: input.nowMs ?? Date.now(),
  });
}

export function parseAuthMode(value: unknown): InternalAuthMode {
  if (value === "chatgpt" || value === "cloudflare_access") return value;
  throw new InternalAuthError(
    "CONFIGURATION_ERROR",
    "INTERNAL_AUTH_MODE must be explicitly set to chatgpt or cloudflare_access.",
  );
}

function authenticateChatGPTHeaders(headers: Headers): InternalAuthenticatedUser {
  const email = normalizeEmail(headers.get("oai-authenticated-user-email"));
  const encodedFullName = headers.get("oai-authenticated-user-full-name");
  const encoding = headers.get("oai-authenticated-user-full-name-encoding");
  const fullName =
    encodedFullName && encoding === "percent-encoded-utf-8"
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    provider: "chatgpt",
    email,
    displayName: fullName ?? email,
    fullName,
  };
}

async function authenticateCloudflareAccess(input: {
  headers: Headers;
  env: Record<string, unknown>;
  fetcher: typeof fetch;
  nowMs: number;
}): Promise<InternalAuthenticatedUser> {
  const token = input.headers.get("cf-access-jwt-assertion")?.trim();
  if (!token) {
    throw new InternalAuthError("UNAUTHENTICATED", "Missing Cloudflare Access JWT.");
  }

  const teamDomain = parseTeamDomain(input.env.CF_ACCESS_TEAM_DOMAIN);
  const audience = requireConfigString(input.env.CF_ACCESS_AUD, "CF_ACCESS_AUD");
  const payload = await verifyCloudflareAccessJwt({
    token,
    teamDomain,
    audience,
    fetcher: input.fetcher,
    nowMs: input.nowMs,
  });

  const email = normalizeEmail(payload.email);
  const fullName = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : null;
  return {
    provider: "cloudflare_access",
    email,
    displayName: fullName ?? email,
    fullName,
  };
}

export async function verifyCloudflareAccessJwt(input: {
  token: string;
  teamDomain: string;
  audience: string;
  fetcher?: typeof fetch;
  nowMs?: number;
}): Promise<Record<string, unknown>> {
  const fetcher = input.fetcher ?? fetch;
  const nowMs = input.nowMs ?? Date.now();
  const parts = input.token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new InternalAuthError("INVALID_TOKEN", "Malformed Cloudflare Access JWT.");
  }

  const header = parseJsonPart(parts[0], "JWT header");
  const payload = parseJsonPart(parts[1], "JWT payload");
  if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) {
    throw new InternalAuthError("INVALID_TOKEN", "Unsupported Cloudflare Access JWT header.");
  }

  validateClaims(payload, input.teamDomain, input.audience, nowMs);

  const response = await fetcher(`${input.teamDomain}/cdn-cgi/access/certs`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new InternalAuthError("INVALID_TOKEN", "Unable to load Cloudflare Access signing keys.");
  }

  const jwks = await response.json();
  if (typeof jwks !== "object" || jwks === null || !Array.isArray((jwks as { keys?: unknown }).keys)) {
    throw new InternalAuthError("INVALID_TOKEN", "Cloudflare Access JWKS response is invalid.");
  }

  const key = (jwks as { keys: Array<Record<string, unknown>> }).keys.find(
    (candidate) => candidate.kid === header.kid && candidate.kty === "RSA",
  );
  if (!key) {
    throw new InternalAuthError("INVALID_TOKEN", "Cloudflare Access signing key was not found.");
  }

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      "jwk",
      key as JsonWebKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    throw new InternalAuthError("INVALID_TOKEN", "Cloudflare Access signing key is invalid.");
  }

  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) {
    throw new InternalAuthError("INVALID_TOKEN", "Cloudflare Access JWT signature is invalid.");
  }

  return payload;
}

function validateClaims(
  payload: Record<string, unknown>,
  teamDomain: string,
  audience: string,
  nowMs: number,
): void {
  const issuer = payload.iss;
  if (issuer !== teamDomain) {
    throw new InternalAuthError("INVALID_TOKEN", "Cloudflare Access JWT issuer is invalid.");
  }

  const aud = payload.aud;
  const hasAudience = aud === audience || (Array.isArray(aud) && aud.includes(audience));
  if (!hasAudience) {
    throw new InternalAuthError("INVALID_TOKEN", "Cloudflare Access JWT audience is invalid.");
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  const clockSkewSeconds = 60;
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || nowSeconds - clockSkewSeconds >= payload.exp) {
    throw new InternalAuthError("INVALID_TOKEN", "Cloudflare Access JWT is expired or missing exp.");
  }
  if (
    payload.nbf !== undefined &&
    (typeof payload.nbf !== "number" || !Number.isFinite(payload.nbf) || nowSeconds + clockSkewSeconds < payload.nbf)
  ) {
    throw new InternalAuthError("INVALID_TOKEN", "Cloudflare Access JWT is not active yet.");
  }
  if (
    payload.iat !== undefined &&
    (typeof payload.iat !== "number" || !Number.isFinite(payload.iat) || payload.iat > nowSeconds + clockSkewSeconds)
  ) {
    throw new InternalAuthError("INVALID_TOKEN", "Cloudflare Access JWT issued-at value is invalid.");
  }
}

function parseTeamDomain(value: unknown): string {
  const raw = requireConfigString(value, "CF_ACCESS_TEAM_DOMAIN");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InternalAuthError("CONFIGURATION_ERROR", "CF_ACCESS_TEAM_DOMAIN is not a valid URL.");
  }
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".cloudflareaccess.com") ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw new InternalAuthError(
      "CONFIGURATION_ERROR",
      "CF_ACCESS_TEAM_DOMAIN must be an https://<team>.cloudflareaccess.com origin.",
    );
  }
  return url.origin;
}

function requireConfigString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new InternalAuthError("CONFIGURATION_ERROR", `${name} is required.`);
  }
  return value.trim();
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new InternalAuthError("UNAUTHENTICATED", "Authenticated email is missing.");
  }
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new InternalAuthError("UNAUTHENTICATED", "Authenticated email is invalid.");
  }
  return email;
}

function parseJsonPart(part: string, label: string): Record<string, unknown> {
  try {
    const decoded = new TextDecoder().decode(decodeBase64Url(part));
    const parsed = JSON.parse(decoded) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new InternalAuthError("INVALID_TOKEN", `${label} is invalid.`);
  }
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new InternalAuthError("INVALID_TOKEN", "JWT base64url data is invalid.");
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
