"use client";

import { useMemo, useSyncExternalStore } from "react";

import { createArabFamilyProfile } from "@/lib/arab-family-policy";
import { getAsymmetricCategoryLabelAr } from "@/lib/asymmetric-decision-presentation";
import {
  buildPracticalEditorialVerdictSummaryAr,
  decidePracticalEditorialVerdict,
  EDITORIAL_PRACTICAL_OUTCOME_LABELS_AR,
} from "@/lib/editorial-practical-verdict";
import type { EditorialReviewPublication } from "@/lib/editorial-review";
import {
  LOCAL_FAMILY_SETTINGS_STORAGE_KEY,
  parseLocalFamilySettings,
} from "@/lib/local-family-settings";

const SETTINGS_LOADING_SNAPSHOT = "__qabl_family_settings_loading__";

function subscribe(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === LOCAL_FAMILY_SETTINGS_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

function getSnapshot() {
  return window.localStorage.getItem(LOCAL_FAMILY_SETTINGS_STORAGE_KEY);
}

function getServerSnapshot() {
  return SETTINGS_LOADING_SNAPSHOT;
}

export default function EditorialPracticalVerdict({
  review,
  publicationQualityPassed,
}: {
  review: EditorialReviewPublication;
  publicationQualityPassed: boolean;
}) {
  const settingsSnapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const settingsLoaded = settingsSnapshot !== SETTINGS_LOADING_SNAPSHOT;
  const settings = useMemo(
    () => settingsLoaded ? parseLocalFamilySettings(settingsSnapshot) : null,
    [settingsLoaded, settingsSnapshot],
  );

  const generalVerdict = useMemo(
    () => decidePracticalEditorialVerdict({ review, publicationQualityPassed }),
    [publicationQualityPassed, review],
  );
  const familyVerdict = useMemo(
    () => settings
      ? decidePracticalEditorialVerdict({
          review,
          publicationQualityPassed,
          family: createArabFamilyProfile(settings),
        })
      : null,
    [publicationQualityPassed, review, settings],
  );
  const verdict = familyVerdict ?? generalVerdict;
  const determiningLabels = verdict.determiningCategories.map(getAsymmetricCategoryLabelAr);
  const knownLabels = verdict.knownPresentCategories.map(getAsymmetricCategoryLabelAr);
  const unknownLabels = verdict.unknownCategories.map(getAsymmetricCategoryLabelAr);
  const referenceOnlyLabels = verdict.referenceOnlyCategories.map(getAsymmetricCategoryLabelAr);

  return (
    <section className="editorial-uncertain" aria-labelledby="practical-verdict-title">
      <div>
        <span>{familyVerdict ? "الحكم وفق حدود أسرتك" : "حكم عملي على مستوى العمل"}</span>
        <h2 id="practical-verdict-title">
          {EDITORIAL_PRACTICAL_OUTCOME_LABELS_AR[verdict.outcome]}
        </h2>
        <p>{buildPracticalEditorialVerdictSummaryAr(verdict)}</p>
        <p>
          هذا الحكم لا يدّعي أن كل نسخة عرض متطابقة، ولا يحوّل المحاور غير المحسومة إلى «لا يوجد».
          لو وُجد اختلاف معروف بين النسخ، تظل تفاصيل النسخة موضحة في التحليل.
        </p>
        <p>
          <strong>درجة الثقة:</strong>{" "}
          {verdict.confidence === "medium" ? "متوسطة" : verdict.confidence === "low" ? "منخفضة" : "غير متاحة"}
          {verdict.establishedWork ? " · العمل تجاوز نافذة الإصدار المبكر" : " · العمل ما زال داخل نافذة الإصدار المبكر"}
        </p>
      </div>

      {!settingsLoaded ? (
        <p aria-live="polite">جارٍ قراءة إعدادات الأسرة المحفوظة على هذا الجهاز…</p>
      ) : familyVerdict && settings ? (
        <div aria-live="polite">
          <p><strong>القرار المخصص:</strong> {EDITORIAL_PRACTICAL_OUTCOME_LABELS_AR[familyVerdict.outcome]}</p>
          <p>
            استخدمنا عمر {settings.childAge}، حد الخوف {settings.fearLimit}،
            وتجنب التنمر {settings.avoidBullying ? "مفعّل" : "غير مفعّل"}.
          </p>
          {determiningLabels.length > 0 ? (
            <p><strong>سبب المنع:</strong> وجود محتوى موثّق في {determiningLabels.join("، ")} بينما حد الأسرة لهذا المحور صفر.</p>
          ) : (
            <p>لم نجد في الوقائع المؤهلة ما يثبت تجاوز حد صفري اخترته؛ لذلك لا نختلق شدة رقمية لإنتاج منع غير موثّق.</p>
          )}
        </div>
      ) : (
        <div aria-live="polite">
          <p><strong>الحكم العام:</strong> {EDITORIAL_PRACTICAL_OUTCOME_LABELS_AR[generalVerdict.outcome]}</p>
          <p>لا توجد إعدادات أسرة محفوظة على هذا الجهاز، لذلك هذا حكم عام على مستوى العمل وليس حكمًا لعمر طفل بعينه.</p>
        </div>
      )}

      <div>
        <p><strong>المحتوى الذي ثبت وجوده في التحليل:</strong></p>
        <ul>{knownLabels.map((label) => <li key={label}>{label}</li>)}</ul>
      </div>

      {unknownLabels.length > 0 ? (
        <div>
          <p><strong>محاور ما زالت غير محسومة:</strong></p>
          <ul>{unknownLabels.map((label) => <li key={label}>{label}</li>)}</ul>
          <p>وجودها كمحاور غير محسومة يقلل قوة الحكم، لكنه لا يمسح الحكم العملي كله في عمل ناضج وله تحليل متعدد المصادر.</p>
        </div>
      ) : null}

      {referenceOnlyLabels.length > 0 ? (
        <div>
          <p><strong>وقائع مفيدة موجودة بمرجع رابط فقط:</strong></p>
          <ul>{referenceOnlyLabels.map((label) => <li key={label}>{label}</li>)}</ul>
          <p>نعرضها للمستخدم، لكن لا نستخدمها وحدها لإثبات تجاوز حد أسري.</p>
        </div>
      ) : null}

      <div>
        <p><strong>ليه الحكم ده مختلف عن «مراجعة نسخة محددة»؟</strong></p>
        <p>
          الحكم العملي يجيب سؤال «ينفع أشاهده ولا لأ؟» من corpus تحريري ناضج ومتعدد المصادر.
          أما ختم «ضمن حدودك» عالي الثقة لنسخة محددة فيظل محتاج هوية نسخة وتغطية كاملة وشدة موثقة عند الحاجة.
        </p>
      </div>
    </section>
  );
}
