import { requireInternalSessionUser } from "@/app/internal-session";
import { loadInternalDashboard, type InternalDashboardData } from "@/db/internal-ui-service";
import { ReviewWorkflowError } from "@/lib/internal-review-workflow";

import InternalDashboardClient, { BootstrapPanel } from "./InternalDashboardClient";

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
  return <InternalDashboardClient data={data} />;
}
