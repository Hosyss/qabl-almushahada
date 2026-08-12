"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { saveReviewDraftAction, submitReviewAssignmentAction } from "./actions";
import type { ReviewerEditorData } from "@/db/internal-ui-service";
import { CONTENT_CATEGORIES, CONTENT_FLAGS, type ContentCategory, type ContentFlag } from "@/lib/review-engine/types";
import styles from "../internal.module.css";

const CATEGORY_LABELS: Record<ContentCategory, string> = {
  fear: "الخوف والفزع",
  violence: "العنف",
  language: "الألفاظ واللغة",
  bullying: "التنمر",
  sexualContent: "المحتوى الجنسي",
  substances: "التدخين والمواد",
  discrimination: "التمييز",
  selfHarm: "إيذاء النفس",
  grief: "الفقد والحزن",
  flashingLights: "الومضات الضوئية",
};

const FLAG_LABELS: Record<ContentFlag, string> = {
  jump_scare: "فزعة مفاجئة",
  blood: "دماء",
  weapon: "سلاح",
  verbal_bullying: "تنمر لفظي",
  physical_bullying: "تنمر جسدي",
  bereavement: "وفاة/فقد",
  separation: "انفصال",
  flashing_sequence: "وميض متكرر",
};

type CategoryCheck = "none" | "present" | "uncertain";
type ObservationDraft = {
  id: string;
  category: ContentCategory;
  severity: 1 | 2 | 3 | 4;
  startSecond: number;
  endSecond: number;
  frequency: "single" | "repeated" | "sustained";
  context: "comic" | "neutral" | "educational" | "threatening" | "distressing";
  spoilerLevel: "none" | "contextual" | "major";
  summary: string;
  flags: ContentFlag[];
};

type EditableDraft = {
  startedAt: string;
  completedAt: string;
  watchedSeconds: number;
  declaredComplete: boolean;
  categoryChecks: Record<ContentCategory, CategoryCheck>;
  observations: ObservationDraft[];
};

export default function ReviewEditor({ data }: { data: ReviewerEditorData }) {
  const initial = useMemo(() => normalizeDraft(data.draft), [data.draft]);
  const [startedAt, setStartedAt] = useState(toLocalInput(initial.startedAt));
  const [completedAt, setCompletedAt] = useState(toLocalInput(initial.completedAt));
  const [watchedMinutes, setWatchedMinutes] = useState(
    initial.watchedSeconds > 0 ? String(Math.round(initial.watchedSeconds / 60)) : "",
  );
  const [declaredComplete, setDeclaredComplete] = useState(initial.declaredComplete);
  const [checks, setChecks] = useState(initial.categoryChecks);
  const [observations, setObservations] = useState(initial.observations);
  const [revision, setRevision] = useState(data.assignment.revision);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const locked = data.assignment.state === "submitted" || data.assignment.state === "approved";
  const runtimeMinutes = Math.ceil(data.assignment.runtimeSeconds / 60);
  const minimumMinutes = Math.ceil((data.assignment.runtimeSeconds * 0.95) / 60);

  const payload = (): EditableDraft => ({
    startedAt: toIso(startedAt),
    completedAt: toIso(completedAt),
    watchedSeconds: Math.round(Number(watchedMinutes) * 60),
    declaredComplete,
    categoryChecks: checks,
    observations,
  });

  const save = () => startTransition(async () => {
    setMessage(null);
    setSuccess(null);
    try {
      const result = await saveReviewDraftAction({ assignmentId: data.assignment.id, expectedRevision: revision, draft: payload() });
      setRevision(result.revision);
      setSuccess(`تم حفظ المسودة. revision ${result.revision}`);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  });

  const submit = () => startTransition(async () => {
    setMessage(null);
    setSuccess(null);
    try {
      const saved = await saveReviewDraftAction({ assignmentId: data.assignment.id, expectedRevision: revision, draft: payload() });
      setRevision(saved.revision);
      await submitReviewAssignmentAction({ assignmentId: data.assignment.id, expectedRevision: saved.revision });
      window.location.href = "/internal";
    } catch (error) {
      setMessage(errorMessage(error));
    }
  });

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div>
          <span className={styles.eyebrow}>مراجعة نسخة محددة</span>
          <h1>{data.assignment.titleName}</h1>
          <p>{data.assignment.editionLabel} · {data.assignment.platform} · {data.assignment.language} · {runtimeMinutes} دقيقة</p>
        </div>
        <Link className={styles.secondaryButton} href="/internal">العودة للمهام</Link>
      </header>

      <section className={styles.notice}>
        المهمة مرتبطة ببصمة النسخة: <code dir="ltr">{data.assignment.contentFingerprint}</code> · revision الحالي: {revision}.
        تغيير المراجع أو النسخة غير متاح من هذا النموذج.
      </section>

      {locked && <section className={styles.notice}>هذه المهمة مقفلة في حالة {data.assignment.state}. يمكنك قراءة المسودة فقط، ولا يقبل الخادم أي تعديل جديد.</section>}

      <section className={styles.card}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>التغطية</span><h2>وقت المشاهدة</h2></div><span className={styles.muted}>الحد الأدنى للإرسال: {minimumMinutes} دقيقة تقريبًا (95%)</span></div>
        <div className={styles.formGrid}>
          <label>بدأت المشاهدة<input type="datetime-local" value={startedAt} disabled={locked} onChange={(event) => setStartedAt(event.target.value)} /></label>
          <label>انتهت المشاهدة<input type="datetime-local" value={completedAt} disabled={locked} onChange={(event) => setCompletedAt(event.target.value)} /></label>
          <label>مدة المشاهدة بالدقائق<input type="number" min="0" max={runtimeMinutes} value={watchedMinutes} disabled={locked} onChange={(event) => setWatchedMinutes(event.target.value)} /></label>
          <label className={styles.checkLine}><input type="checkbox" checked={declaredComplete} disabled={locked} onChange={(event) => setDeclaredComplete(event.target.checked)} /> أقر أنني فحصت كل المحاور أدناه صراحة.</label>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Checklist كامل</span><h2>كل محور يجب أن يكون محسومًا</h2></div></div>
        <div className={styles.categoryGrid}>
          {CONTENT_CATEGORIES.map((category) => {
            const count = observations.filter((item) => item.category === category).length;
            return <div className={styles.categoryRow} key={category}>
              <div><strong>{CATEGORY_LABELS[category]}</strong><small>{count > 0 ? `${count} واقعة` : "لا توجد وقائع"}</small></div>
              <select value={checks[category]} disabled={locked} onChange={(event) => setChecks((current) => ({ ...current, [category]: event.target.value as CategoryCheck }))}>
                <option value="uncertain">غير محسوم — يوقف الإرسال</option>
                <option value="none">غير موجود</option>
                <option value="present">موجود</option>
              </select>
              <button type="button" disabled={locked} onClick={() => addObservation(category)}>إضافة واقعة</button>
            </div>;
          })}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>الوقائع</span><h2>التوقيت والشدة والسياق</h2></div><strong>{observations.length}</strong></div>
        {observations.length === 0 ? <p className={styles.empty}>لا توجد وقائع مسجلة. أي محور «موجود» يحتاج واقعة واحدة على الأقل قبل الإرسال.</p> : <div className={styles.stack}>
          {observations.map((observation, index) => <ObservationEditor key={observation.id} observation={observation} index={index} locked={locked} runtimeSeconds={data.assignment.runtimeSeconds} onChange={(next) => setObservations((current) => current.map((item) => item.id === next.id ? next : item))} onRemove={() => setObservations((current) => current.filter((item) => item.id !== observation.id))} />)}
        </div>}
      </section>

      {!locked && <section className={styles.actionBar}>
        <div><strong>الحفظ لا يعني اعتمادًا.</strong><small>الإرسال النهائي يعيد كل validation على الخادم ثم يقفل المهمة.</small></div>
        <div className={styles.inlineActions}><button disabled={pending} onClick={save}>حفظ مسودة</button><button className={styles.primaryButton} disabled={pending} onClick={submit}>إرسال وقفل المراجعة</button></div>
      </section>}
      {success && <p className={styles.successBox}>{success}</p>}
      {message && <p className={styles.errorBox}>{message}</p>}
    </main>
  );

  function addObservation(category: ContentCategory) {
    setChecks((current) => ({ ...current, [category]: "present" }));
    setObservations((current) => [...current, {
      id: crypto.randomUUID(), category, severity: 1, startSecond: 0, endSecond: 0,
      frequency: "single", context: "neutral", spoilerLevel: "none", summary: "", flags: [],
    }]);
  }
}

function ObservationEditor({ observation, index, locked, runtimeSeconds, onChange, onRemove }: { observation: ObservationDraft; index: number; locked: boolean; runtimeSeconds: number; onChange: (value: ObservationDraft) => void; onRemove: () => void }) {
  const patch = <K extends keyof ObservationDraft>(key: K, value: ObservationDraft[K]) => onChange({ ...observation, [key]: value });
  return <article className={styles.observationEditor}>
    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>واقعة {index + 1}</span><h3>{CATEGORY_LABELS[observation.category]}</h3></div>{!locked && <button className={styles.dangerButton} type="button" onClick={onRemove}>حذف الواقعة</button>}</div>
    <div className={styles.formGrid}>
      <label>المحور<select disabled={locked} value={observation.category} onChange={(event) => patch("category", event.target.value as ContentCategory)}>{CONTENT_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select></label>
      <label>الشدة<select disabled={locked} value={observation.severity} onChange={(event) => patch("severity", Number(event.target.value) as 1 | 2 | 3 | 4)}><option value="1">1 — منخفضة</option><option value="2">2 — متوسطة</option><option value="3">3 — عالية</option><option value="4">4 — شديدة</option></select></label>
      <label>بداية الواقعة بالثواني<input disabled={locked} type="number" min="0" max={runtimeSeconds} value={observation.startSecond} onChange={(event) => patch("startSecond", Number(event.target.value))} /></label>
      <label>نهاية الواقعة بالثواني<input disabled={locked} type="number" min="0" max={runtimeSeconds} value={observation.endSecond} onChange={(event) => patch("endSecond", Number(event.target.value))} /></label>
      <label>التكرار<select disabled={locked} value={observation.frequency} onChange={(event) => patch("frequency", event.target.value as ObservationDraft["frequency"])}><option value="single">مرة واحدة</option><option value="repeated">متكرر</option><option value="sustained">ممتد</option></select></label>
      <label>السياق<select disabled={locked} value={observation.context} onChange={(event) => patch("context", event.target.value as ObservationDraft["context"])}><option value="neutral">محايد</option><option value="comic">كوميدي</option><option value="educational">تعليمي</option><option value="threatening">مهدد</option><option value="distressing">مزعج/مؤلم</option></select></label>
      <label>درجة الحرق<select disabled={locked} value={observation.spoilerLevel} onChange={(event) => patch("spoilerLevel", event.target.value as ObservationDraft["spoilerLevel"])}><option value="none">بدون حرق</option><option value="contextual">سياقي</option><option value="major">حرق كبير</option></select></label>
    </div>
    <label className={styles.fullLabel}>وصف واقعي مختصر<textarea disabled={locked} value={observation.summary} onChange={(event) => patch("summary", event.target.value)} placeholder="صف ما ظهر، لا تحكم على ملاءمته للأسرة هنا." /></label>
    <div className={styles.flagGrid}>{CONTENT_FLAGS.map((flag) => <label className={styles.checkLine} key={flag}><input type="checkbox" disabled={locked} checked={observation.flags.includes(flag)} onChange={(event) => patch("flags", event.target.checked ? [...observation.flags, flag] : observation.flags.filter((item) => item !== flag))} /> {FLAG_LABELS[flag]}</label>)}</div>
  </article>;
}

function normalizeDraft(raw: unknown): EditableDraft {
  const checks = Object.fromEntries(CONTENT_CATEGORIES.map((category) => [category, "uncertain"])) as Record<ContentCategory, CategoryCheck>;
  const fallback: EditableDraft = { startedAt: "", completedAt: "", watchedSeconds: 0, declaredComplete: false, categoryChecks: checks, observations: [] };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const value = raw as Record<string, unknown>;
  if (value.categoryChecks && typeof value.categoryChecks === "object" && !Array.isArray(value.categoryChecks)) {
    const stored = value.categoryChecks as Record<string, unknown>;
    for (const category of CONTENT_CATEGORIES) if (stored[category] === "none" || stored[category] === "present" || stored[category] === "uncertain") checks[category] = stored[category];
  }
  const observations = Array.isArray(value.observations) ? value.observations.filter(isObservationDraft) : [];
  return {
    startedAt: typeof value.startedAt === "string" ? value.startedAt : "",
    completedAt: typeof value.completedAt === "string" ? value.completedAt : "",
    watchedSeconds: typeof value.watchedSeconds === "number" && Number.isInteger(value.watchedSeconds) ? value.watchedSeconds : 0,
    declaredComplete: value.declaredComplete === true,
    categoryChecks: checks,
    observations,
  };
}

function isObservationDraft(value: unknown): value is ObservationDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && CONTENT_CATEGORIES.includes(row.category as ContentCategory) && Number.isInteger(row.severity) && typeof row.startSecond === "number" && typeof row.endSecond === "number" && typeof row.summary === "string" && Array.isArray(row.flags);
}

function toLocalInput(value: string): string {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "تعذر تنفيذ العملية. راجع البيانات ثم حاول مرة أخرى.";
}
