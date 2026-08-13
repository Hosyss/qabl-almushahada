import type { EditorialReviewPublication } from "../editorial-review.ts";
import { buildKidsInMindSource, buildWikipediaSource } from "../editorial-review-source-builders.ts";

export const HARRY_POTTER_2001_EDITORIAL_REVIEW: EditorialReviewPublication = {
  id: "harry-potter-philosophers-stone-2001-editorial-batch-v1",
  titleId: "wd:Q102438",
  titleLabel: "هاري بوتر وحجر الفيلسوف",
  releaseYear: 2001,
  kind: "movie",
  policyVersion: "2026-08-13.2",
  publishedAt: "2026-08-13T15:11:00+03:00",
  scopeAr: "هذا تحليل تحريري على مستوى Harry Potter and the Philosopher's Stone (2001). أعدنا تدقيق الإسناد وشروط المصادر وأبقينا المراجع المؤهلة حاليًا فقط. لا نعامل تقييمًا خارجيًا يقول «صفر» كإثبات عام للغياب في تصنيفنا، ولا ندّعي مشاهدة نسخة محددة.",
  analysisAr: "يتفق مرجعان مستقلان على وجود خطر خيالي ومواجهات مخيفة وعنف فانتازي، كما يتفقان على حضور موت والدي Harry في خلفية القصة. وجود الألفاظ الخفيفة مدعوم حاليًا بمرجع واحد فقط، لذلك نعرضه كدليل أحادي لا كاتفاق. ستة محاور أخرى تظل غير محسومة.",
  decisionStatus: "insufficient_data",
  decisionEligible: false,
  sources: [
    buildKidsInMindSource({
      id: "hp1-source-kids-in-mind",
      url: "https://kids-in-mind.com/h/harry_potter_and_the_sorcerers_stone_2001.htm",
      supportedClaimIds: ["hp1-claim-fear", "hp1-claim-violence", "hp1-claim-language", "hp1-claim-grief"],
    }),
    buildWikipediaSource({
      id: "hp1-source-wikipedia",
      url: "https://en.wikipedia.org/w/index.php?title=Harry_Potter_and_the_Philosopher%27s_Stone_(film)&oldid=1368709802",
      revisionId: "1368709802",
      supportedClaimIds: ["hp1-claim-fear", "hp1-claim-violence", "hp1-claim-grief"],
    }),
  ],
  claims: [
    { id: "hp1-claim-fear", category: "fear", summaryAr: "توجد مخلوقات ومواقف تهديد داخل المدرسة والغابة ومواجهة نهائية قد تكون قوية على الأطفال الأصغر، ويظهر هذا السياق في مرجعين مستقلين.", verification: "corroborated", sourceIds: ["hp1-source-kids-in-mind", "hp1-source-wikipedia"] },
    { id: "hp1-claim-violence", category: "violence", summaryAr: "يتضمن الفيلم قتالًا فانتازيًا ومباراة شطرنج تتكسر فيها القطع ومواجهة ينتهي فيها جسد خصم بالتفتت بصورة غير واقعية.", verification: "corroborated", sourceIds: ["hp1-source-kids-in-mind", "hp1-source-wikipedia"] },
    { id: "hp1-claim-language", category: "language", summaryAr: "توجد ألفاظ خفيفة وإهانات متفرقة، لكن الدليل المؤهل الحالي على هذا المحور يأتي من مرجع واحد فقط.", verification: "single_source", sourceIds: ["hp1-source-kids-in-mind"] },
    { id: "hp1-claim-grief", category: "grief", summaryAr: "موت والدي Harry جزء أساسي من خلفية القصة وتعود الإشارة إلى مقتلهما وتضحية الأم، وهو سياق مثبت في مرجعين مستقلين.", verification: "corroborated", sourceIds: ["hp1-source-kids-in-mind", "hp1-source-wikipedia"] },
  ],
  uncertainCategories: ["bullying", "sexualContent", "substances", "discrimination", "selfHarm", "flashingLights"],
};
