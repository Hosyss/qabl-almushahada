import { LOCAL_FAMILY_SETTINGS_STORAGE_KEY } from "./local-family-settings.ts";
import {
  BASELINE_AUDIT_RATE_BPS,
  HIGH_RISK_AUDIT_RATE_BPS,
} from "./review-audit-selection.ts";
import {
  HIGH_SENSITIVITY_CATEGORY_THRESHOLDS,
  HIGH_SENSITIVITY_FLAG_THRESHOLDS,
} from "./review-engine/risk-policy.ts";

export const PUBLIC_POLICY_LAST_UPDATED_AR = "18 أغسطس 2026";

export const PUBLIC_REVIEW_POLICY_FACTS = {
  minimumIndependentReviewers: 2,
  highRiskIndependentReviewers: 3,
  baselineAuditPercent: BASELINE_AUDIT_RATE_BPS / 100,
  highRiskAuditPercent: HIGH_RISK_AUDIT_RATE_BPS / 100,
  categoryThresholds: HIGH_SENSITIVITY_CATEGORY_THRESHOLDS,
  flagThresholds: HIGH_SENSITIVITY_FLAG_THRESHOLDS,
  failClosedVerdict: "insufficient_data",
} as const;

export const PUBLIC_PRIVACY_POLICY_FACTS = {
  familySettingsStorage: "localStorage",
  familySettingsStorageKey: LOCAL_FAMILY_SETTINGS_STORAGE_KEY,
  familySettingsFields: ["childAge", "fearLimit", "avoidBullying"] as const,
  excludedChildIdentityFields: ["childName", "dateOfBirth"] as const,
  familySettingsSentToD1: false,
  publicAccountRequired: false,
  publicReportAccountRequired: false,
  publicReportRawIpStored: false,
  publicReportClientKeyDerivation: "HMAC-SHA256" as const,
} as const;

export const PUBLIC_CORRECTION_POLICY_FACTS = {
  blockingReportStatuses: ["open", "investigating"] as const,
  resolutions: ["no_issue", "correction_required", "different_version"] as const,
  publicReportIntakeAvailable: true,
  publicReportChangesPublishedDecisionAutomatically: false,
  historicalRevisionsMutable: false,
} as const;

export interface PublicPolicySection {
  id: string;
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
}

export interface PublicPolicyPage {
  href: string;
  title: string;
  eyebrow: string;
  summary: string;
  updatedAt: string;
  notice?: string;
  sections: readonly PublicPolicySection[];
}

function thresholdLine(label: string, threshold: number | undefined): string {
  if (threshold === undefined) {
    throw new Error(`Missing public review threshold for ${label}`);
  }
  return `${label}: من شدة ${threshold}.`;
}

const highRiskRulesAr = [
  "أي واقعة تصل إلى شدة 4 في أي محور.",
  thresholdLine("إيذاء النفس", HIGH_SENSITIVITY_CATEGORY_THRESHOLDS.selfHarm),
  thresholdLine("المحتوى الجنسي", HIGH_SENSITIVITY_CATEGORY_THRESHOLDS.sexualContent),
  thresholdLine("الوميض أو الأضواء الحساسة", HIGH_SENSITIVITY_CATEGORY_THRESHOLDS.flashingLights),
  thresholdLine("العنف", HIGH_SENSITIVITY_CATEGORY_THRESHOLDS.violence),
  thresholdLine("المواد", HIGH_SENSITIVITY_CATEGORY_THRESHOLDS.substances),
  thresholdLine("التمييز", HIGH_SENSITIVITY_CATEGORY_THRESHOLDS.discrimination),
  thresholdLine("التنمر", HIGH_SENSITIVITY_CATEGORY_THRESHOLDS.bullying),
  thresholdLine("تتابع وميض", HIGH_SENSITIVITY_FLAG_THRESHOLDS.flashing_sequence),
  thresholdLine("دم ظاهر", HIGH_SENSITIVITY_FLAG_THRESHOLDS.blood),
  thresholdLine("سلاح", HIGH_SENSITIVITY_FLAG_THRESHOLDS.weapon),
  thresholdLine("تنمر جسدي", HIGH_SENSITIVITY_FLAG_THRESHOLDS.physical_bullying),
] as const;

export const PUBLIC_POLICY_PAGES: Record<"review" | "privacy" | "corrections", PublicPolicyPage> = {
  review: {
    href: "/review-policy",
    title: "سياسة المراجعة",
    eyebrow: "كيف نراجع؟",
    summary:
      "نراجع نسخة محددة، ونسجل وقائع منظمة، ثم نطبق حدود الأسرة على وقائع اعتمدها أكثر من طرف مستقل. إذا كان الدليل ناقصًا أو متعارضًا، فلا نصدر حكمًا مطمئنًا.",
    updatedAt: PUBLIC_POLICY_LAST_UPDATED_AR,
    sections: [
      {
        id: "version",
        title: "نسخة محددة، لا اسم عمل فقط",
        paragraphs: [
          "المراجعة ترتبط بنسخة محددة من العمل: المنصة واللغة والموسم أو الحلقة عند الحاجة وتاريخ المشاهدة وبصمة المحتوى. اختلاف النسخة قد يغير المحتوى، لذلك لا ننقل الثقة تلقائيًا من نسخة لأخرى.",
          "يسجل المراجع الوقائع التي شاهدها فعلًا: المحور، والشدة، والتكرار، والسياق، والوقت التقريبي. الرأي العام وحده لا يكفي للنشر.",
        ],
      },
      {
        id: "independence",
        title: "أكثر من عين بشرية مستقلة",
        paragraphs: [
          `الحد الأدنى العادي هو ${PUBLIC_REVIEW_POLICY_FACTS.minimumIndependentReviewers} مراجعَين نشطين من مجموعتي استقلال مختلفتين. الحالات عالية الحساسية ترفع الحد إلى ${PUBLIC_REVIEW_POLICY_FACTS.highRiskIndependentReviewers} مراجعين نشطين مستقلين.`,
          "المعتمد التحريري مستقل عن المراجعين، ولا يستطيع المراجع أو المنسق اعتماد عمله بنفسه.",
        ],
        items: highRiskRulesAr,
      },
      {
        id: "decision",
        title: "من الوقائع إلى قرار الأسرة",
        paragraphs: [
          "محرك القرار لا يخمن محتوى العمل. بعد اجتياز بوابات الجودة يطبق حدود الأسرة على الوقائع المعتمدة نفسها، ولذلك يمكن إعادة إنتاج القرار من المدخلات نفسها.",
          "إذا كانت معلومة أساسية ناقصة، أو ظهر تعارض جوهري، أو لم يكتمل عدد المراجعين المطلوب، تكون النتيجة «البيانات غير كافية» بدل إصدار «مناسب» افتراضي.",
          "لا نختصر الثقة في رقم واحد أو ترتيب للمراجعين، ولا نعرض تقييمًا عمريًا رسميًا من اختراعنا.",
        ],
      },
      {
        id: "audit",
        title: "تدقيق غير متوقع بعد الإرسال",
        paragraphs: [
          `بعد تجميد الإرسال النهائي يختار الخادم عينة تدقيق عشوائي غير متوقعة: ${PUBLIC_REVIEW_POLICY_FACTS.baselineAuditPercent}% للحالات العادية و${PUBLIC_REVIEW_POLICY_FACTS.highRiskAuditPercent}% للحالات عالية الحساسية وفق قواعد الخطر نفسها أعلاه.`,
          "إذا اختيرت المراجعة للتدقيق، يظل الاعتماد متوقفًا حتى يسجل مدقق مستقل النتيجة. الأخطاء الجوهرية تعيد العمل إلى دورة التصحيح بدل تمريرها بصمت.",
        ],
      },
      {
        id: "verified",
        title: "متى تظهر «مراجعة موثقة»؟",
        items: [
          "الحزمة نفسها في حالة موثقة.",
          "النسخة المرتبطة بها ما زالت نشطة.",
          "يوجد اعتماد تحريري حالي وحالته معتمدة.",
          "لا يوجد بلاغ جوهري مفتوح أو قيد التحقيق.",
          "صفحة المراجعة تعيد فحص الحالة عند القراءة؛ أي حالة قديمة أو سباق في الاعتماد يفشل مغلقًا بدل خلط بيانات قديمة بجديدة.",
        ],
      },
      {
        id: "limits",
        title: "حدود هذه السياسة",
        paragraphs: [
          "«قبل المشاهدة» دليل قرار أسري مبني على وقائع مراجعة، وليس جهة تصنيف عمري رسمية ولا بديلًا عن معرفة الوالدين بحساسية أطفالهم.",
          "الأمثلة الموجودة في أجزاء العرض التوضيحية من الصفحة الرئيسية ليست مراجعات منشورة، ولا يجوز التعامل معها كأحكام حقيقية على أعمال بعينها.",
        ],
      },
    ],
  },
  privacy: {
    href: "/privacy",
    title: "سياسة الخصوصية",
    eyebrow: "أقل بيانات ممكنة",
    summary:
      "الواجهة العامة تعمل من غير حساب أسرة ومن غير اسم طفل أو تاريخ ميلاد. إعدادات الأسرة تبقى محلية، بينما تُعالج عند إرسال بلاغ عام أقل البيانات التقنية اللازمة لمكافحة الإساءة وتتبع البلاغ.",
    updatedAt: PUBLIC_POLICY_LAST_UPDATED_AR,
    sections: [
      {
        id: "public-use",
        title: "استخدام الموقع العام",
        paragraphs: [
          "لا تحتاج إلى إنشاء حساب عام لكي تبحث أو تقرأ المراجعات المنشورة. التطبيق لا ينشئ ملف طفل عام داخل D1 ولا يطلب اسم الطفل أو تاريخ ميلاده.",
          "صفحات المراجعات العامة تقرأ بيانات العمل والمراجعة المنشورة من D1، ولا تحتاج إلى هوية المستخدم لعرضها.",
        ],
      },
      {
        id: "family-settings",
        title: "حدود الأسرة المحفوظة على جهازك",
        paragraphs: [
          `الميزة الحالية تستخدم ${PUBLIC_PRIVACY_POLICY_FACTS.familySettingsStorage} تحت المفتاح التقني ${PUBLIC_PRIVACY_POLICY_FACTS.familySettingsStorageKey}. الحقول المحفوظة فقط هي: العمر، وحد الخوف، وخيار تجنب التنمر.`,
          "هذه الإعدادات لا تُرسل إلى D1 بواسطة ميزة الحفظ المحلي الحالية. إذا كان التخزين المحلي غير متاح، تستمر الإعدادات للجلسة فقط ويظهر ذلك للمستخدم.",
          "مسح بيانات الموقع من إعدادات المتصفح يزيل هذه الإعدادات المحلية.",
        ],
      },
      {
        id: "search",
        title: "ماذا يحدث عند البحث؟",
        paragraphs: [
          "عبارة البحث تُرسل إلى خادم الموقع ضمن طلب البحث حتى نقرأ النتائج المناسبة من D1. التطبيق لا يحول عبارة البحث إلى ملف طفل أو إعداد أسرة محفوظ.",
          "مثل أي خدمة مستضافة على الويب، تمر الطلبات عبر بنية Cloudflare وقد تعالج البنية بيانات الطلب التشغيلية المعتادة اللازمة لتقديم الخدمة والأمان. لا ندعي أن بيانات الشبكة تظل داخل المتصفح.",
        ],
      },
      {
        id: "public-reports",
        title: "ماذا نخزن عند إرسال بلاغ؟",
        paragraphs: [
          "لا نطلب بريدًا إلكترونيًا أو حسابًا لإرسال البلاغ. يُحفظ نوع المحتوى المرتبط بالبلاغ ومعرفه الحالي وسبب البلاغ ونصه ووقت الاستقبال والحالة اللازمة لدورة المراجعة.",
          `تُستخدم بيانات اتصال الشبكة لحظيًا لاشتقاق مفتاح عميل بواسطة ${PUBLIC_PRIVACY_POLICY_FACTS.publicReportClientKeyDerivation} لتطبيق حدود الإساءة ومنع التكرار. لا يُخزن عنوان IP الخام داخل سجل البلاغ العام.`,
          "لا تُرسل إعدادات عمر الطفل أو تفضيلات الأسرة مع البلاغ، ولا يغير إرسال البلاغ الحكم المنشور تلقائيًا.",
        ],
      },
      {
        id: "staff",
        title: "حسابات فريق المراجعة منفصلة",
        paragraphs: [
          "النظام الداخلي للمراجعين ليس حسابًا عامًا للأسرة. دخول الفريق محمي من جهة الخادم، والأدوار والصلاحيات وسجلات التدقيق جزء من سير العمل الداخلي حتى يمكن معرفة من راجع أو اعتمد أو صحح.",
          "الوصول الداخلي على Cloudflare مصمم ليفشل مغلقًا إذا لم تكتمل هوية Cloudflare Access المطلوبة؛ لا يوجد تحويل صامت لزائر عام إلى مستخدم داخلي موثوق.",
        ],
      },
      {
        id: "changes",
        title: "إذا تغير ما نجمعه",
        paragraphs: [
          "هذه الصفحة تصف السلوك الحالي للمنتج. إذا أضيف مستقبلًا جمع جديد لبيانات تعريفية أو أدوات قياس أو خدمة خارجية تؤثر في الخصوصية، يجب تحديث السياسة قبل اعتبار السلوك الجديد جزءًا من المنتج العام.",
          "لا يوجد حاليًا ملف حساب عام داخل D1 نطلب منك الحفاظ عليه؛ البيانات العائلية المحلية الحالية تحت سيطرتك في المتصفح.",
        ],
      },
    ],
  },
  corrections: {
    href: "/corrections",
    title: "سياسة التصحيح",
    eyebrow: "الخطأ يوقف الثقة عند ثبوته",
    summary:
      "يصل البلاغ العام أولًا إلى قائمة مراجعة ولا يغير الحكم المنشور تلقائيًا. إذا ثبت أن بلاغًا على مراجعة بشرية جوهري، يمكن للمراجع التحريري تصعيده إلى دورة التصحيح التي توقف الاعتماد وتحفظ التاريخ.",
    updatedAt: PUBLIC_POLICY_LAST_UPDATED_AR,
    notice:
      "قناة البلاغ العامة مخصصة للمراجعات المنشورة، وتبدأ بمرحلة فرز بشرية. قبول البلاغ لا يعني صحة مضمونه ولا يوقف المحتوى تلقائيًا، ولا نعد المستخدم بنتيجة آلية أو فورية.",
    sections: [
      {
        id: "public-intake",
        title: "ماذا يحدث بعد الضغط على «إرسال البلاغ»؟",
        paragraphs: [
          "يربط الخادم البلاغ بالحالة العامة الحالية للمراجعة؛ لا يستطيع النموذج اختيار revision أو اعتماد أو هوية مراجع من عند المستخدم.",
          "يُحفظ البلاغ في قائمة استقبال منفصلة غير قابلة لمحو التاريخ أو تعديل نص البلاغ بعد الاستقبال. ثم يراجعه مراجع تحريري مخول قبل أي تصعيد جوهري.",
          "البلاغات على التحليل التحريري أو مراجعة الأدلة تبقى في قائمة الفرز ولا تُسقط المحتوى تلقائيًا؛ لا نخترع لها دورة تصحيح غير موجودة.",
        ],
      },
      {
        id: "material-report",
        title: "ما الذي نعتبره بلاغًا جوهريًا؟",
        paragraphs: [
          "مثال ذلك: مراجعة النسخة الخطأ، أو واقعة مهمة مفقودة، أو فرق شدة جوهري، أو دليل يجعل الاعتماد الحالي غير صالح للاستمرار كما هو.",
          "في مسار المراجعة البشرية، لا يصبح البلاغ العام بلاغًا جوهريًا إلا بعد التحقق الداخلي. عند التصعيد يثبت النظام snapshot للحزمة والنسخة والاعتماد الجاري حتى لا يتغير موضوع البلاغ أثناء الحسم.",
        ],
      },
      {
        id: "freeze",
        title: "عند التصعيد الجوهري: التوقف أولًا، ثم التحقيق",
        paragraphs: [
          "عند تصعيد بلاغ جوهري على مراجعة بشرية موثقة تتحول الحزمة إلى حالة تعارض ويسقط الاعتماد الحالي من العرض العام فورًا من غير حذف التاريخ.",
          "وجود بلاغ جوهري مفتوح أو قيد التحقيق يمنع صفحة المراجعة العامة من الاستمرار في عرض النتيجة كموثقة.",
        ],
      },
      {
        id: "resolution",
        title: "ثلاث نتائج حسم فقط",
        items: [
          "لا توجد مشكلة: يعيد نفس الاعتماد الذي أوقفه البلاغ فقط إذا لم تتغير الحالة ولم يظهر ما يبطله.",
          "التصحيح مطلوب: يعيد مهام المراجعة إلى طلب التغييرات، ويفرض إرسالات جديدة ثم اعتماد revision جديدة؛ الاعتماد التاريخي المبطل لا يعود كأنه جديد.",
          "نسخة مختلفة: إذا ثبت أن المحتوى يخص نسخة مختلفة، تُسحب الحزمة بدل تعديل الوقائع تحت هوية نسخة خاطئة.",
        ],
      },
      {
        id: "history",
        title: "التاريخ لا يُمحى",
        paragraphs: [
          "إعادات الإرسال والاعتمادات الجديدة تنشئ revisions جديدة مرتبطة بالسابق. السجلات القديمة والوقائع التاريخية والاعتمادات السابقة محمية من التعديل أو الحذف في قاعدة البيانات بعد إقفالها.",
          "الهدف أن يمكن تتبع: ماذا كان منشورًا، وما الذي أوقفه، ومن حسم البلاغ، وما الذي تغير بعد التصحيح.",
        ],
      },
      {
        id: "return",
        title: "متى تعود المراجعة إلى «موثقة»؟",
        paragraphs: [
          "بعد طلب التصحيح لا تكفي إعادة فتح الحالة يدويًا. يجب أن تمر المراجعات الجديدة ببوابات الجودة والتدقيق المطلوبة ثم يصدر اعتماد تحريري جديد قبل أن تصبح الحزمة موثقة مرة أخرى.",
          "إذا بقي نقص أو تعارض أساسي، يظل المنتج مغلقًا تحفظيًا ولا يصدر نتيجة مناسبة لمجرد أن المراجعة كانت موثقة في الماضي.",
        ],
      },
      {
        id: "public-state",
        title: "ما الذي يراه المستخدم أثناء التصحيح؟",
        paragraphs: [
          "المراجعة المتوقفة لا تُعرض كموثقة. البحث يفرق بين المراجعة المنشورة، والعمل قيد المراجعة، والعمل الموجود في الدليل فقط، وصفحة المراجعة نفسها ترفض الحالة القديمة أو المتعارضة.",
          "واجهة البلاغ توضح نجاح الإرسال أو فشله بوضوح، وتعرض رقم مرجع عند الاستقبال الناجح. الاستقبال وحده لا يعني أن الحكم تغير أو أن التصحيح اعتمد.",
        ],
      },
    ],
  },
};

export const PUBLIC_POLICY_NAV = [
  { href: PUBLIC_POLICY_PAGES.review.href, label: "سياسة المراجعة" },
  { href: PUBLIC_POLICY_PAGES.privacy.href, label: "الخصوصية" },
  { href: PUBLIC_POLICY_PAGES.corrections.href, label: "التصحيح" },
] as const;
