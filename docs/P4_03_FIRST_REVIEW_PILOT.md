# P4-03 — أول مراجعة حقيقية: Pilot fail-closed

تاريخ الفحص: 13 أغسطس 2026

هذا الملف يسجل أول محاولة عملية لبدء `P4-03` من دون إضعاف نموذج الثقة أو اختراع بيانات نسخة أو تحويل غياب الذكر إلى «غير موجود».

## العنوان المختار

- العنوان: `Cars` / «سيارات» (2006).
- Catalog ID: `wd:Q182153`.
- سبب الاختيار: عمل عائلي معروف وموجود بالفعل داخل كتالوج Wikidata production ذي الـ200 عنوان.

## فحص المصدر القانوني

المصدر الآلي المسموح حاليًا لمسار `analysis_evidence` هو Wikipedia وفق `CONTENT_SOURCE_POLICY_VERSION = 2026-08-13.1`.

تمت إعادة مراجعة المصادر الرسمية الحالية في 13 أغسطس 2026:

- Wikimedia Terms of Use: `https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use`
- Wikimedia Developer App Guidelines: `https://foundation.wikimedia.org/wiki/Legal:Wikimedia_Developer_App_Guidelines`
- MediaWiki Action API etiquette: `https://www.mediawiki.org/wiki/API:Etiquette/en`

النتيجة التشغيلية الحالية متوافقة مع policy المشروع: نص Wikipedia قابل لإعادة الاستخدام تجاريًا تحت CC BY-SA 4.0 مع العزو وشروط ShareAlike المناسبة، واستخدام الـAction API يجب أن يحمل User-Agent واضحًا ويحترم `maxlag` ومعدلات الطلبات.

لم نضف مصدرًا جديدًا ولم نخفف أي policy.

## نتيجة محاولة التغطية

صفحة Wikipedia الإنجليزية لـCars مفيدة لإثبات وقائع **موجودة** عندما يكون لها locator واضح في النص، لكنها ليست قائمة فحص شاملة للمحاور العشرة.

المحاور المطلوبة للنشر هي:

- `fear`
- `violence`
- `language`
- `bullying`
- `sexualContent`
- `substances`
- `discrimination`
- `selfHarm`
- `grief`
- `flashingLights`

عدم ذكر محور في ملخص أو Plot لا يثبت غيابه. لذلك لا يجوز تحويل الصمت إلى `none`، وWorkers AI أصلًا لا يملك سلطة إنتاج `none` من prose آلية.

بناءً على ذلك، Wikipedia وحدها لا تكفي لإغلاق coverage لهذا العنوان، ويجب أن تكون النتيجة `insufficient_data` إذا لم يوجد مصدر قانوني آخر يثبت المحاور غير المحسومة صراحة.

## عائق هوية النسخة

استيراد `P3S-08` أدخل title metadata + provenance فقط، وبشكل مقصود **لم ينشئ `title_versions`**.

للنشر الحقيقي نحتاج نسخة محددة فعلًا، تشمل على الأقل:

- edition/cut محددًا؛
- platform أو وسيطًا محددًا؛
- اللغة؛
- runtime موثقة لهذه النسخة؛
- `content_fingerprint` حقيقية تميز النسخة.

لم ننشئ version اصطناعية من `Cars`، ولم نستخدم runtime عامة من صفحة عنوان باعتبارها بصمة نسخة، ولم نكتب أي صف production فقط لتمرير بوابة P3S-06.

## قرار الـPilot

**لم تُنشر مراجعة.**

لم يحدث:

- D1 write لمراجعة أو version مصطنعة؛
- evidence publication؛
- current publication head؛
- تغيير حالة العنوان إلى reviewed؛
- ادعاء human watch.

هذا هو السلوك الصحيح fail-closed، وليس فشلًا يجب الالتفاف عليه.

## ما يلزم قبل إعادة المحاولة

يوجد مساران صالحان فقط:

1. الحصول على **هوية نسخة دقيقة** + مجموعة مصادر analysis evidence مسموح بها قانونيًا وتغطي المحاور غير المحسومة بشكل صريح؛ أو
2. استخدام مسار المشاهدة البشرية P2/P2Q لعنوان ذي نسخة حقيقية عندما تتوفر مشاهدة ومراجعين مستقلين فعليًا.

لا نضيف مصدر مراجعات/Parents Guide لمجرد أنه متاح على الويب، ولا نحول metadata أو تصنيفًا عمريًا إلى evidence شامل، ولا نخفف قاعدة `uncertain/insufficient_data` من أجل الوصول لرقم 10–20.

## حالة P4-03 بعد الـPilot

`P4-03` **ما زالت مفتوحة**. لم نحتسب `Cars` ضمن cohort مراجعات production لأن شروط النشر لم تتحقق.

الخطوة التالية الآمنة هي حل **source coverage + exact version identity** لأول عنوان قبل محاولة التوسع إلى العنوان الثاني.
