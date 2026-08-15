# خطة تنفيذ «قبل المشاهدة» — الحالة التشغيلية

آخر تحديث: 15 أغسطس 2026

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
9. P4-03C2A Asymmetric Decision Semantics — **مدمجة ومنشورة إنتاجيًا** ضمن PR #67؛ Jurassic Park فقط على مستوى العمل، بلا migration لهوية النسخة.
10. P4-03C2B Original Editorial Artwork — **مدمجة ومنشورة إنتاجيًا** ضمن PR #67؛ سبعة أغلفة أصلية محلية مع disclosure وfallback، بلا مصدر صور خارجي.
11. C1 three-title production quality checkpoint — **نُفذ للثلاثة فقط**؛ كل فحوص العرض/SEO/المصادر نجحت، وكشف focus trap واحدًا أُصلح في PR #68 ونجح Browser QA قبل الدمج.
12. P4-03C2 — **قيد المراجعة**؛ إضافة Alice in Wonderland (2010) وThe Hunger Games (2012) وSpider-Man: No Way Home (2021) لرفع الإجمالي من 7 إلى **10 فقط** عبر D1 Editorial Persistence الحالي.
13. Public report intake — checkpoint مستقل، **التالي بعد إغلاق P4-03C2 إنتاجيًا** ولم يبدأ بعد.
14. التوسع بعد العشرة — **سيتوقف مؤقتًا**؛ لا فيلم حادي عشر ولا دفعة محتوى جديدة قبل قناة البلاغ والاستعداد للفهرسة/AdSense.

## P4-03C2 — Three Editorial Additions

- [x] اختيار ثلاثة عناوين موجودة فعليًا في Production D1: `wd:Q174385`, `wd:Q212965`, `wd:Q68934496`.
- [x] Wikipedia fixed revisions + Kids-In-Mind link-only مع version caveats.
- [x] Fixtures جديدة `decisionEligible=false` ولا `none` مصطنعة.
- [x] حراس regression يقفلون العدد عند 10 ويحفظون fingerprints للسبعة السابقين.
- [x] ثلاثة أغلفة أصلية محلية وallowlist من 10 فقط.
- [x] homepage contract يظل أحدث 4 فقط، وLive Smoke محدث ليتوقع 10 في الدليل/sitemap بعد Production.
- [x] Branch Checkpoint: Engine + migrations + lint + production build ناجحة.
- [x] Public Quality على الفرع ناجح.
- [ ] PR مستقل + B4 persistence checks.
- [ ] بعد الدمج: Production D1 verification + Cloudflare deploy + Live Product Smoke + Chrome QA.
- [ ] توقف عند 10؛ لا فيلم حادي عشر.

## P4-03C1 — Production quality checkpoint للثلاثة الجدد

- [x] Barbie (2023)، Jurassic Park (1993)، My Neighbor Totoro (1988) فقط.
- [x] Production Chrome على Desktop `1440×1000` وMobile `390×844`.
- [x] العربية/الإنجليزية/السنة والخلاصة والوقائع والمصادر واضحة في الحالات الست.
- [x] canonical + metadata + `Article` JSON-LD + citations + sitemap سليمة.
- [x] artwork المحلي الصحيح في كل صفحة؛ لا broken images ولا horizontal overflow؛ CLS = `0.0000`.
- [x] فلتر «له تحليل تحريري» يعيد **7 فقط**؛ لا publication ثامن.
- [x] البحث الأساسي بالعربي والإنجليزي والبدائل/الأخطاء البسيطة التي راجعتها المصفوفة ناجح.
- [x] Wikipedia تبقى fixed revision + `CC BY-SA 4.0`، وKids-In-Mind يبقى `link_only_factual_reference`؛ لا درجات أو بنية أو نصوص منقولة.
- [x] `corroborated` لا تتجاوز مصدرين مستقلين؛ المصدر الواحد يبقى `single_source`؛ unknown لا يتحول إلى none.
- [x] Jurassic Park بلا Severity مختلقة ويبقى `insufficient_data`.
- [x] Totoro يعرض تنبيه الدبلجة ولا يعمم تفاصيل النسخة.
- [x] Barbie لا يحول التفسير التحريري إلى واقعة بلا إسناد.
- [x] الأربع صفحات السابقة بقيت على fixtures/baseline المقفولة في C1 regression.
- [x] Production QA كشف خللًا واحدًا: focus trap داخل Dialog لم يكن محكمًا مع Tab.
- [x] PR #68 أصلح الـfocus trap في ملف UI واحد فقط؛ لا data/evidence/decision/schema/migration/D1 change.
- [x] Browser QA للإصلاح run `31837235360`: **success** — 6/6 حالات، 16 Tab forward + 16 Shift+Tab reverse داخل الـDialog، وEscape يغلق ويعيد التركيز.
- [x] Artifact مراجعة Production: `9232858307`، digest `sha256:9998f443f2e648a58f02d732878431741ea4ec613ccc077e47df7a21fb953adc`.
- [ ] Production/Live Smoke النهائي لإصلاح الوصول بعد دمج PR #68، ثم التوقف قبل الفيلم الثامن.

## P4-03B4 — Editorial Persistence

- [x] D1 persistence مستقل عن `evidence_review_publications` وعن المراجعات البشرية.
- [x] append-only revisions وchildren غير قابلة للتعديل أو الحذف تاريخيًا.
- [x] current-head واحد لكل `title_id` مع direct successor وrevision lock.
- [x] incomplete/stale snapshot لا تصبح current.
- [x] حفظ المصادر والوقائع والمحاور غير المحسومة وقوة الإسناد والحقوق/العزو والسياسة والبصمة.
- [x] الصفحات الأربع الأصلية تظل `decisionEligible = false` و`decisionStatus = insufficient_data`.
- [x] إثبات parity للأربع صفحات قبل حذف Registry القديمة.
- [x] bootstrap idempotent لـCars وE.T. وHarry Potter 1 وMinions، ثم توسع bounded في C1 إلى السبعة.
- [x] D1-only public loader مع fingerprint fail-closed ولا fallback صامت إلى Registry.
- [x] إزالة TypeScript content registry وملفات publications الأربعة بعد إثبات parity.
- [x] الرئيسية والبحث و`/review` وصفحة العنوان والـsitemap تعتمد current-head D1.
- [x] فلتر `/titles` الحقيقي «له تحليل تحريري» من current-head D1.
- [x] اختبارات immutability وcurrent-head/concurrency/rollback وIDOR وparity/idempotence.
- [x] `cloudflare:migrate` يعيد bootstrap والتحقق من current-heads حتى في redeploy بلا migrations جديدة.
- [x] PR #63 دمج تنفيذ persistence الأساسي إلى main عند `56ec293144ef5f1c788f35a311acb5f4dabb0d91`.
- [x] Live Smoke الأول كشف regression في ترتيب `HarryPotter`؛ PR #64 أعاد خوارزمية B3 المحافظة وأضاف regression دائم، ثم دُمج عند `8acb3b3ad3b59919b194ab606bba857e16fd8ca5`.
- [x] main Checkpoint run `31748757205` — success.
- [x] main B4 persistence run `31748757222` — success.
- [x] Cloudflare production deploy run `31748757264` — success.
- [x] Live Product Smoke run `31748835647` — success.
- [x] **B4 مكتملة ومتحققة إنتاجيًا**.

تاريخيًا كان B4 يغطي **4 فقط**. بعد P4-03C1 أصبح الوضع الحالي **7** تحليلات جزئية، والـcheckpoint الحالي يمنع أي توسع إلى فيلم ثامن.

## P4-03B3 — مغلقة

- [x] اقتراحات D1 وتطبيع عربي/إنجليزي وفصل direct عن «هل تقصد؟».
- [x] aliases في D1 من دون إضافة عنوان جديد.
- [x] ARIA combobox/listbox وArrowDown/ArrowUp/Enter/Escape مع regression دائم.
- [x] إزالة أي CTA عام إلى `/review` بلا locator.
- [x] الرئيسية تعرض المحتوى الحقيقي فقط بلا أحكام ملاءمة وهمية.
- [x] الفصل بين التحليل التحريري الجزئي والمراجعة الموثقة لنسخة محددة.
- [x] `/titles`: pagination وبحث ونوع وسنة وحالة مراجعة موثقة Server-side من D1.
- [x] catalog-only = `noindex, follow`، والـsitemap يقتصر على الصفحات الغنية القابلة للفهرسة.
- [x] invalid/mixed `/review` يفشل مغلقًا ويحمل noindex ورابط بحث.
- [x] Engine + migrations + DB regressions + lint + production build + main + Cloudflare + Live Product Smoke.

## P4-03C2A — Asymmetric Decision Semantics

- [x] فصل إثبات التجاوز عن إثبات الملاءمة.
- [x] `exceeds_family_limits` يسمح بدليل present مؤهل يتجاوز حد الأسرة حتى مع unknown غير مرتبط.
- [x] `within_family_limits` يتطلب Full Evidence Gate ناجحة صراحةً + Full Coverage مؤهلة + Exact Version.
- [x] منع المصدر link-only من حسم القرار.
- [x] `work_level` لا يتحول إلى exact-version claim.
- [x] Jurassic Park فقط يحصل على لوحة work-level الجديدة؛ بقية الستة لا تتغير.
- [x] عدم اختراع severity للخوف/العنف؛ النتيجة الفعلية الحالية `insufficient_data`.
- [x] تمييز defaults-only عن defaults-with-overrides؛ إعدادات الأسرة المحلية الحالية لا تُقدَّم كتخصيص كامل.
- [x] تسمية الإعدادات العامة منزوعة الادعاء الرسمي/العلمي.
- [x] Exact Version البديل موثق كـADR فقط، بلا schema migration.
- [x] PR #67 merged، Production deploy وLive Product Smoke ناجحان.

## P4-03C2B — Original Editorial Artwork

- [x] توليد سبعة أغلفة أصلية بنسبة `3:4` للسبعة المنشورين فقط.
- [x] WebP محلي مضغوط بلا hotlink أو image API خارجي.
- [x] allowlist حسب `titleId` واختبار يمنع توريث صورة فيلم لعنوان مجهول.
- [x] صور في الرئيسية والدليل والبحث والاقتراحات وصفحة العمل والتحليل/المراجعة.
- [x] fallback محايد لبقية عناوين D1.
- [x] disclosure: «غلاف توضيحي أصلي — ليس الملصق الرسمي».
- [x] لا D1/schema/migration ولا تأثير على evidence/decision.
- [x] Lint + Production Build نجحا في GitHub Actions.
- [x] UI QA على Desktop/Mobile ناجح؛ أصلح ازدحام Harry Potter ثم أعيدت المصفوفة كاملة.
- [x] PR #67 merged ومنشور Production.

## Checkpoint لاحق: Public report intake

الـbackend الداخلي موجود لكن public intake غير مفتوح. الربط العام يحتاج عقدًا مستقلًا للتحقق من المدخلات وربطها بالسجل الصحيح وضبط معدل الإرسال ومنع الإساءة وربط البلاغ الجوهري بدورة التصحيح. لا نضيف زرًا أو endpoint عامًا جزئيًا قبل ذلك.

## قواعد ثابتة

- لا نسخ أو ترجمة مراجعات خارجية كاملة.
- `corroborated` تحتاج مجموعتي استقلال فعليتين على الأقل.
- ما لم يثبت يظل `uncertain` ولا يتحول الصمت إلى `none`.
- الصفحات الجزئية لا تدعي Full Version Decision بلا بواباتها المطلوبة.
- persistence لا تمنح سلطة حكم؛ هي تخزين وتاريخ نشر وتدقيق فقط.
- لا فيلم ثامن ولا دفعة محتوى جديدة في هذا checkpoint.

## الخطوة التالية

**أغلق PR #68 إنتاجيًا بعد التحقق، ثم توقّف. لا تبدأ فيلمًا ثامنًا أو دفعة محتوى جديدة.**