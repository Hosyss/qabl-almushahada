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
- validation النهائي يرفض تغطية أقل من 95%، المحاور الناقصة/`uncertain`، التناقضات، enums/flags المجهولة، التوقيت الخاطئ وmass assignment.
- الاعتماد التحريري يشغّل `assessReviewQuality` قبل الكتابة ويغطي كل المراجعات الحالية وspot checks وبصمة النسخة.
- إعادة تفعيل الحساب الموقوف ممنوعة fail-closed حتى وجود سياسة معايرة/استئناف في P2Q.
- `internal_audit_events` و`review_audit_events` append-only على مستوى SQLite.
- المصادقة الداخلية مستقلة عن الاستضافة: `INTERNAL_AUTH_MODE` إجباري، ووضع Cloudflare Access يتحقق من JWT RS256 وissuer/audience/expiry قبل الثقة في البريد.
- `/internal` مكتملة حسب الدور: Admin / Coordinator / Reviewer / Editorial، مع نموذج مراجع منظم وقراءة D1 مقيدة على الخادم.

## P2-03 — المراجعة الثالثة حسب المخاطر

- أضيفت سياسة مخاطر مستقلة deterministic في `lib/review-engine/risk-policy.ts`؛ لا توجد heuristics مخفية أو AI يقرر متى نطلب المراجع الثالث.
- القاعدة العامة تبقى مراجعَين نشطَين مستقلَين على الأقل للحالات العادية.
- يرتفع الحد إلى **3 مراجعين نشطين من 3 مجموعات استقلال مختلفة** عند أي من الآتي:
  - أي واقعة severity = 4 في أي محور.
  - `selfHarm` من severity 1.
  - `sexualContent` أو `flashingLights` من severity 2.
  - `violence` أو `substances` أو `discrimination` أو `bullying` من severity 3.
  - flag `flashing_sequence` من severity 1.
  - flags `blood` أو `weapon` أو `physical_bullying` من severity 3.
- النقص في المراجع الثالث ينتج blocking issue باسم `THIRD_REVIEW_REQUIRED`، ونقص مجموعة استقلال ثالثة ينتج `THIRD_INDEPENDENT_REVIEW_REQUIRED`.
- `decideForFamily` و`preparePublication` والاعتماد التحريري server-side كلها تمر عبر نفس risk-gated quality function.
- المراجع الموقوف أو غير النشط لا يحتسب ضمن شرط الثلاثة.
- checkpoint P2-03 المدموج على main اجتاز 72/72 اختبارًا، و`test:migrations` و`lint:local` و`build:local`.

## P2-04 — revisions غير قابلة للمحو

- مسار إعادة الإرسال لم يعد يمسح `observations` أو `review_category_checks` أو `observation_flags` ولم يعد يعمل UPSERT فوق نفس `review_submission`.
- كل إرسال جديد ينشئ `review_submissions` جديدًا بمعرّف جديد و`revision` متزايد و`supersedes_submission_id` يشير مباشرة إلى revision السابقة لنفس assignment.
- `review_assignments.submission_id` هو المؤشر الوحيد للمراجعة الحالية؛ المحرك يقرأ هذا المؤشر ولا يخلط revisions القديمة في القرار.
- SQLite يفرض lineage المراجعات ويتحقق من تطابق assignment مع bundle/version/reviewer، ويرفض القفز فوق revision سابقة.
- SQLite يمنع `UPDATE` و`DELETE` على `review_submissions` وعلى category checks والوقائع والflags المرتبطة بها؛ التصحيح يكون revision جديدة فقط.
- الاعتماد التحريري أصبح append-only أيضًا: كل اعتماد جديد يحصل على `revision` متزايد و`supersedes_approval_id` مباشر.
- `review_bundles.current_approval_id` يشير إلى الاعتماد التحريري الحالي فقط، بينما كل الاعتمادات السابقة تبقى محفوظة.
- loader العام يقرأ الاعتماد الحالي من `current_approval_id` فقط؛ هذا يسمح لاحقًا في P2-05 بإسقاط الاعتماد الحالي عند تصحيح جوهري من غير محو أي تاريخ.
- SQLite يمنع `UPDATE` و`DELETE` على الاعتمادات وروابط submissions وspot checks القديمة، ويتحقق أن `current_approval_id` تابع لنفس الحزمة.
- migration `0005_immutable_review_revisions.sql` رفعت العدد إلى **6 migrations** مع بقاء **17 جدولًا**؛ لا نحتاج جدولًا إضافيًا لأن lineage محفوظ داخل الصفوف نفسها.
- `scripts/verify-migrations.mjs` يثبت أن revisions القديمة غير قابلة للتعديل/الحذف، وأن revision 2 يجب أن تشير مباشرة إلى revision 1، ويرفض lineage المزورة للمراجعات والاعتمادات.
- آخر CI على فرع P2-04 اجتاز `test:engine`, `test:migrations`, `lint:local`, `build:local` بنجاح. لا يُعتبر P2-04 مدموجًا إلى main قبل إتمام PR وCI الخاص به.

## Cloudflare — إعداد الإنتاج

- الهدف النهائي Cloudflare Workers + D1 من نفس المستودع؛ راجع `docs/CLOUDFLARE_DEPLOYMENT.md`.
- `vite.config.ts` يفصل preview المحلي عن production: الـplaceholder D1 لا يُستخدم عندما يُمرر `CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH`.
- `scripts/prepare-cloudflare-deploy.mjs` يولد config إنتاج داخل `.wrangler/production/` بعد التحقق من D1 UUID/Name الحقيقيين؛ placeholder المحلي مرفوض.
- config الإنتاج يربط `DB` و`IMAGES` ويستخدم `nodejs_compat` وWorkers observability.
- Cloudflare Access اختياري في أول نشر عام؛ إذا لم يُضبط لا توضع vars داخل Worker، وبالتالي `/internal` يفشل مغلقًا بينما `/` و`/review` يمكن نشرهما.
- عند تفعيل Access يجب تمرير Team Domain وAUD معًا؛ bootstrap admin اختياري لأول مرة فقط.
- أضيفت أوامر `cloudflare:prepare`, `cloudflare:build`, `cloudflare:migrate`, `cloudflare:deploy`، ولا تنسخ API token أو Account ID إلى Worker config.
- اختبارات Cloudflare config تغطي منع placeholder، اكتمال Access pair، عدم تسريب credentials، وربط D1/Images.
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
- الرابط القديم لا يحتوي آخر سير العمل ولا يُعتبر نشر Cloudflare النهائي.

## نقطة البدء التالية

1. إتمام PR وCI ودمج checkpoint `P2-04` إلى `main`.
2. التالي بعد الدمج: `P2-05` **حرج / Work** — حسم البلاغات والتصحيح المرتبط بالنسخة وإجبار اعتماد جديد بعد التعديل الجوهري.
3. عند توفر Cloudflare authentication: إنشاء D1 جديد لهذا المشروع، تطبيق migrations، deploy إلى Worker جديد، اختبار URL الفعلي، ثم إعداد Access للمسارات الداخلية.
4. لا تبدأ تلميعًا بصريًا عامًا قبل حفظ checkpoint الأمني التالي.

راجع `docs/ENGINE_TRUST_MODEL.md` و`docs/CLOUDFLARE_DEPLOYMENT.md` قبل أي تعديل في الثقة أو النشر.
