import {
  INTERNAL_ROLES,
  ReviewWorkflowError,
  assertCanApproveEditorially,
  hasInternalPermission,
  type InternalActor,
  type InternalRole,
  type ReviewAssignmentScope,
} from "./internal-review-workflow.ts";

export type ProvisionedRole = InternalRole;

export interface InternalUserProvisioningPlan {
  authEmail: string;
  role: ProvisionedRole;
  reviewerProfile: {
    displayLabel: string;
    independenceGroupId: string;
  } | null;
}

export interface ReviewAssignmentCreationPlan {
  bundleId: string;
  reviewerEmail: string;
  expectedBundleRevision: number;
}

export interface EditorialTransitionPlan {
  assignmentId: string;
  expectedAssignmentRevision: number;
  expectedBundleRevision: number;
  note: string;
}

export interface EditorialApprovalPlan {
  bundleId: string;
  expectedBundleRevision: number;
  assignments: Array<{
    assignmentId: string;
    expectedRevision: number;
  }>;
  versionFingerprintConfirmed: true;
  notes: string;
  spotChecks: Array<{
    observationId: string;
    result: "confirmed" | "unresolved";
  }>;
}

export function assertCanManageInternalUsers(actor: InternalActor): void {
  assertActive(actor);
  if (!hasInternalPermission(actor, "manage_internal_users")) {
    throw new ReviewWorkflowError("FORBIDDEN", "هذا الدور لا يملك صلاحية إدارة الحسابات الداخلية.");
  }
}

export function assertCanAssignReviews(actor: InternalActor): void {
  assertActive(actor);
  if (!hasInternalPermission(actor, "assign_reviews")) {
    throw new ReviewWorkflowError("FORBIDDEN", "هذا الدور لا يملك صلاحية توزيع مهام المراجعة.");
  }
}

export function prepareInternalUserProvisioning(
  actor: InternalActor,
  raw: unknown,
): InternalUserProvisioningPlan {
  assertCanManageInternalUsers(actor);
  const input = requirePlainObject(raw, "بيانات الحساب الداخلي غير صالحة.");
  rejectUnknownKeys(input, ["authEmail", "role", "displayLabel", "independenceGroupId"]);

  const authEmail = normalizeEmail(input.authEmail);
  const role = parseRole(input.role);
  const needsReviewer = role === "reviewer" || role === "editorial_reviewer";

  if (!needsReviewer) {
    if (input.displayLabel !== undefined || input.independenceGroupId !== undefined) {
      throw new ReviewWorkflowError(
        "INVALID_DRAFT",
        "حساب Admin أو منسق المراجعات لا يقبل حقول هوية مراجع.",
      );
    }
    return { authEmail, role, reviewerProfile: null };
  }

  return {
    authEmail,
    role,
    reviewerProfile: {
      displayLabel: requireTrimmedString(input.displayLabel, "displayLabel", 2, 120),
      independenceGroupId: requireTrimmedString(
        input.independenceGroupId,
        "independenceGroupId",
        2,
        120,
      ),
    },
  };
}

export function prepareInternalUserStatusChange(
  actor: InternalActor,
  raw: unknown,
): {
  targetUserId: string;
  expectedRevision: number;
  status: "active" | "suspended";
} {
  assertCanManageInternalUsers(actor);
  const input = requirePlainObject(raw, "بيانات تغيير حالة الحساب غير صالحة.");
  rejectUnknownKeys(input, ["targetUserId", "expectedRevision", "status"]);
  const targetUserId = requireTrimmedString(input.targetUserId, "targetUserId", 1, 160);
  const expectedRevision = requireRevision(input.expectedRevision, "expectedRevision");
  const status = input.status;
  if (status !== "active" && status !== "suspended") {
    throw new ReviewWorkflowError("INVALID_DRAFT", "حالة الحساب المطلوبة غير معروفة.");
  }
  if (targetUserId === actor.userId && status === "suspended") {
    throw new ReviewWorkflowError("FORBIDDEN", "لا يمكن للمشرف إيقاف حسابه بنفسه.");
  }
  return { targetUserId, expectedRevision, status };
}

export function prepareReviewAssignmentCreation(
  actor: InternalActor,
  raw: unknown,
): ReviewAssignmentCreationPlan {
  assertCanAssignReviews(actor);
  const input = requirePlainObject(raw, "بيانات توزيع المهمة غير صالحة.");
  rejectUnknownKeys(input, ["bundleId", "reviewerEmail", "expectedBundleRevision"]);
  return {
    bundleId: requireTrimmedString(input.bundleId, "bundleId", 1, 160),
    reviewerEmail: normalizeEmail(input.reviewerEmail),
    expectedBundleRevision: requireRevision(input.expectedBundleRevision, "expectedBundleRevision"),
  };
}

export function prepareEditorialTransition(
  actor: InternalActor,
  assignment: ReviewAssignmentScope,
  raw: unknown,
  allowedStates: readonly ReviewAssignmentScope["state"][],
): EditorialTransitionPlan {
  assertActive(actor);
  if (!hasInternalPermission(actor, "request_review_changes") || !actor.reviewer) {
    throw new ReviewWorkflowError("FORBIDDEN", "هذا الدور لا يملك صلاحية التدقيق التحريري.");
  }
  if (actor.reviewer.status !== "active") {
    throw new ReviewWorkflowError("FORBIDDEN", "المعتمد التحريري غير نشط.");
  }
  if (actor.reviewer.id === assignment.reviewer.id) {
    throw new ReviewWorkflowError("SELF_APPROVAL", "لا يجوز للمستخدم تدقيق مراجعته بنفسه.");
  }
  if (actor.reviewer.independenceGroupId === assignment.reviewer.independenceGroupId) {
    throw new ReviewWorkflowError(
      "EDITOR_NOT_INDEPENDENT",
      "لا يجوز للمعتمد التدخل في مراجعة من نفس مجموعة الاستقلال.",
    );
  }
  if (!allowedStates.includes(assignment.state)) {
    throw new ReviewWorkflowError("ASSIGNMENT_LOCKED", "حالة المهمة لا تسمح بهذا الانتقال.");
  }

  const input = requirePlainObject(raw, "بيانات الانتقال التحريري غير صالحة.");
  rejectUnknownKeys(input, ["assignmentId", "expectedAssignmentRevision", "expectedBundleRevision", "note"]);
  const assignmentId = requireTrimmedString(input.assignmentId, "assignmentId", 1, 160);
  if (assignmentId !== assignment.id) {
    throw new ReviewWorkflowError("ASSIGNMENT_OWNERSHIP", "معرّف المهمة لا يطابق المهمة المحمّلة.");
  }
  const expectedAssignmentRevision = requireRevision(
    input.expectedAssignmentRevision,
    "expectedAssignmentRevision",
  );
  if (expectedAssignmentRevision !== assignment.revision) {
    throw new ReviewWorkflowError("REVISION_CONFLICT", "تم تعديل المهمة؛ أعد تحميلها قبل المتابعة.");
  }
  return {
    assignmentId,
    expectedAssignmentRevision,
    expectedBundleRevision: requireRevision(input.expectedBundleRevision, "expectedBundleRevision"),
    note: requireTrimmedString(input.note, "note", 10, 2000),
  };
}

export function prepareEditorialApproval(
  actor: InternalActor,
  assignments: readonly ReviewAssignmentScope[],
  raw: unknown,
): EditorialApprovalPlan {
  assertActive(actor);
  if (!hasInternalPermission(actor, "approve_editorially") || !actor.reviewer) {
    throw new ReviewWorkflowError("FORBIDDEN", "هذا الدور لا يملك صلاحية الاعتماد التحريري.");
  }
  if (assignments.length === 0) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "لا توجد مراجعات مرسلة لاعتمادها.");
  }
  for (const assignment of assignments) assertCanApproveEditorially(actor, assignment);

  const input = requirePlainObject(raw, "بيانات الاعتماد التحريري غير صالحة.");
  rejectUnknownKeys(input, [
    "bundleId",
    "expectedBundleRevision",
    "assignments",
    "versionFingerprintConfirmed",
    "notes",
    "spotChecks",
  ]);

  const bundleId = requireTrimmedString(input.bundleId, "bundleId", 1, 160);
  if (assignments.some((assignment) => assignment.bundleId !== bundleId)) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "الاعتماد يجمع مهام من حزم مختلفة.");
  }

  if (input.versionFingerprintConfirmed !== true) {
    throw new ReviewWorkflowError(
      "INVALID_DRAFT",
      "يجب تأكيد بصمة النسخة نفسها قبل الاعتماد.",
    );
  }

  if (!Array.isArray(input.assignments)) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "قائمة revisions للمهام مطلوبة.");
  }
  const expectedAssignments = new Map(assignments.map((item) => [item.id, item.revision]));
  const seenAssignments = new Set<string>();
  const assignmentPlans = input.assignments.map((value, index) => {
    const item = requirePlainObject(value, `assignment[${index}] غير صالح.`);
    rejectUnknownKeys(item, ["assignmentId", "expectedRevision"]);
    const assignmentId = requireTrimmedString(item.assignmentId, "assignmentId", 1, 160);
    const expectedRevision = requireRevision(item.expectedRevision, "expectedRevision");
    if (seenAssignments.has(assignmentId)) {
      throw new ReviewWorkflowError("INVALID_DRAFT", "يوجد معرّف مهمة مكرر في الاعتماد.");
    }
    seenAssignments.add(assignmentId);
    if (expectedAssignments.get(assignmentId) !== expectedRevision) {
      throw new ReviewWorkflowError("REVISION_CONFLICT", "revision إحدى المهام قديم أو غير مطابق.");
    }
    return { assignmentId, expectedRevision };
  });
  if (seenAssignments.size !== expectedAssignments.size) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "يجب أن يشمل الاعتماد كل المهام المرسلة الحالية.");
  }
  for (const id of expectedAssignments.keys()) {
    if (!seenAssignments.has(id)) {
      throw new ReviewWorkflowError("INVALID_DRAFT", "هناك مهمة مرسلة لم تدخل في الاعتماد.");
    }
  }

  if (!Array.isArray(input.spotChecks)) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "قائمة spot checks مطلوبة.");
  }
  const seenObservations = new Set<string>();
  const spotChecks = input.spotChecks.map((value, index) => {
    const item = requirePlainObject(value, `spotCheck[${index}] غير صالح.`);
    rejectUnknownKeys(item, ["observationId", "result"]);
    const observationId = requireTrimmedString(item.observationId, "observationId", 1, 160);
    if (seenObservations.has(observationId)) {
      throw new ReviewWorkflowError("INVALID_DRAFT", "يوجد spot check مكرر لنفس الواقعة.");
    }
    seenObservations.add(observationId);
    if (item.result !== "confirmed" && item.result !== "unresolved") {
      throw new ReviewWorkflowError("INVALID_DRAFT", "نتيجة spot check غير معروفة.");
    }
    return { observationId, result: item.result };
  });

  return {
    bundleId,
    expectedBundleRevision: requireRevision(input.expectedBundleRevision, "expectedBundleRevision"),
    assignments: assignmentPlans,
    versionFingerprintConfirmed: true,
    notes: requireTrimmedString(input.notes ?? "", "notes", 0, 4000),
    spotChecks,
  };
}

function assertActive(actor: InternalActor | null | undefined): asserts actor is InternalActor {
  if (!actor) throw new ReviewWorkflowError("UNAUTHENTICATED", "يلزم تسجيل الدخول.");
  if (actor.status !== "active") {
    throw new ReviewWorkflowError("ACCOUNT_SUSPENDED", "الحساب الداخلي غير نشط.");
  }
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new ReviewWorkflowError("INVALID_DRAFT", "البريد الداخلي مطلوب.");
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 3 ||
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "البريد الداخلي غير صالح.");
  }
  return normalized;
}

function parseRole(value: unknown): ProvisionedRole {
  if (typeof value === "string" && (INTERNAL_ROLES as readonly string[]).includes(value)) {
    return value as ProvisionedRole;
  }
  throw new ReviewWorkflowError("INVALID_DRAFT", "الدور الداخلي غير معروف.");
}

function requireRevision(value: unknown, field: string): number {
  if (!Number.isInteger(value) || typeof value !== "number" || value < 0) {
    throw new ReviewWorkflowError("REVISION_CONFLICT", `${field} غير صالح.`);
  }
  return value;
}

function requireTrimmedString(
  value: unknown,
  field: string,
  minLength: number,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new ReviewWorkflowError("INVALID_DRAFT", `${field} يجب أن يكون نصًا.`);
  }
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new ReviewWorkflowError("INVALID_DRAFT", `${field} خارج الطول المسموح.`);
  }
  return normalized;
}

function requirePlainObject(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReviewWorkflowError("INVALID_DRAFT", message);
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(input: Record<string, unknown>, allowedKeys: readonly string[]): void {
  const allowed = new Set(allowedKeys);
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new ReviewWorkflowError(
      "INVALID_DRAFT",
      "الطلب يحتوي حقولًا غير مسموح بها.",
      unknown.map((key) => `unknown field: ${key}`),
    );
  }
}
