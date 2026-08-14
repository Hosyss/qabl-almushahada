# P4-03C2A — Asymmetric Decision Semantics

Status: **local implementation only; not committed, pushed, merged, written to D1, or deployed**.

## Why the decision gate is asymmetric

A negative family-settings result and a positive suitability result do not require the same proof burden.

### `exceeds_family_limits`

A result may be negative when at least one category has:

- `present` evidence;
- a source that is currently permitted for persisted decision evidence;
- a structured, decision-eligible severity;
- no quality/provenance disqualification for the evidence used by the decision; and
- severity above the family-selected limit, or a verified blocked flag.

Unrelated unknown categories do not erase an already proven exceedance.

### `within_family_limits`

A positive result remains fail-closed and requires:

- `exact_version` scope with established exact-version identity;
- the existing Full Evidence publication gate has passed explicitly;
- all ten content categories resolved;
- every category decision-eligible under the applicable source/quality rules;
- no `unknown`, `conflicted`, ineligible-present, or severity-missing category; and
- no category or blocked flag exceeding the family's limits.

### `insufficient_data`

This remains the result when no eligible exceedance has been proven and incomplete evidence could still change the decision. `unknown` is never normalized to `none`.

## Decision metadata

The local C2A result records:

- `outcome`: `exceeds_family_limits` / `within_family_limits` / `insufficient_data`;
- `decisionScope`: `work_level` / `exact_version`;
- `decisionBasis`: `verified_present_evidence` / `full_coverage` / `incomplete_evidence`;
- `usedDefaultPreferences`;
- `preferenceMode`: `defaults_only` / `defaults_with_overrides` / `fully_custom`;
- explicit `fullEvidenceGatePassed` input is required before any positive exact-version result;
- determining categories;
- attention categories;
- unknown/conflicted/ineligible/severity-missing categories;
- source IDs and evidence IDs attached to determining reasons.

The public Arabic wording maps the outcomes to «يتجاوز حدودك»، «ضمن حدودك»، or «المعلومات غير كافية». A category exactly at a selected limit is surfaced as «يحتاج انتباهك» without inventing a fourth persistence state.

## Work-level versus exact-version

P4-03 partial editorial evidence is allowed to support only a `work_level` caution or exceedance. The UI must display:

> هذا الاستنتاج مبني على معلومات موثقة عن العمل، وقد تختلف بعض التفاصيل حسب نسخة العرض.

Work-level evidence can never produce `within_family_limits` and is never presented as a Full Version Decision.

## Source policy

Only sources that are currently permitted for persisted `analysis_evidence` may determine C2A. Link-only third-party review references remain visible as editorial context but cannot determine a result.

For the current Jurassic Park C1 fixture:

- Wikipedia fixed revision, CC BY-SA 4.0, is usable under the current source policy and supports `fear` and `violence` as present at work level.
- Kids-In-Mind is `link_only_factual_reference`; it is excluded from decision evidence.
- `language`, `substances`, and `sexualContent` therefore remain decision-unknown despite the editorial links.
- `bullying`, `discrimination`, `selfHarm`, `grief`, and `flashingLights` remain explicitly unresolved.
- the C1 record does not contain a structured numeric severity for the permitted `fear`/`violence` claims, so C2A does not invent one.

Actual Jurassic Park result in this checkpoint: `insufficient_data`, `decisionScope=work_level`, `decisionBasis=incomplete_evidence`.

## Family preferences wording

The existing preset remains code-compatible, but the public label is **«إعدادات افتراضية قابلة للتعديل»**. It is explicitly not a scientific, governmental, or universal age rating. C2A adds no «مناسب من عمر X» age-band output.

When valid local family settings exist, the Jurassic panel applies the saved age/fear/bullying overrides on top of the existing default limits for the remaining categories. It says explicitly that this is **defaults with overrides**, not full customization. When no local settings exist, it does not silently invent a child age and explicitly says that no preset was auto-applied.

## Non-goals

- no Exact Version schema migration;
- no `contentFingerprint` relaxation in production;
- no image pipeline;
- no eighth title;
- no changes to the other six editorial titles;
- no D1 write or deployment.

## Presentation hardening

Public UI renders Arabic labels for outcome/scope/basis instead of raw internal enum tokens. The Jurassic work-level headline is conditional on the persisted editorial publication quality gate: if that gate fails, the panel explicitly says the record is not eligible for decision use and does not continue to state that content is verified for decision purposes.
