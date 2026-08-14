# ADR — Exact Version without mandatory media fingerprint

Status: **Design recorded only — intentionally deferred from P4-03C2A**

## Context

The current `title_versions.content_fingerprint` is `NOT NULL`, and `ReviewVersion` describes it as a fingerprint supplied by a media ingestion layer for the exact cut. The product does not currently ingest the film media itself, so making that proof mandatory for every future exact-version decision can create an unreachable gate.

P4-03C2A does **not** change this schema. The immediate checkpoint fixes asymmetric decision semantics because version identity alone would not solve incomplete evidence coverage.

## Proposed future identity model

A future checkpoint may identify a version from documented release metadata when no media file exists:

- `title_id`;
- `version_type` (`theatrical`, `extended`, `directors_cut`, `edited`, `broadcast`, `streaming`, `physical_release`, ...);
- release date/year;
- country/market;
- runtime;
- distributor/edition/platform/language when applicable;
- identity provenance sources;
- conflict state;
- confidence state (`unverified`, `documented`, `multi_source_documented`, `fingerprint_verified`, `conflicted`);
- optional `content_fingerprint` when real media ingestion exists.

## Fail-closed rule

A version-specific decision must still fail closed whenever multiple plausible cuts remain, identity evidence conflicts, or the available metadata cannot distinguish theatrical/extended/edited/country variants. Runtime alone is never sufficient when two versions can share similar durations.

A real media fingerprint remains the strongest proof when a media-ingestion path exists, but this ADR proposes that it should not be the only theoretically possible proof of version identity.

## Future schema impact

If approved in a later checkpoint, likely impact includes nullable `content_fingerprint`, a partial unique index for non-null fingerprints, explicit version-identity fields, and provenance/assertion tables. None of those migrations are part of P4-03C2A.
