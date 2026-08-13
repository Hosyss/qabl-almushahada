import type { EditorialSourceReference } from "./editorial-review.ts";

const KIDS_IN_MIND_TERMS = "https://kids-in-mind.com/terms.htm";
const CC_BY_SA_4 = "https://creativecommons.org/licenses/by-sa/4.0/";

export function buildKidsInMindSource(input: {
  id: string;
  url: string;
  supportedClaimIds: string[];
}): EditorialSourceReference {
  return {
    id: input.id,
    publisher: "Kids-In-Mind",
    sourceType: "published_review",
    sourceUrl: input.url,
    accessedOn: "2026-08-13",
    independenceGroupId: "kids-in-mind",
    usageBasis: "link_only_factual_reference",
    rightsLabel: "ربط للمصدر ومرجع وقائع فقط — لا ندّعي ترخيص إعادة نشر",
    rightsUrl: KIDS_IN_MIND_TERMS,
    usageNoteAr:
      "نستخدم الصفحة كمرجع لوقائع عامة مع رابط واضح للمصدر، ونكتب الوصف العربي من الصفر. لا ننقل نص المراجعة أو تقييماتها العددية أو بنيتها، لأن شروط الموقع تمنع إعادة النشر التجاري دون إذن.",
    supportedClaimIds: input.supportedClaimIds,
  };
}

export function buildWikipediaSource(input: {
  id: string;
  url: string;
  revisionId: string;
  supportedClaimIds: string[];
}): EditorialSourceReference {
  return {
    id: input.id,
    publisher: "Wikipedia (English)",
    sourceType: "open_encyclopedia",
    sourceUrl: input.url,
    accessedOn: "2026-08-13",
    independenceGroupId: "wikipedia-en",
    usageBasis: "open_license",
    rightsLabel: "CC BY-SA 4.0",
    rightsUrl: CC_BY_SA_4,
    usageNoteAr:
      "نحفظ رابط مراجعة ثابتة للمقال ونستخدم الوقائع فقط مع الإسناد. لا ننسخ جمل المقال؛ الصياغة العربية هنا أصلية، ومعلومات المصدر المفتوح معروضة للشفافية.",
    sourceVersion: `oldid=${input.revisionId}`,
    supportedClaimIds: input.supportedClaimIds,
  };
}
