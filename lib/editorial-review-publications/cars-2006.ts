import type { EditorialReviewPublication } from "../editorial-review.ts";
import { buildKidsInMindSource, buildWikipediaSource } from "../editorial-review-source-builders.ts";

export const CARS_2006_EDITORIAL_REVIEW: EditorialReviewPublication = {
  id: "cars-2006-editorial-pilot-v1",
  titleId: "wd:Q182153",
  titleLabel: "Cars",
  releaseYear: 2006,
  kind: "movie",
  policyVersion: "2026-08-13.2",
  publishedAt: "2026-08-13T14:45:00+03:00",
  scopeAr:
    "هذا تحليل تحريري على مستوى Cars (2006)، وليس مراجعة لنسخة أو منصة بعينها. بعد مراجعة شروط المصادر أبقينا فقط مراجع يمكن استخدامها على هذا المسار وفق أساس معلن، وخفّضنا قوة أي واقعة لا يساندها مصدر مستقل ثانٍ بدل الإبقاء على اتفاق غير مؤهل.",
  analysisAr:
    "المؤكد بقوة أعلى هو وجود اصطدامات وحوادث سباق وقيادة خطرة، لأن هذا يظهر في مرجعين مستقلين مؤهلين حاليًا. توجد أيضًا إشارات إلى لحظات توتر وألفاظ خفيفة وغزل أو تلميحات بسيطة، لكن كل محور من هذه المحاور يعتمد الآن على مرجع واحد فقط، لذلك نعرضه بوضوح كدليل أضعف لا كاتفاق بين مصادر. ستة محاور أخرى تظل غير محسومة، وصمت أي مصدر لا يتحول إلى «غير موجود».",
  decisionStatus: "insufficient_data",
  decisionEligible: false,
  sources: [
    buildKidsInMindSource({
      id: "cars-source-kids-in-mind",
      url: "https://kids-in-mind.com/c/cars.htm",
      supportedClaimIds: [
        "cars-claim-violence",
        "cars-claim-fear",
        "cars-claim-language",
        "cars-claim-sexual-content",
      ],
    }),
    buildWikipediaSource({
      id: "cars-source-wikipedia",
      url: "https://en.wikipedia.org/w/index.php?title=Cars_(film)&oldid=1368455889",
      revisionId: "1368455889",
      supportedClaimIds: ["cars-claim-violence"],
    }),
  ],
  claims: [
    {
      id: "cars-claim-violence",
      category: "violence",
      summaryAr:
        "تتضمن القصة سباقات واصطدامات وحوادث قيادة متكررة، بينها تحطم سيارات وخروجها عن المسار ومواقف خطر على الطريق.",
      verification: "corroborated",
      sourceIds: ["cars-source-kids-in-mind", "cars-source-wikipedia"],
    },
    {
      id: "cars-claim-fear",
      category: "fear",
      summaryAr:
        "توجد لحظات توتر قصيرة مرتبطة بالمطاردة والقيادة السريعة والاقتراب من أخطار الطريق؛ هذا الوصف مدعوم حاليًا بمرجع واحد فقط.",
      verification: "single_source",
      sourceIds: ["cars-source-kids-in-mind"],
    },
    {
      id: "cars-claim-language",
      category: "language",
      summaryAr:
        "توجد ألفاظ خفيفة وإهانات وصيحات تعجب متفرقة؛ لا ننقل قائمة الألفاظ أو العدّ الوارد في المرجع.",
      verification: "single_source",
      sourceIds: ["cars-source-kids-in-mind"],
    },
    {
      id: "cars-claim-sexual-content",
      category: "sexualContent",
      summaryAr:
        "توجد إشارات غزل ونكات أو تلميحات خفيفة مبنية على عالم السيارات، من دون استنتاج أوسع من الوقائع التي يذكرها المرجع.",
      verification: "single_source",
      sourceIds: ["cars-source-kids-in-mind"],
    },
  ],
  uncertainCategories: [
    "bullying",
    "substances",
    "discrimination",
    "selfHarm",
    "grief",
    "flashingLights",
  ],
};
