import {
  CONTENT_CATEGORIES,
  type CategoryChecklist,
  type ContentObservation,
  type ReviewBundle,
  type ReviewSubmission,
} from "./types.ts";

function checklist(present: Array<keyof CategoryChecklist>): CategoryChecklist {
  return Object.fromEntries(
    CONTENT_CATEGORIES.map((category) => [category, present.includes(category) ? "present" : "none"]),
  ) as CategoryChecklist;
}

const reviewerOneObservations: ContentObservation[] = [
  {
    id: "obs-a-fear-1",
    category: "fear",
    severity: 2,
    startSecond: 1440,
    endSecond: 1495,
    frequency: "single",
    context: "threatening",
    spoilerLevel: "contextual",
    summary: "مطاردة خيالية قصيرة وسط عاصفة وتنتهي بالاطمئنان.",
    flags: [],
  },
  {
    id: "obs-a-violence-1",
    category: "violence",
    severity: 1,
    startSecond: 2460,
    endSecond: 2480,
    frequency: "single",
    context: "comic",
    spoilerLevel: "none",
    summary: "سقوط كرتوني من غير إصابة ظاهرة.",
    flags: [],
  },
  {
    id: "obs-a-bullying-1",
    category: "bullying",
    severity: 1,
    startSecond: 1980,
    endSecond: 2005,
    frequency: "repeated",
    context: "distressing",
    spoilerLevel: "none",
    summary: "لقب ساخر يتكرر ثم تعتذر الشخصية.",
    flags: ["verbal_bullying"],
  },
  {
    id: "obs-a-grief-1",
    category: "grief",
    severity: 2,
    startSecond: 4320,
    endSecond: 4390,
    frequency: "single",
    context: "distressing",
    spoilerLevel: "contextual",
    summary: "حوار عاطفي عن غياب شخص عزيز من غير عرض لحظة الفقد.",
    flags: ["bereavement"],
  },
];

const reviewerTwoObservations: ContentObservation[] = reviewerOneObservations.map((observation) => ({
  ...observation,
  id: observation.id.replace("obs-a", "obs-b"),
  startSecond: observation.startSecond + 2,
  endSecond: observation.endSecond + 2,
}));

function submission(
  id: string,
  reviewerId: string,
  independenceGroupId: string,
  observations: ContentObservation[],
): ReviewSubmission {
  return {
    id,
    versionId: "version-demo-ar-2024",
    reviewer: { id: reviewerId, independenceGroupId, status: "active" },
    startedAt: "2026-08-08T10:00:00.000Z",
    completedAt: "2026-08-08T11:40:00.000Z",
    watchedSeconds: 5538,
    declaredComplete: true,
    categoryChecks: checklist(["fear", "violence", "bullying", "grief"]),
    observations,
  };
}

export function createVerifiedDemoBundle(): ReviewBundle {
  return {
    id: "review-bundle-demo-024",
    version: {
      id: "version-demo-ar-2024",
      titleId: "title-cloud-city",
      editionLabel: "النسخة العربية التجريبية",
      platform: "demo-platform",
      language: "ar",
      releaseYear: 2024,
      runtimeSeconds: 5538,
      contentFingerprint: "demo-ar-2024-5538-v1",
    },
    submissions: [
      submission("submission-reviewer-a", "reviewer-a", "independent-group-a", reviewerOneObservations),
      submission("submission-reviewer-b", "reviewer-b", "independent-group-b", reviewerTwoObservations),
    ],
    blockingReports: [],
    editorialApproval: {
      status: "approved",
      approverId: "editor-c",
      approverIndependenceGroupId: "editorial-group-c",
      approverStatus: "active",
      approvedAt: "2026-08-08T15:00:00.000Z",
      versionFingerprintConfirmed: true,
      reviewedSubmissionIds: ["submission-reviewer-a", "submission-reviewer-b"],
      spotChecks: [
        { observationId: "obs-a-fear-1", result: "confirmed" },
        { observationId: "obs-b-grief-1", result: "confirmed" },
      ],
    },
  };
}
