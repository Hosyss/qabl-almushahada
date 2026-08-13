# حالة مشروع «قبل المشاهدة»

آخر تحديث: 13 أغسطس 2026

> هذا الملف يصف **الحالة الحالية ومصدر الحقيقة التشغيلي**. التاريخ التفصيلي محفوظ في `docs/ROADMAP.md`، وملفات checkpoint، وPull Requests وGit history.

## الهدف الحالي

«قبل المشاهدة» دليل عربي مستقل يساعد الأسرة على معرفة محتوى الفيلم أو المسلسل قبل تشغيله. المنتج يفصل الآن بوضوح بين مستويين:

1. **وقائع مفيدة قابلة للتتبع** يمكن نشرها في تحليل تحريري جزئي عندما تكون مثبتة بمصادر مستقلة.
2. **قرار الملاءمة** لا يصدر إلا بعد اكتمال بوابات الحكم؛ أي نقص مهم يبقي النتيجة `insufficient_data`.

المقياس العملي للمرحلة الحالية:

> هل يستطيع الزائر البحث عن عمل معروف، ورؤية ما استطعنا إثباته فعلًا مع مصادره، مع عدم تحويل المحاور المجهولة إلى «آمنة» أو تحويل التحليل الجزئي إلى حكم نهائي؟

## ترتيب العمل المعتمد الآن

1. كتالوج حقيقي — **مكتمل إنتاجيًا**.
2. بحث مفيد من D1 فقط — **مكتمل إنتاجيًا**.
3. P4-03: مسار مراجعة تحريرية مبنية على مصادر مستقلة — **Cars (2006) pilot قيد checkpoint الآن؛ لا توسع قبل نجاحه**.
4. بعد نجاح Cars checkpoint: اختيار persistence للتوسع ثم بناء أول 10–20 تحليلًا تحريريًا موثوقًا.
5. توصيل البلاغ العام والتصحيح الكامل.
6. اختبار المنتج مع 5 أسر، 3 أعمال لكل أسرة.
7. بعد المحتوى فقط: اختصار الصفحة الرئيسية وعرض أعمال حقيقية بدل الأمثلة التصميمية.
8. قبل التوسع الكبير: custom domain، أداء/إتاحة، rate limiting، monitoring، D1 backup/recovery، وتعطيل آمن عند الأعطال.

لا أولوية الآن لتسجيل مستخدمين أو توصيات AI أو نجوم أو تعليقات أو تطبيق موبايل أو إعادة تصميم كبيرة.

## المبدأ التحريري والثقة

- المصادر الخارجية تمدنا **بالبيانات أو الوقائع القابلة للتحقق** فقط؛ لا تصبح مراجعتنا.
- Wikidata مخصصة للـcatalog metadata تحت CC0 1.0.
- Wikipedia تبقى لمسار analysis evidence الآلي وفق policy المشروع والعزو/الrevision المحفوظين.
- P4-03 يسمح يدويًا بالرجوع إلى مراجعات منشورة وجهات رسمية لاستخراج **الوقائع فقط**، مع كتابة التحليل العربي من الصفر.
- لا نخزن source text أو ترجمة أو اقتباسًا طويلًا أو paraphrase قريبة من مراجعة خارجية داخل سجل P4-03.
- كل claim نسجل معها URL + publisher/type + access date + supported claim IDs.
- `corroborated` تحتاج مصدرين مستقلين على الأقل من independence groups مختلفة.
- لا metadata → verified review تلقائيًا.
- لا fake/synthetic reviewers.
- لا ادعاء مشاهدة بشرية إذا لم تحدث.
- Workers AI طبقة استخراج غير موثوقة ولا تملك publish authority.
- `uncertain` تمنع **الحكم** لكنها لا تمنع نشر صفحة تحريرية مفيدة للوقائع المثبتة.
- silence لا يتحول إلى `none` في أي مسار.
- قرار الأسرة منفصل عن حقيقة وجود الواقعة نفسها.

النص العام الصحيح يفرق بين:

- **مراجعة مكتملة لنسخة محددة** عندما تنجح بوابات P2/P3S الكاملة؛ أو
- **تحليل تحريري موثق جزئيًا** يعرض الوقائع المثبتة ويصرح بالمحاور `uncertain`؛ أو
- **بيانات غير كافية** عندما لا توجد حتى وقائع قابلة للنشر.

## P3S-05 / P3S-06 — evidence-based full review path

المسار evidence-based الكامل مستقل عن سير المراجعين البشر القديم:

- evidence مرخص ومربوط بنسخة محددة.
- extraction schema-bound.
- coverage/conflict assessment deterministic.
- publication snapshots append-only.
- كل claim منشور مرتبط بمصدر داخل snapshot نفسها.
- لا `human_watch_confirmed = 1` في المسار evidence-based.
- `/review?publicationId=...` للمراجعة evidence-based الكاملة.
- `/review?bundleId=...` للمسار البشري القديم.
- العرض العام يفشل مغلقًا عند stale/missing/current-head mismatch.

**P4-03 لا يخفف P3S-06 ولا يعدلها.** التحليل التحريري الجزئي له locator ومسار عرض منفصلان، ولا يستطيع جعل `engineEligible = true`.

المسار البشري P2/P2Q محفوظ كاملًا كمسار جودة يدوي أو تصعيد.

## P4-03 — editorial partial publication path

المسار الجديد يفصل **Publication Gate** عن **Suitability Decision Gate**:

### Editorial Publication Gate

تسمح بصفحة عامة عندما:

- يوجد عنوان حقيقي في الكتالوج.
- توجد claim واحدة على الأقل بصياغة عربية أصلية.
- كل claim مرتبطة بمصدر/مصادر معروفة داخل نفس publication record.
- المصدر يسجل URL، نوعه، تاريخ الوصول، independence group، والclaims التي يدعمها.
- وصف `corroborated` لا يمر إلا بمصدرين مستقلين على الأقل.
- كل محور من المحاور العشرة إما له claim مثبتة أو معلّم صراحة `uncertain`.
- لا يوجد حقل لتخزين source text/excerpt/quote/translation/paraphrase في source contract.

### Suitability Decision Gate

في P4-03 الجزئي:

```text
decisionEligible = false
decisionStatus = insufficient_data
```

هذه القيم مفروضة في contract والvalidator. الصفحة لا تعرض «مناسب» أو «غير مناسب» لمجرد أن بعض الوقائع اتثبتت.

المسارات العامة أصبحت:

```text
/review?bundleId=...       → human-reviewed full path
/review?publicationId=...  → evidence-based full path
/review?editorialId=...    → editorial partial facts path
```

وجود أكثر من locator في نفس الطلب يفشل مغلقًا.

## Cars (2006) — أول pilot للمسار التحريري

العنوان: `Cars` / `wd:Q182153` / 2006.

### مصادر الـpilot

تمت مراجعة خمسة مصادر مستقلة يدويًا في 13 أغسطس 2026:

- Common Sense Media — `published_review`.
- Plugged In — `published_review`.
- BBFC — `official_classification`.
- Kids-In-Mind — `published_review`.
- Dove.org — `published_review`.

السجل لا يخزن نصوص هذه الصفحات؛ يخزن فقط روابطها وmetadata الاستشهاد والclaims المدعومة.

### الوقائع المتقاطعة المنشورة في pilot

أربع claims كلها `corroborated` بمصدرين مستقلين أو أكثر:

- `violence`: سباقات/قيادة خطرة تتضمن اصطدامات وفقدان سيطرة وأضرارًا للسيارات.
- `fear`: مواقف خطر قصيرة، ومنها توتر طريق وعبور سكة حديد مع اقتراب قطار.
- `language`: ألفاظ وتعليقات خفيفة وبعض الإهانات/التعجبات المتناثرة.
- `sexualContent`: إشارات غزل ونكات أو تلميحات خفيفة مبنية على عالم السيارات.

المحاور التي بقيت `uncertain`:

- `bullying`
- `substances`
- `discrimination`
- `selfHarm`
- `grief`
- `flashingLights`

**Cars لا تحصل على suitability verdict في هذا الـpilot.** النتيجة تظل `insufficient_data`، ولا ندّعي exact cut/platform/fingerprint أو مشاهدة بشرية.

### التنفيذ الحالي للـpilot

- `lib/editorial-review.ts`: contract + deterministic validation.
- `lib/editorial-review-registry.ts`: Cars فقط، كـversioned pilot صغير قبل اختيار persistence للتوسع.
- `tests/editorial-review.test.ts`: تحقق الاستقلال، source metadata، عدم تخزين source expression، وإجبار القرار على insufficient.
- `/review?editorialId=cars-2006-editorial-pilot-v1`: العرض العام الجديد بعد النشر.
- `/title/Q182153` والبحث يربطان إلى التحليل التحريري، مع تمييزه عن المراجعة المكتملة.
- فلتر العمر لا يستخدم التحليل الجزئي.

**لا عنوان ثانٍ قبل نجاح branch → PR → Quality Gate → merge → deploy → live verification لهذا الـpilot.**

## P3S-07 — taxonomy موضوعية

مكتملة ومنشورة:

- `nudity`
- `kissing`
- `intimate_touching`
- `sexual_dialogue`
- `smoking_or_vaping`
- `alcohol_use`
- `drug_use`
- `gambling_activity`
- `religious_reference_or_practice`

الـsubtypes وصفية ولا تتحول تلقائيًا إلى age rating أو risk verdict مستقل. D1 category guards والـCHECKs متحقق منها production.

## P3S-08 — أول كتالوج production حقيقي — مكتمل 100%

### النتيجة الفعلية

تم استيراد **200/200 عنوان حقيقي** من Wikidata إلى D1 production مع provenance قانونية لكل عنوان.

- المصدر: Wikidata.
- الاستخدام: `catalog_metadata` فقط.
- الرخصة: CC0 1.0.
- لا posters.
- لا review state مصطنعة.
- لا evidence publication مصطنعة.
- لا title version مصطنعة لمجرد SEO.
- الاسم العربي يُفضّل عندما يتوفر، والاسم الإنجليزي المختلف يُحفظ كاسم بحث بديل.
- الاختيار الأولي مرتب بالشيوع عبر Wikidata sitelinks مع bounds صريحة.
- runtime/المدة **لا تُخزن كحقيقة عامة للعنوان**؛ تبقى خاصية للنسخة عندما تكون النسخة/القص محددين بدقة.

### الاستيراد والإثبات

- أول successful production import: Run `31690242194`، successful rerun job `94416044496`.
- validated records: **200**.
- exact remote verification: **200 title/provenance pairs**.
- first QID: `Q44578`.
- preview artifact: `wikidata-catalog-preview-31690242194`.
- artifact ID: `9177142287`.
- artifact ZIP SHA-256: `9e5ed4d87ce524959af37069851fecff93e98a8f112495fd195f04d9d2d857ab`.
- D1 import نفذ 400 statements للـ200 title + 200 provenance records.
- أول محاولتين فشلتا قبل أي D1 write؛ لم يتم تخطي fail-closed gates.

### الصفحات العامة

- `/titles` تعرض فقط عناوين لها provenance Wikidata/CC0 مسموح بها.
- `/title/[qid]` تعرض metadata + source/license/policy disclosure + canonical/JSON-LD.
- `/sitemap.xml` يولّد روابط العناوين القانونية فقط.
- `/robots.txt` يعلن sitemap ويمنع `/internal`.
- وجود العنوان في الكتالوج **لا يعني وجود حكم ملاءمة**.

## البحث الحقيقي — مكتمل 100%

البحث يعتمد على D1 الحقيقي فقط للعناوين:

- `/api/search-suggestions?q=...` يستخدم نفس `searchPublicTitles` server-side.
- أقل من حرفين → لا اقتراحات.
- أقصى 5 اقتراحات.
- `no-store`، ولا fake fallback عند تعذر D1.
- Hero يستخدم debounce + AbortController.
- أزيلت الاقتراحات الثابتة القديمة.

حالات العرض أصبحت تفرق بين:

- **موجود — مراجعة موثقة**.
- **موجود — قيد المراجعة**.
- **موجود — تحليل تحريري جزئي** عندما يوجد editorial pilot لكن الحكم غير مكتمل.
- **موجود — الحكم غير مكتمل**.
- **غير موجود**.

التحليل التحريري الجزئي لا يتحول إلى `verified` ولا يدخل فلتر العمر.

### Live product smoke قبل checkpoint الحالي

آخر production checkpoint الموثوق قبل فرع P4-03 التحريري:

- main commit: `c77c0d2b6b1c0f1be2dfc277761c852f69a835cb`.
- main Checkpoint: success.
- Cloudflare production deploy: success.
- Live product smoke: success.

فرع `agent/p4-03-editorial-review-pilot` لديه Quality Gate مستقل ويجب أن ينجح قبل فتح/دمج checkpoint. لا يُعتبر Cars منشورًا إنتاجيًا قبل merge/deploy/live verification.

## Cloudflare production — الحالة الحالية قبل checkpoint الجديد

- Worker: `https://qabl-almushahada.buildtools.workers.dev`.
- D1: `qabl-almushahada-production`.
- D1 ID: `f2bd0d7a-660b-4f9e-bddc-40a918dd35cc`.
- migrations: **22/22**.
- product tables محليًا: **33**.
- bindings: `DB`, `IMAGES`, `AI`, `ASSETS`.
- current production main قبل P4-03 editorial merge: `c77c0d2b6b1c0f1be2dfc277761c852f69a835cb`.
- remote schema verification: success.
- remote objective taxonomy guards: success.
- standard public smoke: success.
- live product smoke: success.

## ما يزال تصميميًا أو غير موصول

- بعض بطاقات الصفحة الرئيسية أمثلة تصميمية ومعلّمة بوضوح وليست reviews production.
- زر البلاغ العام داخل المراجعة غير موصول بعد.
- «اطلب مراجعته» غير موصول ولن يظهر كزر وهمي.
- لا posters غير مرخصة.
- editorial persistence ما زالت registry versioned صغيرة للـpilot؛ لم نقرر D1 schema للتوسع بعد.
- Cars لا تملك suitability verdict مكتملًا.

## ملاحظة عن Source qualification السابقة

فحص `docs/P4_03_SOURCE_QUALIFICATION.md` يظل صحيحًا **للمسار الآلي/الكامل**: لا يوجد source stack مجاني ثبت أنه يغلق المحاور العشرة + exact-version identity لـCars. التغيير الحالي لا يدعي حل ذلك؛ بل يفصل صفحة الوقائع الجزئية عن الحكم الكامل.

بالتالي لم نخفض taxonomy، ولم نحول silence إلى `none`، ولم نخترع `content_fingerprint`.

## الخطوة التالية

1. أكمل checkpoint مستقل لـCars editorial pilot.
2. لا تضف عنوانًا ثانيًا قبل نجاح CI + merge + Cloudflare deploy + live verification للصفحة والبحث.
3. بعد نجاح الـpilot، قرر persistence للتوسع: registry صغيرة مؤقتة مقابل جداول D1 مخصصة للـeditorial publications.
4. بعدها فقط ابدأ أول cohort من 10–20 عنوانًا بنفس قواعد الاستقلال والشفافية.
5. قرار الملاءمة لكل عنوان يظل `insufficient_data` ما لم تنجح بوابات الحكم الكاملة.

**العدد الصغير الموثوق أفضل من آلاف الصفحات المنسوخة أو الأحكام الوهمية.**

## روابط المصدر

- المستودع: `https://github.com/Hosyss/qabl-almushahada`
- الإنتاج: `https://qabl-almushahada.buildtools.workers.dev`
- Roadmap: `docs/ROADMAP.md`
- سياسة المصادر: `docs/CONTENT_SOURCE_POLICY.md`
- P4-03 first fail-closed pilot: `docs/P4_03_FIRST_REVIEW_PILOT.md`
- P4-03 source qualification: `docs/P4_03_SOURCE_QUALIFICATION.md`
- Trust model: `docs/ENGINE_TRUST_MODEL.md`
- Cloudflare: `docs/CLOUDFLARE_DEPLOYMENT.md`
