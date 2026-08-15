"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

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
  serializeLocalFamilySettings,
  type LocalFamilySettings,
} from "@/lib/local-family-settings";

const SETTINGS_LOADING_SNAPSHOT = "__qabl_family_settings_loading__";
const SETTINGS_CHANGED_EVENT = "qabl-family-settings-changed";
const DEFAULT_FORM: LocalFamilySettings = { childAge: 12, fearLimit: 2, avoidBullying: true };

function subscribe(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === LOCAL_FAMILY_SETTINGS_STORAGE_KEY) onStoreChange();
  };
  const handleLocalChange = () => onStoreChange();
  window.addEventListener("storage", handleStorage);
  window.addEventListener(SETTINGS_CHANGED_EVENT, handleLocalChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(SETTINGS_CHANGED_EVENT, handleLocalChange);
  };
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
  const [draft, setDraft] = useState<LocalFamilySettings | null>(null);
  const [savedNotice, setSavedNotice] = useState("");
  const form = draft ?? settings ?? DEFAULT_FORM;

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
  const attentionLabels = verdict.attentionCategories.map(getAsymmetricCategoryLabelAr);
  const knownLabels = verdict.knownPresentCategories.map(getAsymmetricCategoryLabelAr);
  const unknownLabels = verdict.unknownCategories.map(getAsymmetricCategoryLabelAr);
  const referenceOnlyLabels = verdict.referenceOnlyCategories.map(getAsymmetricCategoryLabelAr);

  function updateDraft(patch: Partial<LocalFamilySettings>) {
    setDraft({ ...form, ...patch });
  }

  function saveSettings() {
    window.localStorage.setItem(LOCAL_FAMILY_SETTINGS_STORAGE_KEY, serializeLocalFamilySettings(form));
    setDraft(null);
    window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
    setSavedNotice("تم حفظ إعدادات الأسرة على هذا الجهاز وتحديث الحكم.");
  }

  function clearSettings() {
    window.localStorage.removeItem(LOCAL_FAMILY_SETTINGS_STORAGE_KEY);
    setDraft(null);
    window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
    setSavedNotice("تم حذف إعدادات الأسرة المحلية. لن نفترض عمرًا أو حدودًا من عندنا.");
  }

  return (
    <section className="editorial-uncertain" aria-labelledby="practical-verdict-title">
      <div>
        <span>{familyVerdict ? "الحكم وفق حدود أسرتك" : "التحليل جاهز للحكم العملي"}</span>
        <h2 id="practical-verdict-title">
          {EDITORIAL_PRACTICAL_OUTCOME_LABELS_AR[verdict.outcome]}
        </h2>
        <p>{buildPracticalEditorialVerdictSummaryAr(verdict)}</p>
        <p>
          النتائج الممكنة بعد تحديد إعدادات الأسرة: «ينفع للمشاهدة وفق حدود أسرتك»، «يحتاج انتباهك قبل المشاهدة»،
          أو «لا أنصح به وفق حدود أسرتك».
        </p>
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
          ) : attentionLabels.length > 0 ? (
            <p><strong>يحتاج انتباه بسبب:</strong> {attentionLabels.join("، ")}. لا نملك شدة رقمية كافية لإثبات أن هذه النقاط داخل حد الأسرة، لذلك لا نقول «ينفع» بلا دليل ولا نرجع إلى «الحكم غير مكتمل».</p>
          ) : (
            <p>لم نجد في الوقائع أو المحاور غير المحسومة ما يمكن أن يتجاوز حدود الأسرة الحالية ضمن ما نستطيع إثباته من دون اختراع شدة.</p>
          )}
        </div>
      ) : (
        <div aria-live="polite">
          <p><strong>الأدلة جاهزة، والناقص هو إعداد الأسرة فقط.</strong> لن نفترض عمر طفل من عندنا.</p>
        </div>
      )}

      {settingsLoaded ? (
        <fieldset className="editorial-family-settings">
          <legend>{settings ? "تعديل إعدادات الأسرة" : "حدد إعدادات الأسرة لإصدار الحكم"}</legend>
          <label>
            عمر الطفل
            <select
              aria-label="عمر الطفل"
              value={form.childAge}
              onChange={(event) => updateDraft({ childAge: Number(event.target.value) })}
            >
              {Array.from({ length: 15 }, (_, index) => index + 3).map((age) => (
                <option key={age} value={age}>{age} سنة</option>
              ))}
            </select>
          </label>
          <label>
            حد الخوف
            <select
              aria-label="حد الخوف"
              value={form.fearLimit}
              onChange={(event) => updateDraft({ fearLimit: Number(event.target.value) as 0 | 1 | 2 | 3 })}
            >
              <option value={0}>صفر — لا أقبل وجوده</option>
              <option value={1}>منخفض</option>
              <option value={2}>متوسط</option>
              <option value={3}>مرتفع</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.avoidBullying}
              onChange={(event) => updateDraft({ avoidBullying: event.target.checked })}
            />
            تجنب التنمر بالكامل
          </label>
          <div className="editorial-family-settings__actions">
            <button type="button" onClick={saveSettings}>احفظ وحدث الحكم</button>
            {settings ? <button type="button" onClick={clearSettings}>احذف الإعدادات</button> : null}
          </div>
          <p>تُحفظ هذه القيم محليًا على جهازك فقط. لا نرسل عمر الطفل أو تفضيلات الأسرة إلى حساب أو ملف شخصي.</p>
          <p aria-live="polite">{savedNotice}</p>
        </fieldset>
      ) : null}

      <div>
        <p><strong>المحتوى الذي ثبت وجوده في التحليل:</strong></p>
        <ul>{knownLabels.map((label) => <li key={label}>{label}</li>)}</ul>
      </div>

      {unknownLabels.length > 0 ? (
        <div>
          <p><strong>محاور ما زالت غير محسومة:</strong></p>
          <ul>{unknownLabels.map((label) => <li key={label}>{label}</li>)}</ul>
          <p>تظل غير محسومة فعلًا. وجودها قد يجعل الحكم «يحتاج انتباهك»، لكنه لا يعيد الفيلم تلقائيًا إلى «المعلومات غير كافية» بعد نضج التحليل.</p>
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
          الحكم العملي يجاوب قرار الأسرة من corpus تحريري ناضج ومتعدد المصادر.
          أما ختم «ضمن حدودك» عالي الثقة لنسخة محددة فيظل محتاج هوية نسخة وتغطية كاملة وشدة موثقة عند الحاجة.
        </p>
      </div>
    </section>
  );
}
