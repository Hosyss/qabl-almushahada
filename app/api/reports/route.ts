import { submitPublicReportIntake } from "@/db/public-report-intake-service";

const MAX_BODY_BYTES = 4096;
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ accepted: false, message: "نوع الطلب غير مدعوم." }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ accepted: false, message: "حجم البلاغ أكبر من المسموح." }, 413);
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return json({ accepted: false, message: "تعذر قراءة البلاغ." }, 400);
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({ accepted: false, message: "حجم البلاغ أكبر من المسموح." }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ accepted: false, message: "صيغة البلاغ غير صالحة." }, 400);
  }

  try {
    const result = await submitPublicReportIntake({ request, body });
    if (result.accepted) {
      return json(
        {
          accepted: true,
          referenceId: result.intakeId,
          message: "وصل البلاغ للمراجعة. لا يغيّر الحكم المنشور تلقائيًا قبل التحقق منه.",
        },
        202,
      );
    }

    if (result.reason === "invalid_input") {
      return json({ accepted: false, message: "راجع بيانات البلاغ.", errorsAr: result.errorsAr }, 400);
    }
    if (result.reason === "target_unavailable") {
      return json({ accepted: false, message: "المحتوى لم يعد متاحًا بهذه الحالة." }, 404);
    }
    if (result.reason === "rate_limited") {
      return json(
        { accepted: false, message: "تم استلام عدد كافٍ من البلاغات حاليًا. حاول لاحقًا إذا كانت المعلومة ما زالت تحتاج مراجعة." },
        429,
        { "retry-after": "3600" },
      );
    }
    return json({ accepted: false, message: "تعذر قبول الطلب من هذا السياق." }, 403);
  } catch {
    return json(
      { accepted: false, message: "قناة البلاغ غير متاحة مؤقتًا. لم يتم تغيير أي حكم منشور." },
      503,
    );
  }
}

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}
