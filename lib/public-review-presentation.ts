import type {
  PublicReviewCategory,
  PublicReviewFact,
  PublicReviewView,
} from "./public-review.ts";

const KIND_LABELS: Record<PublicReviewView["title"]["kind"], string> = {
  movie: "فيلم",
  series: "مسلسل",
  episode: "حلقة",
  special: "عمل خاص",
};

const CONFIDENCE_LABELS: Record<PublicReviewView["confidence"], string> = {
  high: "أدلة مرتفعة",
  medium: "أدلة متوسطة",
  low: "أدلة محدودة",
  unavailable: "غير متاحة",
};

export interface PublicReviewCategoryPresentation extends PublicReviewCategory {
  severityPercent: number;
  severityLabel: string;
  factCountLabel: string;
}

export interface PublicReviewPresentation {
  kindLabel: string;
  runtimeLabel: string;
  publishedDateLabel: string;
  approvedDateLabel: string;
  confidenceLabel: string;
  highestCategoryLabel: string;
  highestSeverity: number;
  categories: PublicReviewCategoryPresentation[];
}

export function buildPublicReviewPresentation(review: PublicReviewView): PublicReviewPresentation {
  const highestCategory = review.highestCategory
    ? review.categories.find((category) => category.id === review.highestCategory) ?? null
    : null;

  return {
    kindLabel: KIND_LABELS[review.title.kind],
    runtimeLabel: formatRuntime(review.version.runtimeSeconds),
    publishedDateLabel: formatDate(review.publishedAt),
    approvedDateLabel: formatDate(review.approvedAt),
    confidenceLabel: CONFIDENCE_LABELS[review.confidence],
    highestCategoryLabel: highestCategory?.labelAr ?? "لا توجد وقائع مسجلة",
    highestSeverity: highestCategory?.severity ?? 0,
    categories: review.categories.map((category) => ({
      ...category,
      severityPercent: category.severity * 25,
      severityLabel: category.severity === 0 ? "غير موجود" : `شدة ${category.severity} من 4`,
      factCountLabel:
        category.facts.length === 0
          ? "لا توجد وقائع مسجلة في هذا المحور."
          : `${category.facts.length} ${category.facts.length === 1 ? "واقعة مسجلة" : "وقائع مسجلة"}`,
    })),
  };
}

export function getFactSummaryForSpoilerMode(
  fact: PublicReviewFact,
  spoilerFree: boolean,
): string | null {
  if (spoilerFree && fact.spoilerLevel !== "none") return null;
  return fact.summary;
}

export function formatFactTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatRuntime(totalSeconds: number): string {
  return formatFactTime(totalSeconds);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ar-EG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
