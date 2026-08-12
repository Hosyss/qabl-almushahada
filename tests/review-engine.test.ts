import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTENT_CATEGORIES,
  VERDICT_LABELS_AR,
  InvalidStoredReviewError,
  assessReviewQuality,
  createExampleFamilyProfile,
  createVerifiedDemoBundle,
  decideForFamily,
  hydrateReviewBundle,
  preparePublication,
  prepareReportOpening,
  type ContentCategory,
  type FamilyProfile,
  type ReviewBundle,
  type Severity,
} from "../lib/review-engine/index.ts";

function cloneBundle(): ReviewBundle {
  return structuredClone(createVerifiedDemoBundle());
}

function profileWithLimit(limit: Severity): FamilyProfile {
  return {
    id: `profile-${limit}`,
    childAge: 10,
    maxSeverity: Object.fromEntries(
      CONTENT_CATEGORIES.map((category) => [category, limit]),
    ) as Record<ContentCategory, Severity>,
    blockedFlags: [],
  };
}

test("a verified bundle passes every quality gate", () => {
  const quality = assessReviewQuality(createVerifiedDemoBundle());
  assert.equal(quality.status, "verified");
  assert.equal(quality.publishable, true);
  assert.equal(quality.confidence, "high");
  assert.deepEqual(quality.eligibleSubmissionIds.sort(), ["submission-reviewer-a", "submission-reviewer-b"]);
});

test("one human source can never produce a published suitability decision", () => {
  const bundle = cloneBundle();
  bundle.submissions = bundle.submissions.slice(0, 1);
  bundle.editorialApproval!.reviewedSubmissionIds = [bundle.submissions[0].id];

  const decision = decideForFamily(bundle, profileWithLimit(4));
  assert.equal(decision.verdict, "insufficient_data");
  assert.equal(decision.quality.publishable, false);
  assert.ok(decision.quality.issues.some((item) => item.code === "SECOND_REVIEW_REQUIRED"));
});

test("reviewers from the same independence group do not count as corroboration", () => {
  const bundle = cloneBundle();
  bundle.submissions[1].reviewer.independenceGroupId = bundle.submissions[0].reviewer.independenceGroupId;

  const quality = assessReviewQuality(bundle);
  assert.equal(quality.publishable, false);
  assert.ok(quality.issues.some((item) => item.code === "INDEPENDENT_REVIEW_REQUIRED"));
});

test("duplicate submissions from one reviewer cannot increase corroboration", () => {
  const bundle = cloneBundle();
  const duplicate = structuredClone(bundle.submissions[0]);
  duplicate.id = "submission-reviewer-a-duplicate";
  duplicate.observations = duplicate.observations.map((item) => ({
    ...item,
    id: `${item.id}-duplicate`,
  }));
  bundle.submissions.push(duplicate);
  bundle.editorialApproval!.reviewedSubmissionIds.push(duplicate.id);
  bundle.editorialApproval!.spotChecks.push({
    observationId: duplicate.observations[0].id,
    result: "confirmed",
  });

  const quality = assessReviewQuality(bundle);
  assert.equal(quality.publishable, false);
  assert.ok(quality.issues.some((item) => item.code === "DUPLICATE_REVIEWER_SUBMISSION"));
});

test("a disagreement about whether content exists blocks the engine", () => {
  const bundle = cloneBundle();
  bundle.submissions[1].categoryChecks.fear = "none";
  bundle.submissions[1].observations = bundle.submissions[1].observations.filter((item) => item.category !== "fear");

  const decision = decideForFamily(bundle, profileWithLimit(4));
  assert.equal(decision.verdict, "insufficient_data");
  assert.equal(decision.quality.status, "conflicted");
  assert.ok(decision.quality.issues.some((item) => item.code === "CHECKLIST_CONFLICT"));
});

test("a severity outlier is treated as conflict instead of truth", () => {
  const bundle = cloneBundle();
  const fearObservation = bundle.submissions[1].observations.find((item) => item.category === "fear");
  assert.ok(fearObservation);
  fearObservation.severity = 4;

  const quality = assessReviewQuality(bundle);
  assert.equal(quality.status, "conflicted");
  assert.ok(quality.issues.some((item) => item.code === "SEVERITY_CONFLICT"));
});

test("a weak version fingerprint blocks accidental cross-version trust", () => {
  const bundle = cloneBundle();
  bundle.version.contentFingerprint = "short";

  const decision = decideForFamily(bundle, profileWithLimit(4));
  assert.equal(decision.verdict, "insufficient_data");
  assert.ok(decision.quality.issues.some((item) => item.code === "VERSION_FINGERPRINT_WEAK"));
});

test("an observation outside the runtime blocks publication", () => {
  const bundle = cloneBundle();
  bundle.submissions[0].observations[0].endSecond = bundle.version.runtimeSeconds + 1;

  const quality = assessReviewQuality(bundle);
  assert.equal(quality.publishable, false);
  assert.ok(quality.issues.some((item) => item.code === "OBSERVATION_OUTSIDE_RUNTIME"));
});

test("the editorial approver cannot approve their own independence group", () => {
  const bundle = cloneBundle();
  bundle.editorialApproval!.approverIndependenceGroupId = bundle.submissions[0].reviewer.independenceGroupId;

  const quality = assessReviewQuality(bundle);
  assert.equal(quality.status, "conflicted");
  assert.ok(quality.issues.some((item) => item.code === "EDITOR_NOT_INDEPENDENT"));
});

test("editorial approval must confirm the exact version fingerprint", () => {
  const bundle = cloneBundle();
  bundle.editorialApproval!.versionFingerprintConfirmed = false;

  const quality = assessReviewQuality(bundle);
  assert.equal(quality.publishable, false);
  assert.ok(quality.issues.some((item) => item.code === "EDITORIAL_FINGERPRINT_UNCONFIRMED"));
});

test("a suspended editorial approver cannot publish a bundle", () => {
  const bundle = cloneBundle();
  bundle.editorialApproval!.approverStatus = "suspended";

  const quality = assessReviewQuality(bundle);
  assert.equal(quality.publishable, false);
  assert.ok(quality.issues.some((item) => item.code === "EDITOR_NOT_ACTIVE"));
});

test("every active submission needs an independent spot check", () => {
  const bundle = cloneBundle();
  bundle.editorialApproval!.spotChecks = bundle.editorialApproval!.spotChecks.slice(0, 1);

  const quality = assessReviewQuality(bundle);
  assert.equal(quality.publishable, false);
  assert.ok(quality.issues.some((item) => item.code === "EDITORIAL_SPOT_CHECK_INCOMPLETE"));
});

test("content below every family limit is suitable", () => {
  const decision = decideForFamily(createVerifiedDemoBundle(), profileWithLimit(4));
  assert.equal(decision.verdict, "suitable");
  assert.equal(decision.reasons.length, 0);
});

test("content exactly on a family limit requires guidance", () => {
  const decision = decideForFamily(createVerifiedDemoBundle(), profileWithLimit(2));
  assert.equal(decision.verdict, "with_guidance");
  assert.ok(decision.reasons.every((reason) => reason.code === "category_at_limit"));
});

test("content above a family limit is not suitable", () => {
  const decision = decideForFamily(createVerifiedDemoBundle(), profileWithLimit(1));
  assert.equal(decision.verdict, "not_suitable");
  assert.ok(decision.reasons.some((reason) => reason.code === "category_exceeds_limit"));
});

test("a blocked flag wins even when category severity is otherwise allowed", () => {
  const profile = profileWithLimit(4);
  profile.blockedFlags = ["verbal_bullying"];

  const decision = decideForFamily(createVerifiedDemoBundle(), profile);
  assert.equal(decision.verdict, "not_suitable");
  assert.ok(decision.reasons.some((reason) => reason.code === "blocked_flag"));
});

test("an open material report forces the decision back to insufficient data", () => {
  const bundle = cloneBundle();
  bundle.blockingReports.push({
    id: "report-1",
    reportType: "different_version",
    status: "investigating",
  });

  const decision = decideForFamily(bundle, profileWithLimit(4));
  assert.equal(decision.verdict, "insufficient_data");
  assert.ok(decision.quality.issues.some((item) => item.code === "OPEN_REPORT_BLOCKS_PUBLICATION"));
});

test("an invalid family profile fails safely instead of creating hidden defaults", () => {
  const profile = profileWithLimit(4);
  delete (profile.maxSeverity as Partial<typeof profile.maxSeverity>).fear;

  const decision = decideForFamily(createVerifiedDemoBundle(), profile);
  assert.equal(decision.verdict, "insufficient_data");
  assert.equal(decision.confidence, "unavailable");
  assert.equal(decision.reasons[0].code, "profile_invalid");
});

test("an out-of-range family limit fails safely", () => {
  const profile = profileWithLimit(4);
  (profile.maxSeverity as Record<ContentCategory, number>).fear = 9;

  const decision = decideForFamily(createVerifiedDemoBundle(), profile);
  assert.equal(decision.verdict, "insufficient_data");
  assert.equal(decision.reasons[0].code, "profile_invalid");
});

test("the example profile turns bullying avoidance into an explicit zero limit", () => {
  const profile = createExampleFamilyProfile({ childAge: 9, fearLimit: 2, avoidBullying: true });
  assert.equal(profile.maxSeverity.fear, 2);
  assert.equal(profile.maxSeverity.bullying, 0);
  assert.ok(profile.blockedFlags.includes("verbal_bullying"));
});

test("every engine verdict has one stable Arabic UI label", () => {
  assert.deepEqual(Object.keys(VERDICT_LABELS_AR).sort(), [
    "insufficient_data",
    "not_suitable",
    "suitable",
    "with_guidance",
  ]);
  assert.equal(VERDICT_LABELS_AR.insufficient_data, "البيانات غير كافية");
});

test("stored rows hydrate into the same verified domain bundle", () => {
  const source = createVerifiedDemoBundle();
  const rows = {
    bundle: { id: source.id, revision: 7 },
    version: source.version,
    submissions: source.submissions.map((submission) => ({
      id: submission.id,
      versionId: submission.versionId,
      reviewerId: submission.reviewer.id,
      reviewerIndependenceGroupId: submission.reviewer.independenceGroupId,
      reviewerStatus: submission.reviewer.status,
      startedAt: submission.startedAt,
      completedAt: submission.completedAt,
      watchedSeconds: submission.watchedSeconds,
      declaredComplete: submission.declaredComplete,
    })),
    categoryChecks: source.submissions.flatMap((submission) =>
      Object.entries(submission.categoryChecks).map(([category, result]) => ({
        submissionId: submission.id,
        category,
        result,
      })),
    ),
    observations: source.submissions.flatMap((submission) =>
      submission.observations.map((observation) => ({
        id: observation.id,
        submissionId: submission.id,
        category: observation.category,
        severity: observation.severity,
        startSecond: observation.startSecond,
        endSecond: observation.endSecond,
        frequency: observation.frequency,
        context: observation.context,
        spoilerLevel: observation.spoilerLevel,
        summary: observation.summary,
      })),
    ),
    observationFlags: source.submissions.flatMap((submission) =>
      submission.observations.flatMap((observation) =>
        observation.flags.map((flag) => ({ observationId: observation.id, flag })),
      ),
    ),
    blockingReports: [],
    approval: {
      ...source.editorialApproval!,
      status: source.editorialApproval!.status,
    },
  };

  const hydrated = hydrateReviewBundle(rows);
  assert.equal(hydrated.revision, 7);
  assert.equal(hydrated.bundle.submissions.length, 2);
  assert.equal(assessReviewQuality(hydrated.bundle).publishable, true);
});

test("the storage boundary rejects unknown categories instead of casting them", () => {
  const source = createVerifiedDemoBundle();
  assert.throws(
    () =>
      hydrateReviewBundle({
        bundle: { id: source.id, revision: 0 },
        version: source.version,
        submissions: [],
        categoryChecks: [{ submissionId: "missing", category: "made_up", result: "none" }],
        observations: [],
        observationFlags: [],
        blockingReports: [],
      }),
    InvalidStoredReviewError,
  );
});

test("publication preparation locks the expected revision and audit evidence", () => {
  const prepared = preparePublication(createVerifiedDemoBundle(), 4);
  assert.equal(prepared.allowed, true);
  if (!prepared.allowed) return;
  assert.equal(prepared.expectedRevision, 4);
  assert.equal(prepared.nextRevision, 5);
  assert.equal(prepared.auditPayload.bundleId, "review-bundle-demo-024");
  assert.equal(prepared.auditPayload.eligibleSubmissionIds.length, 2);
});

test("publication preparation returns a quality stop instead of a write plan", () => {
  const bundle = cloneBundle();
  bundle.submissions = bundle.submissions.slice(0, 1);
  const prepared = preparePublication(bundle, 2);
  assert.equal(prepared.allowed, false);
  if (prepared.allowed) return;
  assert.equal(prepared.reason, "quality_gate");
});

test("report opening validates type, message, and optimistic-lock revision", () => {
  const valid = prepareReportOpening({
    bundleId: "bundle-1",
    revision: 3,
    reportType: "different_version",
    message: "النسخة المعروضة أطول من النسخة المسجلة.",
  });
  assert.equal(valid.allowed, true);
  if (valid.allowed) assert.equal(valid.nextRevision, 4);

  const invalid = prepareReportOpening({
    bundleId: "",
    revision: -1,
    reportType: "invented",
    message: "قصير",
  });
  assert.equal(invalid.allowed, false);
  if (!invalid.allowed) assert.equal(invalid.errorsAr.length, 4);
});
