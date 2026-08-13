# P4-03 — Source qualification for the first real review cohort

تاريخ الفحص: 13 أغسطس 2026

هذا الفحص مكمل لـ`P4_03_FIRST_REVIEW_PILOT.md`. هدفه إيجاد مصدر قانوني وقابل للتتبع يستطيع إغلاق coverage فعلًا لأول مراجعة production من غير تحويل الصمت إلى `none` ومن غير نسخ قاعدة مراجعات تجارية بلا إذن.

## النتيجة التنفيذية

حتى تاريخ الفحص، **لا يوجد ضمن المصادر المجانية المؤهلة حاليًا مصدر واحد أو تركيبة مصادر مثبتة تستطيع إغلاق المحاور العشرة كلها لعمل حديث مثل `Cars` مع هوية نسخة دقيقة**.

هذا يعني أن `P4-03` ما زالت blocked على **مصدر evidence شامل + exact version identity**، وليس على نقص في كود بوابة النشر.

لا نخفف coverage gate ولا نغيّر taxonomy للوصول إلى رقم 10–20.

## المصادر التي أُعيد فحصها

### Wikipedia — يبقى مسموحًا، لكنه غير شامل

- الترخيص الحالي: CC BY-SA 4.0 وفق policy المشروع.
- مناسب لإثبات `present` عندما توجد فقرة/locator واضحة.
- غير مناسب لإثبات `none` بمجرد غياب الذكر.
- النتيجة: **approved partial evidence only**؛ لا يغلق cohort وحده.

### Wikimedia Commons — قانونيًا مفيد لكل ملف على حدة

- قد يوفر ملف فيلم كامل حرًا أو public-domain مع checksum ومدة ثابتة، وبالتالي يمكنه حل exact-version identity لبعض الأعمال القديمة.
- لا يجوز تعميم ترخيص ملف على ملف آخر.
- pipeline الحالي لا يحلل فيديو كاملًا ولا يدّعي 95% مشاهدة من frame sampling.
- أغلب cohort المقصود أعمال عائلية حديثة وليست ملفات أفلام حرة على Commons.
- النتيجة: **qualified only for per-file future experiments**؛ لا يحل `Cars` أو cohort الحديث الآن.

### BBFC — جودة عالية، لكنه ليس مصدرًا مجانيًا مفتوحًا لنا

تمت مراجعة:

- Website Terms & Conditions: `https://www.bbfc.co.uk/website-terms-and-conditions`
- VOD / data licensing: `https://www.bbfc.co.uk/using-a-bbfc-age-rating/vod-and-streaming-services`

الصفحات العامة تعرض version/use/runtime وextended content advice وقد تشمل flashing/flickering lights، لكن:

- شروط الموقع تحفظ حقوق النص والمعلومات وتمنع إعادة الإنتاج دون إذن صريح.
- خدمات قواعد بيانات الأفلام التي تعرض BBFC ratings/associated data مطالبة بتوقيع Data Service Agreement حتى لو لم يصلها feed مباشر من BBFC.
- عدم ظهور محور في content advice لا يثبت بالضرورة غيابه المطلق وفق معيارنا.

النتيجة: **blocked for automated/commercial evidence without the required agreement/permission**, وحتى مع الاتفاق لا نعتمد silence كـ`none`.

### Australian Classification — مصدر رسمي مفيد، لكنه لا يغلق محاورنا

تمت مراجعة صفحات Australian Classification الرسمية. نظام consumer advice يركز عادة على **العناصر الأكثر تأثيرًا وتكرارًا**، ويذكر ستة عناصر تصنيف رئيسية: themes, violence, language, drug use, nudity, sex.

هذا جيد كمرجع رسمي، لكنه:

- لا يغطي taxonomy العشرة الخاصة بنا واحدًا لواحد.
- عدم ذكر عنصر ليس إثباتًا تلقائيًا لعدم وجوده.
- لم نعتمد ترخيص إعادة استخدام تجاري شامل لبيانات NCD ضمن policy المشروع أثناء هذا الفحص.

النتيجة: **manual reference only / not approved as exhaustive evidence**.

### New Zealand Classification Office — محتوى وصفي قوي لكن الترخيص والشمول غير كافيين

صفحات Quick Takes قد تذكر بوضوح violence, bullying/cruelty, suicide, drug use, language وغيرها، وبعضها يعطي runtime/language. لكن:

- لم نجد تصريحًا عامًا على صفحات ratings يجعل كل محتوى قاعدة التصنيف CC-licensed للاستخدام التجاري؛ وجود تقارير بحثية منفردة تحت CC BY 4.0 لا يرخّص قاعدة ratings كلها.
- الصفحات لا تمثل checklist صريحة لكل محاورنا العشرة.

النتيجة: **manual reference only / not approved for automated commercial ingestion**.

### Figshare MPAA reasons dataset — الرخصة مفتوحة لكن الدلالة غير كافية

Dataset `Reasons for film MPAA ratings of PG or higher, 1991-2013` منشور تحت CC BY 4.0، ويعطي True/False لأسباب rating في violence/sex/drugs/language.

لكن `False` يعني أن العنصر لم يُذكر كسبب للتصنيف، **وليس أن العنصر غير موجود في الفيلم**. الأدبيات نفسها توضح أن rating reasons لا تلتقط كل أنواع المحتوى، خصوصًا substances.

النتيجة: **not valid for `none` assertions**.

### IMDb Parents Guide / licensed IMDb data

IMDb يوفر Parents Guide severity data تجاريًا عبر AWS Marketplace بخمس فئات رئيسية، وقد تكون القيمة `None/Mild/Moderate/Severe` عندما تتوفر.

لكن:

- الـIMDb public datasets ليست مسارًا تجاريًا مجانيًا للمشروع.
- المنتج المرخص ليس ضمن تكاملنا الحالي.
- خمس فئات لا تغطي taxonomy العشرة كاملة وحدها.

النتيجة: **possible future licensed supplement, not a current solution**.

## exact version identity

لكي ننشر evidence review حقيقية، لا يكفي وجود سنة الإصدار أو runtime عامة للعنوان.

المسارات المقبولة:

1. نسخة فعلية لها platform/language/runtime/cut identity موثقة وبصمة مستقرة حقيقية؛ أو
2. ملف وسائط قانوني محدد يمكن حفظ checksum حقيقي له؛ أو
3. آلية version identity جديدة تُصمم وتُراجع صراحة ولا تدّعي أنها content hash إن لم تكن كذلك.

لا ننشئ `content_fingerprint` من title/year/runtime فقط لمجرد اجتياز الـschema.

## القرار العملي لـP4-03

المسار القصير المتاح حاليًا واحد من الآتي:

1. **Licensed exhaustive evidence provider** يغطي المحاور المطلوبة مع شروط استخدام تجاري صريحة؛ أو
2. **Human-watch path P2/P2Q** بمراجعين مستقلين حقيقيين لنسخة محددة؛ أو
3. مسار مستقل لاحق لتحليل **ملف فيلم حر كامل** مع coverage مثبتة فعليًا، وليس sampling يوصف خطأً كمشاهدة كاملة.

حتى يتحقق أحد هذه المسارات، يبقى `Cars` = `insufficient_data` ولا يُنشر كـreview.

## ما لم نفعله

- لم نضع scraper على BBFC أو IMDb أو مواقع Parents Guide.
- لم نحول rating reasons إلى `none`.
- لم نستخدم غياب الذكر كدليل.
- لم نختلق version fingerprint.
- لم نخفض عدد المحاور المطلوبة.
- لم ننشر أي review فقط لإظهار تقدم عددي.
