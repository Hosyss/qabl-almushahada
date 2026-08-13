# خطة تنفيذ «قبل المشاهدة» — الحالة التشغيلية

آخر تحديث: 13 أغسطس 2026

> التاريخ التفصيلي محفوظ في `docs/ROADMAP_ARCHIVE_2026-08-13.md` وGit history.

## ترتيب التنفيذ الحالي

1. **الكتالوج الحقيقي** — مكتمل: 200/200 عنوان داخل D1.
2. **البحث الحقيقي** — مكتمل إنتاجيًا حتى B2، وB3 يضيف normalization/اقتراحات/UX أقوى.
3. **P4-03A Cars Pilot** — مكتمل.
4. **P4-03B1 دفعة 3 أفلام** — مكتملة.
5. **P4-03B2 مراجعة الجودة التحريرية/المصادر** — مكتملة ومتحققة إنتاجيًا.
6. **P4-03B3 جودة عامة للبحث والواجهة والدليل وSEO** — **قيد الإغلاق؛ لا تعتبر مكتملة قبل main + Cloudflare + Live Smoke**.
7. **Editorial persistence migration** — blocker مستقل بعد B3 وقبل أي فلتر D1 «له تحليل تحريري».
8. **Public report intake security checkpoint** — مستقل؛ لا زر عام قبل validation/rate limiting/server-owned binding.
9. **P4-03C استكمال 10–20 تحليلًا** — لا يبدأ في جلسة B3 ولا قبل مراجعة نتيجة checkpoint الحالي.
10. **اختبار 5 أسر** — قبل تعديل واجهة واسع لاحق.
11. **استعداد التوسع العام** — domain، أداء وإتاحة، monitoring، backup/recovery.

## P4-03 — الحالة الحالية

عدد صفحات التحليل التحريري الجزئي: **4 فقط**.

- [x] `P4-03A` Cars.
- [x] `P4-03B1` E.T. + Harry Potter 1 + Minions.
- [x] `P4-03B2` مراجعة الجودة.
- [ ] `P4-03B3` البحث + readability/modal + جودة عامة.
  - [x] إصلاح normalization والاقتراحات من D1 مع direct مقابل «هل تقصد؟» محافظ.
  - [x] دعم aliases في D1 من دون إضافة عنوان جديد.
  - [x] ARIA combobox/listbox ولوحة المفاتيح.
  - [x] إزالة CTA `/review` بلا locator من الرئيسية.
  - [x] استبدال الأمثلة الوهمية بالأربع صفحات الحقيقية فقط.
  - [x] توضيح الفرق بين التحليل التحريري الجزئي والمراجعة الموثقة لنسخة محددة.
  - [x] تحسين اللغة والجمع وإخفاء المصطلحات التقنية من الواجهة الأساسية.
  - [x] تقليل تكرار المحاور غير المحسومة وإبقاء المعلومات في HTML.
  - [x] `/titles`: pagination + query/type/year/reviewStatus server-side من D1 بحجم صفحة 24.
  - [x] `hasVerifiedReview` من علاقة المراجعة البشرية الحالية فقط؛ لا snapshot قديمة ولا approval غير current ولا publication غير منشورة ولا blocking report.
  - [x] لا يوجد SQL interpolation أو IDs ثابتة للصفحات الأربع.
  - [x] catalog-only title pages = `noindex, follow`، والـsitemap لا يدرجها.
  - [x] WebSite + Organization JSON-LD للرئيسية؛ لا SearchAction حاليًا.
  - [x] invalid/mixed `/review` = fail-closed + noindex + search path.
  - [x] Kids-In-Mind يبقى link-only factual reference بلا ادعاء إعادة نشر.
  - [x] البلاغ العام لم يُربط جزئيًا لأن public intake يحتاج checkpoint أمني مستقل.
  - [ ] Quality Gate النهائي على آخر head.
  - [ ] PR مستقل وCI أخضر.
  - [ ] main verification.
  - [ ] Cloudflare production deploy.
  - [ ] Live Product Smoke للمسارات المعدلة.
  - [ ] Desktop/Mobile QA وصور التسليم.
- [ ] `P4-03C` — **متوقف في هذا checkpoint**.

## Blocker: Editorial persistence migration

التحليلات التحريرية الجزئية الأربع الحالية registry في TypeScript، وليست كيان publication/current-head داخل D1. لذلك لا ننفذ فلتر «له تحليل تحريري» باستخدام أربعة IDs ثابتة ولا نخلط هذا النوع بمسار `review_bundles` أو `evidence_review_publications`.

المهمة المستقلة المطلوبة لاحقًا:

- جداول append-only للتحليل التحريري الجزئي.
- ربط صحيح بـ`title_id`/`version_id` حسب العقد النهائي.
- revision + publication state + current-head.
- مصادر وclaims وعلاقات تدقيق قابلة للتحقق.
- migration ذرية للصفحات الأربع الحالية من TypeScript إلى D1 مع مقارنة التكافؤ قبل تحويل القراءة.
- **بعد نجاحها فقط** يضاف فلتر D1 «له تحليل تحريري» في `/titles`.

لا تنفذ هذه migration ضمن B3.

## قواعد ثابتة

- لا نسخ أو ترجمة مراجعات خارجية كاملة.
- `corroborated` تحتاج مجموعتي استقلال فعليتين على الأقل.
- مصدر واحد يظهر `single_source` داخليًا، مع صياغة عربية طبيعية للمستخدم.
- ما لم يثبت يظل `uncertain` ولا يتحول الصمت إلى `none`.
- كل صفحة جزئية تظل `decisionEligible = false` و`decisionStatus = insufficient_data` داخليًا.
- لا يضاف فيلم خامس ولا تبدأ P4-03C داخل B3.
- لا يتم إنشاء Public report intake قبل checkpoint الأمان المخصص.

## الخطوة الحالية

إغلاق `P4-03B3` عبر Quality Gates ثم PR → main → Cloudflare → Live Smoke → Desktop/Mobile QA. **بعد نجاحها نتوقف قبل أي توسع بالمحتوى.**
