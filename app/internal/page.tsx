import Link from "next/link";

import { requireInternalSessionUser } from "@/app/internal-session";
import { loadInternalDashboard, type InternalDashboardData } from "@/db/internal-ui-service";
import { ReviewWorkflowError } from "@/lib/internal-review-workflow";

import InternalDashboardClient, { BootstrapPanel } from "./InternalDashboardClient";
import shortcutStyles from "./qualityShortcut.module.css";

export default async function InternalDashboardPage() {
  const sessionUser = await requireInternalSessionUser();
  let data: InternalDashboardData | null = null;
  let canAttemptBootstrap = false;

  try {
    data = await loadInternalDashboard(sessionUser.email);
  } catch (error) {
    if (error instanceof ReviewWorkflowError && error.code === "FORBIDDEN") {
      canAttemptBootstrap = true;
    } else {
      throw error;
    }
  }

  if (canAttemptBootstrap || !data) {
    return <BootstrapPanel email={sessionUser.email} />;
  }

  const canViewQuality =
    data.actor.role === "admin" ||
    (data.actor.role === "editorial_reviewer" && data.actor.reviewer?.status === "active");
  const canTriagePublicReports =
    data.actor.role === "editorial_reviewer" && data.actor.reviewer?.status === "active";

  return (
    <>
      {canViewQuality && (
        <nav className={shortcutStyles.bar} dir="rtl" aria-label="روابط الجودة الداخلية">
          <Link className={shortcutStyles.link} href="/internal/quality">
            عرض لوحة الجودة والأدلة
          </Link>
          {canTriagePublicReports && (
            <Link className={shortcutStyles.link} href="/internal/reports">
              مراجعة بلاغات الجمهور
            </Link>
          )}
        </nav>
      )}
      <InternalDashboardClient data={data} />
    </>
  );
}
