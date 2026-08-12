import { requireInternalSessionUser } from "@/app/internal-session";
import { loadReviewerEditor } from "@/db/internal-ui-service";

import ReviewEditor from "../ReviewEditor";

export default async function ReviewerAssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const sessionUser = await requireInternalSessionUser();
  const { assignmentId } = await params;
  const data = await loadReviewerEditor(sessionUser.email, decodeURIComponent(assignmentId));
  return <ReviewEditor data={data} />;
}
