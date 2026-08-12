import Link from "next/link";

import { requireInternalSessionUser } from "@/app/internal-session";
import {
  loadInternalQualityDashboard,
  type InternalQualityDashboardData,
  type QualityReferenceAttemptRow,
  type QualityReviewerCalibrationRow,
  type QualitySafetyHoldRow,
} from "@/db/internal-quality-dashboard-service";

import styles from "../internal.module.css";

const HOLD_SOURCE_LABELS: Record<QualitySafetyHoldRow["source"], string> = {
  automatic_audit_pattern: "نمط تدقيق تلقائي",
  manual_collusion_suspicion: "تحقيق بشري",
};

const HOLD_TRIGGER_LABELS: Record<string, string> = {
  HIGH_SENSITIVITY_EVENT_MISSED: "حدث عالي الحساسية فائت",
  EXTREME_SEVERITY_GAP: "فرق شدة = 3",
  REPEATED_CORRECTIONS: "تصحيحات متكررة",
  REPEATED_MISSED_EVENTS: "أحداث فائتة متكررة",
  REPEATED_LARGE_SEVERITY_GAPS: "فروق شدة كبيرة متكررة",
  COLLUSION_SUSPICION: "اشتباه يحتاج تحقيقًا",
};

const REFERENCE_PURPOSE_LABELS: Record<QualityReferenceAttemptRow["purpose"], string> = {
  initial: "تفعيل أولي",
  reactivation: "إعادة تفعيل",
  drift: "فحص انحراف",
};

const REFERENCE_STATUS_LABELS: Record<QualityReferenceAttemptRow["status"], string> = {
  in_progress: "قيد التنفيذ",
  passed: "اجتاز",
  failed: "لم يجتز",
};

export default async function InternalQualityDashboardPage() {
  const sessionUser = await requireInternalSessionUser();
  const data = await loadInternalQualityDashboard(sessionUser.email);

  return (
    <main className={styles.shell} dir="rtl">
      <header className={styles.topbar}>
        <div>
          <span className={styles.eyebrow}>قبل المشاهدة · Evidence dashboard</span>
          <h1>لوحة الجودة</h1>
          <p>
            قراءة تشغيلية للأسباب والأدلة الحالية. لا تنتج هذه الصفحة درجة ثقة أو ترتيبًا للمراجعين.
          </p>
        </div>
        <Link className={styles.secondaryButton} href="/internal">
          العودة للنظام الداخلي
        </Link>
      </header>

      <section className={styles.notice}>
        الصفحة للقراءة فقط. أي Safety Hold أو حسم أو إعادة تفعيل يظل خاضعًا لمسارات الخادم
        المنفصلة وبوابات P2Q-03 وP2Q-04.
      </section>

      <SummaryCards data={data} />
      <SafetyHoldsSection rows={data.safetyHolds} />
      <ConflictsSection data={data} />
      <AuditCalibrationSection rows={data.reviewerCalibration} />
      <ReferenceCalibrationSection rows={data.referenceAttempts} />
    </main>
  );
}

function SummaryCards({ data }: { data: InternalQualityDashboardData }) {
  const items = [
    ["Safety Holds غير المحسومة", data.summary.unresolvedSafetyHolds],
    ["الحزم المتعارضة", data.summary.conflictedBundles],
    ["مراجعون بعينة ≥20", data.summary.reviewersWithCalibrationMetrics],
    ["معايرات مرجعية جارية", data.summary.referenceAttemptsInProgress],
  ] as const;

  return (
    <section className={styles.assignmentGrid} aria-label="ملخص الجودة">
      {items.map(([label, value]) => (
        <article className={styles.assignmentCard} key={label}>
          <span className={styles.eyebrow}>مؤشر تشغيلي</span>
          <h3>{label}</h3>
          <strong>{value.toLocaleString("ar-EG")}</strong>
        </article>
      ))}
    </section>
  );
}

function SafetyHoldsSection({ rows }: { rows: QualitySafetyHoldRow[] }) {
  return (
    <section className={styles.card}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>Safety Holds</span>
          <h2>التعليقات وأسبابها</h2>
        </div>
        <strong>{rows.length}</strong>
      </div>
      {rows.length === 0 ? (
        <p className={styles.empty}>لا توجد Safety Holds مسجلة.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>المراجع</th>
                <th>المصدر</th>
                <th>الأسباب</th>
                <th>الحالة</th>
                <th>وقت التعليق</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.holdEventId}>
                  <td>
                    <strong>{row.reviewerLabel}</strong>
                    <br />
                    <small dir="ltr">{row.reviewerEmail ?? row.reviewerId}</small>
                  </td>
                  <td>{HOLD_SOURCE_LABELS[row.source]}</td>
                  <td>{row.triggerCodes.map(labelHoldTrigger).join(" · ")}</td>
                  <td>{holdStateLabel(row)}</td>
                  <td>{formatDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ConflictsSection({ data }: { data: InternalQualityDashboardData }) {
  return (
    <section className={styles.card}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>Fail closed</span>
          <h2>الحزم المتعارضة</h2>
        </div>
        <strong>{data.conflicts.length}</strong>
      </div>
      {data.conflicts.length === 0 ? (
        <p className={styles.empty}>لا توجد حزم في حالة conflicted حاليًا.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>العمل / النسخة</th>
                <th>المنصة واللغة</th>
                <th>بلاغات نشطة</th>
                <th>آخر بلاغ</th>
                <th>revision</th>
                <th>آخر تحديث</th>
              </tr>
            </thead>
            <tbody>
              {data.conflicts.map((row) => (
                <tr key={row.bundleId}>
                  <td>
                    <strong>{row.titleName}</strong>
                    <br />
                    <small>{row.editionLabel}</small>
                  </td>
                  <td>
                    {row.platform} · {row.language}
                  </td>
                  <td>{row.openReportCount.toLocaleString("ar-EG")}</td>
                  <td>
                    {row.latestReportType
                      ? `${row.latestReportType} · ${row.latestReportStatus ?? "—"}`
                      : "لا يوجد بلاغ مسجل"}
                  </td>
                  <td>{row.bundleRevision}</td>
                  <td>{formatDate(row.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AuditCalibrationSection({ rows }: { rows: QualityReviewerCalibrationRow[] }) {
  return (
    <section className={styles.card}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>Independent audit</span>
          <h2>مؤشرات معايرة التدقيق</h2>
        </div>
        <strong>{rows.length}</strong>
      </div>
      {rows.length === 0 ? (
        <p className={styles.empty}>لا توجد حسابات مراجعين لعرضها.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>المراجع</th>
                <th>العينة</th>
                <th>Confirmed</th>
                <th>تصحيح مطلوب</th>
                <th>Missed events</th>
                <th>Severity differences</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.reviewerId}>
                  <td>
                    <strong>{row.reviewerLabel}</strong>
                    <br />
                    <small>{row.reviewerStatus}</small>
                  </td>
                  <td>
                    {row.calibration.sampleSize.toLocaleString("ar-EG")} / {row.calibration.minimumSampleSize}
                  </td>
                  <td>{calibrationCell(row, "confirmedAudits")}</td>
                  <td>{calibrationCell(row, "correctionRequiredAudits")}</td>
                  <td>{calibrationCell(row, "auditsWithMissedEvents")}</td>
                  <td>{calibrationCell(row, "auditsWithSeverityDifferences")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ReferenceCalibrationSection({ rows }: { rows: QualityReferenceAttemptRow[] }) {
  return (
    <section className={styles.card}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>Reference calibration</span>
          <h2>آخر معايرة مرجعية لكل مراجع</h2>
        </div>
        <strong>{rows.length}</strong>
      </div>
      {rows.length === 0 ? (
        <p className={styles.empty}>لا توجد محاولات معايرة مرجعية بعد.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>المراجع</th>
                <th>الغرض</th>
                <th>الحالة</th>
                <th>اتفاق المحاور</th>
                <th>Recall</th>
                <th>Precision</th>
                <th>أحداث حساسة فائتة</th>
                <th>أقصى فرق شدة</th>
                <th>Blockers</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.attemptId}>
                  <td>
                    <strong>{row.reviewerLabel}</strong>
                    <br />
                    <small>{row.reviewerStatus}</small>
                  </td>
                  <td>{REFERENCE_PURPOSE_LABELS[row.purpose]}</td>
                  <td>{REFERENCE_STATUS_LABELS[row.status]}</td>
                  <td>{formatOptionalBps(row.categoryAgreementBps)}</td>
                  <td>{formatOptionalBps(row.observationRecallBps)}</td>
                  <td>{formatOptionalBps(row.observationPrecisionBps)}</td>
                  <td>{row.missedHighSensitivityCount ?? "—"}</td>
                  <td>{row.maxSeverityDelta ?? "—"}</td>
                  <td>{row.blockers.length > 0 ? row.blockers.join(" · ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function calibrationCell(
  row: QualityReviewerCalibrationRow,
  key:
    | "confirmedAudits"
    | "correctionRequiredAudits"
    | "auditsWithMissedEvents"
    | "auditsWithSeverityDifferences",
): string {
  const count = row.calibration[key].toLocaleString("ar-EG");
  const rate = row.calibration.ratesBps?.[key];
  return rate === undefined ? `${count} · النسبة تظهر بعد 20` : `${count} · ${formatBps(rate)}`;
}

function holdStateLabel(row: QualitySafetyHoldRow): string {
  if (row.resolution === null) return "معلّق · يحتاج حسمًا بشريًا";
  if (row.resolution === "remediation_required") return "حُسم · إعادة معايرة مطلوبة";
  return "حُسم · cleared";
}

function labelHoldTrigger(code: string): string {
  return HOLD_TRIGGER_LABELS[code] ?? code;
}

function formatOptionalBps(value: number | null): string {
  return value === null ? "—" : formatBps(value);
}

function formatBps(value: number): string {
  return `${(value / 100).toLocaleString("ar-EG", { maximumFractionDigits: 2 })}%`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
