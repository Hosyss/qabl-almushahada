import {
  CONTENT_CATEGORIES,
  CONTENT_FLAGS,
  type ContentCategory,
  type ContentFlag,
} from "./types.ts";

export interface ContentFlagDefinition {
  flag: ContentFlag;
  labelAr: string;
  descriptionAr: string;
  scope: "category" | "cross_cutting";
  allowedCategories: readonly ContentCategory[];
}

const ALL_CATEGORIES = [...CONTENT_CATEGORIES] as const;

export const CONTENT_FLAG_DEFINITIONS: Record<ContentFlag, ContentFlagDefinition> = {
  jump_scare: {
    flag: "jump_scare",
    labelAr: "فزعة مفاجئة",
    descriptionAr: "قفزة صوتية أو بصرية مفاجئة صُممت لإحداث فزع لحظي.",
    scope: "category",
    allowedCategories: ["fear"],
  },
  blood: {
    flag: "blood",
    labelAr: "دماء ظاهرة",
    descriptionAr: "ظهور دماء مرئية ضمن واقعة عنف أو إصابة.",
    scope: "category",
    allowedCategories: ["violence"],
  },
  weapon: {
    flag: "weapon",
    labelAr: "سلاح ظاهر أو مستخدم",
    descriptionAr: "وجود سلاح ظاهر أو استخدامه ضمن واقعة عنف.",
    scope: "category",
    allowedCategories: ["violence"],
  },
  verbal_bullying: {
    flag: "verbal_bullying",
    labelAr: "تنمر لفظي",
    descriptionAr: "إهانة أو سخرية متكررة موجّهة لشخص بوصفها واقعة تنمر.",
    scope: "category",
    allowedCategories: ["bullying"],
  },
  physical_bullying: {
    flag: "physical_bullying",
    labelAr: "تنمر جسدي",
    descriptionAr: "اعتداء جسدي أو دفع أو مضايقة بدنية ضمن واقعة تنمر.",
    scope: "category",
    allowedCategories: ["bullying"],
  },
  bereavement: {
    flag: "bereavement",
    labelAr: "وفاة أو فقد",
    descriptionAr: "وفاة شخص أو الحديث المباشر عن فقده ضمن محور الفقد والحزن.",
    scope: "category",
    allowedCategories: ["grief"],
  },
  separation: {
    flag: "separation",
    labelAr: "انفصال أو فراق",
    descriptionAr: "فراق عائلي أو عاطفي أو ابتعاد دائم/مطوّل موصوف كواقعة فقد.",
    scope: "category",
    allowedCategories: ["grief"],
  },
  flashing_sequence: {
    flag: "flashing_sequence",
    labelAr: "وميض متكرر",
    descriptionAr: "تتابع بصري متكرر أو سريع من الومضات/الإضاءة المتقطعة.",
    scope: "category",
    allowedCategories: ["flashingLights"],
  },
  nudity: {
    flag: "nudity",
    labelAr: "عري ظاهر",
    descriptionAr: "ظهور عري بشري مرئي؛ يصف ما يظهر ولا يحكم على ملاءمته.",
    scope: "category",
    allowedCategories: ["sexualContent"],
  },
  kissing: {
    flag: "kissing",
    labelAr: "تقبيل عاطفي أو حميم",
    descriptionAr: "مشهد تقبيل ذي طابع عاطفي أو حميم؛ الوصف لا يفترض فعلًا جنسيًا آخر.",
    scope: "category",
    allowedCategories: ["sexualContent"],
  },
  intimate_touching: {
    flag: "intimate_touching",
    labelAr: "ملامسة حميمية",
    descriptionAr: "ملامسة جسدية حميمية واضحة تتجاوز التواصل العادي، من غير افتراض تفاصيل غير ظاهرة.",
    scope: "category",
    allowedCategories: ["sexualContent"],
  },
  sexual_dialogue: {
    flag: "sexual_dialogue",
    labelAr: "حوار أو إشارة جنسية",
    descriptionAr: "حوار أو تعليق يذكر الجنس أو نشاطًا جنسيًا بوضوح، من غير استنتاج نية غير مذكورة.",
    scope: "category",
    allowedCategories: ["sexualContent"],
  },
  smoking_or_vaping: {
    flag: "smoking_or_vaping",
    labelAr: "تدخين أو استخدام سيجارة إلكترونية",
    descriptionAr: "استخدام ظاهر للتبغ أو السجائر الإلكترونية/الفيب.",
    scope: "category",
    allowedCategories: ["substances"],
  },
  alcohol_use: {
    flag: "alcohol_use",
    labelAr: "شرب كحول",
    descriptionAr: "شرب مشروب كحولي أو استخدامه كجزء مباشر من الواقعة.",
    scope: "category",
    allowedCategories: ["substances"],
  },
  drug_use: {
    flag: "drug_use",
    labelAr: "استخدام مخدرات ترفيهية",
    descriptionAr: "استخدام ظاهر لمادة مخدرة ترفيهية؛ لا يشمل الدواء الطبي لمجرد ظهوره.",
    scope: "category",
    allowedCategories: ["substances"],
  },
  gambling_activity: {
    flag: "gambling_activity",
    labelAr: "قمار أو رهان بمال/قيمة",
    descriptionAr: "مشاركة ظاهرة في قمار أو رهان على مال أو شيء ذي قيمة.",
    scope: "category",
    allowedCategories: ["substances"],
  },
  religious_reference_or_practice: {
    flag: "religious_reference_or_practice",
    labelAr: "مرجع أو ممارسة دينية ظاهرة",
    descriptionAr: "ذكر أو رمز أو ممارسة دينية ظاهرة داخل الواقعة؛ هذا marker وصفي ولا يعني بذاته حساسية أو إساءة أو حكمًا دينيًا.",
    scope: "cross_cutting",
    allowedCategories: ALL_CATEGORIES,
  },
};

export const CONTENT_FLAG_LABELS_AR: Record<ContentFlag, string> = Object.fromEntries(
  CONTENT_FLAGS.map((flag) => [flag, CONTENT_FLAG_DEFINITIONS[flag].labelAr]),
) as Record<ContentFlag, string>;

export function isKnownContentFlag(value: unknown): value is ContentFlag {
  return typeof value === "string" && (CONTENT_FLAGS as readonly string[]).includes(value);
}

export function isContentFlagAllowedForCategory(
  flag: ContentFlag,
  category: ContentCategory,
): boolean {
  return CONTENT_FLAG_DEFINITIONS[flag].allowedCategories.includes(category);
}

export function getContentFlagsForCategory(category: ContentCategory): ContentFlag[] {
  return CONTENT_FLAGS.filter((flag) => isContentFlagAllowedForCategory(flag, category));
}

export function getIncompatibleContentFlags(
  category: ContentCategory,
  flags: readonly ContentFlag[],
): ContentFlag[] {
  return flags.filter((flag) => !isContentFlagAllowedForCategory(flag, category));
}

export const CONTENT_FLAG_EXTRACTION_GUIDANCE_AR = CONTENT_FLAGS.map((flag) => {
  const definition = CONTENT_FLAG_DEFINITIONS[flag];
  const scope = definition.scope === "cross_cutting"
    ? "يمكن استخدامه مع أي محور إذا كانت الواقعة نفسها تتضمن هذا المرجع"
    : `يستخدم فقط مع محور ${definition.allowedCategories.join("/")}`;
  return `- ${flag}: ${definition.descriptionAr} (${scope}).`;
}).join("\n");
