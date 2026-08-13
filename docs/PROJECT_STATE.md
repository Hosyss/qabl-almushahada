# حالة مشروع «قبل المشاهدة»

آخر تحديث: 13 أغسطس 2026

> هذا الملف يصف الحالة التشغيلية الحالية. التفاصيل التاريخية محفوظة في `docs/ROADMAP.md` وملفات checkpoint وPull Requests وGit history.

## الحالة الحالية

- كتالوج D1 الحقيقي: **200/200 عنوان** من Wikidata مع provenance قانونية.
- البحث والاقتراحات من D1: **مكتملان إنتاجيًا**.
- `Cars (2006)` Editorial Pilot: **مكتمل ومتحقق إنتاجيًا**.
- `P4-03B1` دفعة الثلاثة أفلام: **مكتملة ومتحققة إنتاجيًا**.
- إجمالي Editorial Publication pages المتحققة إنتاجيًا الآن: **4** = Cars + E.T. + Harry Potter and the Philosopher's Stone + Minions.
- `P4-03` ككل: **ما زالت مفتوحة**؛ لم نبدأ بقية هدف 10–20.
- الخطوة التالية الإلزامية: **P4-03B2 مراجعة جودة الصفحات والمصادر**. لا يبدأ أي عنوان إضافي قبل هذه المراجعة.

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
- وجود أكثر من locator للمراجعة في طلب واحد يفشل مغلقًا.

## الصفحات المتحققة إنتاجيًا

### Cars (2006)

- Catalog ID: `wd:Q182153`.
- Editorial ID: `cars-2006-editorial-pilot-v1`.
- المصادر المستقلة: **5**.
- الوقائع `corroborated`: **4**.
- المحاور `uncertain`: **6/10**.
- القرار: `insufficient_data`.

### E.T. the Extra-Terrestrial (1982)

- Catalog ID: `wd:Q11621`.
- Editorial ID: `et-1982-editorial-batch-v1`.
- المصادر المستقلة المستخدمة: **3 مراجعات منشورة**.
- الوقائع `corroborated`: **5**: `fear`, `violence`, `language`, `substances`, `sexualContent`.
- المحاور `uncertain`: **5/10**: `bullying`, `discrimination`, `selfHarm`, `grief`, `flashingLights`.
- القرار: `insufficient_data`.

### Harry Potter and the Philosopher's Stone (2001)

- Catalog ID: `wd:Q102438`.
- Editorial ID: `harry-potter-philosophers-stone-2001-editorial-batch-v1`.
- المصادر المستقلة المستخدمة: **4 مراجعات منشورة**.
- الوقائع `corroborated`: **4**: `fear`, `violence`, `language`, `grief`.
- المحاور `uncertain`: **6/10**: `bullying`, `sexualContent`, `substances`, `discrimination`, `selfHarm`, `flashingLights`.
- القرار: `insufficient_data`.

### Minions (2015)

- Catalog ID: `wd:Q13619743`.
- Editorial ID: `minions-2015-editorial-batch-v1`.
- المصادر المستقلة المستخدمة: **4 مراجعات منشورة**.
- الوقائع `corroborated`: **5**: `violence`, `fear`, `language`, `substances`, `sexualContent`.
- المحاور `uncertain`: **5/10**: `bullying`, `discrimination`, `selfHarm`, `grief`, `flashingLights`.
- القرار: `insufficient_data`.

تفاصيل روابط المصادر ونوع كل مصدر وتاريخ الوصول وربط المصدر بالادعاءات محفوظة في `lib/editorial-review-registry.ts` وموثقة في `docs/P4_03_THREE_TITLE_BATCH.md`.

## التحقق الإنتاجي لـP4-03B1

- Content batch PR: `#54`.
- Live validation follow-up PR: `#55`.
- `main` بعد إصلاح الـLive Smoke: `269c46babfe80e0638da29b1b35ccf3ab874bf0d`.
- Checkpoint verification على `main`: **success**.
- Cloudflare production deploy: **success**.
- Live Product Smoke: **success**.
- الفحص الحي مرّ لكل من Cars وE.T. وHarry Potter 1 وMinions عبر:

```text
search → title page → editorial analysis
```

- كل صفحة أظهرت `insufficient_data`.
- mixed review locators فشلت مغلقًا.
- صفحات Editorial الأربع موجودة في `sitemap.xml`.

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

## الفهرسة

- صفحات العناوين الحقيقية تظل من D1.
- `sitemap.xml` يدرج صفحات Editorial Publication العامة الأربع إلى جانب صفحات العناوين.
- إدراج صفحة Editorial في sitemap لا يجعلها مراجعة مكتملة أو حكم ملاءمة.

## Production baseline الحالي

- Worker: `https://qabl-almushahada.buildtools.workers.dev`.
- D1: `qabl-almushahada-production`.
- D1 ID: `f2bd0d7a-660b-4f9e-bddc-40a918dd35cc`.
- migrations: **22/22**.
- Editorial pages production-verified: **4**.

## الخطوة التالية

`P4-03B2` فقط:

1. مراجعة جودة الصفحات العربية الأربع.
2. مراجعة جودة وتنوع المصادر والـclaim mapping.
3. تحديد أي تعديلات مطلوبة قبل التوسع.
4. **عدم إضافة أي عنوان خامس أو بدء باقي 10–20 قبل موافقة المستخدم على نتيجة المراجعة.**

## روابط داخل المشروع

- `docs/ROADMAP.md`
- `docs/P4_03_FIRST_REVIEW_PILOT.md`
- `docs/P4_03_SOURCE_QUALIFICATION.md`
- `docs/P4_03_THREE_TITLE_BATCH.md`
- `docs/ENGINE_TRUST_MODEL.md`
- `docs/CONTENT_SOURCE_POLICY.md`
