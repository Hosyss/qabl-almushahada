# P2Q-04 — Reviewer Safety Hold Checkpoint

Status: technically complete on `agent/p2q-04-automatic-safety-holds`, pending final documentation CI, PR review, merge, and post-merge `main` CI.

## Purpose

P2Q-04 temporarily removes a reviewer identity from all current trust roles when independent audit evidence crosses explicit safety thresholds or when an active Admin opens a documented collusion-suspicion investigation. A hold is a fail-closed operational control, not a factual accusation and not a permanent ban.

## Automatic policy — `2026-08-12.v1`

The pure policy lives in `lib/reviewer-safety-hold.ts` and has no composite trust score or ranking.

Immediate hold on the newest completed independent audit:

- at least one missed high-sensitivity event; or
- maximum severity difference = 3.

Aggregate rules are disabled until 20 completed audits exist in the reviewer’s current active epoch. In the rolling latest 20, a hold is required for any of:

- 5 `correction_required` audits;
- 3 audits containing missed events;
- 3 audits containing severity differences of at least 2.

Only the latest 20 are used for aggregate rules. Historical evidence remains immutable and auditable, but evidence from a remediated previous active epoch cannot repeatedly re-trigger the same reviewer forever.

## Database enforcement

Safety hold and resolution events are stored in the existing append-only `internal_audit_events` ledger rather than duplicating current state in new product tables.

SQLite guards enforce that:

- automatic hold events must reference a completed audit outcome for the same subject reviewer and auditor;
- manual collusion-suspicion holds require an active Admin and stored audit evidence IDs;
- every cited manual evidence ID must exist and at least one must be linked to the target reviewer;
- only one unresolved hold may exist for a reviewer;
- every valid hold suspends both the reviewer identity and matching internal account;
- unresolved holds block reviewer activation and reference reactivation/drift attempts;
- only an active Admin may write one human resolution for a hold;
- human resolution alone does not reactivate the reviewer;
- a fresh P2Q-03 reference calibration remains required before Admin activation;
- hold and resolution history cannot be updated or deleted.

## Current trust invalidation

A hold fails closed on any current bundle where the held identity contributes trust as:

- a current reviewer assignment;
- the current editorial approver; or
- the independent auditor who confirmed a selected current submission.

Those affected bundles become `conflicted` and lose `current_approval_id`; historical approvals and submissions remain intact. Unrelated bundles are deliberately left unchanged.

The bundle that produced the triggering `correction_required` audit is excluded from the generic invalidation trigger so the same correction transaction can finish: the assignment can still move to `changes_requested` and the bundle can complete its `under_review` transition after the automatic hold is placed.

## Active epoch anchor

While a reviewer remains `active`, `reviewers.updated_at` is treated as the start of the current safety-evaluation epoch. SQLite rejects timestamp-only changes while status remains `active`, so an unrelated metadata edit cannot silently reset the rolling audit window. Status transitions may advance the anchor.

## Manual investigation boundary

The client may send only:

- target internal user ID;
- expected revision;
- a human note; and
- 1–20 stored evidence event IDs.

The server owns reviewer identity, hold source, policy version, trigger codes, actor identity, and event IDs. Manual `COLLUSION_SUSPICION` means “requires human investigation”; it does not assert that collusion occurred.

## Resume path

```text
hold placed
  → reviewer + internal account suspended
  → human Admin resolution
  → fresh reference calibration (P2Q-03)
  → Admin activation
```

Neither human resolution alone nor a stale calibration can restore production access.

## Verification checkpoint

Latest pre-documentation code checkpoint: `1352b7274a2a879dee1d38cb82d7cb5ccfe0fb70`.

CI #227 passed all required gates:

- `test:engine`: **122/122**, 0 failures;
- `test:migrations`: **18 migration files / 24 product tables**, including P2Q-04 lifecycle, threshold parity, trust-role invalidation, and correction-order verifiers;
- `lint:local`: success;
- `build:local`: success.

This file records the implemented invariants only. P2Q-04 is not considered merged until its PR and post-merge `main` CI are green.
