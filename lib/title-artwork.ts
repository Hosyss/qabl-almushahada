export type TitleArtworkProvenance =
  | Readonly<{
      kind: "project_created_illustration";
    }>
  | Readonly<{
      kind: "external_rights_cleared";
      sourceUrl: string;
      rightsBasis: string;
      attribution: string;
    }>;

export type TitleArtwork = Readonly<{
  src: string;
  altAr: string;
  dominantColor: string;
  provenance: TitleArtworkProvenance;
}>;

export const TITLE_ARTWORK_DISCLOSURE_AR = "غلاف توضيحي أصلي — ليس الملصق الرسمي";

const PROJECT_CREATED_ARTWORK_PROVENANCE = Object.freeze({
  kind: "project_created_illustration" as const,
});

const TITLE_ARTWORK_BY_ID: Readonly<Record<string, TitleArtwork>> = Object.freeze({
  "wd:Q11621": {
    src: "/artwork/et-1982.webp",
    altAr: "رسم توضيحي لدراجة وحديقة ليلية مضاءة بالنجوم",
    dominantColor: "#17333a",
    provenance: PROJECT_CREATED_ARTWORK_PROVENANCE,
  },
  "wd:Q39571": {
    src: "/artwork/my-neighbor-totoro-1988.webp",
    altAr: "رسم توضيحي لطريق ريفي ياباني ومظلة حمراء بعد المطر",
    dominantColor: "#59683d",
    provenance: PROJECT_CREATED_ARTWORK_PROVENANCE,
  },
  "wd:Q102438": {
    src: "/artwork/harry-potter-2001.webp",
    altAr: "رسم توضيحي لمدرسة حجرية خيالية وكتب وفانوس",
    dominantColor: "#26352f",
    provenance: PROJECT_CREATED_ARTWORK_PROVENANCE,
  },
  "wd:Q167726": {
    src: "/artwork/jurassic-park-1993.webp",
    altAr: "رسم توضيحي لأثر قدم زاحف ضخم داخل غابة ممطرة",
    dominantColor: "#172e2a",
    provenance: PROJECT_CREATED_ARTWORK_PROVENANCE,
  },
  "wd:Q174385": {
    src: "/artwork/alice-in-wonderland-2010.webp",
    altAr: "رسم توضيحي لباب خيالي وطريق هندسي داخل حديقة سريالية",
    dominantColor: "#7e9c92",
    provenance: PROJECT_CREATED_ARTWORK_PROVENANCE,
  },
  "wd:Q182153": {
    src: "/artwork/cars-2006.webp",
    altAr: "رسم توضيحي لسيارة سباق حمراء على طريق صحراوي",
    dominantColor: "#a34f2d",
    provenance: PROJECT_CREATED_ARTWORK_PROVENANCE,
  },
  "wd:Q212965": {
    src: "/artwork/the-hunger-games-2012.webp",
    altAr: "رسم توضيحي لساحة دائرية محاطة بغابة كثيفة وقت الغروب",
    dominantColor: "#31483d",
    provenance: PROJECT_CREATED_ARTWORK_PROVENANCE,
  },
  "wd:Q13619743": {
    src: "/artwork/minions-2015.webp",
    altAr: "رسم توضيحي لأشكال صفراء مرحة داخل ورشة خيالية",
    dominantColor: "#315441",
    provenance: PROJECT_CREATED_ARTWORK_PROVENANCE,
  },
  "wd:Q55436290": {
    src: "/artwork/barbie-2023.webp",
    altAr: "رسم توضيحي لبيت وردي هندسي وباب مفتوح على طريق",
    dominantColor: "#d28683",
    provenance: PROJECT_CREATED_ARTWORK_PROVENANCE,
  },
  "wd:Q68934496": {
    src: "/artwork/spider-man-no-way-home-2021.webp",
    altAr: "رسم توضيحي لمدينة ليلية ومسارات ضوئية متقاطعة نحو بوابة هندسية",
    dominantColor: "#183238",
    provenance: PROJECT_CREATED_ARTWORK_PROVENANCE,
  },
});

export function getTitleArtwork(titleId: string): TitleArtwork | null {
  return TITLE_ARTWORK_BY_ID[titleId] ?? null;
}

export function listTitleArtworkEntries(): ReadonlyArray<readonly [string, TitleArtwork]> {
  return Object.entries(TITLE_ARTWORK_BY_ID);
}
