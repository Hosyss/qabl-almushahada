# حالة مشروع «قبل المشاهدة»

آخر تحديث: 13 أغسطس 2026

> هذا الملف يصف **الحالة الحالية ومصدر الحقيقة التشغيلي**. التاريخ التفصيلي لكل مرحلة محفوظ في `docs/ROADMAP.md`، وملفات checkpoint، وPull Requests على GitHub.

## الرؤية الحالية

«قبل المشاهدة» منتج عربي مستقل يساعد الأسرة على معرفة محتوى الفيلم أو المسلسل قبل تشغيله، ثم يصدر قرار مشاهدة مفسرًا ومخصصًا بدل تقييم رقمي واحد أو نقل تصنيف أجنبي كما هو.

### المبدأ التحريري الذي لا يتغير

**«قبل المشاهدة» يعتمد على نفسه في المراجعة النهائية والقرار.**

المصادر الخارجية لا تصبح مراجعتنا ولا ننسخ Parents Guide أو مراجعة أجنبية ثم نعيد صياغتها على أنها رأينا. دور المصدر الخارجي هو تقديم **بيانات كتالوجية أو دليل قابل للتتبع** عندما تسمح الرخصة والشروط بذلك. بعد ذلك نطبّق taxonomy ومعايير الأسرة العربية والإنچين الخاص بنا.

المسار القابل للتوسع الحالي:

1. **Catalog قانوني** لتعريف العمل والنسخة من مصدر يسمح بالاستخدام التجاري.
2. **Evidence مرخص وقابل للتتبع** لكل معلومة محتوى نستخدمها.
3. **استخراج وقائع منظمة** مع إبقاء النموذج الآلي طبقة استخراج غير موثوقة لا تملك صلاحية النشر.
4. **فحص coverage والتعارض**؛ نقص الدليل أو عدم اليقين لا يتحول إلى «مناسب».
5. **معايير الأسرة العربية** versioned وقابلة للتخصيص، وليست ترجمة لتصنيف أجنبي.
6. **Engine مستقل** يطبق حدود الأسرة على الوقائع المقبولة ويُرجع القرار والأسباب.
7. **بوابة نشر مستقلة** هي P3S-06 التالية؛ P3S-05 لا تنشر مراجعة عامة بمفردها.
8. **Corrections/feedback** تحفظ التصحيح والتاريخ بدل تبديل النتيجة بصمت.

سير المراجعين البشر المبني في P2/P2Q **يبقى موجودًا ولا يُحذف** لأنه مفيد كمسار جودة يدوي أو تصعيد للحالات المهمة، لكنه لم يعد شرطًا لتغطية آلاف الأفلام ولا توجد هويات مراجعين وهمية لتمرير بواباته.

## هدف التشغيل التجاري

- الموقع مستهدف لتحقيق دخل من الإعلانات؛ لذلك نتعامل معه كمشروع **تجاري** عند اختيار API أو dataset أو صورة.
- لا نعتمد على توظيف فريق يشاهد كل فيلم لكي يستطيع الموقع التوسع.
- لا نستخدم مصدرًا لمجرد أنه متاح على الإنترنت؛ كل source/use يبدأ blocked إلى أن تراجَع الرخصة وشروط الاستخدام ويُضاف عقد صريح ومختبر.
- لا نزرع مراجعات موثقة مصطنعة بغرض ملء الموقع أو SEO.

## مصادر المحتوى — الحالة القانونية الحالية

راجع `docs/CONTENT_SOURCE_POLICY.md` و`lib/content-source-policy.ts`.

### Wikidata

- الاستخدام: `catalog_metadata` فقط.
- الرخصة: CC0 1.0 للبيانات المنظمة.
- الاستيراد يحمل QID ثابتًا ومصدر السجل والرخصة.
- عقد الطلب محدود، ويستخدم User-Agent واضحًا ولا يحاول تجاوز rate limits.
- metadata لا تتحول تلقائيًا إلى مراجعة موثقة أو حكم مشاهدة.

### Wikipedia — مفعلة في كود P3S-05 كـanalysis evidence، والنشر الإنتاجي ينتظر إصلاح الـdeploy الحالي

- المصدر الأول لمسار `analysis_evidence` هو Wikipedia عبر **Action API الرسمي فقط** وليس scraping للواجهة.
- المضيفان المسموحان في هذا المسار هما `ar.wikipedia.org` و`en.wikipedia.org`.
- عقد الاستخدام يسجل CC BY-SA 4.0 والعزو وlicense URL وrevision ووقت الجلب وSHA-256.
- missing/disambiguation/non-main-namespace تُرفض.
- 429/Retry-After و`maxlag` تفشل بصورة محافظة بدل retry عدواني.
- نص المقالة مدخل عابر للاستخراج؛ لا ننشر فقرات طويلة منها كأنها كتابتنا ولا نحول المقالة نفسها إلى «مراجعة قبل المشاهدة».
- هذه السياسة موجودة في كود P3S-05 وmigration `0017_enable_wikipedia_analysis_evidence.sql`، لكنها **لن تُعتبر production-active** حتى ينجح deploy الإصلاح وتصل D1 إلى 20/20 migrations.

### Wikimedia Commons

- كل ملف له شروطه الخاصة؛ لا نفترض أن كل صورة تحمل نفس الرخصة.
- لا تستخدم صورة حتى نسجل المؤلف والرخصة والعزو المطلوب لكل ملف.
- لا نفترض أن poster أو screenshot حديثًا متاح تجاريًا لمجرد وجوده على الإنترنت.

### محظور آليًا بدون ترخيص تجاري صريح

- TMDB developer API/data/images.
- IMDb datasets/site/Parents Guide/User Reviews أو scraping.
- Common Sense Media، Kids-In-Mind، DoesTheDogDie وأي review/parents-guide site مشابه بدون إذن تجاري واضح.

جهات التصنيف الرسمية يمكن أن تكون **مرجع تحقق لحقيقة تصنيف أو descriptor** بعد مراجعة شروط الجهة المحددة؛ لا نعمل scraping آليًا لوصفها التحريري قبل ذلك، والتصنيف الأجنبي لا يصبح قرار الأسرة العربية عندنا.

## P3S-01 — Allowlist للمصادر التجارية — مدموج ومنشور

- `lib/content-source-policy.ts` عقد fail-closed.
- استخدام المصدر مقسم إلى `catalog_metadata`, `analysis_evidence`, و`media` حتى لا يتحول حق استخدام الكتالوج تلقائيًا إلى حق نسخ مراجعة أو صورة.
- TMDB وIMDb ومواقع أدلة الآباء تبقى blocked بدون commercial license.
- `assertAutomatedSourceUseAllowed` يرفض أي source/use غير مسموح صراحة.

## P3S-02 — عقد Wikidata للكتالوج — مدموج ومنشور

- `lib/wikidata-catalog.ts` يستخدم Wikidata Query Service الرسمي.
- User-Agent: `QablAlmushahadaBot/0.1 (+https://github.com/Hosyss/qabl-almushahada)`.
- query محدودة بـ200 نتيجة كحد أقصى في الطلب، مع offset bounded.
- تقبل أفلامًا ومسلسلات فقط، QID صالحًا، سنة منطقية، وlabel صالحًا.
- parser يفشل عند payload غير صحيح ويزيل التكرار.
- SQL generator يحدث جدول `titles` فقط ولا يلمس `review_bundles` أو submissions أو approvals.
- `scripts/preview-wikidata-catalog.mts` و`npm run content:wikidata:preview` للمعاينة قبل أي كتابة production.
- **لم يتم استيراد catalog production بعد**؛ ذلك مؤجل إلى P3S-08.

## P3S-03 — معايير الأسرة العربية — مدموجة ومنشورة

راجع `docs/ARAB_FAMILY_POLICY.md` و`lib/arab-family-policy.ts`.

- الإصدار الحالي: `2026-08-13.1`.
- السياسة تصف نفسها بوضوح كـ**افتراضي تحريري عربي محافظ نسبيًا وقابل للتخصيص**، لا كتصنيف حكومي موحد للعالم العربي.
- القرار لا يأخذ رقم age rating أجنبي ويعيد تسميته؛ لكل محور حد مستقل.
- السياسة الحالية أشد افتراضيًا في `sexualContent`, `language`, `substances`, و`selfHarm` من الحد العام للعمر.
- `fearLimit` وخيار تجنب التنمر يظلان قابلين لتعديل الأسرة محليًا.
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

## P3S-04 — provenance قانوني غير قابل للتعديل — مكتمل ومنشور على production

- P3S-04 دُمجت عبر PR #35 في main commit `709355bd6a9d0aaccb703837bff3b744a77da90b`.
- Cloudflare production deploy Run `31667069022` نجح كاملًا.
- migration `0016_content_source_provenance.sql` طُبقت فعليًا، وأصبحت D1 عند **19/19 migrations** في هذا checkpoint.
- remote schema verification أكد وجود `content_source_policy_snapshots`, `title_catalog_sources`, و`version_evidence_sources` قبل Worker deploy.
- `content_source_policy_snapshots` تحفظ نسخة policy قانونية ثابتة، و`title_catalog_sources` تفصل provenance الكتالوج، و`version_evidence_sources` تحفظ evidence على نسخة محددة.
- provenance وpolicy snapshots append-only، وWikidata QID/URL/HTTPS/SHA-256/FK guards تُفرض على مستوى SQLite/D1.
- Worker نشر بنجاح ثم نجحت smoke tests العامة وصفحات السياسات.
- Worker Version ID لهذا checkpoint: `af408645-e45d-4144-b59a-a137950d2c3a`.

## P3S-05 — evidence-based review pipeline — مكتمل وظيفيًا، إعادة النشر قيد الإغلاق

PR #36 دُمجت إلى `main` في commit `77f2d4c6d074435cb6b6310713d0a00b931cd528` وبنت المسار التالي:

- Wikipedia Action API كمصدر evidence مرخص ومحدد بالنسخة القانونية المسجلة.
- migration `0017_enable_wikipedia_analysis_evidence.sql` تسمح فقط بحالتي policy persistable المعروفتين: Wikidata catalog/CC0 وWikipedia analysis evidence/CC BY-SA 4.0 مع attribution وShareAlike.
- Cloudflare Workers AI binding باسم `AI`، والنموذج الحالي `@cf/meta/llama-3.1-8b-instruct-fast`.
- النموذج **طبقة استخراج غير موثوقة** ولا يملك publish authority.
- الاستخراج الآلي من prose يسمح فقط بـ`present` أو `uncertain`؛ لا يسمح بـ`none` لأن غياب الذكر ليس دليلًا على عدم الوجود.
- `present` يتطلب fact منظمة وlocator حقيقي `P####`.
- لا تُختلق runtime timestamps من نص Wikipedia.
- chunking bounded/sequential ولا يوجد silent truncation.
- `assessEvidenceReview` يفشل مغلقًا عند محور غير مغطى، `uncertain`، present بلا fact، تعارض وجود، فرق شدة >=2، أو cross-version evidence.
- `buildWikipediaEvidenceReviewCandidate()` يجمع fetch → provenance → extraction → validation → coverage/conflict، لكنه يعيد دائمًا `publishable: false`؛ النشر العام هو P3S-06.

### فشل deploy الأول بعد PR #36 ولماذا لم نعتبره نشرًا ناجحًا

- Cloudflare Run `31669752116` فشل في **Verify engine** قبل تطبيق migration رقم 20 وقبل Worker deploy؛ لذلك لم يحدث تغيير remote من هذا التشغيل.
- 205 من 207 اختبارات نجحت، وفشل اختباران كشفا أن `uncertain` كان ينتج `sourceLocator` فارغًا.
- هذا لم يكن مجرد test formatting: عقد evidence نفسه يرفض locator فارغًا، لذلك كان يمكن أن يحول «عدم اليقين الآمن» إلى `ASSERTION_INVALID` بدل coverage unknown واضحة.

### إصلاح P3S-05 الحالي

- الفرع: `agent/p3s-05-fix-uncertain-locators`.
- functional fix checkpoint: `ae5a46b60a531b29381b2752853419837f03856d`.
- الـ`uncertain` لا تنسب واقعة إلى فقرة داعمة مزعومة، لكنها تسجل نطاق الجزء الذي تم فحصه بصيغة `chunk:P0001-P0004` مثلًا.
- `present` ما زالت تتطلب locators فعلية `P####`، لذلك لم تُخفف أي بوابة ثقة أو coverage.
- branch CI بعد الإصلاح نجح في **207/207 اختبارًا، 0 فشل**، ونجح `test:migrations`, `lint:local`, و`build:local`.
- local schema verifier يؤكد **20 migration files / 27 product tables**.
- لا schema/migration جديدة في الإصلاح نفسه؛ migration رقم 20 هي نفسها P3S-05 الموجودة من PR #36.

### حالة الإنتاج الآن

- آخر production deployment المؤكد الناجح ما زال P3S-04 عند commit `709355bd6a9d0aaccb703837bff3b744a77da90b`.
- D1 production المؤكدة حاليًا: **19/19 migrations**.
- Worker bindings المؤكدة في آخر deploy ناجح: `DB`, `IMAGES`, `ASSETS`.
- `AI` binding وWikipedia analysis-evidence policy وmigration رقم 20 **لا نعتبرها production-active بعد**.
- لإغلاق P3S-05 إنتاجيًا: merge للإصلاح بعد PR CI أخضر، ثم Cloudflare deploy ناجح يثبت 20/20 migrations، source-policy verification، ظهور `env.AI` في deploy output، ونجاح smoke tests.

## الإنچين — الحالة الحالية

- TypeScript domain schema للنسخة والوقائع والمحاور وحدود الأسرة.
- fail-closed: نقص أو تعارض حرج يعيد `insufficient_data` بدل «مناسب».
- القرار deterministic وقابل لإعادة الإنتاج من نفس المدخلات.
- الأسباب مرتبطة بالوقائع التي فعّلت القرار.
- قواعد الخطر والحساسية منفصلة ومختبرة.
- P3S-03 غيّرت default family profile إلى معايير عربية category-specific من غير تغيير مبدأ fail-closed.
- P3S-05 تضيف evidence-to-facts وcoverage/conflict قبل الوصول لمسار النشر؛ لا تمنح Workers AI سلطة القرار أو النشر.

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

لا نحذف هذا العمل. المسار البشري يبقى اختياريًا للحالات ذات القيمة أو النزاع أو التحقق اليدوي، بينما P3S يوفر مسار evidence-based قابلًا للتوسع من غير synthetic reviewers.

## تجربة المستخدم العامة — المنجز

- هوية عربية وRTL وصفحة رئيسية متجاوبة.
- `/search` متصل بـD1 ومحرك بحث عربي deterministic.
- فلاتر النوع والعمر وحالة التحقق.
- `/review` تقرأ bundle حقيقية وتفشل مغلقًا عند stale/conflicted/invalid state.
- حدود الأسرة محفوظة محليًا من غير اسم طفل أو تاريخ ميلاد.
- `/review-policy`, `/privacy`, `/corrections` موجودة ومربوطة من الموقع.
- سياسة التصحيح لا تدعي أن public report intake موصول وهو غير موصول.

## الاختبارات — آخر checkpoint حالي

- fix branch P3S-05: **207/207 ناجحة، 0 فشل**.
- `test:migrations`: ناجح — **20 migration files / 27 product tables** محليًا.
- `lint:local`: ناجح.
- `build:local`: ناجح.
- اختبارات P3S-05 تغطي Wikipedia fetch policy، provenance، Workers AI parser/locators، coverage/conflict، ورفض النشر المباشر من candidate.

## Cloudflare — الإنتاج الفعلي

- Worker العام: `https://qabl-almushahada.buildtools.workers.dev`.
- D1: `qabl-almushahada-production`.
- آخر deployment مؤكد ناجح: P3S-04 / commit `709355bd6a9d0aaccb703837bff3b744a77da90b`.
- D1 production المؤكدة: **19/19 migrations**.
- bindings المؤكدة: `DB`, `IMAGES`, `ASSETS`.
- P3S-05 ستضيف production `AI` binding وتطبق migration رقم 20 فقط بعد merge الإصلاح ونجاح workflow كامل.
- Cloudflare workflow في P3S-05 يفحص remote schema، exact source-policy rows، وجود `env.AI` في deploy output، ثم smoke tests العامة.
- لا API tokens أو Account IDs تُنسخ إلى Worker config.

## ما لا نفعله

- لا fake/synthetic reviewers لتمرير بوابات المراجعة القديمة.
- لا scraper لـIMDb/TMDB/Parents Guide في الموقع التجاري بدون ترخيص.
- لا تحويل metadata وحدها إلى «مراجعة موثقة».
- لا استخدام policy الكتالوج نفسها كـanalysis evidence.
- لا نسخ review أجنبي ثم الادعاء أن «قبل المشاهدة» راجعه بنفسه.
- لا ادعاء أن إنسانًا شاهد النسخة إذا لم يحدث ذلك.
- لا منح Workers AI سلطة publish أو اعتبار صمته دليل `none`.
- لا rating رقمي واحد للعمل يحل محل الأسباب والوقائع.
- لا حسابات أطفال أو جمع اسم الطفل/تاريخ الميلاد.

## ما يزال تجريبيًا أو مؤجلًا

- بعض أعمال وأمثلة الصفحة الرئيسية ما زالت أمثلة تصميمية وليست مراجعات production.
- زر البلاغ العام غير موصول حتى الآن.
- لا توجد بعد بوابة publication مستقلة لـP3S؛ P3S-05 candidates تظل `publishable: false` حتى P3S-06.
- taxonomy العربية تحتاج توسعة موضوعية قبل ingestion واسع: العري، الحميمية/التقبيل، الحوار الجنسي، التدخين/الكحول/المخدرات منفصلة، القمار، والحساسية الدينية عندما يمكن وصفها كواقعة قابلة للرصد.
- لا صور posters غير مرخصة؛ غياب الصورة أفضل من استخدام غير قانوني.
- لم يتم بعد bulk production catalog import؛ ذلك P3S-08.
- P0-05 والمراحل P4 تبقى لاحقة بعد تثبيت مسار المحتوى الجديد.

## نقطة البدء التالية

1. افتح PR لإصلاح `uncertain` trace locator فقط مع تحديث هذا checkpoint، ولا تدخل P3S-06 في نفس PR.
2. لا تدمج إلا بعد PR CI أخضر على نفس head.
3. بعد الدمج راقب main CI وCloudflare production deploy حتى النهاية.
4. لا تعتبر P3S-05 production-complete إلا عندما تصبح D1 **20/20 migrations**، تنجح remote source-policy verification، يظهر `env.AI` في Wrangler deploy output، وتنجح smoke tests العامة.
5. بعد ذلك فقط ابدأ `P3S-06` — بوابة نشر مستقلة تربط كل claim بأدلتها المرخصة ولا تدعي مشاهدة بشرية لم تحدث.
6. بعد P3S-06: `P3S-07` taxonomy ثم `P3S-08` أول catalog production وSEO pages.

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
