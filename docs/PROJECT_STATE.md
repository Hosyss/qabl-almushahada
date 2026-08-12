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
- فتح بلاغ جوهري ذري يوقف النتيجة ويحوّل الحزمة إلى `conflicted` ويسقط الاعتماد الحالي من غير حذف التاريخ.

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

## P2-04 — revisions غير قابلة للمحو — مكتمل على main

- مسار إعادة الإرسال لم يعد يمسح `observations` أو `review_category_checks` أو `observation_flags` ولم يعد يعمل UPSERT فوق نفس `review_submission`.
- كل إرسال جديد ينشئ `review_submissions` جديدًا بمعرّف جديد و`revision` متزايد و`supersedes_submission_id` يشير مباشرة إلى revision السابقة لنفس assignment.
- `review_assignments.submission_id` هو المؤشر الوحيد للمراجعة الحالية؛ المحرك يقرأ هذا المؤشر ولا يخلط revisions القديمة في القرار.
- SQLite يفرض lineage المراجعات ويتحقق من تطابق assignment مع bundle/version/reviewer، ويرفض القفز فوق revision سابقة.
- SQLite يمنع `UPDATE` و`DELETE` على `review_submissions` وعلى category checks والوقائع والflags المرتبطة بها؛ التصحيح يكون revision جديدة فقط.
- الاعتماد التحريري append-only أيضًا: كل اعتماد جديد يحصل على `revision` متزايد و`supersedes_approval_id` مباشر.
- `review_bundles.current_approval_id` يشير إلى الاعتماد التحريري الحالي فقط، بينما كل الاعتمادات السابقة تبقى محفوظة.
- SQLite يمنع `UPDATE` و`DELETE` على الاعتمادات وروابط submissions وspot checks القديمة ويتحقق من lineage.
- migration `0005_immutable_review_revisions.sql` رفعت العدد وقتها إلى 6 migrations / 17 جدولًا.
- P2-04 مدموج على `main` في commit `d32434356eeae46e51c0547fd46f430fa350e0a5`، وCI الخاص بـmain نجح في الاختبارات والمigrations والlint والbuild.

## P2-05 — حسم البلاغ والتصحيح وإعادة الاعتماد — مكتمل على main

- البلاغ الجوهري لا يُفتح إلا على حزمة `verified` لها `current_approval_id` فعلية؛ لا يمكن تعليق workflow ما زال تحت المراجعة ببلاغ عام.
- عند الفتح يلتقط D1 server-side snapshot غير قابل للتزوير: `version_id`، حالة الحزمة، revision، والاعتماد الحالي الذي تم إبطاله. المتصفح لا يحدد هذه القيم.
- snapshot لا تُقبل إلا إذا طابقت نفس النسخة ونفس revision ونفس أحدث approval معتمدة لحظة الفتح؛ أي snapshot مزورة تُرفض في SQLite.
- فتح البلاغ يحوّل الحزمة إلى `conflicted` ويجعل `current_approval_id = NULL` فورًا من غير حذف approval التاريخية.
- لا يسمح بأكثر من بلاغ `open/investigating` واحد للحزمة، ولا يسمح بإنشاء editorial approval جديدة أثناء وجود بلاغ نشط.
- `open` و`investigating` فقط يدخلان `blockingReports` في الإنچين؛ `resolved` و`dismissed` لا يظلان مانعًا دائمًا بعد الحسم الصحيح.
- حسم البلاغ محصور في `editorial_reviewer` نشط بهوية reviewer نشطة؛ هوية الفاعل تأتي من session/D1، والطلب يرفض أي server-owned fields مزورة.
- مسار `no_issue` يعيد **نفس الاعتماد الذي أبطله البلاغ** فقط إذا بقيت الحزمة والنسخة والrevisions كما كانت متوقعة؛ أي تغيير متزامن يوقف الاستعادة.
- مسار `correction_required` للنسخة نفسها يعيد كل assignments المعتمدة إلى `changes_requested`، فيجبر المراجعين على submission revisions جديدة ثم اعتماد تحريري revision جديدة.
- إذا كان البلاغ `different_version` وثبتت صحته، تُحوّل الحزمة إلى `withdrawn` بدل تعديل الوقائع تحت هوية نسخة خاطئة.
- بعد تصحيح مؤكد، SQLite تمنع إعادة approval التي أُبطلت، وتمنع تعيين أي approval تاريخية أقدم كـcurrent؛ `current_approval_id` يجب أن تكون أحدث revision حالية وحالتها `approved`.
- أي محاولة لإرجاع الحزمة `verified` من غير current editorial approval تُرفض في SQLite.
- `review_reports` أصبحت ذات revision lock وهوية/snapshot غير قابلة للتغيير، والبلاغات المحسومة لا يمكن تعديلها أو حذفها.
- migration `0006_report_resolution_reapproval.sql` رفعت الإجمالي إلى **7 migrations / 17 جدولًا**.
- `tests/report-resolution.test.ts` + `scripts/verify-report-resolution.mjs` يغطيان الصلاحيات، mass-assignment، snapshots المزورة، منع البلاغ المكرر، immutable resolution، approval freeze، latest-current guard، وإجبار approval جديدة بعد التصحيح.
- P2-05 مدموجة على `main` في commit `16a6a844f9636373df83a44204579e0164ae9cd8` عبر PR #8.
- CI #142 على `main` بعد الدمج اجتاز **78/78 اختبارًا، 0 فشل**، ومعه `test:migrations`, `lint:local`, `build:local` كلها ناجحة.

## Cloudflare — إعداد الإنتاج

- الهدف النهائي Cloudflare Workers + D1 من نفس المستودع؛ راجع `docs/CLOUDFLARE_DEPLOYMENT.md`.
- `vite.config.ts` يفصل preview المحلي عن production: الـplaceholder D1 لا يُستخدم عندما يُمرر `CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH`.
- `scripts/prepare-cloudflare-deploy.mjs` يولد config إنتاج داخل `.wrangler/production/` بعد التحقق من D1 UUID/Name الحقيقيين؛ placeholder المحلي مرفوض.
- config الإنتاج يربط `DB` و`IMAGES` ويستخدم `nodejs_compat` وWorkers observability.
- Cloudflare Access اختياري في أول نشر عام؛ إذا لم يُضبط لا توضع vars داخل Worker، وبالتالي `/internal` يفشل مغلقًا بينما `/` و`/review` يمكن نشرهما.
- عند تفعيل Access يجب تمرير Team Domain وAUD معًا؛ bootstrap admin اختياري لأول مرة فقط.
- أضيفت أوامر `cloudflare:prepare`, `cloudflare:build`, `cloudflare:migrate`, `cloudflare:deploy`، ولا تنسخ API token أو Account ID إلى Worker config.
- اختبارات Cloudflare config تغطي منع placeholder، اكتمال Access pair، عدم تسريب credentials، وربط D1/Images.
- **لم يحدث remote deploy بعد** لأن الجلسة لا تملك Cloudflare API/CLI authentication متصلًا لإنشاء D1 حقيقي أو تنفيذ `wrangler deploy`. لا يوجد URL Cloudflare جديد يجوز ادعاؤه قبل ذلك.

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

1. التالي: `P2Q-01` **حرج / Work** — تدقيق عشوائي غير قابل للتوقع مع رفع العينة للحالات عالية المخاطر.
2. عند توفر Cloudflare authentication: إنشاء D1 حقيقي لهذا المشروع، تطبيق migrations، deploy إلى Worker، اختبار URL الفعلي، ثم إعداد Access للمسارات الداخلية.
3. أعمال الواجهة الخفيفة والبحث وربط البيانات العامة تبقى مؤجلة حسب ROADMAP ولا تسبق checkpoints الثقة الحرجة.

راجع `docs/ENGINE_TRUST_MODEL.md` و`docs/CLOUDFLARE_DEPLOYMENT.md` قبل أي تعديل في الثقة أو النشر.
