# حالة مشروع «قبل المشاهدة»

آخر تحديث: 13 أغسطس 2026

> هذا الملف يصف **الحالة الحالية ومصدر الحقيقة التشغيلي**. التاريخ التفصيلي لكل مرحلة محفوظ في `docs/ROADMAP.md`، وملفات checkpoint، وPull Requests على GitHub.

## الرؤية الحالية

«قبل المشاهدة» منتج عربي مستقل يساعد الأسرة على معرفة محتوى الفيلم أو المسلسل قبل تشغيله، ثم يصدر قرار مشاهدة مفسرًا ومخصصًا بدل تقييم رقمي واحد أو نقل تصنيف أجنبي كما هو.

### المبدأ التحريري الذي لا يتغير

**«قبل المشاهدة» يعتمد على نفسه في المراجعة النهائية والقرار.**

المصادر الخارجية لا تصبح مراجعتنا ولا ننسخ Parents Guide أو مراجعة أجنبية ثم نعيد صياغتها على أنها رأينا. دور المصدر الخارجي هو تقديم **بيانات كتالوجية أو دليل قابل للتتبع** عندما تسمح الرخصة والشروط بذلك. بعد ذلك نطبّق taxonomy ومعايير الأسرة العربية والإنچين الخاص بنا.

المسار القابل للتوسع المستهدف أصبح:

1. **Catalog قانوني** لتعريف العمل والنسخة من مصدر يسمح بالاستخدام التجاري.
2. **Evidence مرخص وقابل للتتبع** لكل معلومة محتوى نستخدمها.
3. **استخراج وقائع منظمة**: المحور، الشدة، التكرار، السياق، والتوقيت عندما يسمح الدليل بذلك.
4. **فحص coverage والتعارض**؛ نقص الدليل لا يتحول إلى «مناسب».
5. **معايير الأسرة العربية** versioned وقابلة للتخصيص، وليست ترجمة لتصنيف أجنبي.
6. **Engine مستقل** يطبق حدود الأسرة على الوقائع المقبولة ويُرجع القرار والأسباب.
7. **Corrections/feedback** تحفظ التصحيح والتاريخ بدل تبديل النتيجة بصمت.

سير المراجعين البشر المبني في P2/P2Q **يبقى موجودًا ولا يُحذف** لأنه مفيد كمسار جودة يدوي أو تصعيد للحالات المهمة، لكنه لن يكون شرطًا لتغطية آلاف الأفلام ولا سننشئ مراجعين وهميين لتمرير بواباته.

## هدف التشغيل التجاري

- الموقع مستهدف لتحقيق دخل من الإعلانات؛ لذلك نتعامل معه كمشروع **تجاري** عند اختيار API أو dataset أو صورة.
- لا نعتمد على توظيف فريق يشاهد كل فيلم لكي يستطيع الموقع التوسع.
- لا نستخدم مصدرًا لمجرد أنه متاح على الإنترنت؛ كل source يبدأ blocked إلى أن يراجع ترخيصه وشروط استخدامه.
- لا نزرع مراجعات موثقة مصطنعة بغرض ملء الموقع أو SEO.

## مصادر المحتوى — الحالة القانونية الحالية

راجع `docs/CONTENT_SOURCE_POLICY.md` و`lib/content-source-policy.ts`.

### مسموح آليًا الآن

**Wikidata**

- الاستخدام الحالي: `catalog_metadata` فقط.
- الرخصة: CC0 1.0 للبيانات المنظمة.
- الاستيراد يحمل QID ثابتًا ومصدر السجل والرخصة.
- عقد الطلب محدود، ويستخدم User-Agent واضحًا ولا يحاول تجاوز rate limits.
- لا تُحوّل metadata من Wikidata تلقائيًا إلى مراجعة موثقة أو حكم مشاهدة.

### مسموح من حيث الرخصة لكن الأتمتة وحفظ evidence موقوفان حتى اكتمال compliance الخاص بالمصدر

**Wikipedia**

- النص يسمح بالاستخدام التجاري ضمن شروط CC BY-SA والعزو والترخيص بالمثل حسب الصفحة/المحتوى.
- ingestion النصي الآلي وحفظه كـanalysis evidence معطلان حاليًا حتى توجد policy مخصوصة تسجل source URL/revision/license/attribution وتفصل الحقائق عن النص المنسوخ.
- لا ننشر فقرات طويلة كأنها كتابتنا الأصلية.

**Wikimedia Commons**

- كل ملف له شروطه الخاصة؛ لا نفترض أن كل صورة تحمل نفس الرخصة.
- لا تستخدم صورة حتى نسجل المؤلف والرخصة والعزو المطلوب لكل ملف.
- لا نفترض أن poster أو screenshot حديثًا متاح تجاريًا لمجرد وجوده على الإنترنت.

### محظور آليًا بدون ترخيص تجاري صريح

- TMDB developer API/data/images.
- IMDb datasets/site/Parents Guide/User Reviews أو scraping.
- Common Sense Media، Kids-In-Mind، DoesTheDogDie وأي review/parents-guide site مشابه بدون إذن تجاري واضح.

جهات التصنيف الرسمية يمكن أن تكون **مرجع تحقق لحقيقة تصنيف أو descriptor** بعد مراجعة شروط الجهة المحددة؛ لا نعمل scraping آليًا لوصفها التحريري قبل ذلك، والتصنيف الأجنبي لا يصبح قرار الأسرة العربية عندنا.

## P3S-01 — Allowlist للمصادر التجارية — مدموج ومنشور

- أضيف `lib/content-source-policy.ts` كعقد fail-closed.
- المصدر الآلي الوحيد حاليًا هو `wikidata:catalog_metadata`.
- استخدام المصدر مقسم إلى `catalog_metadata`, `analysis_evidence`, و`media` حتى لا يتحول حق استخدام الكتالوج تلقائيًا إلى حق نسخ مراجعة أو صورة.
- TMDB وIMDb ومواقع أدلة الآباء تبقى blocked بدون commercial license.
- `assertAutomatedSourceUseAllowed` يرفض أي source/use غير مسموح صراحة.

## P3S-02 — عقد Wikidata للكتالوج — مدموج ومنشور

- أضيف `lib/wikidata-catalog.ts`.
- endpoint: Wikidata Query Service الرسمي.
- User-Agent: `QablAlmushahadaBot/0.1 (+https://github.com/Hosyss/qabl-almushahada)`.
- query محدودة بـ200 نتيجة كحد أقصى في الطلب، مع offset bounded.
- تقبل أفلامًا ومسلسلات فقط، QID صالحًا، سنة منطقية، وlabel صالحًا.
- parser يفشل عند payload غير صحيح ويزيل التكرار.
- SQL generator يحدث جدول `titles` فقط ولا يلمس `review_bundles` أو submissions أو approvals.
- أضيف `scripts/preview-wikidata-catalog.mts` و`npm run content:wikidata:preview` للمعاينة قبل أي كتابة production.
- **لم يتم استيراد catalog production بعد**؛ الاستيراد الفعلي ينتظر اكتمال وربط provenance بالكتابة الإنتاجية.

## P3S-03 — معايير الأسرة العربية — مدموجة ومنشورة

راجع `docs/ARAB_FAMILY_POLICY.md` و`lib/arab-family-policy.ts`.

- الإصدار الحالي: `2026-08-13.1`.
- السياسة تصف نفسها بوضوح كـ**افتراضي تحريري عربي محافظ نسبيًا وقابل للتخصيص**، لا كتصنيف حكومي موحد للعالم العربي.
- القرار لا يأخذ رقم age rating أجنبي ويعيد تسميته؛ لكل محور حد مستقل.
- السياسة الحالية أشد افتراضيًا في `sexualContent`, `language`, `substances`, و`selfHarm` من الحد العام للعمر.
- `fearLimit` وخيار تجنب التنمر يظلان قابلين لتعديل الأسرة محليًا.
- helper القديم `createExampleFamilyProfile` أصبح يستخدم السياسة العربية الجديدة مع الحفاظ على واجهته الحالية.
- coarse age helper في فلتر البحث يبقى فلترًا استكشافيًا فقط ولا يمثل قرار الأسرة أو rating رسميًا.

### الحدود العربية الافتراضية الحالية

| العمر | المحتوى العام | المحتوى الجنسي | اللغة | المواد | إيذاء النفس |
|---|---:|---:|---:|---:|---:|
| 3–5 | 0 | 0 | 0 | 0 | 0 |
| 6–8 | 1 | 0 | 0 | 0 | 0 |
| 9–11 | 2 | 1 | 1 | 0 | 1 |
| 12–14 | 3 | 2 | 2 | 1 | 2 |
| 15–18 | 4 | 3 | 3 | 2 | 3 |

هذه نقطة بداية وليست حكمًا دينيًا أو أخلاقيًا مطلقًا على العمل.

## P3S-04 — provenance قانوني غير قابل للتعديل — مكتمل وظيفيًا على الفرع الحالي

- migration الجديدة `drizzle/0016_content_source_provenance.sql` ترفع checkpoint إلى **19 migration files / 27 product tables**.
- `content_source_policy_snapshots` تحفظ نسخة policy قانونية ثابتة: source/use/decision/license URLs/attribution/share-alike/automated/commercial/verified-on.
- قاعدة البيانات نفسها تسمح في النسخة الحالية فقط بالـsnapshot القانونية لـ**Wikidata + catalog_metadata + CC0 1.0**؛ محاولة زرع policy تجارية مزورة لـTMDB أو مصدر آخر تُرفض على مستوى SQLite/D1.
- `title_catalog_sources` تحفظ provenance الكتالوج بشكل append-only: العنوان، policy snapshot، QID، URL، revision إن وجدت، وقت الجلب، SHA-256، وطريقة الإدخال.
- Wikidata provenance لا تقبل URL على domain آخر أو QID غير صالح، ولا يمكن UPDATE/DELETE للسجل بعد كتابته.
- `version_evidence_sources` منفصلة عن catalog ومربوطة بـ`title_versions` حتى لا تتحول metadata إلى evidence ضمنيًا.
- جدول evidence موجود الآن، لكن **لا توجد analysis-evidence policy مسموحة حاليًا**؛ لذلك كل محاولة لحفظ evidence تظل fail-closed إلى أن تُراجع وتُفعّل policy مصدر محدد في P3S-05.
- `lib/source-provenance.ts` يطابق نفس السياسة في TypeScript ويشترط HTTPS وSHA-256 lowercase ووقتًا صالحًا وQID/URL متطابقين.
- `db/index.ts` و`drizzle.config.ts` يشملان schema الجديدة.
- `scripts/verify-content-source-provenance.mjs` يطبق جميع migrations على SQLite ويثبت: منع policy مزورة، immutability، الفصل بين catalog/evidence، FK guards، وعدم حذف title له provenance محفوظة.
- Cloudflare workflow في هذا الفرع صار يرفض النشر إذا لم تظهر الجداول الثلاثة الجديدة في D1 البعيدة بعد migration.
- branch checkpoint عند `179d0d4db0754ce2edd2132d4a1b3be854c12683` اجتاز **183/183 اختبارًا، 0 فشل**، ونجح `test:migrations`, `lint:local`, و`build:local`.
- هذا البند **لم يُنشر على production بعد**؛ لا يصبح P3S-04 مكتملًا إنتاجيًا إلا بعد PR/merge ونجاح remote migration/schema verification/Cloudflare smoke tests.

## الإنچين — الحالة الحالية

الإنچين نفسه مبني ويعمل:

- TypeScript domain schema للنسخة والوقائع والمحاور وحدود الأسرة.
- fail-closed: نقص أو تعارض حرج يعيد `insufficient_data` بدل «مناسب».
- القرار deterministic وقابل لإعادة الإنتاج من نفس المدخلات.
- الأسباب مرتبطة بالوقائع التي فعّلت القرار.
- قواعد الخطر والحساسية منفصلة ومختبرة.
- P3S-03 غيّرت default family profile إلى معايير عربية category-specific من غير تغيير مبدأ fail-closed.

الـengine لا يخترع الوقائع. P3S-04 وفرت مخزن provenance قانوني؛ P3S-05 سيبني طبقة evidence-to-facts والـcoverage/conflict التي تمد الإنچين بوقائع قابلة للتتبع من غير تزوير reviewer identity.

## سير المراجعين البشر — موجود لكنه لم يعد نموذج التوسع الإجباري

كل ما بُني في P2/P2Q ما زال في المستودع ومختبرًا:

- Admin / Coordinator / Reviewer / Editorial roles.
- استقلال المراجعين وفصل الواجبات.
- revision locking وappend-only history.
- reviewer third-pass للحالات الحساسة.
- random audit 10%/50%.
- audit outcomes/calibration/reference calibration.
- Safety Holds ولوحة الجودة.
- correction workflow وحماية current approval.

لا نحذف هذا العمل، لكن P3S-05/P3S-06 سيضيفان **مسار evidence-based مستقل** للنشر العام. المسار البشري يبقى اختياريًا للحالات ذات القيمة أو النزاع أو التحقق اليدوي.

## تجربة المستخدم العامة — المنجز

- هوية عربية وRTL وصفحة رئيسية متجاوبة.
- `/search` متصل بـD1 ومحرك بحث عربي deterministic.
- فلاتر النوع والعمر وحالة التحقق.
- `/review` تقرأ bundle حقيقية وتفشل مغلقًا عند stale/conflicted/invalid state.
- حدود الأسرة محفوظة محليًا من غير اسم طفل أو تاريخ ميلاد.
- `/review-policy`, `/privacy`, `/corrections` موجودة ومربوطة من الموقع.
- سياسة التصحيح لا تدعي أن public report intake موصول وهو غير موصول.

## آخر حالة منشورة على main

- P3S-01/P3S-02/P3S-03 دُمجت عبر PR #34 إلى `main` في commit `fad025e903237f011b39239ce3b3d2152e694ca3`، ونجح بعدها main CI وCloudflare production deploy/smoke tests.
- Worker العام يعمل على `https://qabl-almushahada.buildtools.workers.dev`.
- D1 production قبل دمج P3S-04 ما زالت عند **18/18 migrations / 24 product tables**.
- P3S-04 الحالية branch-only؛ الجداول الثلاثة الجديدة ليست production حتى يتم الدمج والنشر.

## الاختبارات

### آخر main منشور قبل P3S-04

- P3S-01/02/03: **179/179** اختبارًا في checkpoint قبل الدمج، مع migrations/lint/build خضراء.

### P3S-04 branch checkpoint

- `test:engine`: **183/183 ناجحة، 0 فشل**.
- `test:migrations`: ناجح.
- `lint:local`: ناجح.
- `build:local`: ناجح.
- schema: **19 migration files / 27 product tables**.
- verifier الخاص بـP3S-04 يثبت الفصل القانوني بين catalog metadata وanalysis evidence على SQLite الفعلية بعد كل migrations.

## Cloudflare — الإنتاج الفعلي

- Worker العام: `https://qabl-almushahada.buildtools.workers.dev`.
- D1: `qabl-almushahada-production`.
- bindings: `DB`, `IMAGES`, `ASSETS`.
- D1 production الحالية قبل P3S-04 عند **18/18 migrations**.
- Cloudflare workflow في فرع P3S-04 صار يطلب وجود `content_source_policy_snapshots`, `title_catalog_sources`, و`version_evidence_sources` بعد تطبيق remote migration؛ أي نقص يمنع Worker deploy.
- لا API tokens أو Account IDs تُنسخ إلى Worker config.

## ما لا نفعله

- لا fake/synthetic reviewers لتمرير بوابات المراجعة القديمة.
- لا scraper لـIMDb/TMDB/Parents Guide في الموقع التجاري بدون ترخيص.
- لا تحويل metadata وحدها إلى «مراجعة موثقة».
- لا استخدام policy الكتالوج نفسها كـanalysis evidence.
- لا نسخ review أجنبي ثم الادعاء أن «قبل المشاهدة» راجعه بنفسه.
- لا ادعاء أن إنسانًا شاهد النسخة إذا لم يحدث ذلك.
- لا rating رقمي واحد للعمل يحل محل الأسباب والوقائع.
- لا حسابات أطفال أو جمع اسم الطفل/تاريخ الميلاد.

## ما يزال تجريبيًا أو مؤجلًا

- بعض أعمال وأمثلة الصفحة الرئيسية ما زالت أمثلة تصميمية وليست مراجعات production.
- زر البلاغ العام غير موصول حتى الآن.
- taxonomy العربية تحتاج توسعة موضوعية قبل ingestion واسع: العري، الحميمية/التقبيل، الحوار الجنسي، التدخين/الكحول/المخدرات منفصلة، القمار، والحساسية الدينية عندما يمكن وصفها كواقعة قابلة للرصد.
- لا صور posters غير مرخصة؛ غياب الصورة أفضل من استخدام غير قانوني.
- P0-05 والمراحل P4 تبقى لاحقة بعد تثبيت مسار المحتوى الجديد.

## نقطة البدء التالية

1. ادمج P3S-04 فقط بعد PR وCI أخضر، ثم تأكد أن remote D1 أصبحت **19/19 migrations** وأن الجداول الثلاثة الجديدة ظهرت في schema verification قبل Worker deploy.
2. لا تبدأ P3S-05 قبل نجاح P3S-04 على production.
3. `P3S-05` — بناء evidence-based review pipeline واختبارات coverage/conflict من غير synthetic reviewers، مع تفعيل مصدر analysis evidence فقط بعد policy قانونية خاصة به.
4. `P3S-06` — بوابة نشر جديدة للمسار المستقل؛ يجب أن تحافظ على الحقيقة: **المراجعة النهائية والقرار من منهجنا نحن**، لكنها لا تقول إن بشرًا شاهدوا النسخة إذا لم يحدث ذلك.
5. `P3S-07` — توسيع taxonomy العربية بوقائع موضوعية قبل التوسع.
6. `P3S-08` — استيراد أول catalog production من Wikidata وتوليد صفحات SEO حقيقية، من غير زرع verified reviews مصطنعة.

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
