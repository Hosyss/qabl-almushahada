"use client";

import { FormEvent, useId, useState } from "react";

import {
  PUBLIC_REPORT_MESSAGE_MAX,
  PUBLIC_REPORT_MESSAGE_MIN,
  type PublicReportReason,
  type PublicReportTargetKind,
} from "@/lib/public-report-intake";

import styles from "./public-report-form.module.css";

const REASON_OPTIONS: ReadonlyArray<{ value: PublicReportReason; label: string }> = [
  { value: "wrong_version", label: "النسخة المرتبطة بالمراجعة غير صحيحة" },
  { value: "missing_content", label: "هناك محتوى مهم غير مذكور" },
  { value: "incorrect_content", label: "هناك معلومة غير صحيحة" },
  { value: "source_issue", label: "هناك مشكلة في مصدر أو مرجع" },
  { value: "spoiler", label: "هناك حرق للأحداث يحتاج مراجعة" },
  { value: "other", label: "سبب آخر" },
];

type ReportResponse = {
  accepted?: boolean;
  referenceId?: string;
  message?: string;
  errorsAr?: string[];
};

export default function PublicReportForm({
  targetKind,
  targetId,
}: {
  targetKind: PublicReportTargetKind;
  targetId: string;
}) {
  const reasonId = useId();
  const messageId = useId();
  const statusId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string; referenceId?: string } | null>(null);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const reason = String(data.get("reason") ?? "") as PublicReportReason;
    const message = String(data.get("message") ?? "").trim();
    const website = String(data.get("website") ?? "").trim();

    setSubmitting(true);
    setStatus(null);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetKind, targetId, reason, message, website }),
      });
      const payload = (await response.json().catch(() => ({}))) as ReportResponse;

      if (response.status === 202 && payload.accepted === true) {
        setStatus({
          tone: "success",
          message: payload.message ?? "وصل البلاغ للمراجعة.",
          referenceId: payload.referenceId,
        });
        form.reset();
        return;
      }

      const errors = Array.isArray(payload.errorsAr) ? payload.errorsAr.filter(Boolean) : [];
      const fallback =
        response.status === 429
          ? "تم استلام عدد كافٍ من البلاغات حاليًا. حاول لاحقًا إذا بقيت المشكلة دون تصحيح."
          : response.status === 503
            ? "قناة البلاغ غير متاحة مؤقتًا. لم يتغير أي حكم منشور."
            : payload.message || "تعذر إرسال البلاغ. راجع البيانات وحاول مرة أخرى.";
      setStatus({ tone: "error", message: errors.length ? errors.join(" — ") : fallback });
    } catch {
      setStatus({ tone: "error", message: "تعذر الاتصال بقناة البلاغ. لم يتغير أي حكم منشور." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.section} aria-labelledby={`${statusId}-title`}>
      <details className={styles.panel}>
        <summary id={`${statusId}-title`}>الإبلاغ عن مشكلة في هذه المراجعة</summary>
        <div className={styles.content}>
          <p className={styles.intro}>
            استخدم هذا النموذج إذا وجدت معلومة غير صحيحة أو ناقصة أو مشكلة في المصدر. البلاغ لا يغيّر الحكم المنشور تلقائيًا؛ يُراجع أولًا ضمن دورة التصحيح.
          </p>

          <form className={styles.form} onSubmit={submitReport} aria-describedby={`${statusId}-privacy`}>
            <div className={styles.field}>
              <label htmlFor={reasonId}>سبب البلاغ</label>
              <select id={reasonId} name="reason" defaultValue="incorrect_content" required>
                {REASON_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor={messageId}>ما الذي يحتاج إلى مراجعة؟</label>
              <textarea
                id={messageId}
                name="message"
                minLength={PUBLIC_REPORT_MESSAGE_MIN}
                maxLength={PUBLIC_REPORT_MESSAGE_MAX}
                rows={5}
                required
                placeholder="اكتب وصفًا واضحًا للمعلومة أو المصدر الذي يحتاج إلى تصحيح."
              />
              <small>من {PUBLIC_REPORT_MESSAGE_MIN} إلى {PUBLIC_REPORT_MESSAGE_MAX} حرفًا. لا ترسل بيانات شخصية.</small>
            </div>

            <div className={styles.honeypot} aria-hidden="true">
              <label htmlFor={`${messageId}-website`}>اترك هذا الحقل فارغًا</label>
              <input id={`${messageId}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <p className={styles.privacy} id={`${statusId}-privacy`}>
              لا نطلب بريدًا إلكترونيًا أو حسابًا. تُستخدم بيانات الاتصال التقنية فقط لتقليل الإساءة وفق سياسة الخصوصية.
            </p>

            <button className={styles.submit} type="submit" disabled={submitting}>
              {submitting ? "جارٍ إرسال البلاغ…" : "إرسال البلاغ للمراجعة"}
            </button>
          </form>

          {status ? (
            <div
              className={status.tone === "success" ? styles.success : styles.error}
              role={status.tone === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              <strong>{status.tone === "success" ? "تم استلام البلاغ" : "تعذر إرسال البلاغ"}</strong>
              <p>{status.message}</p>
              {status.referenceId ? <p className={styles.reference}>مرجع المتابعة: <code dir="ltr">{status.referenceId}</code></p> : null}
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}
