import assert from "node:assert/strict";
import test from "node:test";

import {
  InternalAuthError,
  authenticateInternalRequest,
  verifyCloudflareAccessJwt,
} from "../lib/internal-auth.ts";

const TEAM_DOMAIN = "https://example.cloudflareaccess.com";
const AUDIENCE = "test-audience";
const NOW_MS = Date.UTC(2026, 7, 12, 10, 0, 0);

function expectAuthError(code: InternalAuthError["code"]) {
  return (error: unknown) => error instanceof InternalAuthError && error.code === code;
}

test("internal auth mode is mandatory and fails closed", async () => {
  await assert.rejects(
    () => authenticateInternalRequest({ headers: new Headers(), env: {} }),
    expectAuthError("CONFIGURATION_ERROR"),
  );
});

test("chatgpt auth is used only when explicitly configured", async () => {
  const headers = new Headers({
    "oai-authenticated-user-email": " Reviewer@Example.COM ",
    "oai-authenticated-user-full-name": "مراجع%20مستقل",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });

  const user = await authenticateInternalRequest({
    headers,
    env: { INTERNAL_AUTH_MODE: "chatgpt" },
  });
  assert.equal(user.provider, "chatgpt");
  assert.equal(user.email, "reviewer@example.com");
  assert.equal(user.fullName, "مراجع مستقل");
});

test("cloudflare access mode ignores forged OpenAI identity when Access JWT is missing", async () => {
  const headers = new Headers({
    "oai-authenticated-user-email": "attacker@example.com",
  });
  await assert.rejects(
    () =>
      authenticateInternalRequest({
        headers,
        env: {
          INTERNAL_AUTH_MODE: "cloudflare_access",
          CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
          CF_ACCESS_AUD: AUDIENCE,
        },
      }),
    expectAuthError("UNAUTHENTICATED"),
  );
});

test("valid Cloudflare Access RS256 JWT is verified before email is trusted", async () => {
  const { token, jwks } = await createSignedToken({ email: "Editor@Example.com" });
  const user = await authenticateInternalRequest({
    headers: new Headers({ "cf-access-jwt-assertion": token }),
    env: {
      INTERNAL_AUTH_MODE: "cloudflare_access",
      CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
      CF_ACCESS_AUD: AUDIENCE,
    },
    fetcher: async () => jsonResponse(jwks),
    nowMs: NOW_MS,
  });

  assert.equal(user.provider, "cloudflare_access");
  assert.equal(user.email, "editor@example.com");
});

test("tampering with Cloudflare Access payload invalidates the signature", async () => {
  const { token, jwks } = await createSignedToken({ email: "editor@example.com" });
  const [header, payload, signature] = token.split(".");
  const decoded = JSON.parse(new TextDecoder().decode(decode(payload))) as Record<string, unknown>;
  decoded.email = "attacker@example.com";
  const tampered = `${header}.${encodeJson(decoded)}.${signature}`;

  await assert.rejects(
    () =>
      verifyCloudflareAccessJwt({
        token: tampered,
        teamDomain: TEAM_DOMAIN,
        audience: AUDIENCE,
        fetcher: async () => jsonResponse(jwks),
        nowMs: NOW_MS,
      }),
    expectAuthError("INVALID_TOKEN"),
  );
});

test("wrong audience and expired Cloudflare Access tokens fail closed", async () => {
  const wrongAudience = await createSignedToken({ email: "editor@example.com", aud: "other" });
  await assert.rejects(
    () =>
      verifyCloudflareAccessJwt({
        token: wrongAudience.token,
        teamDomain: TEAM_DOMAIN,
        audience: AUDIENCE,
        fetcher: async () => jsonResponse(wrongAudience.jwks),
        nowMs: NOW_MS,
      }),
    expectAuthError("INVALID_TOKEN"),
  );

  const expired = await createSignedToken({
    email: "editor@example.com",
    exp: Math.floor(NOW_MS / 1000) - 120,
  });
  await assert.rejects(
    () =>
      verifyCloudflareAccessJwt({
        token: expired.token,
        teamDomain: TEAM_DOMAIN,
        audience: AUDIENCE,
        fetcher: async () => jsonResponse(expired.jwks),
        nowMs: NOW_MS,
      }),
    expectAuthError("INVALID_TOKEN"),
  );
});

async function createSignedToken(overrides: {
  email: string;
  aud?: string;
  exp?: number;
}) {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const kid = "test-key";
  const publicJwk = (await crypto.subtle.exportKey("jwk", keyPair.publicKey)) as JsonWebKey & {
    kid?: string;
    alg?: string;
    use?: string;
  };
  publicJwk.kid = kid;
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";

  const nowSeconds = Math.floor(NOW_MS / 1000);
  const header = encodeJson({ alg: "RS256", typ: "JWT", kid });
  const payload = encodeJson({
    iss: TEAM_DOMAIN,
    aud: overrides.aud ?? AUDIENCE,
    iat: nowSeconds - 30,
    nbf: nowSeconds - 30,
    exp: overrides.exp ?? nowSeconds + 600,
    email: overrides.email,
  });
  const signingInput = `${header}.${payload}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      keyPair.privateKey,
      new TextEncoder().encode(signingInput),
    ),
  );

  return {
    token: `${signingInput}.${encode(signature)}`,
    jwks: { keys: [publicJwk] },
  };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function encodeJson(value: unknown): string {
  return encode(new TextEncoder().encode(JSON.stringify(value)));
}

function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
