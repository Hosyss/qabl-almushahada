import type { EditorialReviewPublication } from "../editorial-review.ts";
import { buildKidsInMindSource, buildWikipediaSource } from "../editorial-review-source-builders.ts";

export const MINIONS_2015_EDITORIAL_REVIEW: EditorialReviewPublication = {
  id: "minions-2015-editorial-batch-v1",
  titleId: "wd:Q13619743",
  titleLabel: "المينيون",
  releaseYear: 2015,
  kind: "movie",
  policyVersion: "2026-08-13.2",
  publishedAt: "2026-08-13T15:11:00+03:00",
  scopeAr: "هذا تحليل تحريري على مستوى Minions (2015). بعد تدقيق شروط الاستخدام خفّضنا الادعاءات إلى ما تدعمه المصادر المؤهلة حاليًا، ولم نحتفظ بمحور الخوف لمجرد أنه كان ظاهرًا في مصادر استبعدناها. لا نعامل نبرة الكوميديا كدليل على الأمان.",
  analysisAr: "يوجد اتفاق مستقل على حضور عنف كرتوني وحوادث وتهديدات ضمن إطار كوميدي. أما الألفاظ الخفيفة، ومشاهد المشروبات الكحولية، وبعض المزاح البصري أو الإيحاءات البسيطة فكل واحد منها مدعوم حاليًا بمرجع مؤهل واحد فقط. لذلك نفرق بوضوح بين الاتفاق المستقل والدليل الأحادي، ونترك ستة محاور — ومنها الخوف — غير محسومة.",
  decisionStatus: "insufficient_data",
  decisionEligible: false,
  sources: [
    buildKidsInMindSource({
      id: "minions-source-kids-in-mind",
      url: "https://kids-in-mind.com/m/minions.htm",
      supportedClaimIds: ["minions-claim-violence", "minions-claim-language", "minions-claim-substances", "minions-claim-sexual-content"],
    }),
    buildWikipediaSource({
      id: "minions-source-wikipedia",
      url: "https://en.wikipedia.org/w/index.php?title=Minions_(film)&oldid=1367345879",
      revisionId: "1367345879",
      supportedClaimIds: ["minions-claim-violence"],
    }),
  ],
  claims: [
    { id: "minions-claim-violence", category: "violence", summaryAr: "توجد حوادث وعنف كرتوني وتهديدات ومطاردات وانفجارات، وتُقدَّم أغلبها في سياق كوميدي غير واقعي.", verification: "corroborated", sourceIds: ["minions-source-kids-in-mind", "minions-source-wikipedia"] },
    { id: "minions-claim-language", category: "language", summaryAr: "توجد ألفاظ خفيفة وإهانات متفرقة من الشخصيات البشرية؛ هذا المحور مدعوم حاليًا بمرجع مؤهل واحد فقط.", verification: "single_source", sourceIds: ["minions-source-kids-in-mind"] },
    { id: "minions-claim-substances", category: "substances", summaryAr: "تظهر مشروبات كحولية في عدة لقطات، بينها مشروب في الطائرة وشرب بيرة في حانة؛ الدليل المؤهل الحالي على هذا المحور أحادي المصدر.", verification: "single_source", sourceIds: ["minions-source-kids-in-mind"] },
    { id: "minions-claim-sexual-content", category: "sexualContent", summaryAr: "توجد إشارات غزل ومزاح بصري خفيف يتضمن ملابس داخلية أو عريًا كرتونيًا غير مفصل؛ هذا المحور مدعوم حاليًا بمرجع مؤهل واحد فقط.", verification: "single_source", sourceIds: ["minions-source-kids-in-mind"] },
  ],
  uncertainCategories: ["fear", "bullying", "discrimination", "selfHarm", "grief", "flashingLights"],
};
