# قبل المشاهدة — PROJECT_HANDOFF

Last updated: 2026-08-14 (Africa/Cairo)

## Baseline provenance

- Repository: `Hosyss/qabl-almushahada`.
- GitHub source commit verified before local work: `fc1b7a3d183dc6f7d419c14abb39b21d131763d6` (`P4-03C1 add three editorial analyses`).
- The working tree was created from the official GitHub source archive for that commit.
- A local temporary Git baseline commit was created only to track diffs in the active workspace. Its SHA is workspace-specific and is **not** claimed to be the GitHub commit.
- The local review workspace has no Git remote; publishing for CI uses a dedicated GitHub review branch created from the verified source commit.
- The source archive baseline remains unchanged; all C2A changes are isolated to the review branch.

## Baseline gates before C2A

- Engine: `259/259` passed.
- Migrations: passed.
- Lint: environment-blocked because `eslint` is unavailable locally.
- Production build: environment-blocked because `vinext` is unavailable locally.

## Current checkpoint

`P4-03C2A — Asymmetric Decision Semantics` + `P4-03C2B — Original Editorial Artwork`

Draft-review branch only. No merge to `main`, D1 write, or Production deploy.

### Editorial artwork

- Seven original, project-specific illustrative covers exist for the seven published editorial titles.
- Assets are local WebP files at `720×960` under `public/artwork/`; no remote image API or hotlink is used.
- `lib/title-artwork.ts` is the only title-to-artwork allowlist. Unknown titles receive a neutral fallback and never inherit another title's artwork.
- The artwork appears on home cards, directory cards, search results, suggestions, title pages, and review/editorial pages.
- User-facing disclosure: `غلاف توضيحي أصلي — ليس الملصق الرسمي`.
- Artwork is presentational only. It never enters D1, evidence coverage, or decision logic.
- Generation/source notes and the seven prompt concepts are recorded in `docs/P4_03_C2B_EDITORIAL_ARTWORK.md`.

### Decision semantics

- A verified, source/quality-eligible `present` fact with a structured severity above a family limit can produce `exceeds_family_limits` even when unrelated axes remain unknown.
- Unknown axes never become `none` and do not erase an already proven exceedance.
- `within_family_limits` requires exact-version identity, an explicitly passed Full Evidence gate, and full eligible coverage of all ten categories with no unknown/conflicted/ineligible/severity-missing category.
- If there is no proven exceedance and incomplete evidence could still change the result, the result is `insufficient_data`.
- Decision metadata distinguishes `work_level` from `exact_version` and records `verified_present_evidence`, `full_coverage`, or `incomplete_evidence` basis.

## Jurassic Park pilot — actual result

Only `jurassic-park-1993-editorial-c1-v1` is wired into the new public work-level panel.

Actual result remains:

- outcome: `insufficient_data`
- decision scope: `work_level`
- decision basis: `incomplete_evidence`

Reason:

- the persisted C1 record passes its editorial publication quality gate;
- the current source policy allows the fixed Wikipedia revision to be used as persisted `analysis_evidence`;
- that source supports `fear` and `violence` as present at work level;
- the C1 record does **not** contain a structured decision-eligible numeric severity for either category, so C2A does not invent one;
- Kids-In-Mind remains link-only and cannot determine the decision;
- `language`, `sexualContent`, and `substances` therefore remain decision-unknown despite their editorial references;
- `bullying`, `discrimination`, `selfHarm`, `grief`, and `flashingLights` remain explicitly unresolved.

The UI states that the conclusion is based on work-level information and that details may vary by display version. It does not claim a Full Version Decision.

## Family settings wording

- Public preset label changed to `إعدادات افتراضية قابلة للتعديل`.
- The policy explicitly says it is not an official/scientific/universal age rating.
- No `مناسب من عمر X` output was added.
- If valid local family settings exist, the Jurassic panel identifies them as saved overrides layered on the default limits for categories the current settings UI cannot customize; it does not call that full customization.
- Decision metadata distinguishes `defaults_only`, `defaults_with_overrides`, and `fully_custom`, while retaining `usedDefaultPreferences` for compatibility.
- If no local settings exist, the panel does not silently invent a child age or auto-apply a hidden preset.

## Exact Version

No schema or migration change was made. The alternative documented-version identity design is recorded only in `docs/ADR_P4_03C2A_EXACT_VERSION.md` for a later checkpoint.

## Final verification completed

- C2A focused regression: `12/12` passed after the final presentation hardening.
- Full Engine suite after C2B: `273/273` passed, including two artwork allowlist/asset regressions.
- Migrations after C2B: passed.
- Core C2A TypeScript source-only check using global TypeScript 5.8.3: passed.
- `git diff --check`: passed.
- Full Evidence regression remains green.
- Partial Editorial fallback remains green.
- Jurassic UI is server-hard-scoped to Jurassic; the other six editorial titles do not mount the C2A client panel.
- Public C2A metadata is rendered with Arabic labels instead of exposing raw internal tokens, and the Jurassic headline now fails closed if publication quality is ever not passed.

### GitHub CI gates

GitHub Actions for artwork commit `c6c6369ef6e3ce1508b079fc05eea897f707eb63` completed successfully:

- `npm ci`: passed.
- Engine: `273/273` passed.
- Migrations and DB regressions: passed.
- `npm run lint:local`: passed.
- `npm run build:local`: passed.
- Public Quality checkpoint: passed.
- B4 Editorial Persistence checkpoint: passed.

The remaining merge-readiness blocker is visual Desktop/Mobile QA on a rendered build.

A broader source-only TypeScript traversal through the existing editorial module also reaches the pre-existing baseline diagnostic in `lib/review-engine/hydrate.ts:159`; the same diagnostic is reproducible on untouched `base`, so it is not introduced by C2A.

## Scope verification

- No files under `data/` changed.
- No `db/schema` or migration files changed.
- No eighth title was added.
- No image pipeline was added.
- No Exact Version migration was added.
- The local workspace has no remote; the dedicated GitHub review branch is the only authorized external write for CI.
- No merge, Production deploy, or D1 write occurred.

## Required next review

Owner review is required before any merge/deploy. The draft PR must run `lint:local` and `build:local` with full dependencies; merge readiness also requires review of the final diff and UX in a real built application.
