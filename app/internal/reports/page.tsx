import Link from "next/link";

import { requireInternalSessionUser } from "@/app/internal-session";
import {
  listPublicReportIntakes,
  type PublicReportQueueItem,
} from "@/db/public-report-triage-service";

import styles from "../internal.module.css";
import {
  dismissPublicReportIntakeAction,
  promotePublicReportIntakeAction,
} from "./actions";

const TARGET_LABELS: Record<PublicReportQueueItem["targetKind"], string> = {
  human_review: "مراجعة بشرية موثقة",
  evidence_publication: "مراجعة مبنية على الأدلة",
  editorial_publication: "تحليل تحريري",
};

const REASON_LABELS: Record<string, string> = {
  wrong_version: "النسخة أو العمل غير صحيح",
  missing_content: "محتوى مهم غير مذكور",
  incorrect_content: "معلومة تحتاج تصحيحًا",
  source_issue: "مشكلة في المصدر",
  spoiler: "حرق أو وصف كاشف",
  other: "سبب آخر",
};

export default async function InternalPublicReportsPage() {
  const sessionUser = await requireInternalSessionUser();
  const items = await listPublicReportIntakes({ sessionEmail: sessionUser.email, limit: 100 });
  const received = items.filter((item) => item.status === "received");

  return (
    <main className={styles.shell} dir="rtl">
      <header className={styles.topbar}>
        <div>
          <span className={styles.eyebrow}>قبل المشاهدة · Public report intake</span>
          <h1>بلاغات الجمهور</h1>
          <p>كل بلاغ مرتبط بلقطة server-side من المحتوى الذي كان منشورًا وقت الاستقبال.</p>
        </div>
        <Link className={styles.secondaryButton} href="/internal">
          العودة للنظام الداخلي
        </Link>
      </header>

      <section className={styles.notice}>
        البلاغ العام لا يسقط اعتمادًا تلقائيًا. التصعيد الجوهري متاح فقط للمراجعة البشرية ذات دورة
        التصحيح المكتملة، وبعد قرار مراجع تحريري نشط. بلاغات التحليل التحريري والأدلة تبقى محفوظة
        في قائمة الاستقبال حتى تعتمد لها دورة تصحيح مستقلة.
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>Needs triage</span>
            <h2>بانتظار المراجعة</h2>
          </div>
          <strong>{received.length}</strong>
        </div>

        {received.length === 0 ? (
          <p className={styles.empty}>لا توجد بلاغات جديدة.</p>
        ) : (
          <div className={styles.stack}>
            {received.map((item) => (
              <ReportCard item={item} key={item.id} />
            ))}
          </div>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>History</span>
            <h2>آخر الحالات المحسومة</h2>
          </div>
          <strong>{items.length - received.length}</strong>
        </div>
        {items.filter((item) => item.status !== "received").length === 0 ? (
          <p className={styles.empty}>لا يوجد تاريخ حسم بعد.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>النوع</th>
                  <th>المعرّف</th>
                  <th>السبب</th>
                  <th>الحالة</th>
                  <th>revision</th>
                  <th>الاستقبال</th>
                </tr>
              </thead>
              <tbody>
                {items
                  .filter((item) => item.status !== "received")
                  .map((item) => (
                    <tr key={item.id}>
                      <td>{TARGET_LABELS[item.targetKind]}</td>
                      <td dir="ltr">{item.targetPublicId}</td>
                      <td>{REASON_LABELS[item.reportReason] ?? item.reportReason}</td>
                      <td>{item.status === "promoted" ? "صُعّد لدورة التصحيح" : "رُفض بعد المراجعة"}</td>
                      <td>{item.revision}</td>
                      <td>{formatDate(item.createdAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function ReportCard({ item }: { item: PublicReportQueueItem }) {
  const canPromote = item.targetKind === "human_review";
  return (
    <article className={styles.card}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>{TARGET_LABELS[item.targetKind]}</span>
          <h2>{REASON_LABELS[item.reportReason] ?? item.reportReason}</h2>
        </div>
        <strong>#{item.revision}</strong>
      </div>

      <p>{item.message}</p>
      <p className={styles.muted}>
        الهدف: <span dir="ltr">{item.targetPublicId}</span> · snapshot revision {item.targetRevision} · استُقبل {formatDate(item.createdAt)}
      </p>

      <form action={dismissPublicReportIntakeAction} className={styles.stack}>
        <input type="hidden" name="intakeId" value={item.id} />
        <input type="hidden" name="expectedRevision" value={item.revision} />
        <label className={styles.fullLabel}>
          سبب الرفض بعد التحقق
          <textarea name="note" minLength={10} maxLength={2000} required />
        </label>
        <div className={styles.formActions}>
          <button className={styles.dangerButton} type="submit">رفض البلاغ</button>
        </div>
      </form>

      {canPromote ? (
        <form action={promotePublicReportIntakeAction} className={styles.stack}>
          <input type="hidden" name="intakeId" value={item.id} />
          <input type="hidden" name="expectedRevision" value={item.revision} />
          <div className={styles.formGrid}>
            <label>
              التصنيف الجوهري بعد التحقق
              <select name="materialReportType" defaultValue="missing_event" required>
                <option value="different_version">نسخة مختلفة</option>
                <option value="missing_event">واقعة مفقودة</option>
                <option value="wrong_severity">شدة غير صحيحة</option>
                <option value="spoiler">مشكلة حرق</option>
                <option value="other">سبب آخر</option>
              </select>
            </label>
          </div>
          <label className={styles.fullLabel}>
            ملاحظة قرار التصعيد
            <textarea name="note" minLength={10} maxLength={2000} required />
          </label>
          <div className={styles.formActions}>
            <button className={styles.primaryButton} type="submit">تصعيد لدورة التصحيح</button>
          </div>
        </form>
      ) : (
        <p className={styles.notice}>
          لا يوجد تصعيد آلي لهذا النوع في هذا الـcheckpoint؛ الاحتفاظ بالبلاغ مقصود حتى لا نخترع
          دورة تصحيح غير موجودة.
        </p>
      )}
    </article>
  );
}

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(parsed));
}
