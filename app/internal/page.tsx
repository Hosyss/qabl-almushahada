import { requireInternalSessionUser } from "@/app/internal-session";
import { loadInternalDashboard } from "@/db/internal-ui-service";
import { ReviewWorkflowError } from "@/lib/internal-review-workflow";

import InternalDashboardClient, { BootstrapPanel } from "./InternalDashboardClient";

export default async function InternalDashboardPage() {
  const sessionUser = await requireInternalSessionUser();

  try {
    const data = await loadInternalDashboard(sessionUser.email);
    return <InternalDashboardClient data={data} />;
  } catch (error) {
    if (error instanceof ReviewWorkflowError && error.code === "FORBIDDEN") {
      return <BootstrapPanel email={sessionUser.email} />;
    }
    throw error;
  }
}
