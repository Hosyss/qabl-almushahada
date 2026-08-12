import { assessThirdReviewRequirement } from "./third-review-risk.ts";
import {
  CONTENT_CATEGORIES,
  CONTENT_FLAGS,
  type ContentCategory,
  type QualityAssessment,
  type QualityIssue,
  type ReviewBundle,
  type ReviewSubmission,
} from "./types.ts";

const CONFLICT_CODES = new Set([
  "VERSION_MISMATCH",
  "CHECKLIST_CONFLICT",
  "SEVERITY_CONFLICT",
  "EDITOR_NOT_INDEPENDENT",
]);

function categoryMaximum(submission: ReviewSubmission, category: ContentCategory): number {
  return submission.observations
    .filter((observation) => observation.category === category)
    .reduce((maximum, observation) => Math.max(maximum, observation.severity), 0);
}

function issue(
  issues: QualityIssue[],
  code: string,
  messageAr: string,
  details: Pick<QualityIssue, "submissionIds" | "observationIds"> = {},
  level: QualityIssue["level"] = "blocking",
) {
  issues.push({ code, level, messageAr, ...details });
}

function validateSubmission(
  bundle: ReviewBundle,
  submission: ReviewSubmission,
  issues: QualityIssue[],
  observationIds: Set<string>,
) {
  const submissionRef = { submissionIds: [submission.id] };

  if (!submission.reviewer.id.trim() || !submission.reviewer.independenceGroupId.trim()) {
    issue(issues, "REVIEWER_IDENTITY_INVALID", "هوية المراجع أو مجموعة استقلاله غير مكتملة.", submissionRef);
  }

  if (submission.versionId !== bundle.version.id) {
    issue(issues, "VERSION_MISMATCH", "المراجعة مرتبطة بنسخة مختلفة عن النسخة المطلوب تقييمها.", submissionRef);
  }

  if (submission.reviewer.status !== "active") {
    issue(
      issues,
      "REVIEWER_NOT_ACTIVE",
      submission.reviewer.status === "suspended"
        ? "مراجعة صادرة من حساب موقوف ولا تدخل في أي قرار."
        : "المراجع تحت الاختبار ولا تكفي مراجعته لاعتماد القرار.",
      submissionRef,
    );
  }

  if (!submission.declaredComplete) {
    issue(issues, "REVIEW_NOT_COMPLETE", "المراجع لم يعلن إتمام مشاهدة النسخة كاملة.", submissionRef);
  }

  const minimumCoverage = bundle.version.runtimeSeconds * 0.95;
  if (submission.watchedSeconds < minimumCoverage) {
    issue(issues, "WATCH_COVERAGE_LOW", "تغطية المشاهدة أقل من 95% من مدة النسخة.", submissionRef);
  }

  if (submission.watchedSeconds > bundle.version.runtimeSeconds * 1.2) {
    issue(
      issues,
      "WATCH_COVERAGE_SUSPICIOUS",
      "مدة المشاهدة المسجلة أعلى من مدة النسخة بشكل يحتاج تدقيقًا.",
      submissionRef,
      "warning",
    );
  }

  const startedAt = Date.parse(submission.startedAt);
  const completedAt = Date.parse(submission.completedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt <= startedAt) {
    issue(issues, "INVALID_REVIEW_TIME", "توقيت بداية أو نهاية المراجعة غير صالح.", submissionRef);
  }

  for (const category of CONTENT_CATEGORIES) {
    const check = submission.categoryChecks[category];
    const categoryObservations = submission.observations.filter((item) => item.category === category);

    if (!check || !["none", "present", "uncertain"].includes(check)) {
      issue(issues, "CHECKLIST_INCOMPLETE", `لم يؤكد المراجع فحص محور «${category}».`, submissionRef);
      continue;
    }

    if (check === "uncertain") {
      issue(issues, "CATEGORY_UNCERTAIN", `محور «${category}» ما زال غير محسوم.`, submissionRef);
    }

    if (check === "none" && categoryObservations.length > 0) {
      issue(
        issues,
        "CHECKLIST_OBSERVATION_MISMATCH",
        `المراجع سجّل وقائع في محور «${category}» ثم علّمه كغير موجود.`,
        { ...submissionRef, observationIds: categoryObservations.map((item) => item.id) },
      );
    }

    if (check === "present" && categoryObservations.length === 0) {
      issue(issues, "PRESENT_WITHOUT_EVIDENCE", `المحور «${category}» معلّم كموجود من غير واقعة مسجلة.`, submissionRef);
    }
  }

  for (const observation of submission.observations) {
    if (observationIds.has(observation.id)) {
      issue(
        issues,
        "DUPLICATE_OBSERVATION_ID",
        "يوجد معرّف واقعة مكرر، لذلك لا يمكن تتبع الدليل بأمان.",
        { ...submissionRef, observationIds: [observation.id] },
      );
    }
    observationIds.add(observation.id);

    const invalidTiming =
      !Number.isFinite(observation.startSecond) ||
      !Number.isFinite(observation.endSecond) ||
      observation.startSecond < 0 ||
      observation.endSecond < observation.startSecond ||
      observation.endSecond > bundle.version.runtimeSeconds;

    if (invalidTiming) {
      issue(
        issues,
        "OBSERVATION_OUTSIDE_RUNTIME",
        "توقيت واقعة خارج مدة النسخة أو نهايتها تسبق بدايتها.",
        { ...submissionRef, observationIds: [observation.id] },
      );
    }

    if (!observation.summary.trim()) {
      issue(
        issues,
        "OBSERVATION_SUMMARY_EMPTY",
        "واقعة بلا وصف لا تصلح لتفسير القرار.",
        { ...submissionRef, observationIds: [observation.id] },
      );
    }

    if (!Number.isInteger(observation.severity) || observation.severity < 1 || observation.severity > 4) {
      issue(
        issues,
        "OBSERVATION_SEVERITY_INVALID",
        "درجة شدة الواقعة خارج النطاق المسموح من 1 إلى 4.",
        { ...submissionRef, observationIds: [observation.id] },
      );
    }

    const unknownFlags = observation.flags.filter(
      (flag) => !(CONTENT_FLAGS as readonly string[]).includes(flag),
    );
    if (unknownFlags.length > 0) {
      issue(
        issues,
        "OBSERVATION_FLAG_INVALID",
        "الواقعة تحتوي علامة محتوى غير معروفة.",
        { ...submissionRef, observationIds: [observation.id] },
      );
    }
  }
}

export function assessReviewQuality(bundle: ReviewBundle): QualityAssessment {
  const issues: QualityIssue[] = [];

  if (bundle.blockingReports.length > 0) {
    issue(
      issues,
      "OPEN_REPORT_BLOCKS_PUBLICATION",
      "يوجد بلاغ جوهري مفتوح أو قيد التحقيق؛ تتوقف النتيجة حتى حسمه.",
    );
  }

  if (!bundle.version.id || !bundle.version.titleId || !bundle.version.editionLabel.trim()) {
    issue(issues, "VERSION_IDENTITY_MISSING", "هوية النسخة غير مكتملة.");
  }

  if (!bundle.version.platform.trim() || !bundle.version.language.trim()) {
    issue(issues, "VERSION_SOURCE_MISSING", "منصة النسخة أو لغتها غير محددة.");
  }

  if (!Number.isFinite(bundle.version.runtimeSeconds) || bundle.version.runtimeSeconds <= 0) {
    issue(issues, "VERSION_RUNTIME_INVALID", "مدة النسخة غير صالحة.");
  }

  if (
    !Number.isInteger(bundle.version.releaseYear) ||
    bundle.version.releaseYear < 1880 ||
    bundle.version.releaseYear > 2200
  ) {
    issue(issues, "VERSION_RELEASE_YEAR_INVALID", "سنة إصدار العمل غير صالحة.");
  }

  if (bundle.version.contentFingerprint.trim().length < 12) {
    issue(issues, "VERSION_FINGERPRINT_WEAK", "بصمة النسخة مفقودة أو أقصر من الحد المطلوب.");
  }

  if (bundle.submissions.length === 0) {
    issue(issues, "NO_SUBMISSIONS", "لا توجد أي مراجعة بشرية لهذه النسخة.");
  }

  const submissionIds = new Set<string>();
  const observationIds = new Set<string>();

  for (const submission of bundle.submissions) {
    if (submissionIds.has(submission.id)) {
      issue(issues, "DUPLICATE_SUBMISSION_ID", "يوجد معرّف مراجعة مكرر.", { submissionIds: [submission.id] });
    }
    submissionIds.add(submission.id);
    validateSubmission(bundle, submission, issues, observationIds);
  }

  const activeSubmissions = bundle.submissions.filter((item) => item.reviewer.status === "active");
  const activeReviewerIds = new Set(activeSubmissions.map((item) => item.reviewer.id));
  const independentGroups = new Set(activeSubmissions.map((item) => item.reviewer.independenceGroupId));

  if (activeReviewerIds.size < 2) {
    issue(issues, "SECOND_REVIEW_REQUIRED", "لا يصدر قرار منشور من مراجعة بشرية واحدة.");
  }

  if (activeReviewerIds.size !== activeSubmissions.length) {
    issue(issues, "DUPLICATE_REVIEWER_SUBMISSION", "المراجع نفسه لا يُحتسب أكثر من مرة داخل الحزمة.");
  }

  if (independentGroups.size < 2) {
    issue(issues, "INDEPENDENT_REVIEW_REQUIRED", "المراجعتان ليستا مستقلتين بما يكفي لاعتماد النتيجة.");
  }

  const thirdReviewRequirement = assessThirdReviewRequirement(activeSubmissions);
  if (
    thirdReviewRequirement.required &&
    (activeReviewerIds.size < thirdReviewRequirement.requiredActiveReviewerCount ||
      independentGroups.size < thirdReviewRequirement.requiredIndependentGroupCount)
  ) {
    issue(
      issues,
      "THIRD_INDEPENDENT_REVIEW_REQUIRED",
      "ظهرت واقعة عالية الحساسية وفق سياسة المخاطر؛ يلزم ثلاثة مراجعين نشطين من ثلاث مجموعات استقلال مختلفة قبل أي اعتماد.",
      {
        submissionIds: [...new Set(thirdReviewRequirement.triggers.map((trigger) => trigger.submissionId))],
        observationIds: [...new Set(thirdReviewRequirement.triggers.map((trigger) => trigger.observationId))],
      },
    );
  }

  for (let firstIndex = 0; firstIndex < activeSubmissions.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < activeSubmissions.length; secondIndex += 1) {
      const first = activeSubmissions[firstIndex];
      const second = activeSubmissions[secondIndex];

      if (first.reviewer.independenceGroupId === second.reviewer.independenceGroupId) continue;

      for (const category of CONTENT_CATEGORIES) {
        const firstCheck = first.categoryChecks[category];
        const secondCheck = second.categoryChecks[category];

        if (
          (firstCheck === "none" && secondCheck === "present") ||
          (firstCheck === "present" && secondCheck === "none")
        ) {
          issue(
            issues,
            "CHECKLIST_CONFLICT",
            `المراجعان مختلفان على وجود محور «${category}».`,
            { submissionIds: [first.id, second.id] },
          );
          continue;
        }

        if (firstCheck === "present" && secondCheck === "present") {
          const difference = Math.abs(categoryMaximum(first, category) - categoryMaximum(second, category));
          if (difference >= 2) {
            issue(
              issues,
              "SEVERITY_CONFLICT",
              `فرق الشدة في محور «${category}» أكبر من الحد المقبول ويحتاج مراجعة فاصلة.`,
              { submissionIds: [first.id, second.id] },
            );
          }
        }
      }
    }
  }

  const approval = bundle.editorialApproval;
  if (!approval) {
    issue(issues, "EDITORIAL_APPROVAL_MISSING", "لم تعتمد مراجعة تحريرية مستقلة هذه البيانات.");
  } else {
    if (approval.status !== "approved") {
      issue(issues, "EDITORIAL_NOT_APPROVED", "حالة التدقيق التحريري لا تسمح بالنشر.");
    }

    if (!approval.approverId.trim() || !approval.approverIndependenceGroupId.trim()) {
      issue(issues, "EDITOR_IDENTITY_INVALID", "هوية المعتمد التحريري أو مجموعة استقلاله غير مكتملة.");
    }

    const approvedAt = Date.parse(approval.approvedAt);
    const latestCompletion = Math.max(
      ...activeSubmissions.map((submission) => Date.parse(submission.completedAt)).filter(Number.isFinite),
      0,
    );
    if (!Number.isFinite(approvedAt) || approvedAt < latestCompletion) {
      issue(issues, "EDITORIAL_TIME_INVALID", "وقت الاعتماد غير صالح أو يسبق اكتمال إحدى المراجعات.");
    }

    const reviewerGroups = new Set(bundle.submissions.map((item) => item.reviewer.independenceGroupId));
    if (reviewerGroups.has(approval.approverIndependenceGroupId)) {
      issue(issues, "EDITOR_NOT_INDEPENDENT", "المعتمد التحريري تابع لنفس مجموعة أحد المراجعين.");
    }

    if (approval.approverStatus !== "active") {
      issue(issues, "EDITOR_NOT_ACTIVE", "حساب المعتمد التحريري غير نشط ولا يسمح بالنشر.");
    }

    if (!approval.versionFingerprintConfirmed) {
      issue(
        issues,
        "EDITORIAL_FINGERPRINT_UNCONFIRMED",
        "المعتمد لم يؤكد أن المراجعات تخص بصمة النسخة نفسها.",
      );
    }

    const reviewedIds = new Set(approval.reviewedSubmissionIds);
    const knownSubmissionIds = new Set(bundle.submissions.map((item) => item.id));
    const unknownReviewedIds = approval.reviewedSubmissionIds.filter((id) => !knownSubmissionIds.has(id));
    if (unknownReviewedIds.length > 0) {
      issue(
        issues,
        "EDITORIAL_UNKNOWN_SUBMISSION",
        "الاعتماد التحريري يشير إلى مراجعة غير موجودة في الحزمة.",
        { submissionIds: unknownReviewedIds },
      );
    }
    const unreviewed = activeSubmissions.filter((item) => !reviewedIds.has(item.id));
    if (unreviewed.length > 0) {
      issue(issues, "EDITORIAL_COVERAGE_INCOMPLETE", "الاعتماد التحريري لم يشمل كل المراجعات الفعالة.", {
        submissionIds: unreviewed.map((item) => item.id),
      });
    }

    const allObservationOwners = new Map<string, string>();
    for (const submission of activeSubmissions) {
      for (const observation of submission.observations) {
        allObservationOwners.set(observation.id, submission.id);
      }
    }

    const spotCheckedSubmissionIds = new Set<string>();
    for (const spotCheck of approval.spotChecks) {
      const ownerSubmissionId = allObservationOwners.get(spotCheck.observationId);
      if (!ownerSubmissionId) {
        issue(
          issues,
          "EDITORIAL_SPOT_CHECK_UNKNOWN",
          "التدقيق العشوائي يشير إلى واقعة غير موجودة في الحزمة.",
          { observationIds: [spotCheck.observationId] },
        );
        continue;
      }

      spotCheckedSubmissionIds.add(ownerSubmissionId);
      if (spotCheck.result !== "confirmed") {
        issue(
          issues,
          "EDITORIAL_SPOT_CHECK_UNRESOLVED",
          "تدقيق واقعة ما زال غير محسوم، لذلك لا يمكن نشر القرار.",
          { submissionIds: [ownerSubmissionId], observationIds: [spotCheck.observationId] },
        );
      }
    }

    const submissionsWithoutSpotCheck = activeSubmissions.filter(
      (submission) => submission.observations.length > 0 && !spotCheckedSubmissionIds.has(submission.id),
    );
    if (submissionsWithoutSpotCheck.length > 0) {
      issue(
        issues,
        "EDITORIAL_SPOT_CHECK_INCOMPLETE",
        "يجب تدقيق واقعة واحدة على الأقل من كل مراجعة فعالة.",
        { submissionIds: submissionsWithoutSpotCheck.map((item) => item.id) },
      );
    }
  }

  const blockingIssues = issues.filter((item) => item.level === "blocking");
  const hasConflict = blockingIssues.some((item) => CONFLICT_CODES.has(item.code));
  const publishable = blockingIssues.length === 0;

  return {
    status: publishable ? "verified" : hasConflict ? "conflicted" : "insufficient",
    confidence: publishable ? (issues.some((item) => item.level === "warning") ? "medium" : "high") : "unavailable",
    publishable,
    issues,
    eligibleSubmissionIds: publishable ? activeSubmissions.map((item) => item.id) : [],
  };
}
