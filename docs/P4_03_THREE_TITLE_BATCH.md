# P4-03 — دفعة Editorial Publication من 3 أفلام

تاريخ الإعداد: 13 أغسطس 2026

هذه الدفعة توسّع نفس مسار `Editorial Publication` الذي نجح مع Cars، من دون أي تعديل على بوابة الحكم الكاملة أو P3S-06.

## الحالة العددية

- baseline المنشور والمتحقق إنتاجيًا قبل هذه الدفعة: **Cars (2006) = 1 صفحة**.
- هذه الدفعة: **3 أفلام**.
- إجمالي سجلات editorial بعد تطبيق الدفعة في الـregistry: **4**.
- لا تُحتسب الأفلام الثلاثة الجديدة production-verified إلا بعد merge + Cloudflare deploy + Live Product Smoke لكل فيلم.
- `P4-03` تظل مفتوحة بعد هذه الدفعة؛ لا يبدأ باقي cohort الـ10–20 قبل مراجعة جودة الصفحات والمصادر.

## معيار الاختيار

تم الاختيار من داخل كتالوج Wikidata/D1 ذي الـ200 عنوان، مع أولوية **وفرة المصادر المستقلة القابلة للاستخدام لاستخراج الوقائع** وليس الشهرة وحدها.

العناوين:

1. `E.T. the Extra-Terrestrial` (1982) — `wd:Q11621`.
2. `Harry Potter and the Philosopher's Stone` (2001) — `wd:Q102438`.
3. `Minions` (2015) — `wd:Q13619743`.

## قواعد الدفعة

- لا نخزن نص مراجعة أو excerpt أو quote أو ترجمة أو paraphrase قريبة.
- كل claim مكتوبة بالعربية من الصفر كخلاصة واقعة.
- كل source record يحفظ publisher، النوع، URL، تاريخ الوصول، independence group، وclaim IDs المدعومة.
- `corroborated` لا تمر إلا بمصدرين مستقلين على الأقل.
- المحور غير المغطى بما يكفي يبقى `uncertain`.
- silence أو خانة «غير موجود» في مصدر واحد لا تتحول إلى `none` عام.
- كل الصفحات في هذه الدفعة تفرض:

```text
decisionEligible = false
decisionStatus = insufficient_data
```

## E.T. the Extra-Terrestrial (1982)

Editorial ID: `et-1982-editorial-batch-v1`

المصادر المستخدمة:

- Common Sense Media — `published_review` — `https://www.commonsensemedia.org/movie-reviews/et-the-extra-terrestrial`
- Plugged In — `published_review` — `https://www.pluggedin.com/movie-reviews/et-the-extra-terrestrial-1982/`
- BBFC — `official_classification` — `https://www.bbfc.co.uk/release/e-t-the-extra-terrestrial-q29sbgvjdglvbjpwwc0zmdgynjy`
- Kids-In-Mind — `published_review` — `https://kids-in-mind.com/e/et.htm`

تاريخ الوصول لكل المصادر: `2026-08-13`.

الوقائع المنشورة: **5 corroborated claims**:

- `fear`: مطاردات/احتجاز/مرض ولحظات فقدان مؤقت ترفع التوتر.
- `violence`: مطاردة واحتجاز ومحاولات منع الهرب؛ لا نعمم تفاصيل الأسلحة بسبب اختلاف الإصدارات.
- `language`: ألفاظ وشتائم وإهانات متفرقة.
- `substances`: شرب بيرة وسلوك مخمور، مع ظهور تدخين في بعض التغطيات.
- `sexualContent`: قبلة قصيرة في المدرسة مرتبطة بمشهد تلفزيوني داخل القصة.

المحاور `uncertain`: **5/10** — `bullying`, `discrimination`, `selfHarm`, `grief`, `flashingLights`.

## Harry Potter and the Philosopher's Stone (2001)

Editorial ID: `harry-potter-philosophers-stone-2001-editorial-batch-v1`

المصادر المستخدمة:

- Common Sense Media — `published_review` — `https://www.commonsensemedia.org/movie-reviews/harry-potter-and-the-sorcerers-stone`
- Plugged In — `published_review` — `https://www.pluggedin.com/movie-reviews/harrypotterandthesorcerersstone/`
- BBFC — `official_classification` — `https://www.bbfc.co.uk/release/harry-potter-and-the-philosophers-stone-q29sbgvjdglvbjpwwc0zmzm2odi`
- Kids-In-Mind — `published_review` — `https://kids-in-mind.com/h/harry_potter_and_the_sorcerers_stone_2001.htm`
- Dove.org — `published_review` — `https://dove.org/review/3564-harry-potter-and-the-sorcerers-stone/`

تاريخ الوصول لكل المصادر: `2026-08-13`.

الوقائع المنشورة: **4 corroborated claims**:

- `fear`: مخلوقات ومطاردات ومواقف خطر ومواجهة خيالية نهائية.
- `violence`: قتال فانتازي، شطرنج بالحجم الطبيعي، ومواجهة ينتهي فيها خصم بصورة غير واقعية.
- `language`: عدة جهات تسجل ألفاظًا خفيفة، مع اختلاف في threshold بين المصادر.
- `grief`: موت والدي Harry وإشارات متكررة إلى مقتلهما وتضحية الأم.

المحاور `uncertain`: **6/10** — `bullying`, `sexualContent`, `substances`, `discrimination`, `selfHarm`, `flashingLights`.

## Minions (2015)

Editorial ID: `minions-2015-editorial-batch-v1`

المصادر المستخدمة:

- Common Sense Media — `published_review` — `https://www.commonsensemedia.org/movie-reviews/minions`
- Plugged In — `published_review` — `https://www.pluggedin.com/movie-reviews/minions/`
- BBFC — `official_classification` — `https://www.bbfc.co.uk/release/minions-q29sbgvjdglvbjpwwc00nzm5ody`
- Kids-In-Mind — `published_review` — `https://kids-in-mind.com/m/minions.htm`
- Dove.org — `published_review` — `https://dove.org/review/11407-minions/`

تاريخ الوصول لكل المصادر: `2026-08-13`.

الوقائع المنشورة: **5 corroborated claims**:

- `violence`: عنف كرتوني وحوادث وانفجارات وضرب وتهديدات وأدوات تعذيب كوميدية.
- `fear`: مواقف تهديد وخطر قريب من الموت تقدم غالبًا في إطار ساخر.
- `language`: إهانات وألفاظ خفيفة متفرقة من الشخصيات البشرية.
- `substances`: ثلاثة مصادر مستقلة تسجل مشروبات كحولية؛ يوجد اختلاف في تصنيف جهة أخرى، لذلك نثبت الظهور فقط ولا نستنتج حكمًا.
- `sexualContent`: نكات بصرية خفيفة حول الملابس الداخلية/الأرداف والعري الكرتوني غير المفصل وبعض الغزل.

المحاور `uncertain`: **5/10** — `bullying`, `discrimination`, `selfHarm`, `grief`, `flashingLights`.

## الاختبارات المطلوبة قبل الدمج

- registry = Cars + 3 فقط.
- كل publication تمر `assessEditorialReviewPublication()` لكنها تظل غير مؤهلة للحكم.
- كل `corroborated` claim لها ≥2 independence groups.
- source records لا تحتوي حقول source expression.
- تغيير partial publication لمحاولة إصدار حكم يجعل validator يفشل.
- route العام يحتفظ بقاعدة locator واحدة فقط؛ mixed locator يفشل مغلقًا.
- sitemap يدرج صفحات editorial العامة.
- Live Product Smoke بعد النشر يختبر كل فيلم: search → title → editorial review، ثم mixed locator.

## شرط التوقف

بعد نجاح الأفلام الثلاثة على الإنتاج، **نتوقف** ولا نضيف بقية 10–20 عنوانًا. الخطوة التالية مراجعة جودة الصفحات والمصادر يدويًا قبل أي توسع جديد.
