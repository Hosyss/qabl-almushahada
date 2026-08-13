# خطة تنفيذ «قبل المشاهدة» — الحالة التشغيلية

آخر تحديث: 13 أغسطس 2026

> التاريخ التفصيلي محفوظ في `docs/ROADMAP_ARCHIVE_2026-08-13.md` وGit history.

## ترتيب التنفيذ الحالي

1. الكتالوج الحقيقي — مكتمل: 200/200 عنوان داخل D1.
2. البحث الحقيقي — مكتمل ومقوى بعقد B3 المحافظ للاقتراحات والتطبيع.
3. P4-03A Cars Pilot — مكتمل.
4. P4-03B1 دفعة 3 أفلام — مكتملة.
5. P4-03B2 مراجعة الجودة التحريرية والمصادر — مكتملة إنتاجيًا.
6. P4-03B3 جودة البحث والواجهة والدليل وSEO — **مكتملة ومتحققة إنتاجيًا**.
7. Editorial persistence migration — checkpoint مستقل قبل فلتر D1 «له تحليل تحريري».
8. Public report intake — checkpoint مستقل قبل فتح قناة عامة للبلاغات.
9. P4-03C استكمال 10–20 تحليلًا — متوقف حتى مراجعة واعتماد المستخدم.

## P4-03B3 — مغلقة

- [x] اقتراحات D1 وتطبيع عربي/إنجليزي وفصل direct عن «هل تقصد؟».
- [x] aliases في D1 من دون إضافة عنوان جديد.
- [x] ARIA combobox/listbox وArrowDown/ArrowUp/Enter/Escape مع regression دائم.
- [x] إزالة أي CTA عام إلى `/review` بلا locator.
- [x] الرئيسية تعرض الأربع تحليلات الحقيقية فقط بلا أحكام ملاءمة وهمية.
- [x] الفصل بين التحليل التحريري الجزئي والمراجعة الموثقة لنسخة محددة.
- [x] تحسين القراءة واللغة والجمع وإخفاء المصطلحات التقنية من الواجهة الأساسية.
- [x] الخلاصة وDialog، وتجميع المحاور غير المحسومة في قسم واحد.
- [x] `/titles`: pagination بحجم 24 وبحث ونوع وسنة وحالة مراجعة موثقة Server-side من D1.
- [x] `hasVerifiedReview` من الحالة البشرية الحالية المنشورة والمعتمدة فقط، مع استبعاد البلاغات blocking الحالية.
- [x] لا SQL interpolation ولا IDs ثابتة للأربع صفحات ولا فلتر زائف «له تحليل تحريري».
- [x] catalog-only = `noindex, follow`، والـsitemap يقتصر على الصفحات الغنية القابلة للفهرسة.
- [x] WebSite وOrganization JSON-LD للرئيسية، ولا SearchAction حاليًا.
- [x] invalid/mixed `/review` يفشل مغلقًا ويحمل noindex ورابط بحث.
- [x] Kids-In-Mind يبقى link-only factual reference بلا ادعاء إعادة نشر.
- [x] Engine + migrations + DB regressions + lint + production build.
- [x] main + Cloudflare + Live Product Smoke.
- [x] Chrome production: Desktop 1440×1000 وMobile 390×844، 12 صورة راجعت الرئيسية و`/titles` والأربع صفحات بلا قص أفقي ظاهر أو تداخل تخطيطي.

عدد صفحات التحليل التحريري الجزئي ما زال **4 فقط**: Cars وE.T. وHarry Potter 1 وMinions. لم يبدأ P4-03C.

## Checkpoint لاحق: Editorial persistence migration

التحليلات الأربع الحالية registry في TypeScript وليست publication/current-head داخل D1. المهمة اللاحقة يجب أن تضيف persistence append-only وربطًا صحيحًا بالعنوان/النسخة وrevision وpublication state وcurrent-head ومصادر/claims، ثم تنقل الصفحات الأربع إلى D1 ذريًا مع مقارنة التكافؤ. **بعد نجاح ذلك فقط** يضاف فلتر D1 «له تحليل تحريري».

## Checkpoint لاحق: Public report intake

الـbackend الداخلي موجود لكن public intake غير مفتوح. الربط العام يحتاج عقدًا مستقلًا للتحقق من المدخلات وربطها بالسجل الصحيح وضبط معدل الإرسال ومنع الإساءة وربط البلاغ الجوهري بدورة التصحيح. لا نضيف زرًا أو endpoint عامًا جزئيًا قبل ذلك.

## قواعد ثابتة

- لا نسخ أو ترجمة مراجعات خارجية كاملة.
- `corroborated` تحتاج مجموعتي استقلال فعليتين على الأقل.
- ما لم يثبت يظل `uncertain` ولا يتحول الصمت إلى `none`.
- الصفحات الجزئية تظل داخليًا `decisionEligible = false` و`decisionStatus = insufficient_data`.
- لا فيلم خامس ولا P4-03C قبل اعتماد المستخدم.

## الخطوة الحالية

**توقف بعد إغلاق P4-03B3 ومراجعة النتيجة مع المستخدم قبل أي توسع بالمحتوى.**
