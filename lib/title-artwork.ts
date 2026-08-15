export type TitleArtwork = Readonly<{
  src: string;
  altAr: string;
  dominantColor: string;
}>;

export const TITLE_ARTWORK_DISCLOSURE_AR = "غلاف توضيحي أصلي — ليس الملصق الرسمي";

const TITLE_ARTWORK_BY_ID: Readonly<Record<string, TitleArtwork>> = Object.freeze({
  "wd:Q11621": {
    src: "/artwork/et-1982.webp",
    altAr: "رسم توضيحي لدراجة وحديقة ليلية مضاءة بالنجوم",
    dominantColor: "#17333a",
  },
  "wd:Q39571": {
    src: "/artwork/my-neighbor-totoro-1988.webp",
    altAr: "رسم توضيحي لطريق ريفي ياباني ومظلة حمراء بعد المطر",
    dominantColor: "#59683d",
  },
  "wd:Q102438": {
    src: "/artwork/harry-potter-2001.webp",
    altAr: "رسم توضيحي لمدرسة حجرية خيالية وكتب وفانوس",
    dominantColor: "#26352f",
  },
  "wd:Q167726": {
    src: "/artwork/jurassic-park-1993.webp",
    altAr: "رسم توضيحي لأثر قدم زاحف ضخم داخل غابة ممطرة",
    dominantColor: "#172e2a",
  },
  "wd:Q174385": {
    src: "/artwork/alice-in-wonderland-2010.webp",
    altAr: "رسم توضيحي لباب خيالي وطريق هندسي داخل حديقة سريالية",
    dominantColor: "#7e9c92",
  },
  "wd:Q182153": {
    src: "/artwork/cars-2006.webp",
    altAr: "رسم توضيحي لسيارة سباق حمراء على طريق صحراوي",
    dominantColor: "#a34f2d",
  },
  "wd:Q212965": {
    src: "/artwork/the-hunger-games-2012.webp",
    altAr: "رسم توضيحي لساحة دائرية محاطة بغابة كثيفة وقت الغروب",
    dominantColor: "#31483d",
  },
  "wd:Q13619743": {
    src: "/artwork/minions-2015.webp",
    altAr: "رسم توضيحي لأشكال صفراء مرحة داخل ورشة خيالية",
    dominantColor: "#315441",
  },
  "wd:Q55436290": {
    src: "/artwork/barbie-2023.webp",
    altAr: "رسم توضيحي لبيت وردي هندسي وباب مفتوح على طريق",
    dominantColor: "#d28683",
  },
  "wd:Q68934496": {
    src: "/artwork/spider-man-no-way-home-2021.webp",
    altAr: "رسم توضيحي لمدينة ليلية ومسارات ضوئية متقاطعة نحو بوابة هندسية",
    dominantColor: "#183238",
  },
});

export function getTitleArtwork(titleId: string): TitleArtwork | null {
  return TITLE_ARTWORK_BY_ID[titleId] ?? null;
}

export function listTitleArtworkEntries(): ReadonlyArray<readonly [string, TitleArtwork]> {
  return Object.entries(TITLE_ARTWORK_BY_ID);
}
