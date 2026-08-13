import type { EditorialReviewPublication } from "../editorial-review.ts";
import { buildKidsInMindSource, buildWikipediaSource } from "../editorial-review-source-builders.ts";

export const ET_1982_EDITORIAL_REVIEW: EditorialReviewPublication = {
  id: "et-1982-editorial-batch-v1",
  titleId: "wd:Q11621",
  titleLabel: "إي تي",
  releaseYear: 1982,
  kind: "movie",
  policyVersion: "2026-08-13.2",
  publishedAt: "2026-08-13T15:11:00+03:00",
  scopeAr: "هذا تحليل تحريري على مستوى فيلم E.T. (1982). نراعي اختلاف الإصدارات، وبعد تدقيق شروط الاستخدام أعدنا بناء الإسناد من مراجع مؤهلة حاليًا فقط. لا ندّعي مشاهدة نسخة محددة أو امتلاك بصمة لها.",
  analysisAr: "يوجد اتفاق مستقل على مواقف المطاردة والخطر والتوتر، وعلى مشهد شرب يؤدي إلى سلوك مخمور، وعلى قبلة قصيرة. أما الألفاظ فوجودها مثبت في مرجع واحد مؤهل حاليًا، ولذلك لا نصف هذا المحور بأنه متفق عليه بين مصدرين. خمسة محاور أخرى تبقى غير محسومة.",
  decisionStatus: "insufficient_data",
  decisionEligible: false,
  sources: [
    buildKidsInMindSource({
      id: "et-source-kids-in-mind",
      url: "https://kids-in-mind.com/e/et.htm",
      supportedClaimIds: ["et-claim-fear", "et-claim-violence", "et-claim-language", "et-claim-substances", "et-claim-sexual-content"],
    }),
    buildWikipediaSource({
      id: "et-source-wikipedia",
      url: "https://en.wikipedia.org/w/index.php?title=E.T._the_Extra-Terrestrial&oldid=1368107181",
      revisionId: "1368107181",
      supportedClaimIds: ["et-claim-fear", "et-claim-violence", "et-claim-substances", "et-claim-sexual-content"],
    }),
  ],
  claims: [
    { id: "et-claim-fear", category: "fear", summaryAr: "توجد مطاردات ليلية ومواقف مرض واحتجاز ولحظات توتر عاطفي واضحة، ويظهر هذا السياق في مرجعين مستقلين.", verification: "corroborated", sourceIds: ["et-source-kids-in-mind", "et-source-wikipedia"] },
    { id: "et-claim-violence", category: "violence", summaryAr: "تتضمن القصة مطاردة واحتجازًا ومحاولات لمنع الأطفال من الهرب ومخاطر أثناء الفرار، مع اختلاف بعض التفاصيل بين الإصدارات.", verification: "corroborated", sourceIds: ["et-source-kids-in-mind", "et-source-wikipedia"] },
    { id: "et-claim-language", category: "language", summaryAr: "توجد ألفاظ وإهانات متفرقة في الحوار، لكن هذا المحور مدعوم حاليًا بمرجع مؤهل واحد فقط ولا نعرض قائمته الأصلية.", verification: "single_source", sourceIds: ["et-source-kids-in-mind"] },
    { id: "et-claim-substances", category: "substances", summaryAr: "يوجد مشهد شرب واضح تظهر بعده آثار السكر على شخصيتين، وهو تفصيل حاضر في مرجعين مستقلين.", verification: "corroborated", sourceIds: ["et-source-kids-in-mind", "et-source-wikipedia"] },
    { id: "et-claim-sexual-content", category: "sexualContent", summaryAr: "توجد قبلة قصيرة في سياق المدرسة، من دون تعميم هذا التفصيل إلى حكم أوسع على المحور.", verification: "corroborated", sourceIds: ["et-source-kids-in-mind", "et-source-wikipedia"] },
  ],
  uncertainCategories: ["bullying", "discrimination", "selfHarm", "grief", "flashingLights"],
};
