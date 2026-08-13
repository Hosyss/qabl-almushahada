import {
  assessEditorialReviewPublication,
  parseEditorialReviewId,
  type EditorialReviewPublication,
} from "./editorial-review.ts";

const CARS_2006_EDITORIAL_REVIEW: EditorialReviewPublication = {
  id: "cars-2006-editorial-pilot-v1",
  titleId: "wd:Q182153",
  titleLabel: "Cars",
  releaseYear: 2006,
  kind: "movie",
  policyVersion: "2026-08-13.1",
  publishedAt: "2026-08-13T14:45:00+03:00",
  scopeAr:
    "هذا تحليل تحريري على مستوى العمل Cars (2006) مبني على مراجع مستقلة منشورة ومرجع تصنيف رسمي. لا ندّعي أن فريق «قبل المشاهدة» شاهد نسخة بعينها، ولا نربط الوقائع هنا ببصمة cut أو منصة أو مدة محددة؛ لذلك لا يملك هذا المسار وحده سلطة إصدار حكم ملاءمة مكتمل.",
  analysisAr:
    "المصادر المستقلة تتفق على أن الفيلم يتضمن سباقات وقيادة خطرة فيها اصطدامات وفقدان سيطرة، مع لحظات توتر قصيرة خارج الحلبة، وألفاظ وتعليقات خفيفة، إضافة إلى غزل وتلميحات بسيطة مبنية على عالم السيارات. هذه الخلاصة مكتوبة من الصفر اعتمادًا على الوقائع المتقاطعة بين المصادر، لا على نقل نص أي مراجعة. أما المحاور التي لا تملك تغطية كافية ومتسقة فتبقى غير محسومة بدل تحويل الصمت إلى «غير موجود».",
  decisionStatus: "insufficient_data",
  decisionEligible: false,
  sources: [
    {
      id: "cars-source-common-sense-media",
      publisher: "Common Sense Media",
      sourceType: "published_review",
      sourceUrl: "https://www.commonsensemedia.org/movie-reviews/cars",
      accessedOn: "2026-08-13",
      independenceGroupId: "common-sense-media",
      supportedClaimIds: [
        "cars-claim-violence",
        "cars-claim-fear",
        "cars-claim-language",
      ],
    },
    {
      id: "cars-source-plugged-in",
      publisher: "Plugged In",
      sourceType: "published_review",
      sourceUrl: "https://www.pluggedin.com/movie-reviews/cars/",
      accessedOn: "2026-08-13",
      independenceGroupId: "plugged-in",
      supportedClaimIds: [
        "cars-claim-violence",
        "cars-claim-language",
        "cars-claim-sexual-content",
      ],
    },
    {
      id: "cars-source-bbfc",
      publisher: "BBFC",
      sourceType: "official_classification",
      sourceUrl: "https://www.bbfc.co.uk/release/cars-q29sbgvjdglvbjpwwc00mtc2mjc",
      accessedOn: "2026-08-13",
      independenceGroupId: "bbfc",
      supportedClaimIds: [
        "cars-claim-violence",
        "cars-claim-fear",
        "cars-claim-language",
      ],
    },
    {
      id: "cars-source-kids-in-mind",
      publisher: "Kids-In-Mind",
      sourceType: "published_review",
      sourceUrl: "https://kids-in-mind.com/c/cars.htm",
      accessedOn: "2026-08-13",
      independenceGroupId: "kids-in-mind",
      supportedClaimIds: [
        "cars-claim-violence",
        "cars-claim-language",
        "cars-claim-sexual-content",
      ],
    },
    {
      id: "cars-source-dove",
      publisher: "Dove.org",
      sourceType: "published_review",
      sourceUrl: "https://dove.org/review/5768-cars/",
      accessedOn: "2026-08-13",
      independenceGroupId: "dove",
      supportedClaimIds: [
        "cars-claim-violence",
        "cars-claim-fear",
        "cars-claim-language",
        "cars-claim-sexual-content",
      ],
    },
  ],
  claims: [
    {
      id: "cars-claim-violence",
      category: "violence",
      summaryAr:
        "السباقات وبعض مطاردات الطريق تتضمن اصطدامات وفقدان سيطرة وأضرارًا واضحة لسيارات، وتعرض أكثر من مصدر لحوادث قوية داخل الحلبة وخارجها.",
      verification: "corroborated",
      sourceIds: [
        "cars-source-common-sense-media",
        "cars-source-plugged-in",
        "cars-source-bbfc",
        "cars-source-kids-in-mind",
        "cars-source-dove",
      ],
    },
    {
      id: "cars-claim-fear",
      category: "fear",
      summaryAr:
        "توجد مواقف خطر قصيرة قد ترفع التوتر عند الطفل، ومنها قيادة سريعة على الطريق ومشهد عبور سكة حديد مع اقتراب قطار.",
      verification: "corroborated",
      sourceIds: [
        "cars-source-common-sense-media",
        "cars-source-bbfc",
        "cars-source-dove",
      ],
    },
    {
      id: "cars-claim-language",
      category: "language",
      summaryAr:
        "توجد ألفاظ وتعليقات خفيفة وبعض الإهانات أو صيحات التعجب المتناثرة؛ لا نعتمد على عدّ حرفي موحّد لأن المواد المنشورة قد تصف نسخًا مختلفة.",
      verification: "corroborated",
      sourceIds: [
        "cars-source-common-sense-media",
        "cars-source-plugged-in",
        "cars-source-bbfc",
        "cars-source-kids-in-mind",
        "cars-source-dove",
      ],
    },
    {
      id: "cars-claim-sexual-content",
      category: "sexualContent",
      summaryAr:
        "توجد إشارات غزل ونكات أو تلميحات خفيفة مبنية على عالم السيارات، وهي تفاصيل قد يلتقطها الكبار أكثر من الأطفال.",
      verification: "corroborated",
      sourceIds: [
        "cars-source-plugged-in",
        "cars-source-kids-in-mind",
        "cars-source-dove",
      ],
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

const EDITORIAL_REVIEW_PUBLICATIONS = [CARS_2006_EDITORIAL_REVIEW] as const;

export function getEditorialReviewPublicationById(
  editorialId: string,
): EditorialReviewPublication | null {
  const normalized = parseEditorialReviewId(editorialId);
  const publication = EDITORIAL_REVIEW_PUBLICATIONS.find((item) => item.id === normalized) ?? null;
  if (!publication) return null;
  return getValidatedPublication(publication);
}

export function getEditorialReviewPublicationForTitleId(
  titleId: string,
): EditorialReviewPublication | null {
  const publication = EDITORIAL_REVIEW_PUBLICATIONS.find((item) => item.titleId === titleId) ?? null;
  if (!publication) return null;
  return getValidatedPublication(publication);
}

export function listEditorialReviewPublications(): EditorialReviewPublication[] {
  return EDITORIAL_REVIEW_PUBLICATIONS.map((publication) => {
    const validated = getValidatedPublication(publication);
    if (!validated) throw new TypeError(`Invalid editorial review publication: ${publication.id}`);
    return validated;
  });
}

function getValidatedPublication(
  publication: EditorialReviewPublication,
): EditorialReviewPublication | null {
  const assessment = assessEditorialReviewPublication(publication);
  if (!assessment.publishable || assessment.decisionEligible !== false) return null;
  return {
    ...publication,
    sources: publication.sources.map((source) => ({
      ...source,
      supportedClaimIds: [...source.supportedClaimIds],
    })),
    claims: publication.claims.map((claim) => ({ ...claim, sourceIds: [...claim.sourceIds] })),
    uncertainCategories: [...publication.uncertainCategories],
  };
}
