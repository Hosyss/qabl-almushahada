export type ContentSourceUse =
  | "catalog_metadata"
  | "analysis_evidence"
  | "media";

export type ContentSourceDecision =
  | "allow"
  | "allow_with_attribution"
  | "per_item_license"
  | "manual_reference_only"
  | "blocked_without_commercial_license";

export interface ContentSourcePolicy {
  key: string;
  label: string;
  decision: ContentSourceDecision;
  automatedIngestion: boolean;
  allowedUses: readonly ContentSourceUse[];
  licenseLabel: string;
  policyUrl: string;
  attributionRequired: boolean;
  shareAlike: boolean;
  verifiedOn: string;
  notesAr: string;
}

export const CONTENT_SOURCE_POLICY_VERSION = "2026-08-13.1";

/**
 * Commercial-site source allowlist.
 *
 * This registry is intentionally fail-closed: a public website being readable does not
 * make its data reusable. New sources must be explicitly reviewed before automation.
 */
export const CONTENT_SOURCE_POLICIES = {
  wikidata: {
    key: "wikidata",
    label: "Wikidata",
    decision: "allow",
    automatedIngestion: true,
    allowedUses: ["catalog_metadata"],
    licenseLabel: "CC0 1.0",
    policyUrl: "https://www.wikidata.org/wiki/Wikidata:Licensing",
    attributionRequired: false,
    shareAlike: false,
    verifiedOn: "2026-08-13",
    notesAr:
      "المصدر الأساسي للكتالوج المنظم. بيانات Wikidata المنظمة في نطاقات main/property/lexeme متاحة تحت CC0؛ نحتفظ بمعرف Q ومصدر السجل لأغراض التتبع حتى عندما لا يكون العزو شرطًا للترخيص.",
  },
  wikipedia: {
    key: "wikipedia",
    label: "Wikipedia",
    decision: "allow_with_attribution",
    automatedIngestion: false,
    allowedUses: ["analysis_evidence"],
    licenseLabel: "CC BY-SA 4.0 / applicable page license",
    policyUrl: "https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use",
    attributionRequired: true,
    shareAlike: true,
    verifiedOn: "2026-08-13",
    notesAr:
      "يمكن استخدام النص تجاريًا مع الالتزام بالعزو والترخيص بالمثل. الأتمتة معطلة افتراضيًا حتى يكتمل حفظ revision/source/attribution وعدم إعادة نشر نصوص طويلة كما هي.",
  },
  wikimediaCommons: {
    key: "wikimedia_commons",
    label: "Wikimedia Commons",
    decision: "per_item_license",
    automatedIngestion: false,
    allowedUses: ["media"],
    licenseLabel: "Per-file free license or public domain",
    policyUrl: "https://commons.wikimedia.org/wiki/Commons:Licensing",
    attributionRequired: true,
    shareAlike: false,
    verifiedOn: "2026-08-13",
    notesAr:
      "لا نفترض أن كل صورة تحمل نفس الشروط. لا تُستخدم صورة إلا بعد قراءة ترخيص الملف نفسه وتسجيل المؤلف والرخصة والعزو المطلوب؛ الملصقات واللقطات غير الحرة لا تُسحب تلقائيًا.",
  },
  officialClassificationAuthority: {
    key: "official_classification_authority",
    label: "Official classification authority",
    decision: "manual_reference_only",
    automatedIngestion: false,
    allowedUses: ["analysis_evidence"],
    licenseLabel: "Facts only; automation requires source-specific permission",
    policyUrl: "",
    attributionRequired: true,
    shareAlike: false,
    verifiedOn: "2026-08-13",
    notesAr:
      "يمكن الاستفادة من حقيقة التصنيف المنشور ورابط الجهة الرسمية كمصدر تحقق، لكن لا ننسخ الوصف التحريري ولا نعمل scraping آلي قبل مراجعة شروط كل جهة على حدة.",
  },
  tmdb: {
    key: "tmdb",
    label: "TMDB",
    decision: "blocked_without_commercial_license",
    automatedIngestion: false,
    allowedUses: [],
    licenseLabel: "Commercial license required for a revenue-generating project",
    policyUrl: "https://developer.themoviedb.org/docs/faq",
    attributionRequired: true,
    shareAlike: false,
    verifiedOn: "2026-08-13",
    notesAr:
      "Developer API المجاني مخصص للاستخدام غير التجاري. الموقع الإعلاني يُعامل كمشروع تجاري، لذلك لا نعتمد TMDB للبيانات أو الصور من دون ترخيص تجاري صريح.",
  },
  imdb: {
    key: "imdb",
    label: "IMDb",
    decision: "blocked_without_commercial_license",
    automatedIngestion: false,
    allowedUses: [],
    licenseLabel: "Non-commercial datasets / commercial license required",
    policyUrl: "https://www.imdb.com/interfaces/",
    attributionRequired: true,
    shareAlike: false,
    verifiedOn: "2026-08-13",
    notesAr:
      "الـdatasets العامة موصوفة للاستخدام الشخصي وغير التجاري، وIMDb تمنع scraping التجاري من دون إذن. لا نستخدم Parents Guide أو reviews أو metadata في الإنتاج من دون ترخيص تجاري.",
  },
  thirdPartyReviewSites: {
    key: "third_party_review_sites",
    label: "Third-party review/parents-guide sites",
    decision: "blocked_without_commercial_license",
    automatedIngestion: false,
    allowedUses: [],
    licenseLabel: "No reuse without explicit commercial permission",
    policyUrl: "",
    attributionRequired: true,
    shareAlike: false,
    verifiedOn: "2026-08-13",
    notesAr:
      "مواقع المراجعات وأدلة الآباء ليست مخزنًا مجانيًا للمحتوى. لا ننسخ نصوص Common Sense Media أو Kids-In-Mind أو Parents Guide أو أي موقع مشابه، ولا نحولها إلى قاعدة بيانات عندنا من دون إذن تجاري صريح.",
  },
} as const satisfies Record<string, ContentSourcePolicy>;

export type ContentSourceKey = keyof typeof CONTENT_SOURCE_POLICIES;

export function getContentSourcePolicy(source: ContentSourceKey): ContentSourcePolicy {
  return CONTENT_SOURCE_POLICIES[source];
}

export function assertAutomatedSourceUseAllowed(
  source: ContentSourceKey,
  use: ContentSourceUse,
): ContentSourcePolicy {
  const policy = getContentSourcePolicy(source);
  if (!policy.automatedIngestion || !policy.allowedUses.includes(use)) {
    throw new Error(`Automated source use is not allowed: ${source}:${use}`);
  }
  return policy;
}
