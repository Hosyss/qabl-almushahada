# حالة مشروع «قبل المشاهدة»

آخر تحديث: 13 أغسطس 2026

> هذا الملف يصف الحالة التشغيلية الحالية. التفاصيل التاريخية محفوظة في `docs/ROADMAP.md` وملفات checkpoint وPull Requests وGit history.

## الحالة الحالية

- كتالوج D1 الحقيقي: **200/200 عنوان** من Wikidata مع provenance قانونية.
- البحث والاقتراحات من D1: **مكتملان إنتاجيًا**.
- `Cars (2006)` Editorial Pilot: **مكتمل ومتحقق إنتاجيًا**.
- `P4-03` ككل: **ما زالت مفتوحة**.
- الدفعة الحالية: **3 أفلام فقط** داخل checkpoint واحد: E.T. (1982)، Harry Potter and the Philosopher's Stone (2001)، Minions (2015).
- إجمالي Editorial Publication records داخل الفرع بعد الدفعة: **4** = Cars + 3 أفلام جديدة.
- العدد المتحقق إنتاجيًا يظل **1** حتى تنجح الدفعة الجديدة كاملة بعد الدمج والنشر والفحص الحي. عند نجاحها يصبح العدد **4**.
- بعد نجاح الدفعة الثلاثية يجب التوقف ومراجعة جودة الصفحات والمصادر قبل بدء أي عنوان إضافي من هدف 10–20.

## قواعد P4-03 الحالية

- نستخدم المصادر الخارجية لاستخراج **الوقائع فقط**.
- لا نخزن نص مراجعة خارجية، ولا ترجمة كاملة، ولا اقتباسًا طويلًا، ولا إعادة صياغة قريبة منها.
- التحليل العربي يكتب من الصفر اعتمادًا على الوقائع المتقاطعة.
- كل source record يحفظ الناشر، النوع، الرابط، تاريخ الوصول، مجموعة الاستقلال، والادعاءات التي يدعمها.
- `corroborated` لا تمر إلا عند وجود مصدرين مستقلين فعليًا على الأقل.
- المحاور التي لا نملك لها إثباتًا كافيًا تظل `uncertain`.
- عدم ذكر محور في مصدر لا يتحول إلى `none`.
- كل Editorial Publication تظل:

```text
decisionEligible = false
decisionStatus = insufficient_data
```

- المسار لا يغير P3S-06 ولا يصدر حكم ملاءمة مكتملًا.
- وجود أكثر من locator للمراجعة في طلب واحد يظل غير مقبول في المسار العام.

## Cars (2006) — baseline الإنتاجي

- Catalog ID: `wd:Q182153`.
- Editorial ID: `cars-2006-editorial-pilot-v1`.
- المصادر المستقلة: **5**.
- الوقائع `corroborated`: **4**.
- المحاور `uncertain`: **6/10**.
- القرار: `insufficient_data`.
- تم التحقق منه على الإنتاج عبر Quality Gate وCloudflare وLive Product Smoke.

## P4-03 — الدفعة الثلاثية الحالية

### E.T. the Extra-Terrestrial (1982)

- Catalog ID: `wd:Q11621`.
- Editorial ID: `et-1982-editorial-batch-v1`.
- المصادر المستقلة المستخدمة في الدفعة: **3 مراجعات منشورة**.
- الوقائع `corroborated`: **5**: `fear`, `violence`, `language`, `substances`, `sexualContent`.
- المحاور `uncertain`: **5/10**: `bullying`, `discrimination`, `selfHarm`, `grief`, `flashingLights`.
- القرار: `insufficient_data`.

### Harry Potter and the Philosopher's Stone (2001)

- Catalog ID: `wd:Q102438`.
- Editorial ID: `harry-potter-philosophers-stone-2001-editorial-batch-v1`.
- المصادر المستقلة المستخدمة في الدفعة: **4 مراجعات منشورة**.
- الوقائع `corroborated`: **4**: `fear`, `violence`, `language`, `grief`.
- المحاور `uncertain`: **6/10**: `bullying`, `sexualContent`, `substances`, `discrimination`, `selfHarm`, `flashingLights`.
- القرار: `insufficient_data`.

### Minions (2015)

- Catalog ID: `wd:Q13619743`.
- Editorial ID: `minions-2015-editorial-batch-v1`.
- المصادر المستقلة المستخدمة في الدفعة: **4 مراجعات منشورة**.
- الوقائع `corroborated`: **5**: `violence`, `fear`, `language`, `substances`, `sexualContent`.
- المحاور `uncertain`: **5/10**: `bullying`, `discrimination`, `selfHarm`, `grief`, `flashingLights`.
- القرار: `insufficient_data`.

تفاصيل روابط المصادر ونوع كل مصدر وتاريخ الوصول وربط المصدر بالادعاءات محفوظة في `lib/editorial-review-registry.ts` وموثقة في `docs/P4_03_THREE_TITLE_BATCH.md`.

## الاختبارات الحالية

`tests/editorial-review.test.ts` يتحقق من:

- أن الـregistry يحتوي Cars + الأفلام الثلاثة فقط.
- أن كل Editorial Publication قابلة للنشر كصفحة وقائع جزئية لكنها غير مؤهلة للحكم.
- أن كل claim موسومة `corroborated` لديها مجموعتا استقلال على الأقل.
- أن source records لا تخزن source text أو quote أو translation أو paraphrase.
- أن المحاور غير المثبتة تبقى `uncertain`.
- أن تقليل claim إلى مصدر مستقل واحد يجعل التحقق يفشل.
- أن محاولة تحويل التحليل الجزئي إلى قرار مكتمل تجعل التحقق يفشل.
- أن مسار المراجعة العام يحتفظ بشرط locator واحد فقط.

`Live Product Smoke` معد لاختبار Cars والأفلام الثلاثة من البحث إلى صفحة العنوان ثم صفحة التحليل، والتحقق من `insufficient_data` والمصادر والأعداد، ثم اختبار رفض الطلب ذي أكثر من locator.

## الفهرسة

- صفحات العناوين الحقيقية تظل من D1.
- `sitemap.xml` يضيف صفحات Editorial Publication العامة الأربع إلى روابط العناوين.
- إدراج صفحة Editorial في sitemap لا يجعلها مراجعة مكتملة أو حكم ملاءمة.

## Production baseline قبل دمج الدفعة

- Worker: `https://qabl-almushahada.buildtools.workers.dev`.
- D1: `qabl-almushahada-production`.
- D1 ID: `f2bd0d7a-660b-4f9e-bddc-40a918dd35cc`.
- migrations: **22/22**.
- آخر baseline موثوق قبل الدفعة: `b4a627989add3c3fc5d9c5a7f30e422a790912ef`.
- Cars Live Product Smoke: success.

## الخطوة التالية

1. تشغيل Quality Gate على آخر head للفرع الحالي.
2. فتح PR مستقل للدفعة الثلاثية فقط.
3. الدمج فقط إذا نجحت Engine tests وmigrations وlint وproduction build.
4. بعد الدمج: التحقق من `main` وCloudflare production deploy.
5. التحقق الحي لكل فيلم: search → title → editorial analysis، مع بقاء القرار `insufficient_data`.
6. إذا نجحت الدفعة كلها على الإنتاج: **التوقف وإبلاغ المستخدم قبل إضافة أي عنوان آخر**.

## روابط داخل المشروع

- `docs/ROADMAP.md`
- `docs/P4_03_FIRST_REVIEW_PILOT.md`
- `docs/P4_03_SOURCE_QUALIFICATION.md`
- `docs/P4_03_THREE_TITLE_BATCH.md`
- `docs/ENGINE_TRUST_MODEL.md`
- `docs/CONTENT_SOURCE_POLICY.md`
