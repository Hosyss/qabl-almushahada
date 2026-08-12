# P2Q-05 — Internal Quality Dashboard Checkpoint

Status: technically complete on `agent/p2q-05-quality-dashboard`, pending final branch CI, PR merge, and post-merge `main` CI.

## Goal

Expose the trust evidence already produced by P2Q-01 through P2Q-04 without turning it into a reviewer score, leaderboard, or new source of authority.

The dashboard is **read-only**. It does not resolve holds, approve reviews, reactivate reviewers, or mutate calibration state.

## Route and access

- Route: `/internal/quality`.
- A visible shortcut is rendered from `/internal` only for:
  - active `admin` accounts; or
  - active `editorial_reviewer` accounts whose reviewer identity is also active.
- The route repeats the authorization check server-side. Knowing the URL does not bypass access control.
- `reviewer` and `review_coordinator` roles are rejected.
- suspended accounts and non-active editorial reviewer identities are rejected.

## Evidence displayed

### Safety Holds

The dashboard reads append-only `reviewer_safety_hold_placed` / `reviewer_safety_hold_resolved` events and displays:

- reviewer label and identity;
- automatic-vs-human-investigation source;
- policy version;
- trigger codes;
- unresolved/resolved operational state;
- creation time.

Known P2Q-04 trigger codes are translated for the Arabic UI. Unknown future codes remain visible as their stored code instead of being silently hidden.

### Conflicted bundles

Current `review_bundles.status = 'conflicted'` rows are shown with:

- title/version identity;
- platform/language;
- bundle revision;
- active report count;
- latest report type/status;
- last update time.

### Independent-audit calibration

Per reviewer, the dashboard derives counts directly from completed `review_audit_outcomes` and findings:

- completed sample size;
- confirmed audits;
- correction-required audits;
- audits containing missed events;
- audits containing severity differences;
- raw missed-event / severity-difference counts;
- maximum observed severity delta.

The existing P2Q-02 minimum-sample rule remains authoritative: normalized rates are **not displayed before 20 completed audits**. At 20+, rates are shown in basis-points-derived percentages.

There is no composite `trustScore`, quality score, rank, percentile, or competitive ordering.

### Reference calibration

The latest P2Q-03 reference-calibration attempt for each reviewer is displayed with:

- purpose (`initial`, `reactivation`, `drift`);
- state (`in_progress`, `passed`, `failed`);
- category agreement;
- observation recall/precision;
- missed high-sensitivity count;
- maximum severity delta;
- stored blocker codes.

## Fail-closed parsing

`lib/internal-quality-dashboard.ts` validates stored hold/resolution payloads and calibration aggregates before presentation. Unknown stored states, malformed JSON, duplicate trigger codes, impossible sample counts, invalid basis points, or out-of-range severity deltas fail closed rather than being normalized silently in the UI.

## Read service

`db/internal-quality-dashboard-service.ts` is read-only and queries existing tables only. P2Q-05 adds **no product table and no migration**.

A dedicated SQLite verifier applies all migrations and then executes the quality-dashboard query shapes against the migrated schema. This catches SQL/runtime drift that TypeScript build alone cannot detect.

## UI boundary

The page deliberately says that it is evidence, not reviewer ranking. Mutating workflows remain in their existing protected services/actions; the quality route does not expose hold resolution or activation buttons.

The `/internal` shortcut is rendered server-side according to the already-loaded actor role. The quality route performs its own independent server-side authorization check again.

## Verification

Current database shape remains:

- **18 migration files**;
- **24 product tables**.

Required gates for the final branch head:

- `npm run test:engine`;
- `npm run test:migrations` (including `verify-internal-quality-dashboard.mjs`);
- `npm run lint:local`;
- `npm run build:local`.

P2Q-05 is not considered merged until the PR CI and post-merge `main` CI are both green.
