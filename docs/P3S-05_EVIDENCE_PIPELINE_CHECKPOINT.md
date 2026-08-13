# P3S-05 — Evidence-based review pipeline

آخر تحديث: 13 أغسطس 2026

## الهدف

تغطية الأفلام والمسلسلات على موقع تجاري قابل للتوسع من غير توظيف فريق يشاهد كل عنوان، ومن غير إنشاء مراجعين وهميين لتمرير بوابات P2 القديمة.

## المبدأ التحريري الثابت

**«قبل المشاهدة» يعتمد على نفسه في المراجعة النهائية والقرار.**

المصدر الخارجي يقدم دليلًا فقط. لا تصبح Wikipedia أو أي جهة تصنيف أو نموذج AI «المراجع» ولا ننقل مراجعتها كحكمنا. الوقائع المنظمة، معايير الأسرة العربية، فحص التغطية/التعارض، والقرار النهائي كلها جزء من منهج «قبل المشاهدة».

لا يجوز الادعاء بأن إنسانًا شاهد نسخة من العمل إذا لم يحدث ذلك فعلًا.

## المصدر الأول المسموح للتحليل

### Wikipedia

- الاستخدام: `analysis_evidence` فقط.
- الرخصة المعتمدة: CC BY-SA 4.0.
- الاستخدام التجاري: مسموح بشرط الالتزام بالعزو وشروط الرخصة وShareAlike عندما ينطبق على مادة مشتقة منشورة.
- الاستدعاء: MediaWiki Action API الرسمي، لا scraping لواجهة الموقع.
- النطاق الحالي: `ar.wikipedia.org` و`en.wikipedia.org` فقط.
- كل دليل يثبت: page URL، revision id، revision timestamp، retrieved-at، SHA-256، license URL، attribution text، وpolicy snapshot.
- المقالة نص عابر للاستخراج، ولا تُحفظ على أنها مراجعة «قبل المشاهدة» ولا ننشر فقرات طويلة منها.
- صفحات missing/disambiguation/non-main namespace مرفوضة.
- `maxlag=1` وUser-Agent واضح؛ HTTP 429 وRetry-After لا يؤديان إلى retry عدواني داخل helper.

## ما يزال محظورًا

- TMDB بدون ترخيص تجاري مناسب.
- IMDb datasets/site/Parents Guide/User Reviews بدون ترخيص تجاري مناسب.
- Common Sense Media / Kids-In-Mind / DoesTheDogDie / Parents Guide مشابهة بدون إذن تجاري واضح.
- تحويل Wikidata catalog metadata إلى analysis evidence.
- صور posters/screenshots غير مرخصة.

## Workers AI

Production config يربط `AI`، والنموذج الأولي:

`@cf/meta/llama-3.1-8b-instruct-fast`

النموذج **ليس جهة ثقة ولا يملك سلطة نشر**. وظيفته extraction فقط.

### قواعد extraction

- JSON schema تحدد 10 محاور المحتوى الحالية.
- النموذج يستطيع إخراج `present` أو `uncertain` فقط.
- **`none` ممنوعة على النموذج**؛ غياب الذكر في prose لا يثبت غياب المحتوى.
- `present` يتطلب structured fact وlocator من الفقرة التي استند إليها (`P####`).
- `uncertain` لا تحمل facts ولا تغلق المحور.
- parser عندنا يعيد التحقق من exact keys، categories، enums، flags، severity، والـlocators؛ JSON Mode وحده لا يُعامل كضمان صحة.
- لا timestamps داخل الفيلم إذا لم يقدمها المصدر؛ تبقى `null` بدل اختراعها.
- لا age rating أجنبي يتحول إلى قرار عربي.
- الشدة تصف قوة الواقعة المذكورة، لا حكم الأسرة عليها.
- الفقرات تُقسم إلى chunks محدودة، بالتتابع، من غير silent truncation.

## فحص التغطية والتعارض

`assessEvidenceReview()` هو بوابة P3S-05 قبل الإنچين:

- محور بلا `present` أو `none` صريحة = `unknown` → `insufficient_data`.
- `uncertain` لا تعد تغطية.
- `present` بلا fact = blocking.
- fact مرتبطة بـ`none` أو `uncertain` = blocking.
- `present` مقابل `none` بين أدلة = `conflicted`.
- فرق شدة >= 2 بين مصادر evidence لنفس المحور = `conflicted`.
- evidence تخص version مختلفة = blocking.
- بيانات المصدر/URL/hash غير الصالحة = blocking.

لا يمر شيء إلى الإنچين إلا عندما تكون `engineEligible = true`.

## Candidate end-to-end

`buildWikipediaEvidenceReviewCandidate()` يربط:

1. Wikipedia API fetch.
2. CC BY-SA provenance.
3. Workers AI extraction.
4. strict parser.
5. coverage/conflict assessment.

الناتج يحمل دائمًا:

`publishable: false`

P3S-05 لا تنشر مراجعة عامة ولا تجعل bundle `verified`. بوابة النشر الجديدة ومسار snapshot العام تخص P3S-06 فقط.

## قاعدة المراجعين البشر

P2/P2Q لا تُحذف. تبقى مسار جودة يدوي/تصعيد للحالات المهمة أو النزاع. لكنها ليست شرطًا لتغطية آلاف الأعمال، ولا يتم إنشاء fake/synthetic reviewers لتمثيل AI أو Wikipedia.

## النشر الإنتاجي المطلوب قبل إغلاق P3S-05

- جميع unit/migration/lint/build checks خضراء.
- migration `0017_enable_wikipedia_analysis_evidence.sql` تنجح على D1 الحقيقية.
- D1 تصبح 20/20 migrations مع بقاء 27 product tables.
- remote source-policy verification يثبت وجود policyين فقط:
  - Wikidata / catalog / CC0.
  - Wikipedia / analysis_evidence / CC BY-SA 4.0 / attribution + ShareAlike.
- Wrangler deploy يعرض binding `env.AI` إضافة إلى DB/IMAGES/ASSETS.
- public smoke tests الحالية تبقى خضراء.

بعد ذلك فقط يبدأ P3S-06.
