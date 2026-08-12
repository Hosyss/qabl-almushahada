"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import {
  approveReviewBundleEditoriallyAction,
  bootstrapInitialAdminAction,
  createReviewAssignmentAction,
  flagReviewConflictAction,
  provisionInternalUserAction,
  requestReviewChangesAction,
  setInternalUserStatusAction,
} from "./management/actions";
import type {
  EditorialObservationUiRow,
  InternalAssignmentUiRow,
  InternalDashboardData,
} from "@/db/internal-ui-service";
import styles from "./internal.module.css";

const ROLE_LABELS = {
  admin: "مشرف",
  review_coordinator: "منسق المراجعات",
  reviewer: "مراجع",
  editorial_reviewer: "معتمد تحريري",
} as const;

const STATE_LABELS: Record<InternalAssignmentUiRow["state"], string> = {
  draft: "مسودة",
  assigned: "مُسندة",
  in_progress: "قيد المراجعة",
  submitted: "مرسلة ومقفلة",
  changes_requested: "مطلوب تعديل",
  approved: "معتمدة",
  conflicted: "متعارضة",
};

const CATEGORY_LABELS: Record<string, string> = {
  fear: "الخوف",
  violence: "العنف",
  language: "اللغة",
  bullying: "التنمر",
  sexualContent: "المحتوى الجنسي",
  substances: "المواد والتدخين",
  discrimination: "التمييز",
  selfHarm: "إيذاء النفس",
  grief: "الفقد والحزن",
  flashingLights: "الومضات الضوئية",
};

export function BootstrapPanel({ email }: { email: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <main className={styles.shell}>
      <section className={styles.heroCard}>
        <span className={styles.eyebrow}>النظام الداخلي</span>
        <h1>تهيئة المشرف الأول</h1>
        <p>
          الحساب الحالي: <strong dir="ltr">{email}</strong>. لن تتم التهيئة إلا إذا كان البريد مطابقًا
          للقيمة المضبوطة على الخادم وكانت قاعدة الحسابات الداخلية فارغة.
        </p>
        <button
          className={styles.primaryButton}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await bootstrapInitialAdminAction();
                window.location.reload();
              } catch (error) {
                setMessage(errorMessage(error));
              }
            })
          }
        >
          {pending ? "جارٍ التحقق…" : "تهيئة المشرف الأول"}
        </button>
        {message && <p className={styles.errorBox}>{message}</p>}
      </section>
    </main>
  );
}

export default function InternalDashboardClient({ data }: { data: InternalDashboardData }) {
  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div>
          <span className={styles.eyebrow}>قبل المشاهدة · نظام المراجعة</span>
          <h1>لوحة {ROLE_LABELS[data.actor.role]}</h1>
          <p>
            مسجل كـ <strong dir="ltr">{data.actor.email}</strong>
            {data.actor.reviewer ? ` · ${data.actor.reviewer.label}` : ""}
          </p>
        </div>
        <Link className={styles.secondaryButton} href="/">
          العودة للموقع
        </Link>
      </header>

      <section className={styles.notice}>
        الواجهة لا تمنح أي صلاحية بنفسها. كل حفظ أو توزيع أو اعتماد يُعاد التحقق منه على الخادم.
      </section>

      {data.actor.role === "admin" && <AdminPanel data={data} />}
      {data.actor.role === "review_coordinator" && <CoordinatorPanel data={data} />}
      {data.actor.role === "reviewer" && <ReviewerPanel data={data} />}
      {data.actor.role === "editorial_reviewer" && <EditorialPanel data={data} />}
    </main>
  );
}

function AdminPanel({ data }: { data: InternalDashboardData }) {
  const [role, setRole] = useState<"admin" | "review_coordinator" | "reviewer" | "editorial_reviewer">("reviewer");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reviewerRole = role === "reviewer" || role === "editorial_reviewer";

  return (
    <>
      <section className={styles.card}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>الحسابات</span><h2>إضافة حساب داخلي</h2></div>
          <span className={styles.muted}>أقل صلاحية لازمة لكل دور</span>
        </div>
        <form
          className={styles.formGrid}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const request: Record<string, unknown> = {
              authEmail: form.get("authEmail"),
              role,
            };
            if (reviewerRole) {
              request.displayLabel = form.get("displayLabel");
              request.independenceGroupId = form.get("independenceGroupId");
            }
            startTransition(async () => {
              try {
                await provisionInternalUserAction(request);
                window.location.reload();
              } catch (error) {
                setMessage(errorMessage(error));
              }
            });
          }}
        >
          <label>البريد<input name="authEmail" type="email" required dir="ltr" /></label>
          <label>الدور<select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
            <option value="reviewer">مراجع</option>
            <option value="editorial_reviewer">معتمد تحريري</option>
            <option value="review_coordinator">منسق مراجعات</option>
            <option value="admin">مشرف</option>
          </select></label>
          {reviewerRole && <>
            <label>اسم العرض<input name="displayLabel" required /></label>
            <label>مجموعة الاستقلال<input name="independenceGroupId" required dir="ltr" /></label>
          </>}
          <div className={styles.formActions}><button className={styles.primaryButton} disabled={pending}>إضافة الحساب</button></div>
        </form>
        {message && <p className={styles.errorBox}>{message}</p>}
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>الحالة</span><h2>الحسابات الحالية</h2></div><strong>{data.users.length}</strong></div>
        <div className={styles.tableWrap}><table><thead><tr><th>البريد</th><th>الدور</th><th>المراجع</th><th>الحالة</th><th>revision</th><th /></tr></thead><tbody>
          {data.users.map((user) => <tr key={user.id}>
            <td dir="ltr">{user.authEmail}</td><td>{ROLE_LABELS[user.role]}</td><td>{user.reviewerLabel ?? "—"}</td><td>{user.status}</td><td>{user.revision}</td>
            <td>{user.status === "active" && user.id !== data.actor.userId ? <button className={styles.dangerButton} disabled={pending} onClick={() => startTransition(async () => {
              try {
                await setInternalUserStatusAction({ targetUserId: user.id, expectedRevision: user.revision, status: "suspended" });
                window.location.reload();
              } catch (error) { setMessage(errorMessage(error)); }
            })}>إيقاف</button> : "—"}</td>
          </tr>)}
        </tbody></table></div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Audit</span><h2>آخر الأحداث الأمنية</h2></div></div>
        <div className={styles.list}>{data.auditEvents.map((event) => <div className={styles.listRow} key={event.id}><div><strong>{event.eventType}</strong><small>{event.entityType} · {event.entityId}</small></div><time>{event.createdAt}</time></div>)}</div>
      </section>
    </>
  );
}

function CoordinatorPanel({ data }: { data: InternalDashboardData }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [bundleId, setBundleId] = useState(data.bundles[0]?.id ?? "");
  const selectedBundle = data.bundles.find((bundle) => bundle.id === bundleId);

  return (
    <>
      <section className={styles.card}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>توزيع</span><h2>إسناد نسخة إلى مراجع</h2></div></div>
        {data.bundles.length === 0 || data.reviewers.length === 0 ? <p className={styles.empty}>يلزم وجود bundle قابلة للمراجعة وحساب مراجع قبل الإسناد.</p> :
        <form className={styles.formGrid} onSubmit={(event) => {
          event.preventDefault();
          if (!selectedBundle) return;
          const form = new FormData(event.currentTarget);
          startTransition(async () => {
            try {
              await createReviewAssignmentAction({ bundleId: selectedBundle.id, reviewerEmail: form.get("reviewerEmail"), expectedBundleRevision: selectedBundle.revision });
              window.location.reload();
            } catch (error) { setMessage(errorMessage(error)); }
          });
        }}>
          <label>النسخة<select value={bundleId} onChange={(event) => setBundleId(event.target.value)}>{data.bundles.map((bundle) => <option value={bundle.id} key={bundle.id}>{bundle.titleName} · {bundle.platform} · rev {bundle.revision}</option>)}</select></label>
          <label>المراجع<select name="reviewerEmail">{data.reviewers.map((reviewer) => <option value={reviewer.authEmail} key={reviewer.reviewerId}>{reviewer.displayLabel} · {reviewer.independenceGroupId}</option>)}</select></label>
          <div className={styles.versionBox}>{selectedBundle && <><strong>{selectedBundle.editionLabel}</strong><span>{selectedBundle.language} · {formatDuration(selectedBundle.runtimeSeconds)}</span><code>{selectedBundle.contentFingerprint}</code></>}</div>
          <div className={styles.formActions}><button className={styles.primaryButton} disabled={pending}>إسناد المهمة</button></div>
        </form>}
        {message && <p className={styles.errorBox}>{message}</p>}
      </section>
      <AssignmentTable assignments={data.assignments} />
    </>
  );
}

function ReviewerPanel({ data }: { data: InternalDashboardData }) {
  return <section className={styles.card}>
    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>مهامي</span><h2>المراجعات المخصصة لي</h2></div><strong>{data.assignments.length}</strong></div>
    {data.assignments.length === 0 ? <p className={styles.empty}>لا توجد مهمة مراجعة مخصصة لك حاليًا.</p> : <div className={styles.assignmentGrid}>{data.assignments.map((assignment) => <article className={styles.assignmentCard} key={assignment.id}>
      <div className={styles.assignmentMeta}><span>{STATE_LABELS[assignment.state]}</span><span>rev {assignment.revision}</span></div>
      <h3>{assignment.titleName}</h3><p>{assignment.editionLabel} · {assignment.platform} · {assignment.language}</p>
      <code>{assignment.contentFingerprint}</code>
      <Link className={styles.primaryButton} href={`/internal/reviews/${encodeURIComponent(assignment.id)}`}>{assignment.state === "submitted" || assignment.state === "approved" ? "عرض المهمة" : assignment.draftPresent ? "استكمال المراجعة" : "بدء المراجعة"}</Link>
    </article>)}</div>}
  </section>;
}

function EditorialPanel({ data }: { data: InternalDashboardData }) {
  const bundles = useMemo(() => {
    const map = new Map<string, InternalAssignmentUiRow[]>();
    for (const assignment of data.assignments) map.set(assignment.bundleId, [...(map.get(assignment.bundleId) ?? []), assignment]);
    return [...map.entries()];
  }, [data.assignments]);

  return <section className={styles.stack}>
    <div className={styles.card}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>التدقيق التحريري</span><h2>الحزم المنتظرة</h2></div><strong>{bundles.length}</strong></div>
      {bundles.length === 0 && <p className={styles.empty}>لا توجد مراجعات مرسلة تنتظر التدقيق.</p>}
    </div>
    {bundles.map(([bundleId, assignments]) => <EditorialBundle key={bundleId} bundleId={bundleId} assignments={assignments} observations={data.observations.filter((item) => assignments.some((assignment) => assignment.id === item.assignmentId))} />)}
  </section>;
}

function EditorialBundle({ bundleId, assignments, observations }: { bundleId: string; assignments: InternalAssignmentUiRow[]; observations: EditorialObservationUiRow[] }) {
  const submitted = assignments.filter((assignment) => assignment.state === "submitted");
  const [note, setNote] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [fingerprintConfirmed, setFingerprintConfirmed] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bundleRevision = assignments[0]?.bundleRevision ?? 0;

  const transition = (assignment: InternalAssignmentUiRow, kind: "changes" | "conflict") => startTransition(async () => {
    try {
      const request = { assignmentId: assignment.id, expectedAssignmentRevision: assignment.revision, expectedBundleRevision: assignment.bundleRevision, note };
      if (kind === "changes") await requestReviewChangesAction(request); else await flagReviewConflictAction(request);
      window.location.reload();
    } catch (error) { setMessage(errorMessage(error)); }
  });

  return <article className={styles.card}>
    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Bundle</span><h2>{assignments[0]?.titleName ?? bundleId}</h2></div><span>bundle rev {bundleRevision}</span></div>
    <div className={styles.versionBox}><span>{assignments[0]?.editionLabel} · {assignments[0]?.platform} · {assignments[0]?.language}</span><code>{assignments[0]?.contentFingerprint}</code></div>
    <label className={styles.fullLabel}>ملاحظة طلب التعديل / التعارض<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="اكتب سببًا واضحًا لا يقل عن 10 أحرف" /></label>
    <div className={styles.assignmentGrid}>{assignments.map((assignment) => <div className={styles.assignmentCard} key={assignment.id}>
      <div className={styles.assignmentMeta}><span>{assignment.reviewerLabel}</span><span>{STATE_LABELS[assignment.state]} · rev {assignment.revision}</span></div>
      <small>مجموعة الاستقلال: {assignment.reviewerIndependenceGroupId}</small>
      {assignment.state === "submitted" && <div className={styles.inlineActions}><button disabled={pending || note.trim().length < 10} onClick={() => transition(assignment, "changes")}>طلب تعديل</button><button className={styles.dangerButton} disabled={pending || note.trim().length < 10} onClick={() => transition(assignment, "conflict")}>تعارض جوهري</button></div>}
    </div>)}</div>

    {submitted.length > 0 && <div className={styles.approvalBox}>
      <h3>Spot checks والاعتماد</h3>
      <p className={styles.muted}>اختر واقعة واحدة على الأقل من كل مراجعة فعالة. الخادم سيعيد فحص الاستقلال والتغطية والتعارضات كلها قبل الاعتماد.</p>
      <div className={styles.observationList}>{observations.map((observation) => <label className={styles.observationRow} key={observation.id}><input type="checkbox" checked={checked.has(observation.id)} onChange={(event) => setChecked((current) => { const next = new Set(current); if (event.target.checked) next.add(observation.id); else next.delete(observation.id); return next; })} /><span><strong>{CATEGORY_LABELS[observation.category] ?? observation.category} · شدة {observation.severity}</strong><small>{formatSecond(observation.startSecond)}–{formatSecond(observation.endSecond)} · {observation.summary}</small></span></label>)}</div>
      <label className={styles.checkLine}><input type="checkbox" checked={fingerprintConfirmed} onChange={(event) => setFingerprintConfirmed(event.target.checked)} /> أؤكد أن المراجعات تخص بصمة النسخة المعروضة أعلاه.</label>
      <label className={styles.fullLabel}>ملاحظات الاعتماد<textarea value={approvalNotes} onChange={(event) => setApprovalNotes(event.target.value)} /></label>
      <button className={styles.primaryButton} disabled={pending || !fingerprintConfirmed} onClick={() => startTransition(async () => {
        try {
          await approveReviewBundleEditoriallyAction({
            bundleId,
            expectedBundleRevision: bundleRevision,
            assignments: submitted.map((assignment) => ({ assignmentId: assignment.id, expectedRevision: assignment.revision })),
            versionFingerprintConfirmed: true,
            notes: approvalNotes,
            spotChecks: [...checked].map((observationId) => ({ observationId, result: "confirmed" })),
          });
          window.location.reload();
        } catch (error) { setMessage(errorMessage(error)); }
      })}>اعتماد الحزمة بعد فحص الجودة</button>
    </div>}
    {message && <p className={styles.errorBox}>{message}</p>}
  </article>;
}

function AssignmentTable({ assignments }: { assignments: InternalAssignmentUiRow[] }) {
  return <section className={styles.card}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>المتابعة</span><h2>حالة المهام</h2></div><strong>{assignments.length}</strong></div>
    {assignments.length === 0 ? <p className={styles.empty}>لا توجد مهام بعد.</p> : <div className={styles.tableWrap}><table><thead><tr><th>العنوان</th><th>المراجع</th><th>الحالة</th><th>revision</th><th>bundle</th></tr></thead><tbody>{assignments.map((assignment) => <tr key={assignment.id}><td>{assignment.titleName}</td><td>{assignment.reviewerLabel}</td><td>{STATE_LABELS[assignment.state]}</td><td>{assignment.revision}</td><td>{assignment.bundleRevision}</td></tr>)}</tbody></table></div>}
  </section>;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "تعذر تنفيذ العملية. أعد تحميل الصفحة وحاول مرة أخرى.";
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `${minutes} دقيقة`;
}

function formatSecond(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}
