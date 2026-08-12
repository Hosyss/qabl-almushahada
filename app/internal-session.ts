import { env } from "cloudflare:workers";
import { headers } from "next/headers";

import {
  InternalAuthError,
  authenticateInternalRequest,
  type InternalAuthenticatedUser,
} from "@/lib/internal-auth";
import { ReviewWorkflowError } from "@/lib/internal-review-workflow";

export async function requireInternalSessionUser(): Promise<InternalAuthenticatedUser> {
  const requestHeaders = await headers();
  try {
    return await authenticateInternalRequest({
      headers: requestHeaders,
      env: env as unknown as Record<string, unknown>,
    });
  } catch (error) {
    if (error instanceof InternalAuthError) {
      if (error.code === "UNAUTHENTICATED") {
        throw new ReviewWorkflowError("UNAUTHENTICATED", "يلزم تسجيل الدخول للوصول إلى النظام الداخلي.");
      }
      throw new ReviewWorkflowError(
        "FORBIDDEN",
        "تعذر التحقق من هوية المستخدم الداخلي بأمان.",
        [error.message],
      );
    }
    throw error;
  }
}
