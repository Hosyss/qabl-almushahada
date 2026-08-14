# خطة تنفيذ «قبل المشاهدة» — الحالة التشغيلية

آخر تحديث: 14 أغسطس 2026

> التاريخ التفصيلي محفوظ في `docs/ROADMAP_ARCHIVE_2026-08-13.md` وGit history.

## ترتيب التنفيذ الحالي

1. الكتالوج الحقيقي — مكتمل: 200/200 عنوان داخل D1.
2. البحث الحقيقي — مكتمل ومقوى بعقد B3 المحافظ للاقتراحات والتطبيع.
3. P4-03A Cars Pilot — مكتمل.
4. P4-03B1 دفعة 3 أفلام — مكتملة.
5. P4-03B2 مراجعة الجودة التحريرية والمصادر — مكتملة إنتاجيًا.
6. P4-03B3 جودة البحث والواجهة والدليل وSEO — **مكتملة ومتحققة إنتاجيًا**.
7. P4-03B4 Editorial Persistence — **مكتملة ومتحققة إنتاجيًا** عند `8acb3b3ad3b59919b194ab606bba857e16fd8ca5`.
8. P4-03C1 — **مكتملة على main** عند `fc1b7a3d183dc6f7d419c14abb39b21d131763d6`؛ أصبح الإجمالي 7 تحليلات جزئية.
9. P4-03C2A Asymmetric Decision Semantics — **قيد المراجعة على فرع غير إنتاجي**؛ Jurassic Park فقط، بلا دمج أو نشر Production أو migration لهوية النسخة.
10. Public report intake — checkpoint مستقل ومؤجل.
11. التوسع بعد السبعة — مؤجل حتى مراجعة C2A.

## P4-03B4 — Editorial Persistence

- [x] D1 persistence مستقل عن `evidence_review_publications` وعن المراجعات البشرية.
- [x] append-only revisions وchildren غير قابلة للتعديل أو الحذف تاريخيًا.
- [x] current-head واحد لكل `title_id` مع direct successor وrevision lock.
- [x] incomplete/stale snapshot لا تصبح current.
- [x] حفظ المصادر والوقائع والمحاور غير المحسومة وقوة الإسناد والحقوق/العزو والسياسة والبصمة.
- [x] الصفحات الأربع تظل `decisionEligible = false` و`decisionStatus = insufficient_data`.
- [x] إثبات parity للأربع صفحات قبل حذف Registry القديمة.
- [x] bootstrap idempotent لـCars وE.T. وHarry Potter 1 وMinions.
- [x] D1-only public loader مع fingerprint fail-closed ولا fallback صامت إلى Registry.
- [x] إزالة TypeScript content registry وملفات publications الأربعة بعد إثبات parity.
- [x] الرئيسية والبحث و`/review` وصفحة العنوان والـsitemap تعتمد current-head D1.
- [x] فلتر `/titles` الحقيقي «له تحليل تحريري» من current-head D1.
- [x] اختبارات immutability وcurrent-head/concurrency/rollback وIDOR وparity/idempotence.
- [x] `cloudflare:migrate` يعيد bootstrap والتحقق من الأربع current-heads حتى في redeploy بلا migrations جديدة.
- [x] PR #63 دمج تنفيذ persistence الأساسي إلى main عند `56ec293144ef5f1c788f35a311acb5f4dabb0d91`.
- [x] Live Smoke الأول كشف regression في ترتيب `HarryPotter`؛ PR #64 أعاد خوارزمية B3 المحافظة وأضاف regression دائم، ثم دُمج عند `8acb3b3ad3b59919b194ab606bba857e16fd8ca5`.
- [x] main Checkpoint run `31748757205` — success.
- [x] main B4 persistence run `31748757222` — success.
- [x] Cloudflare production deploy run `31748757264` — success، بما فيه D1 bootstrap/current-head verification قبل Worker deploy.
- [x] Live Product Smoke run `31748835647` — success للأربع صفحات والبحث والدليل وfail-closed والسitemap.
- [x] live filter diagnostic run `31748924588` — success؛ `editorialStatus=editorial` يعرض بالضبط الأربع current editorial titles في هذا checkpoint.
- [x] **B4 مكتملة ومتحققة إنتاجيًا**.

تاريخيًا كان B4 يغطي **4 فقط**. بعد P4-03C1 أصبح الوضع الحالي **7** تحليلات جزئية؛ لا يوجد فيلم ثامن داخل C2A.

## P4-03B3 — مغلقة

- [x] اقتراحات D1 وتطبيع عربي/إنجليزي وفصل direct عن «هل تقصد؟».
- [x] aliases في D1 من دون إضافة عنوان جديد.
- [x] ARIA combobox/listbox وArrowDown/ArrowUp/Enter/Escape مع regression دائم.
- [x] إزالة أي CTA عام إلى `/review` بلا locator.
- [x] الرئيسية تعرض الأربع تحليلات الحقيقية فقط بلا أحكام ملاءمة وهمية.
- [x] الفصل بين التحليل التحريري الجزئي والمراجعة الموثقة لنسخة محددة.
- [x] `/titles`: pagination وبحث ونوع وسنة وحالة مراجعة موثقة Server-side من D1.
- [x] catalog-only = `noindex, follow`، والـsitemap يقتصر على الصفحات الغنية القابلة للفهرسة.
- [x] invalid/mixed `/review` يفشل مغلقًا ويحمل noindex ورابط بحث.
- [x] Engine + migrations + DB regressions + lint + production build + main + Cloudflare + Live Product Smoke.


## P4-03C2A — Asymmetric Decision Semantics (فرع مراجعة)

- [x] فصل إثبات التجاوز عن إثبات الملاءمة.
- [x] `exceeds_family_limits` يسمح بدليل present مؤهل يتجاوز حد الأسرة حتى مع unknown غير مرتبط.
- [x] `within_family_limits` يتطلب Full Evidence Gate ناجحة صراحةً + Full Coverage مؤهلة + Exact Version.
- [x] منع المصدر link-only من حسم القرار.
- [x] `work_level` لا يتحول إلى exact-version claim.
- [x] Jurassic Park فقط يحصل على لوحة work-level جديدة؛ بقية الستة لا تتغير.
- [x] عدم اختراع severity للخوف/العنف؛ النتيجة الفعلية الحالية `insufficient_data`.
- [x] تمييز defaults-only عن defaults-with-overrides؛ إعدادات الأسرة المحلية الحالية لا تُقدَّم كتخصيص كامل.
- [x] تسمية الإعدادات العامة منزوعة الادعاء الرسمي/العلمي.
- [x] Exact Version البديل موثق كـADR فقط، بلا schema migration.
- [ ] Lint وProduction Build مطلوبان قبل merge readiness؛ حالة البيئة المحلية الحالية تحدد هل يمكن تشغيلهما.

## Checkpoint لاحق: Public report intake

الـbackend الداخلي موجود لكن public intake غير مفتوح. الربط العام يحتاج عقدًا مستقلًا للتحقق من المدخلات وربطها بالسجل الصحيح وضبط معدل الإرسال ومنع الإساءة وربط البلاغ الجوهري بدورة التصحيح. لا نضيف زرًا أو endpoint عامًا جزئيًا قبل ذلك.

## قواعد ثابتة

- لا نسخ أو ترجمة مراجعات خارجية كاملة.
- `corroborated` تحتاج مجموعتي استقلال فعليتين على الأقل.
- ما لم يثبت يظل `uncertain` ولا يتحول الصمت إلى `none`.
- الصفحات الجزئية تظل داخليًا `decisionEligible = false` و`decisionStatus = insufficient_data`.
- persistence لا تمنح سلطة حكم؛ هي تخزين وتاريخ نشر وتدقيق فقط.
- لا فيلم خامس ولا P4-03C ولا public report intake داخل B4.

## الخطوة التالية

**C2A على فرع مراجعة غير إنتاجي. أكمِل CI وراجع النتائج قبل أي merge/deploy أو توسع إلى فيلم ثامن.**
