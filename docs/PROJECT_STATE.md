# حالة مشروع «قبل المشاهدة»

آخر تحديث: 13 أغسطس 2026

> هذا الملف يصف **الحالة الحالية ومصدر الحقيقة التشغيلي**. التاريخ التفصيلي محفوظ في `docs/ROADMAP.md`، وملفات checkpoint، وPull Requests على GitHub.

## الرؤية الحالية

«قبل المشاهدة» منتج عربي مستقل يساعد الأسرة على معرفة محتوى الفيلم أو المسلسل قبل تشغيله، ثم يصدر قرار مشاهدة مفسرًا ومخصصًا بدل تقييم رقمي واحد أو نقل تصنيف أجنبي كما هو.

### المبدأ التحريري الثابت

**«قبل المشاهدة» يعتمد على نفسه في المراجعة النهائية والمنهج والقرار.**

المصادر الخارجية لا تصبح مراجعتنا. دورها هو تقديم **بيانات كتالوجية أو دليل قابل للتتبع** عندما تسمح الرخصة والشروط بذلك، ثم نحول الأدلة إلى وقائع منظمة ونطبق taxonomy ومعايير الأسرة العربية والإنچين الخاص بنا.

النص العام الذي يجب الحفاظ عليه:

> **نحن لا ننقل مراجعة الآخرين؛ المصادر تمدنا بالدليل، والمراجعة النهائية وتجميع الوقائع وقرار الأسرة من منهج «قبل المشاهدة».**

ولا يجوز أن ندعي أن إنسانًا من فريقنا شاهد النسخة إذا لم يحدث ذلك فعلًا في مسار مراجعة بشري منفصل.

## المسار القابل للتوسع

1. **Catalog قانوني** لتعريف العمل والنسخة.
2. **Evidence مرخص وقابل للتتبع** لكل claim محتوى.
3. **استخراج وقائع منظمة**؛ Workers AI طبقة استخراج غير موثوقة ولا تملك publish authority.
4. **Coverage + Conflict Gate**؛ `uncertain` أو التعارض لا يتحولان إلى «مناسب».
5. **بوابة نشر evidence-based مستقلة** لا تستخدم reviewer وهميًا ولا تعيد استخدام approval بشري بصورة مضللة.
6. **Snapshot غير قابلة للمحو** تربط كل claim بمصدرها ورخصتها والنسخة المحددة.
7. **عرض عام fail-closed** يعيد فحص current publication بعد hydration لمنع stale/race state.
8. **Arab Family Policy + Engine** يظلان منفصلين عن حقيقة وجود الوقائع نفسها.
9. **Corrections/feedback** تحفظ التصحيح والتاريخ بدل تبديل النتيجة بصمت.

سير المراجعين البشر المبني في P2/P2Q **يبقى موجودًا ولا يُحذف** كمسار جودة يدوي أو تصعيد، لكنه ليس شرطًا لتغطية آلاف الأعمال ولا توجد هويات مراجعين وهمية لتمرير بواباته.

## التشغيل التجاري ومصادر المحتوى

- المشروع تجاري لأنه يستهدف إيرادًا إعلانيًا؛ لذلك لا نستخدم API أو dataset أو صورة إلا إذا كانت شروط الاستخدام مناسبة تجاريًا.
- Wikidata: `catalog_metadata` تحت CC0 1.0 فقط.
- Wikipedia: `analysis_evidence` عبر Action API الرسمي، مع CC BY-SA 4.0 والعزو وrevision ووقت الجلب وSHA-256.
- Wikimedia Commons: لكل ملف على حدة فقط بعد التحقق من ترخيصه.
- TMDB / IMDb / Parents Guide sites: blocked آليًا بلا ترخيص تجاري صريح.
- لا يتم تحويل metadata وحدها إلى مراجعة موثقة.
- لا نزرع مراجعات production مصطنعة بغرض SEO أو ملء الموقع.

راجع `docs/CONTENT_SOURCE_POLICY.md` و`lib/content-source-policy.ts`.

## P3S-01 — Allowlist للمصادر التجارية — مكتمل ومنشور

- `lib/content-source-policy.ts` عقد fail-closed لكل source/use.
- `catalog_metadata`, `analysis_evidence`, و`media` استخدامات منفصلة.
- المصدر الجديد يبدأ blocked حتى تتم مراجعته وإضافة policy صريحة ومختبرة.

## P3S-02 — عقد Wikidata للكتالوج — مكتمل ومنشور

- `lib/wikidata-catalog.ts` يستخدم Wikidata Query Service الرسمي.
- الطلبات bounded وبـUser-Agent واضح.
- الاستيراد يولد metadata فقط ولا يلمس review state.
- أول catalog production ما زال مؤجلًا إلى P3S-08.

## P3S-03 — معايير الأسرة العربية — مكتملة ومنشورة

- الإصدار الحالي: `2026-08-13.1`.
- policy عربية افتراضية محافظة نسبيًا وقابلة للتخصيص، وليست تصنيفًا حكوميًا موحدًا.
- القرار لا يعيد تسمية age rating أجنبي؛ لكل محور حد مستقل.

## P3S-04 — provenance قانوني غير قابل للتعديل — مكتمل ومنشور

- PR #35 → main commit `709355bd6a9d0aaccb703837bff3b744a77da90b`.
- أضيفت `content_source_policy_snapshots`, `title_catalog_sources`, و`version_evidence_sources`.
- provenance وpolicy snapshots append-only ومحمية بقيود SQLite/D1.
- production checkpoint وقتها: **19/19 migrations**.

## P3S-05 — evidence-based review pipeline — مكتمل ومنشور على production

المسار الوظيفي بُني في PR #36 ثم أُغلق إصلاحه عبر PR #37.

### ما ينفذه

- Wikipedia Action API كمصدر `analysis_evidence` مرخص.
- Cloudflare Workers AI binding باسم `AI`.
- النموذج الحالي: `@cf/meta/llama-3.1-8b-instruct-fast`.
- النموذج **طبقة استخراج غير موثوقة** فقط.
- model-assisted extraction يسمح بـ`present` أو `uncertain` فقط؛ لا يسمح بتحويل غياب الذكر إلى `none`.
- `present` يتطلب fact منظمة وlocator حقيقي `P####`.
- `uncertain` يحتفظ بتتبع نطاق chunk من غير اختراع فقرة داعمة.
- لا تُختلق runtime timestamps من Wikipedia prose.
- `assessEvidenceReview` يفشل مغلقًا عند نقص coverage أو uncertainty أو conflict أو cross-version evidence.
- candidate الناتجة من P3S-05 تظل `publishable: false`؛ سلطة النشر أصبحت P3S-06.

### الإغلاق الإنتاجي المؤكد

- PR #37 squash merged إلى main commit `701604e7570671671ff94b3b97e111d837ab626f`.
- Cloudflare production Run `31676888290` نجح كاملًا.
- **207/207 tests، 0 fail**.
- D1 production أصبحت **20/20 migrations**.
- bindings المؤكدة: `DB`, `IMAGES`, `AI`, `ASSETS`.
- Worker Version ID: `a0de055e-8a85-4cd9-9ab6-57971b909fae`.

## P3S-06 — بوابة النشر المستقلة للأدلة — مكتملة ومنشورة على production

P3S-06 دُمجت عبر PR #38 إلى main commit `d914b223c9db1d8622c4ba33a5681b7436842cf9`.

### مبدأ المعمارية

P3S-06 **لا تستخدم** `review_bundles` أو `editorial_approvals` كحيلة لإيهام النظام بوجود مراجعة بشرية. يوجد مسار publication مستقل تمامًا للمراجعة evidence-based، بينما المسار البشري القديم يبقى كما هو.

### بوابة النشر النقية

`lib/evidence-publication.ts`:

- تعيد تشغيل `assessEvidenceReview` قبل السماح بأي persistence.
- تتطلب `status = ready` و`engineEligible = true`.
- تمنع `model_assisted + none`.
- تتأكد أن مجموعة المصادر ومجموعة provenance متطابقتان واحدًا لواحد.
- تعيد التحقق من policy الحالية والرخصة والعزو والنسخة والـhash.
- تفرض `reviewMethod = evidence_based` و`humanWatchConfirmed = false` server-side.

### D1 publication snapshots

migration `0018_evidence_publication_gate.sql` أضافت:

1. `evidence_review_publications`
2. `evidence_publication_sources`
3. `evidence_publication_assertions`
4. `evidence_publication_facts`
5. `evidence_publication_fact_flags`
6. `evidence_review_publication_heads`

خصائصها:

- snapshots وclaims وfacts وflags append-only.
- revision lineage مباشرة عبر `supersedes_publication_id`.
- كل source منشورة يجب أن تكون `analysis_evidence` مرخصة تجاريًا لنفس النسخة.
- كل assertion منشورة يجب أن ترتبط بمصدر داخل snapshot نفسها.
- `present` بلا fact مرفوضة.
- `uncertain` لا يمكنها غلق coverage.
- وجود conflict أو severity delta >=2 بين المصادر يمنع finalization.
- current head لا يثبت إلا لو النسخة active وكل المحاور العشرة مغطاة صراحة بلا conflict.
- `human_watch_confirmed = 1` مرفوض في هذا المسار على مستوى D1.

### معاملة النشر

`db/publish-evidence-review.ts`:

- يتحقق من النسخة active.
- يطابق provenance المخزنة حرفيًا أو يرفض mismatch.
- يكتب missing provenance + publication snapshot + source links + claims + facts + flags في D1 batch.
- current head هو آخر statement في المعاملة ويعمل كبوابة finalization على مستوى قاعدة البيانات.
- revision الحالية تستخدم optimistic WHERE؛ أي concurrent publication تمنع finalization بدل overwrite صامت.

### العرض العام

- `/review?publicationId=...` هو locator للمراجعة evidence-based.
- `/review?bundleId=...` يظل للمسار البشري القديم.
- وجود الاثنين أو غياب الاثنين يفشل مغلقًا.
- public loader يعمل initial gate → hydration → final gate بنفس revision لمنع stale/race state.
- الصفحة تقول صراحة: **«المشاهدة البشرية — غير مدعاة»** و**«لا ندّعي مشاهدة بشرية لم تحدث»**.
- تعرض source/license/attribution/revision من snapshot المنشورة.
- التوقيت غير المتاح يظهر `—` ولا يتم اختلاق timestamp.
- قرار الأسرة يظل منفصلًا عن مجرد نشر الوقائع.

### التحقق والإغلاق الإنتاجي المؤكد

- branch وPR CI نجحا قبل الدمج.
- main Checkpoint verification Run `31679684679` نجح بالكامل.
- Cloudflare production Run `31679684634` نجح بالكامل.
- **219/219 tests، 0 fail**.
- `test:migrations`: **21 migration files / 33 product tables** محليًا.
- D1 production أصبحت **21/21 migrations**.
- migration `0018_evidence_publication_gate.sql` نُفذت remote بنجاح عبر atomic file ingestion.
- remote schema verification أكد وجود الجداول الستة الجديدة مع جداول المشروع/provenance.
- bindings بعد النشر: `DB`, `IMAGES`, `AI`, `ASSETS`.
- Worker Version ID: `cab77fad-1466-42c7-a057-736a18384020`.
- Worker: `https://qabl-almushahada.buildtools.workers.dev`.
- smoke tests نجحت لـ`/`, `/review`, `/search?q=nemo`, `/review-policy`, `/privacy`, `/corrections`.
- `/review?publicationId=missing-publication` أُختبرت إنتاجيًا وأعادت الحالة الآمنة «المراجعة غير متاحة حاليًا» بدل Demo/fallback.

**P3S-06 = 100% ومغلقة إنتاجيًا.**

## الإنچين والثقة — الحالة الحالية

- القرار deterministic وقابل لإعادة الإنتاج.
- نقص أو تعارض حرج يعيد `insufficient_data` بدل «مناسب».
- Workers AI لا يملك سلطة القرار أو النشر.
- P3S-05 يحول الأدلة إلى وقائع وcoverage/conflict assessment.
- P3S-06 فقط يسمح بتحويل snapshot evidence-ready إلى publication current، بعد إعادة التحقق في التطبيق وفي D1.
- المسار البشري P2/P2Q محفوظ كاملًا مع independence, revisions, audit, calibration, safety holds, corrections.

راجع `docs/ENGINE_TRUST_MODEL.md`.

## تجربة المستخدم العامة

- هوية عربية وRTL وصفحة رئيسية متجاوبة.
- `/search` متصل بـD1 ومحرك بحث عربي deterministic.
- فلاتر النوع والعمر وحالة التحقق.
- `/review?bundleId=...` للمراجعات البشرية الموثقة القديمة.
- `/review?publicationId=...` للمراجعات evidence-based بعد وجود snapshot منشورة فعلية.
- حدود الأسرة محفوظة محليًا من غير اسم طفل أو تاريخ ميلاد.
- `/review-policy`, `/privacy`, `/corrections` موجودة ومربوطة من الموقع.
- search لم يُربط بعد تلقائيًا بـevidence publications؛ ذلك يدخل مع ingestion/SEO في P3S-08.

## Cloudflare — الإنتاج المؤكد حاليًا

- Worker: `https://qabl-almushahada.buildtools.workers.dev`.
- D1: `qabl-almushahada-production`.
- آخر production feature commit مؤكد: `d914b223c9db1d8622c4ba33a5681b7436842cf9` (P3S-06).
- Cloudflare Run: `31679684634`.
- D1: **21/21 migrations**.
- bindings: `DB`, `IMAGES`, `AI`, `ASSETS`.
- Worker Version ID: `cab77fad-1466-42c7-a057-736a18384020`.
- remote schema وsmoke tests نجحا بعد migration رقم 21.

## ما لا نفعله

- لا fake/synthetic reviewers.
- لا scraper لـIMDb/TMDB/Parents Guide بلا ترخيص تجاري.
- لا metadata → verified review تلقائيًا.
- لا `catalog_metadata` policy كـ`analysis_evidence`.
- لا نسخ review أجنبي ثم الادعاء أنه مراجعتنا.
- لا ادعاء مشاهدة بشرية لم تحدث.
- لا منح Workers AI سلطة publish أو اعتبار صمته دليل `none`.
- لا rating رقمي واحد يحل محل الوقائع والأسباب.
- لا حسابات أطفال أو جمع اسم الطفل/تاريخ الميلاد.

## ما يزال مؤجلًا

- بعض أمثلة الصفحة الرئيسية ما زالت تصميمية وليست مراجعات production.
- زر البلاغ العام غير موصول بعد.
- taxonomy العربية تحتاج توسعة موضوعية في P3S-07.
- لا posters غير مرخصة.
- لا bulk production catalog import حتى P3S-08.
- لا صفحات SEO production واسعة قبل catalog/evidence صالحين فعليًا.
- P0-05 والمراحل P4 تبقى لاحقة بعد تثبيت مسار المحتوى الجديد.

## نقطة البدء التالية

1. ابدأ `P3S-07` فقط — توسيع taxonomy العربية بوقائع موضوعية قابلة للرصد والاختبار.
2. لا تدخل bulk catalog أو SEO ingestion في نفس PR.
3. بعد P3S-07: `P3S-08` أول catalog production من Wikidata وصفحات SEO حقيقية من البيانات القانونية.
4. بعد تثبيت المحتوى الحقيقي، انتقل إلى P4-03 لاختبار 20 مراجعة evidence-based يدويًا قبل التوسع.

راجع قبل تعديل المصدر/الثقة/النشر:

- `docs/CONTENT_SOURCE_POLICY.md`
- `docs/ARAB_FAMILY_POLICY.md`
- `docs/ENGINE_TRUST_MODEL.md`
- `docs/CLOUDFLARE_DEPLOYMENT.md`
- `docs/ROADMAP.md`

## الروابط

- المستودع: `https://github.com/Hosyss/qabl-almushahada`
- الإنتاج: `https://qabl-almushahada.buildtools.workers.dev`
- الموقع القديم `https://qabl-almushahada.hosys.chatgpt.site` ليس مصدر النشر الحالي.
