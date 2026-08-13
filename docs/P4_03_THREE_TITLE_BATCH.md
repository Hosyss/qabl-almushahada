# P4-03 — دفعة 3 أفلام

تاريخ الإعداد: 13 أغسطس 2026

هذه الدفعة توسّع نفس `Editorial Publication` المستخدم في Cars إلى ثلاثة أفلام فقط. لا تغيّر منطق قرار الملاءمة.

## الأعداد

- Cars قبل الدفعة: **1 صفحة متحققة إنتاجيًا**.
- الدفعة الحالية: **3 صفحات جديدة**.
- إجمالي الـregistry داخل الفرع: **4**.
- لا تُحسب الصفحات الثلاث الجديدة كإنتاج ناجح إلا بعد الدمج والنشر والفحص الحي.
- بعد نجاحها نتوقف لمراجعة الجودة قبل أي توسع إضافي.

## قواعد التحرير

- نأخذ الوقائع فقط من المراجعات المنشورة.
- لا نخزن نص مراجعة أو ترجمة أو اقتباسًا أو إعادة صياغة قريبة.
- كل واقعة مكتوبة بالعربية من الصفر.
- كل مصدر يحفظ الناشر والنوع والرابط وتاريخ الوصول والادعاءات التي يدعمها.
- `corroborated` تحتاج مصدرين مستقلين فعليًا على الأقل.
- المحور غير المثبت يظل `uncertain`.
- كل صفحة في الدفعة تظل `decisionStatus = insufficient_data` و`decisionEligible = false`.

## E.T. the Extra-Terrestrial (1982)

- Catalog: `wd:Q11621`
- Editorial ID: `et-1982-editorial-batch-v1`
- المصادر: **3 مراجعات مستقلة**
  - Common Sense Media — `https://www.commonsensemedia.org/movie-reviews/et-the-extra-terrestrial`
  - Plugged In — `https://www.pluggedin.com/movie-reviews/et-the-extra-terrestrial-1982/`
  - Kids-In-Mind — `https://kids-in-mind.com/e/et.htm`
- تاريخ الوصول: `2026-08-13`
- الوقائع المتقاطعة: **5** — `fear`, `violence`, `language`, `substances`, `sexualContent`
- غير المحسوم: **5/10** — `bullying`, `discrimination`, `selfHarm`, `grief`, `flashingLights`

## Harry Potter and the Philosopher's Stone (2001)

- Catalog: `wd:Q102438`
- Editorial ID: `harry-potter-philosophers-stone-2001-editorial-batch-v1`
- المصادر: **4 مراجعات مستقلة**
  - Common Sense Media — `https://www.commonsensemedia.org/movie-reviews/harry-potter-and-the-sorcerers-stone`
  - Plugged In — `https://www.pluggedin.com/movie-reviews/harrypotterandthesorcerersstone/`
  - Kids-In-Mind — `https://kids-in-mind.com/h/harry_potter_and_the_sorcerers_stone_2001.htm`
  - Dove.org — `https://dove.org/review/3564-harry-potter-and-the-sorcerers-stone/`
- تاريخ الوصول: `2026-08-13`
- الوقائع المتقاطعة: **4** — `fear`, `violence`, `language`, `grief`
- غير المحسوم: **6/10** — `bullying`, `sexualContent`, `substances`, `discrimination`, `selfHarm`, `flashingLights`

## Minions (2015)

- Catalog: `wd:Q13619743`
- Editorial ID: `minions-2015-editorial-batch-v1`
- المصادر: **4 مراجعات مستقلة**
  - Common Sense Media — `https://www.commonsensemedia.org/movie-reviews/minions`
  - Plugged In — `https://www.pluggedin.com/movie-reviews/minions/`
  - Kids-In-Mind — `https://kids-in-mind.com/m/minions.htm`
  - Dove.org — `https://dove.org/review/11407-minions/`
- تاريخ الوصول: `2026-08-13`
- الوقائع المتقاطعة: **5** — `violence`, `fear`, `language`, `substances`, `sexualContent`
- غير المحسوم: **5/10** — `bullying`, `discrimination`, `selfHarm`, `grief`, `flashingLights`

## ملاحظات التنفيذ

- `tests/editorial-review.test.ts` يتحقق من استقلال المصادر وبقاء القرار غير مكتمل.
- `sitemap.xml` يدرج صفحات Editorial العامة.
- `Live Product Smoke` سيختبر كل فيلم من البحث إلى صفحة العنوان ثم صفحة التحليل.

بعد نجاح الأفلام الثلاثة على الإنتاج، نتوقف قبل إضافة بقية هدف 10–20 عنوانًا.
