import {
  CONTENT_CATEGORIES,
  CONTENT_FLAGS,
  type CategoryCheck,
  type CategoryChecklist,
  type ContentCategory,
  type ContentFlag,
  type ContentObservation,
  type ObservedSeverity,
  type ReviewSubmission,
  type ReviewVersion,
  type ReviewerIdentity,
} from "./review-engine/types.ts";
import { isContentFlagAllowedForCategory } from "./review-engine/content-taxonomy.ts";

export const INTERNAL_ROLES = [
  "admin",
  "review_coordinator",
  "reviewer",
  "editorial_reviewer",
] as const;

export type InternalRole = (typeof INTERNAL_ROLES)[number];
export type InternalAccountStatus = "active" | "suspended";

export const REVIEW_ASSIGNMENT_STATES = [
  "draft",
  "assigned",
  "in_progress",
  "submitted",
  "changes_requested",
  "approved",
  "conflicted",
] as const;

export type ReviewAssignmentState = (typeof REVIEW_ASSIGNMENT_STATES)[number];

export type InternalPermission =
  | "manage_internal_users"
  | "assign_reviews"
  | "read_all_assignments"
  | "read_own_assignment"
  | "edit_own_draft"
  | "submit_own_review"
  | "request_review_changes"
  | "approve_editorially"
  | "read_audit_log";

const ROLE_PERMISSIONS: Record<InternalRole, readonly InternalPermission[]> = {
  admin: ["manage_internal_users", "read_audit_log"],
  review_coordinator: ["assign_reviews", "read_all_assignments"],
  reviewer: ["read_own_assignment", "edit_own_draft", "submit_own_review"],
  editorial_reviewer: [
    "read_all_assignments",
    "request_review_changes",
    "approve_editorially",
  ],
};

export interface InternalActor {
  userId: string;
  email: string;
  role: InternalRole;
  status: InternalAccountStatus;
  reviewer: ReviewerIdentity | null;
}

export interface ReviewAssignmentScope {
  id: string;
  bundleId: string;
  version: ReviewVersion;
  reviewer: ReviewerIdentity;
  state: ReviewAssignmentState;
  revision: number;
}

export interface ReviewDraftInput {
  startedAt?: unknown;
  completedAt?: unknown;
  watchedSeconds?: unknown;
  declaredComplete?: unknown;
  categoryChecks?: unknown;
  observations?: unknown;
}

export type ReviewWorkflowErrorCode =
  | "UNAUTHENTICATED"
  | "ACCOUNT_SUSPENDED"
  | "FORBIDDEN"
  | "ASSIGNMENT_OWNERSHIP"
  | "REVISION_CONFLICT"
  | "ASSIGNMENT_LOCKED"
  | "SELF_APPROVAL"
  | "EDITOR_NOT_INDEPENDENT"
  | "INVALID_DRAFT";

export class ReviewWorkflowError extends Error {
  readonly code: ReviewWorkflowErrorCode;
  readonly details: readonly string[];

  constructor(
    code: ReviewWorkflowErrorCode,
    message: string,
    details: readonly string[] = [],
  ) {
    super(message);
    this.name = "ReviewWorkflowError";
    this.code = code;
    this.details = details;
  }
}

export function hasInternalPermission(
  actor: InternalActor,
  permission: InternalPermission,
): boolean {
  return actor.status === "active" && ROLE_PERMISSIONS[actor.role].includes(permission);
}

export function assertCanReadAssignment(
  actor: InternalActor,
  assignment: ReviewAssignmentScope,
): void {
  assertActiveActor(actor);

  if (hasInternalPermission(actor, "read_all_assignments")) return;
  if (
    hasInternalPermission(actor, "read_own_assignment") &&
    actor.reviewer?.id === assignment.reviewer.id
  ) {
    return;
  }

  throw new ReviewWorkflowError(
    "ASSIGNMENT_OWNERSHIP",
    "المستخدم لا يملك صلاحية الوصول إلى هذه المهمة.",
  );
}

export function assertCanEditOwnDraft(
  actor: InternalActor,
  assignment: ReviewAssignmentScope,
  expectedRevision: number,
): void {
  assertActiveActor(actor);

  if (!hasInternalPermission(actor, "edit_own_draft") || !actor.reviewer) {
    throw new ReviewWorkflowError("FORBIDDEN", "هذا الدور لا يملك صلاحية تعديل مراجعة.");
  }
  if (actor.reviewer.status !== "active") {
    throw new ReviewWorkflowError("FORBIDDEN", "المراجع غير نشط ولا يمكنه إرسال مراجعة إنتاجية.");
  }
  if (actor.reviewer.id !== assignment.reviewer.id) {
    throw new ReviewWorkflowError(
      "ASSIGNMENT_OWNERSHIP",
      "لا يمكن للمراجع تعديل مهمة مراجع آخر.",
    );
  }
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new ReviewWorkflowError("REVISION_CONFLICT", "رقم revision غير صالح.");
  }
  if (expectedRevision !== assignment.revision) {
    throw new ReviewWorkflowError(
      "REVISION_CONFLICT",
      "تم تعديل المهمة في طلب آخر؛ أعد تحميلها قبل الحفظ.",
    );
  }
  if (!isEditableState(assignment.state)) {
    throw new ReviewWorkflowError(
      "ASSIGNMENT_LOCKED",
      "المراجعة مقفلة في حالتها الحالية ولا يمكن تعديلها.",
    );
  }
}

export function assertCanApproveEditorially(
  actor: InternalActor,
  assignment: ReviewAssignmentScope,
): void {
  assertActiveActor(actor);

  if (!hasInternalPermission(actor, "approve_editorially") || !actor.reviewer) {
    throw new ReviewWorkflowError("FORBIDDEN", "هذا الدور لا يملك صلاحية الاعتماد التحريري.");
  }
  if (actor.reviewer.status !== "active") {
    throw new ReviewWorkflowError("FORBIDDEN", "المعتمد غير نشط.");
  }
  if (assignment.state !== "submitted") {
    throw new ReviewWorkflowError(
      "ASSIGNMENT_LOCKED",
      "لا يمكن اعتماد مراجعة قبل أن تكون submitted ومقفلة.",
    );
  }
  if (actor.reviewer.id === assignment.reviewer.id) {
    throw new ReviewWorkflowError("SELF_APPROVAL", "لا يجوز للمستخدم اعتماد مراجعته بنفسه.");
  }
  if (actor.reviewer.independenceGroupId === assignment.reviewer.independenceGroupId) {
    throw new ReviewWorkflowError(
      "EDITOR_NOT_INDEPENDENT",
      "لا يجوز للمعتمد اعتماد مراجعة من نفس مجموعة الاستقلال.",
    );
  }
}

export function canTransitionAssignment(
  from: ReviewAssignmentState,
  to: ReviewAssignmentState,
): boolean {
  const allowed: Record<ReviewAssignmentState, readonly ReviewAssignmentState[]> = {
    draft: ["assigned"],
    assigned: ["in_progress"],
    in_progress: ["submitted"],
    submitted: ["changes_requested", "approved", "conflicted"],
    changes_requested: ["in_progress"],
    approved: [],
    conflicted: ["changes_requested"],
  };

  return allowed[from].includes(to);
}

export function prepareLockedReviewSubmission(input: {
  actor: InternalActor;
  assignment: ReviewAssignmentScope;
  expectedRevision: number;
  draft: unknown;
  submissionId: string;
}): ReviewSubmission {
  assertCanEditOwnDraft(input.actor, input.assignment, input.expectedRevision);

  if (!hasInternalPermission(input.actor, "submit_own_review")) {
    throw new ReviewWorkflowError("FORBIDDEN", "هذا الدور لا يملك صلاحية إرسال المراجعة.");
  }
  if (input.assignment.state !== "in_progress") {
    throw new ReviewWorkflowError(
      "ASSIGNMENT_LOCKED",
      "يجب بدء المهمة وحفظها كـ in_progress قبل الإرسال النهائي.",
    );
  }

  const parsed = parseDraftForSubmission(input.draft, input.assignment.version);
  return {
    id: requireNonEmptyString(input.submissionId, "submissionId"),
    versionId: input.assignment.version.id,
    reviewer: input.assignment.reviewer,
    ...parsed,
  };
}

export function sanitizeReviewDraftForStorage(raw: unknown): ReviewDraftInput {
  if (!isPlainObject(raw)) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "بيانات المسودة غير صالحة.");
  }

  const allowedKeys = [
    "startedAt",
    "completedAt",
    "watchedSeconds",
    "declaredComplete",
    "categoryChecks",
    "observations",
  ] as const;
  const allowed = new Set<string>(allowedKeys);
  const unknownFields = Object.keys(raw).filter((key) => !allowed.has(key));
  if (unknownFields.length > 0) {
    throw new ReviewWorkflowError(
      "INVALID_DRAFT",
      "المسودة تحتوي حقولًا غير مسموح بها.",
      unknownFields.map((key) => `unknown field: ${key}`),
    );
  }

  const sanitized: ReviewDraftInput = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) sanitized[key] = raw[key];
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(sanitized);
  } catch {
    throw new ReviewWorkflowError("INVALID_DRAFT", "المسودة ليست JSON صالحًا.");
  }
  if (new TextEncoder().encode(serialized).length > 262_144) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "حجم المسودة أكبر من الحد المسموح.");
  }

  return JSON.parse(serialized) as ReviewDraftInput;
}

export function parseDraftForSubmission(
  raw: unknown,
  version: ReviewVersion,
): Omit<ReviewSubmission, "id" | "versionId" | "reviewer"> {
  const errors: string[] = [];
  if (!isPlainObject(raw)) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "بيانات المراجعة غير صالحة.", [
      "payload must be an object",
    ]);
  }

  const allowedKeys = new Set([
    "startedAt",
    "completedAt",
    "watchedSeconds",
    "declaredComplete",
    "categoryChecks",
    "observations",
  ]);
  for (const key of Object.keys(raw)) {
    if (!allowedKeys.has(key)) errors.push(`unknown field: ${key}`);
  }

  const startedAt = parseIsoDate(raw.startedAt, "startedAt", errors);
  const completedAt = parseIsoDate(raw.completedAt, "completedAt", errors);
  const watchedSeconds = parseInteger(raw.watchedSeconds, "watchedSeconds", errors);
  const declaredComplete = raw.declaredComplete;
  if (declaredComplete !== true) {
    errors.push("declaredComplete must be true");
  }

  if (startedAt && completedAt && Date.parse(completedAt) <= Date.parse(startedAt)) {
    errors.push("completedAt must be after startedAt");
  }
  if (watchedSeconds !== null) {
    if (watchedSeconds < 0 || watchedSeconds > version.runtimeSeconds) {
      errors.push("watchedSeconds outside version runtime");
    }
    const minimumCoverage = Math.ceil(version.runtimeSeconds * 0.95);
    if (watchedSeconds < minimumCoverage) {
      errors.push("watch coverage below 95%");
    }
  }

  const categoryChecks = parseCategoryChecklist(raw.categoryChecks, errors);
  const observations = parseObservations(raw.observations, version, errors);

  if (categoryChecks) {
    const byCategory = new Map<ContentCategory, number>();
    for (const observation of observations) {
      byCategory.set(observation.category, (byCategory.get(observation.category) ?? 0) + 1);
    }

    for (const category of CONTENT_CATEGORIES) {
      const check = categoryChecks[category];
      const count = byCategory.get(category) ?? 0;
      if (check === "uncertain") errors.push(`${category}: uncertain blocks submission`);
      if (check === "present" && count === 0) errors.push(`${category}: present requires observation`);
      if (check === "none" && count > 0) errors.push(`${category}: none conflicts with observations`);
    }
  }

  if (errors.length > 0 || !startedAt || !completedAt || watchedSeconds === null || !categoryChecks) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "المراجعة غير مكتملة أو غير متسقة.", errors);
  }

  return {
    startedAt,
    completedAt,
    watchedSeconds,
    declaredComplete: true,
    categoryChecks,
    observations,
  };
}

function assertActiveActor(actor: InternalActor | null | undefined): asserts actor is InternalActor {
  if (!actor) {
    throw new ReviewWorkflowError("UNAUTHENTICATED", "يلزم تسجيل الدخول.");
  }
  if (actor.status !== "active") {
    throw new ReviewWorkflowError("ACCOUNT_SUSPENDED", "الحساب الداخلي غير نشط.");
  }
}

function isEditableState(state: ReviewAssignmentState): boolean {
  return state === "assigned" || state === "in_progress" || state === "changes_requested";
}

function parseCategoryChecklist(raw: unknown, errors: string[]): CategoryChecklist | null {
  if (!isPlainObject(raw)) {
    errors.push("categoryChecks must be an object");
    return null;
  }

  const allowed = new Set<string>(CONTENT_CATEGORIES);
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) errors.push(`unknown category: ${key}`);
  }

  const output = {} as CategoryChecklist;
  for (const category of CONTENT_CATEGORIES) {
    const value = raw[category];
    if (!isCategoryCheck(value)) {
      errors.push(`${category}: invalid or missing category check`);
      continue;
    }
    output[category] = value;
  }
  return output;
}

function parseObservations(
  raw: unknown,
  version: ReviewVersion,
  errors: string[],
): ContentObservation[] {
  if (!Array.isArray(raw)) {
    errors.push("observations must be an array");
    return [];
  }

  const output: ContentObservation[] = [];
  const ids = new Set<string>();
  for (let index = 0; index < raw.length; index += 1) {
    const value = raw[index];
    const prefix = `observations[${index}]`;
    if (!isPlainObject(value)) {
      errors.push(`${prefix}: must be object`);
      continue;
    }

    const allowedKeys = new Set([
      "id",
      "category",
      "severity",
      "startSecond",
      "endSecond",
      "frequency",
      "context",
      "spoilerLevel",
      "summary",
      "flags",
    ]);
    for (const key of Object.keys(value)) {
      if (!allowedKeys.has(key)) errors.push(`${prefix}: unknown field ${key}`);
    }

    const id = typeof value.id === "string" ? value.id.trim() : "";
    if (!id) errors.push(`${prefix}: id required`);
    else if (ids.has(id)) errors.push(`${prefix}: duplicate id`);
    else ids.add(id);

    const category = value.category;
    if (!isContentCategory(category)) errors.push(`${prefix}: invalid category`);
    const severity = value.severity;
    if (!isObservedSeverity(severity)) errors.push(`${prefix}: invalid severity`);
    const startSecond = parseInteger(value.startSecond, `${prefix}.startSecond`, errors);
    const endSecond = parseInteger(value.endSecond, `${prefix}.endSecond`, errors);
    if (startSecond !== null && endSecond !== null) {
      if (startSecond < 0 || endSecond < startSecond || endSecond > version.runtimeSeconds) {
        errors.push(`${prefix}: timing outside version runtime`);
      }
    }

    const frequency = value.frequency;
    if (!isOneOf(frequency, ["single", "repeated", "sustained"] as const)) {
      errors.push(`${prefix}: invalid frequency`);
    }
    const context = value.context;
    if (!isOneOf(context, ["comic", "neutral", "educational", "threatening", "distressing"] as const)) {
      errors.push(`${prefix}: invalid context`);
    }
    const spoilerLevel = value.spoilerLevel;
    if (!isOneOf(spoilerLevel, ["none", "contextual", "major"] as const)) {
      errors.push(`${prefix}: invalid spoilerLevel`);
    }
    const summary = typeof value.summary === "string" ? value.summary.trim() : "";
    if (!summary) errors.push(`${prefix}: summary required`);
    const flags = parseFlags(value.flags, prefix, errors);
    if (isContentCategory(category)) {
      for (const flag of flags) {
        if (!isContentFlagAllowedForCategory(flag, category)) {
          errors.push(`${prefix}: flag ${flag} is incompatible with category ${category}`);
        }
      }
    }

    if (
      id &&
      isContentCategory(category) &&
      isObservedSeverity(severity) &&
      startSecond !== null &&
      endSecond !== null &&
      isOneOf(frequency, ["single", "repeated", "sustained"] as const) &&
      isOneOf(context, ["comic", "neutral", "educational", "threatening", "distressing"] as const) &&
      isOneOf(spoilerLevel, ["none", "contextual", "major"] as const) &&
      summary
    ) {
      output.push({
        id,
        category,
        severity,
        startSecond,
        endSecond,
        frequency,
        context,
        spoilerLevel,
        summary,
        flags,
      });
    }
  }
  return output;
}

function parseFlags(raw: unknown, prefix: string, errors: string[]): ContentFlag[] {
  if (!Array.isArray(raw)) {
    errors.push(`${prefix}: flags must be an array`);
    return [];
  }
  const output: ContentFlag[] = [];
  const seen = new Set<ContentFlag>();
  for (const value of raw) {
    if (!isContentFlag(value)) {
      errors.push(`${prefix}: unknown flag ${String(value)}`);
      continue;
    }
    if (!seen.has(value)) {
      seen.add(value);
      output.push(value);
    }
  }
  return output;
}

function parseIsoDate(raw: unknown, field: string, errors: string[]): string | null {
  if (typeof raw !== "string" || raw.trim() === "" || Number.isNaN(Date.parse(raw))) {
    errors.push(`${field} must be a valid ISO date`);
    return null;
  }
  return raw;
}

function parseInteger(raw: unknown, field: string, errors: string[]): number | null {
  if (!Number.isInteger(raw)) {
    errors.push(`${field} must be an integer`);
    return null;
  }
  return raw as number;
}

function requireNonEmptyString(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ReviewWorkflowError("INVALID_DRAFT", `${field} مطلوب.`);
  }
  return normalized;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCategoryCheck(value: unknown): value is CategoryCheck {
  return value === "none" || value === "present" || value === "uncertain";
}

function isContentCategory(value: unknown): value is ContentCategory {
  return typeof value === "string" && (CONTENT_CATEGORIES as readonly string[]).includes(value);
}

function isContentFlag(value: unknown): value is ContentFlag {
  return typeof value === "string" && (CONTENT_FLAGS as readonly string[]).includes(value);
}

function isObservedSeverity(value: unknown): value is ObservedSeverity {
  return Number.isInteger(value) && typeof value === "number" && value >= 1 && value <= 4;
}

function isOneOf<const T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}
