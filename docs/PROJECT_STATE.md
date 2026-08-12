# حالة مشروع «قبل المشاهدة»

آخر تحديث: 12 أغسطس 2026

## الرؤية الحالية

منتج عربي مستقل يساعد الأسرة على اتخاذ قرار مشاهدة مفسَّر ومخصص، لا مجرد تقييم عمري أو درجة عامة.

مسار القرار المتفق عليه:

1. مراجعة بشرية لنسخة محددة: منصة، لغة، موسم/حلقة، وتاريخ.
2. تسجيل وقائع منظمة: المحور، الشدة، التكرار، السياق، والتوقيت التقريبي.
3. فحوص جودة وتعارض قبل اعتماد البيانات.
4. تطبيق حدود الأسرة آليًا على الوقائع المعتمدة.
5. عرض القرار والسبب ودرجة الثقة وحالة البيانات.
6. عند نقص معلومة أساسية: «البيانات غير كافية».

## ما تم تنفيذه

- هوية «قبل المشاهدة» واتجاه عربي كامل وصفحة رئيسية متجاوبة.
- Hero عائلي برسمة أشجار، بحث تجريبي، اقتراحات قابلة للنقر، وحدود أسرة تفاعلية.
- صفحة `/review` الكاملة مع وضع «من غير حرق»، المحاور، الوقائع، التوقيتات، سبب القرار، وحالة النسخة.
- نواة إنچين قرار TypeScript مستقلة عن الواجهة، مع fail-safe يعيد `insufficient_data` عند نقص أو تعارض.
- بوابات جودة تمنع المصدر الواحد، مجموعات الاستقلال غير الكافية، `uncertain`، اختلاف وجود المحور، وفروق الشدة الكبيرة.
- محوّل صارم من صفوف D1 إلى schema الإنچين؛ القيم المجهولة تُرفض.
- نشر ذري بقفل `revision` و`transition ID` وسجل تدقيق.
- فتح بلاغ جوهري ذري يوقف النتيجة ويحوّل الحزمة إلى `conflicted`.

## P2-02 — مكتمل على main

- أدوار أقل صلاحية منفصلة: `admin`، `review_coordinator`، `reviewer`، `editorial_reviewer`، وAdmin لا يرث صلاحيات الأدوار الأخرى.
- bootstrap/provisioning للحسابات محميان server-side، والخادم يولد هوية reviewer ولا يقبل `reviewerId` من المتصفح.
- المنسق يوزع المهمة باستخدام بريد حساب داخلي؛ reviewer والنسخة يُحلان من D1 والـbundle على الخادم.
- SQLite triggers تمنع تبديل bundle/version/reviewer بعد إنشاء المهمة.
- حفظ المسودة والإرسال يستخدمان optimistic revision locking؛ لا يوجد `assigned → submitted` مباشر.
- الإرسال النهائي يقفل المهمة ويكتب نفس schema الذي يستهلكه الإنچين ويرفع revision الحزمة.
- validation النهائي يرفض تغطية أقل من 95%، المحاور الناقصة/`uncertain`، التناقضات، enums/flags المجهولة، التوقيت الخاطئ وmass assignment.
- `request changes` و`conflicted` لا ينفذهما إلا معتمد تحريري مستقل مع revision lock وسجل تدقيق.
- الاعتماد التحريري يشغّل `assessReviewQuality` قبل الكتابة ويغطي كل المراجعات الحالية وspot checks وبصمة النسخة.
- إعادة تفعيل الحساب الموقوف ممنوعة fail-closed حتى وجود سياسة معايرة/استئناف في P2Q.
- `internal_audit_events` و`review_audit_events` append-only على مستوى SQLite.
- 5 migrations تنشئ 17 جدولًا.
- المصادقة الداخلية مستقلة عن الاستضافة: `INTERNAL_AUTH_MODE` إجباري، ووضع Cloudflare Access يتحقق من JWT RS256 وissuer/audience/expiry قبل الثقة في البريد.
- `/internal` مكتملة حسب الدور: Admin / Coordinator / Reviewer / Editorial، مع نموذج مراجع منظم وقراءة D1 مقيدة على الخادم.
- `P2-02` دُمج كاملًا إلى `main` في commit `b10ff7a95bc2048a888fdb7b47f7e091fa7b7bee`، وCI على `main` نجح في الاختبارات والمigrations والlint والproduction build.

## Cloudflare — إعداد الإنتاج

- الهدف النهائي Cloudflare Workers + D1 من نفس المستودع؛ راجع `docs/CLOUDFLARE_DEPLOYMENT.md`.
- `vite.config.ts` يفصل الآن preview المحلي عن production: الـplaceholder D1 لا يُستخدم عندما يُمرر `CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH`.
- `scripts/prepare-cloudflare-deploy.mjs` يولد config إنتاج داخل `.wrangler/production/` بعد التحقق من D1 UUID/Name الحقيقيين؛ placeholder المحلي مرفوض.
- config الإنتاج يربط `DB` و`IMAGES` ويستخدم `nodejs_compat` وWorkers observability.
- Cloudflare Access اختياري في أول نشر عام؛ إذا لم يُضبط لا توضع vars داخل Worker، وبالتالي `/internal` يفشل مغلقًا بينما `/` و`/review` يمكن نشرهما.
- عند تفعيل Access يجب تمرير Team Domain وAUD معًا؛ bootstrap admin اختياري لأول مرة فقط.
- أضيفت أوامر `cloudflare:prepare`, `cloudflare:build`, `cloudflare:migrate`, `cloudflare:deploy`، ولا تنسخ API token أو Account ID إلى Worker config.
- اختبارات Cloudflare config تغطي منع placeholder، اكتمال Access pair، عدم تسريب credentials، وربط D1/Images.
- آخر CI على فرع إعداد Cloudflare نجح في `test:engine`, `test:migrations`, `lint:local`, `build:local`.
- **لم يحدث remote deploy بعد** لأن أدوات هذه الجلسة لا تحتوي Cloudflare API/CLI authentication متصلًا لإنشاء D1 جديد أو تنفيذ `wrangler deploy`. لا يوجد URL Cloudflare جديد يجوز ادعاؤه قبل تنفيذ ذلك والحصول على الرابط الحقيقي.

## ما يزال تجريبيًا أو مؤجلًا

- البحث لا يتصل بقاعدة عناوين حقيقية.
- أسماء الأعمال والوقائع المعروضة للعامة أمثلة تصميمية وليست مراجعات منشورة.
- إعدادات الأسرة تعيش داخل حالة الصفحة فقط.
- زر الإبلاغ الظاهر في الواجهة العامة غير موصول بخدمة فتح البلاغ.
- لا توجد بيانات إنتاج حقيقية.
- تفعيل/معايرة المراجعين ضد مجموعة مرجعية لم يبدأ بعد.

## الروابط الحالية

- المستودع: `https://github.com/Hosyss/qabl-almushahada`
- الموقع المنشور القديم: `https://qabl-almushahada.hosys.chatgpt.site`
- الرابط القديم لا يحتوي آخر P2-02 ولا يُعتبر نشر Cloudflare النهائي.

## نقطة البدء التالية

1. دمج checkpoint إعداد Cloudflare الإنتاج إلى `main` بعد CI النهائي.
2. عند توفر Cloudflare authentication: إنشاء D1 جديد لهذا المشروع، تطبيق migrations، deploy إلى Worker جديد، اختبار URL الفعلي، ثم إعداد Access للمسارات الداخلية.
3. بالتوازي بعد حفظ checkpoint: `P2-03` **حرج / Work** — قواعد صريحة للمراجعة الثالثة في المحاور عالية الحساسية.
4. لا تبدأ تلميعًا بصريًا عامًا قبل حفظ checkpoint الأمني التالي.

راجع `docs/P2-02_SECURITY_MODEL.md` و`docs/CLOUDFLARE_DEPLOYMENT.md` قبل أي تعديل في المصادقة أو النشر.
