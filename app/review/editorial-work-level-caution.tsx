"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ARAB_FAMILY_POLICY_LABEL_AR,
  ARAB_FAMILY_POLICY_NOTICE_AR,
  createArabFamilyProfile,
} from "@/lib/arab-family-policy";
import {
  buildAsymmetricDecisionPresentation,
  getAsymmetricCategoryLabelAr,
} from "@/lib/asymmetric-decision-presentation";
import {
  JURASSIC_C2A_EDITORIAL_ID,
  decideEditorialWorkLevelForFamily,
  summarizeEditorialWorkLevelEvidence,
} from "@/lib/editorial-work-level-decision";
import type { EditorialReviewPublication } from "@/lib/editorial-review";
import {
  LOCAL_FAMILY_SETTINGS_STORAGE_KEY,
  parseLocalFamilySettings,
  type LocalFamilySettings,
} from "@/lib/local-family-settings";

export default function EditorialWorkLevelCaution({
  review,
  publicationQualityPassed,
}: {
  review: EditorialReviewPublication;
  publicationQualityPassed: boolean;
}) {
  const [localSettings, setLocalSettings] = useState<LocalFamilySettings | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    setLocalSettings(parseLocalFamilySettings(window.localStorage.getItem(LOCAL_FAMILY_SETTINGS_STORAGE_KEY)));
    setSettingsLoaded(true);
  }, []);

  const evidence = useMemo(
    () => summarizeEditorialWorkLevelEvidence(review, {}, publicationQualityPassed).summary,
    [publicationQualityPassed, review],
  );
  const decision = useMemo(() => {
    if (!localSettings) return null;
    return decideEditorialWorkLevelForFamily({
      review,
      family: createArabFamilyProfile(localSettings),
      usedDefaultPreferences: true,
      preferenceMode: "defaults_with_overrides",
      publicationQualityPassed,
    }).decision;
  }, [localSettings, publicationQualityPassed, review]);

  if (review.id !== JURASSIC_C2A_EDITORIAL_ID) return null;

  const verifiedLabels = evidence.verifiedPresentCategories.map(getAsymmetricCategoryLabelAr);
  const unresolvedLabels = evidence.editorialUncertainCategories.map(getAsymmetricCategoryLabelAr);
  const referenceOnlyLabels = evidence.referenceOnlyCategories.map(getAsymmetricCategoryLabelAr);
  const decisionUnknownLabels = evidence.decisionUnknownCategories.map(getAsymmetricCategoryLabelAr);
  const severityMissingLabels = evidence.severityMissingCategories.map(getAsymmetricCategoryLabelAr);
  const allowedSources = review.sources.filter((source) => evidence.allowedSourceIds.includes(source.id));
  const presentation = decision ? buildAsymmetricDecisionPresentation(decision) : null;

  return (
    <section className="editorial-uncertain" aria-labelledby="work-level-caution-title">
      <div>
        <span>{publicationQualityPassed ? "تحذير موثّق على مستوى العمل" : "سجل النشر غير مؤهل للحكم"}</span>
        <h2 id="work-level-caution-title">
          {publicationQualityPassed && verifiedLabels.length > 0
            ? "نعرف أن الخوف والعنف موجودان، لكن لا نختلق درجة شدة"
            : "لا نستخدم وقائع هذا السجل للحكم قبل اجتياز بوابة الجودة"}
        </h2>
        <p>
          {publicationQualityPassed
            ? "المصدر المفتوح المسموح للاستخدام في القرار يثبت وجود محتوى في المحاور الموضحة أدناه، لكن سجل التحليل الحالي لا يحتوي شدة رقمية موثقة تسمح بمقارنتها بحدود أسرتك. لذلك تبقى النتيجة «المعلومات غير كافية» بدل اختراع شدة أو حكم."
            : "بوابة جودة سجل النشر غير مجتازة؛ لذلك لا نستخدم أي claim من هذا السجل لحسم حدود الأسرة، حتى لو كان له رابط مصدر."}
        </p>
        <p>
          هذا الاستنتاج مبني على معلومات موثقة عن العمل، وقد تختلف بعض التفاصيل حسب نسخة العرض.
          لا نعرضه باعتباره قرارًا موثقًا لنسخة محددة.
        </p>
        <p>
          <strong>نطاق القرار:</strong> {presentation?.scopeLabelAr ?? "على مستوى العمل"} ·{" "}
          <strong>الأساس الحالي:</strong> {presentation?.basisLabelAr ?? "الأدلة الحالية غير مكتملة"} ·{" "}
          <strong>الحالة:</strong> {presentation?.outcomeLabelAr ?? "المعلومات غير كافية"}
        </p>
        <p><strong>بوابة جودة سجل النشر:</strong> {publicationQualityPassed ? "مجتازة" : "غير مجتازة — لا يُستخدم أي claim للحكم"}</p>
      </div>

      <div aria-live="polite">
        <p><strong>إعدادات الأسرة المستخدمة:</strong></p>
        {!settingsLoaded ? (
          <p>جارٍ قراءة الإعدادات المحلية على هذا الجهاز…</p>
        ) : localSettings && presentation ? (
          <>
            <p>
              استُخدمت <strong>تعديلاتك المحفوظة على هذا الجهاز</strong>: عمر {localSettings.childAge}،
              وحد الخوف {localSettings.fearLimit}، وتجنب التنمر {localSettings.avoidBullying ? "مفعّل" : "غير مفعّل"}.
              بقية حدود المحاور ما زالت تأتي من الإعدادات الافتراضية القابلة للتعديل؛ لذلك لا نصف النتيجة بأنها تخصيص كامل.
            </p>
            <p><strong>أساس الإعدادات:</strong> {presentation.preferencesLabelAr}.</p>
            <p>
              <strong>النتيجة وفق حدودك:</strong> {presentation.outcomeLabelAr}. هذه النتيجة لا تصبح «ضمن حدودك»
              مع وجود محاور غير محسومة، ولا تصبح «يتجاوز حدودك» من دون شدة مؤهلة تتجاوز حدًا اخترته.
            </p>
          </>
        ) : (
          <>
            <p>
              لا توجد إعدادات أسرة محفوظة، لذلك <strong>لم نفترض عمر طفل أو حدودًا مخفية</strong> ولم نطبق preset تلقائيًا.
            </p>
            <p><strong>{ARAB_FAMILY_POLICY_LABEL_AR}:</strong> {ARAB_FAMILY_POLICY_NOTICE_AR}</p>
          </>
        )}
      </div>

      <div>
        <p><strong>محاور ثبت وجودها من مصدر قابل للاستخدام:</strong></p>
        <ul>{verifiedLabels.map((label) => <li key={label}>{label}</li>)}</ul>
      </div>

      <div>
        <p><strong>لماذا لا نستطيع بعد إثبات تجاوز حدود الأسرة؟</strong></p>
        <p>وجود الخوف والعنف مثبت، لكن الشدة المنظمة المطلوبة للمقارنة غير موجودة في سجل C1 الحالي.</p>
        <ul>{severityMissingLabels.map((label) => <li key={label}>{label}: الشدة غير موثقة</li>)}</ul>
      </div>

      <div>
        <p><strong>المحاور الخمسة التي لم تُحسم أصلًا:</strong></p>
        <ul>{unresolvedLabels.map((label) => <li key={label}>{label}</li>)}</ul>
      </div>

      <div>
        <p><strong>معلومات موجودة بمرجع رابط فقط ولا نسمح لها بحسم القرار:</strong></p>
        <ul>{referenceOnlyLabels.map((label) => <li key={label}>{label}</li>)}</ul>
      </div>

      <div>
        <p><strong>المحاور المجهولة بالنسبة لمحرك القرار حاليًا:</strong></p>
        <ul>{decisionUnknownLabels.map((label) => <li key={label}>{label}</li>)}</ul>
      </div>

      <div>
        <p><strong>الدليل المسموح الذي يستند إليه التحذير:</strong></p>
        <ul>
          {allowedSources.map((source) => (
            <li key={source.id}>
              <a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.publisher}</a>
              {source.sourceVersion ? ` — ${source.sourceVersion}` : ""}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p><strong>ما الذي يمنع نتيجة «ضمن حدودك»؟</strong></p>
        <ul>
          <li>هذا التحليل على مستوى العمل وليس هوية نسخة دقيقة موثقة.</li>
          <li>لا توجد تغطية كاملة مؤهلة للمحاور العشرة.</li>
          <li>المحاور المجهولة لا تتحول إلى «لا يوجد» بسبب صمت المصادر.</li>
          <li>الخوف والعنف موجودان، لكن شدة مؤهلة للمقارنة لم تُسجل في هذا الـcheckpoint.</li>
        </ul>
      </div>
    </section>
  );
}
