import { env } from "cloudflare:workers";

import {
  INTERNAL_ROLES,
  REVIEW_ASSIGNMENT_STATES,
  ReviewWorkflowError,
  type InternalAccountStatus,
  type InternalRole,
  type ReviewAssignmentState,
} from "@/lib/internal-review-workflow";

interface ActorRow {
  userId: string;
  authEmail: string;
  role: string;
  accountStatus: string;
  reviewerId: string | null;
  reviewerLabel: string | null;
  independenceGroupId: string | null;
  reviewerStatus: string | null;
}

export interface InternalUiActor {
  userId: string;
  email: string;
  role: InternalRole;
  status: InternalAccountStatus;
  reviewer: null | {
    id: string;
    label: string;
    independenceGroupId: string;
    status: "active" | "probation" | "suspended";
  };
}

export interface InternalUserUiRow {
  id: string;
  authEmail: string;
  role: InternalRole;
  status: InternalAccountStatus;
  revision: number;
  reviewerLabel: string | null;
  independenceGroupId: string | null;
  reviewerStatus: string | null;
}

export interface InternalBundleUiRow {
  id: string;
  revision: number;
  status: string;
  titleName: string;
  versionId: string;
  editionLabel: string;
  platform: string;
  language: string;
  runtimeSeconds: number;
  contentFingerprint: string;
}

export interface InternalReviewerUiRow {
  authEmail: string;
  reviewerId: string;
  displayLabel: string;
  independenceGroupId: string;
  reviewerStatus: string;
  accountStatus: InternalAccountStatus;
}

export interface InternalAssignmentUiRow {
  id: string;
  bundleId: string;
  bundleRevision: number;
  state: ReviewAssignmentState;
  revision: number;
  submissionId: string | null;
  titleName: string;
  versionId: string;
  editionLabel: string;
  platform: string;
  language: string;
  runtimeSeconds: number;
  contentFingerprint: string;
  reviewerId: string;
  reviewerLabel: string;
  reviewerIndependenceGroupId: string;
  reviewerStatus: string;
  draftPresent: boolean;
}

export interface EditorialObservationUiRow {
  id: string;
  assignmentId: string;
  submissionId: string;
  category: string;
  severity: number;
  startSecond: number;
  endSecond: number;
  summary: string;
}

export interface InternalAuditUiRow {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

export interface InternalDashboardData {
  actor: InternalUiActor;
  users: InternalUserUiRow[];
  bundles: InternalBundleUiRow[];
  reviewers: InternalReviewerUiRow[];
  assignments: InternalAssignmentUiRow[];
  observations: EditorialObservationUiRow[];
  auditEvents: InternalAuditUiRow[];
}

export interface ReviewerEditorData {
  actor: InternalUiActor;
  assignment: InternalAssignmentUiRow;
  draft: unknown | null;
}

export async function loadInternalDashboard(sessionEmail: string): Promise<InternalDashboardData> {
  const actor = await requireUiActor(sessionEmail);
  const empty: Omit<InternalDashboardData, "actor"> = {
    users: [],
    bundles: [],
    reviewers: [],
    assignments: [],
    observations: [],
    auditEvents: [],
  };

  if (actor.role === "admin") {
    const [users, auditEvents] = await Promise.all([loadUsers(), loadInternalAuditEvents()]);
    return { actor, ...empty, users, auditEvents };
  }

  if (actor.role === "review_coordinator") {
    const [bundles, reviewers, assignments] = await Promise.all([
      loadBundles(),
      loadReviewerAccounts(),
      loadAllAssignments(),
    ]);
    return { actor, ...empty, bundles, reviewers, assignments };
  }

  if (actor.role === "reviewer") {
    if (!actor.reviewer) throw new ReviewWorkflowError("FORBIDDEN", "حساب المراجع غير مربوط بهوية مراجع.");
    const assignments = await loadAssignmentsForReviewer(actor.reviewer.id);
    return { actor, ...empty, assignments };
  }

  const [assignments, observations] = await Promise.all([
    loadEditorialAssignments(),
    loadEditorialObservations(),
  ]);
  return { actor, ...empty, assignments, observations };
}

export async function loadReviewerEditor(
  sessionEmail: string,
  assignmentId: string,
): Promise<ReviewerEditorData> {
  const actor = await requireUiActor(sessionEmail);
  if (actor.role !== "reviewer" || !actor.reviewer) {
    throw new ReviewWorkflowError("FORBIDDEN", "هذه الصفحة مخصصة للمراجع المعيّن فقط.");
  }

  const normalizedId = assignmentId.trim();
  if (!normalizedId) throw new ReviewWorkflowError("FORBIDDEN", "معرّف المهمة غير صالح.");

  const row = await requireD1()
    .prepare(`${ASSIGNMENT_SELECT}
      LEFT JOIN review_assignment_drafts d ON d.assignment_id = a.id
      WHERE a.id = ? AND a.reviewer_id = ?
      LIMIT 1`)
    .bind(normalizedId, actor.reviewer.id)
    .first<AssignmentDbRow & { draftPayloadJson: string | null }>();

  if (!row) {
    throw new ReviewWorkflowError("ASSIGNMENT_OWNERSHIP", "المهمة غير موجودة أو ليست مخصصة لهذا المراجع.");
  }
  const assignment = parseAssignment(row);
  let draft: unknown | null = null;
  if (row.draftPayloadJson !== null) {
    try {
      draft = JSON.parse(row.draftPayloadJson) as unknown;
    } catch {
      throw new ReviewWorkflowError("INVALID_DRAFT", "المسودة المخزنة غير صالحة.");
    }
  }

  return { actor, assignment, draft };
}

async function requireUiActor(sessionEmail: string): Promise<InternalUiActor> {
  const normalizedEmail = sessionEmail.trim().toLowerCase();
  if (!normalizedEmail) throw new ReviewWorkflowError("UNAUTHENTICATED", "يلزم تسجيل الدخول.");

  const row = await requireD1()
    .prepare(
      `SELECT
         u.id AS userId,
         u.auth_email AS authEmail,
         u.role AS role,
         u.status AS accountStatus,
         r.id AS reviewerId,
         r.display_label AS reviewerLabel,
         r.independence_group_id AS independenceGroupId,
         r.status AS reviewerStatus
       FROM internal_users u
       LEFT JOIN reviewers r ON r.id = u.reviewer_id
       WHERE u.auth_email = ?
       LIMIT 1`,
    )
    .bind(normalizedEmail)
    .first<ActorRow>();

  if (!row) throw new ReviewWorkflowError("FORBIDDEN", "الحساب غير مضاف إلى النظام الداخلي.");
  const role = parseRole(row.role);
  const status = parseAccountStatus(row.accountStatus);
  if (status !== "active") throw new ReviewWorkflowError("ACCOUNT_SUSPENDED", "الحساب الداخلي غير نشط.");

  let reviewer: InternalUiActor["reviewer"] = null;
  if (row.reviewerId || row.reviewerLabel || row.independenceGroupId || row.reviewerStatus) {
    if (!row.reviewerId || !row.reviewerLabel || !row.independenceGroupId || !isReviewerStatus(row.reviewerStatus)) {
      throw new ReviewWorkflowError("FORBIDDEN", "هوية المراجع المخزنة غير مكتملة أو غير صالحة.");
    }
    reviewer = {
      id: row.reviewerId,
      label: row.reviewerLabel,
      independenceGroupId: row.independenceGroupId,
      status: row.reviewerStatus,
    };
  }
  if ((role === "reviewer" || role === "editorial_reviewer") && !reviewer) {
    throw new ReviewWorkflowError("FORBIDDEN", "الدور الداخلي يتطلب هوية مراجع مرتبطة.");
  }

  return { userId: row.userId, email: row.authEmail, role, status, reviewer };
}

async function loadUsers(): Promise<InternalUserUiRow[]> {
  const result = await requireD1()
    .prepare(
      `SELECT
         u.id AS id,
         u.auth_email AS authEmail,
         u.role AS role,
         u.status AS status,
         u.revision AS revision,
         r.display_label AS reviewerLabel,
         r.independence_group_id AS independenceGroupId,
         r.status AS reviewerStatus
       FROM internal_users u
       LEFT JOIN reviewers r ON r.id = u.reviewer_id
       ORDER BY u.created_at DESC`,
    )
    .all<Record<string, unknown>>();

  return (result.results ?? []).map((row) => ({
    id: requireString(row.id, "user id"),
    authEmail: requireString(row.authEmail, "auth email"),
    role: parseRole(requireString(row.role, "role")),
    status: parseAccountStatus(requireString(row.status, "status")),
    revision: requireRevision(row.revision),
    reviewerLabel: nullableString(row.reviewerLabel),
    independenceGroupId: nullableString(row.independenceGroupId),
    reviewerStatus: nullableString(row.reviewerStatus),
  }));
}

async function loadInternalAuditEvents(): Promise<InternalAuditUiRow[]> {
  const result = await requireD1()
    .prepare(
      `SELECT id, event_type AS eventType, entity_type AS entityType,
              entity_id AS entityId, created_at AS createdAt
       FROM internal_audit_events
       ORDER BY created_at DESC
       LIMIT 50`,
    )
    .all<InternalAuditUiRow>();
  return result.results ?? [];
}

async function loadBundles(): Promise<InternalBundleUiRow[]> {
  const result = await requireD1()
    .prepare(
      `SELECT b.id AS id, b.revision AS revision, b.status AS status,
              t.canonical_name AS titleName, v.id AS versionId,
              v.edition_label AS editionLabel, v.platform AS platform,
              v.language AS language, v.runtime_seconds AS runtimeSeconds,
              v.content_fingerprint AS contentFingerprint
       FROM review_bundles b
       INNER JOIN title_versions v ON v.id = b.version_id
       INNER JOIN titles t ON t.id = v.title_id
       WHERE b.status IN ('draft', 'under_review', 'conflicted')
       ORDER BY b.updated_at DESC`,
    )
    .all<InternalBundleUiRow>();
  return (result.results ?? []).map((row) => ({ ...row, revision: requireRevision(row.revision) }));
}

async function loadReviewerAccounts(): Promise<InternalReviewerUiRow[]> {
  const result = await requireD1()
    .prepare(
      `SELECT u.auth_email AS authEmail, r.id AS reviewerId,
              r.display_label AS displayLabel,
              r.independence_group_id AS independenceGroupId,
              r.status AS reviewerStatus, u.status AS accountStatus
       FROM internal_users u
       INNER JOIN reviewers r ON r.id = u.reviewer_id
       WHERE u.role = 'reviewer'
       ORDER BY r.display_label ASC`,
    )
    .all<Record<string, unknown>>();

  return (result.results ?? []).map((row) => ({
    authEmail: requireString(row.authEmail, "reviewer email"),
    reviewerId: requireString(row.reviewerId, "reviewer id"),
    displayLabel: requireString(row.displayLabel, "reviewer label"),
    independenceGroupId: requireString(row.independenceGroupId, "independence group"),
    reviewerStatus: requireString(row.reviewerStatus, "reviewer status"),
    accountStatus: parseAccountStatus(requireString(row.accountStatus, "account status")),
  }));
}

async function loadAssignmentsForReviewer(reviewerId: string): Promise<InternalAssignmentUiRow[]> {
  const result = await requireD1()
    .prepare(`${ASSIGNMENT_SELECT}
      WHERE a.reviewer_id = ?
      ORDER BY a.updated_at DESC`)
    .bind(reviewerId)
    .all<AssignmentDbRow>();
  return (result.results ?? []).map(parseAssignment);
}

async function loadAllAssignments(): Promise<InternalAssignmentUiRow[]> {
  const result = await requireD1()
    .prepare(`${ASSIGNMENT_SELECT}
      ORDER BY a.updated_at DESC
      LIMIT 200`)
    .all<AssignmentDbRow>();
  return (result.results ?? []).map(parseAssignment);
}

async function loadEditorialAssignments(): Promise<InternalAssignmentUiRow[]> {
  const result = await requireD1()
    .prepare(`${ASSIGNMENT_SELECT}
      WHERE a.state IN ('submitted', 'conflicted', 'changes_requested')
      ORDER BY a.updated_at DESC`)
    .all<AssignmentDbRow>();
  return (result.results ?? []).map(parseAssignment);
}

async function loadEditorialObservations(): Promise<EditorialObservationUiRow[]> {
  const result = await requireD1()
    .prepare(
      `SELECT o.id AS id, a.id AS assignmentId, o.submission_id AS submissionId,
              o.category AS category, o.severity AS severity,
              o.start_second AS startSecond, o.end_second AS endSecond,
              o.summary AS summary
       FROM review_assignments a
       INNER JOIN observations o ON o.submission_id = a.submission_id
       WHERE a.state = 'submitted'
       ORDER BY a.bundle_id, a.created_at, o.start_second`,
    )
    .all<EditorialObservationUiRow>();
  return result.results ?? [];
}

interface AssignmentDbRow {
  id: string;
  bundleId: string;
  bundleRevision: number;
  state: string;
  revision: number;
  submissionId: string | null;
  titleName: string;
  versionId: string;
  editionLabel: string;
  platform: string;
  language: string;
  runtimeSeconds: number;
  contentFingerprint: string;
  reviewerId: string;
  reviewerLabel: string;
  reviewerIndependenceGroupId: string;
  reviewerStatus: string;
  draftPresent: number;
}

const ASSIGNMENT_SELECT = `SELECT
    a.id AS id,
    a.bundle_id AS bundleId,
    b.revision AS bundleRevision,
    a.state AS state,
    a.revision AS revision,
    a.submission_id AS submissionId,
    t.canonical_name AS titleName,
    v.id AS versionId,
    v.edition_label AS editionLabel,
    v.platform AS platform,
    v.language AS language,
    v.runtime_seconds AS runtimeSeconds,
    v.content_fingerprint AS contentFingerprint,
    r.id AS reviewerId,
    r.display_label AS reviewerLabel,
    r.independence_group_id AS reviewerIndependenceGroupId,
    r.status AS reviewerStatus,
    CASE WHEN d.assignment_id IS NULL THEN 0 ELSE 1 END AS draftPresent
  FROM review_assignments a
  INNER JOIN review_bundles b ON b.id = a.bundle_id AND b.version_id = a.version_id
  INNER JOIN title_versions v ON v.id = a.version_id
  INNER JOIN titles t ON t.id = v.title_id
  INNER JOIN reviewers r ON r.id = a.reviewer_id
  LEFT JOIN review_assignment_drafts d ON d.assignment_id = a.id`;

function parseAssignment(row: AssignmentDbRow): InternalAssignmentUiRow {
  if (!isReviewerStatus(row.reviewerStatus)) {
    throw new ReviewWorkflowError("FORBIDDEN", "حالة المراجع المخزنة غير معروفة.");
  }
  return {
    id: row.id,
    bundleId: row.bundleId,
    bundleRevision: requireRevision(row.bundleRevision),
    state: parseAssignmentState(row.state),
    revision: requireRevision(row.revision),
    submissionId: row.submissionId,
    titleName: row.titleName,
    versionId: row.versionId,
    editionLabel: row.editionLabel,
    platform: row.platform,
    language: row.language,
    runtimeSeconds: row.runtimeSeconds,
    contentFingerprint: row.contentFingerprint,
    reviewerId: row.reviewerId,
    reviewerLabel: row.reviewerLabel,
    reviewerIndependenceGroupId: row.reviewerIndependenceGroupId,
    reviewerStatus: row.reviewerStatus,
    draftPresent: row.draftPresent === 1,
  };
}

function parseRole(value: string): InternalRole {
  if ((INTERNAL_ROLES as readonly string[]).includes(value)) return value as InternalRole;
  throw new ReviewWorkflowError("FORBIDDEN", "دور داخلي مخزن غير معروف.");
}

function parseAccountStatus(value: string): InternalAccountStatus {
  if (value === "active" || value === "suspended") return value;
  throw new ReviewWorkflowError("FORBIDDEN", "حالة حساب داخلي مخزنة غير معروفة.");
}

function parseAssignmentState(value: string): ReviewAssignmentState {
  if ((REVIEW_ASSIGNMENT_STATES as readonly string[]).includes(value)) return value as ReviewAssignmentState;
  throw new ReviewWorkflowError("FORBIDDEN", "حالة مهمة مخزنة غير معروفة.");
}

function isReviewerStatus(value: unknown): value is "active" | "probation" | "suspended" {
  return value === "active" || value === "probation" || value === "suspended";
}

function requireRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ReviewWorkflowError("FORBIDDEN", "revision مخزن غير صالح.");
  }
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ReviewWorkflowError("FORBIDDEN", `${field} مخزن غير صالح.`);
  }
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function requireD1() {
  if (!env.DB) throw new Error("D1 binding `DB` is unavailable.");
  return env.DB;
}
