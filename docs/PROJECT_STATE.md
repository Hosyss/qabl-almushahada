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

## P2-03 — المراجعة الثالثة حسب المخاطر — مكتمل على main

- سياسة مخاطر deterministic في `lib/review-engine/risk-policy.ts`؛ لا توجد heuristics مخفية أو AI يقرر متى نطلب المراجع الثالث.
- القاعدة العامة مراجعان نشطان مستقلان على الأقل.
- يرتفع الحد إلى **3 مراجعين نشطين من 3 مجموعات استقلال مختلفة** عند:
  - أي واقعة severity = 4.
  - `selfHarm` من severity 1.
  - `sexualContent` أو `flashingLights` من severity 2.
  - `violence` أو `substances` أو `discrimination` أو `bullying` من severity 3.
  - flag `flashing_sequence` من severity 1.
  - flags `blood` أو `weapon` أو `physical_bullying` من severity 3.
- النقص في المراجع الثالث أو مجموعة الاستقلال الثالثة يمنع القرار والنشر والاعتماد التحريري.
- المراجع الموقوف أو غير النشط لا يحتسب.
- checkpoint P2-03 المدموج على main اجتاز 72/72 اختبارًا، و`test:migrations` و`lint:local` و`build:local`.

## P2-04 — revisions غير قابلة للمحو — مكتمل على main

- إعادة الإرسال لا تمسح facts القديمة ولا تعمل UPSERT فوق نفس submission.
- كل إرسال جديد ينشئ `review_submissions` جديدًا بمعرّف و`revision` جديدين و`supersedes_submission_id` مباشر.
- `review_assignments.submission_id` هو المؤشر للمراجعة الحالية فقط؛ revisions التاريخية تبقى محفوظة ولا تدخل القرار الحالي.
- SQLite تمنع UPDATE/DELETE على submissions وcategory checks والوقائع والflags القديمة وتفرض lineage مباشرًا.
- الاعتماد التحريري append-only أيضًا: كل approval جديدة تحمل revision متزايدة و`supersedes_approval_id` مباشر.
- `review_bundles.current_approval_id` يشير إلى الاعتماد الحالي فقط، بينما كل الاعتمادات السابقة تبقى محفوظة.
- P2-04 مدموج على `main` في commit `d32434356eeae46e51c0547fd46f430fa350e0a5`، وCI الخاص بـmain نجح.

## P2-05 — حسم البلاغ والتصحيح وإعادة الاعتماد — مكتمل على main

- البلاغ الجوهري لا يُفتح إلا على حزمة `verified` لها current approval فعلية.
- D1 تلتقط server-side snapshot غير قابل للتزوير: `version_id`، حالة الحزمة، revision، والاعتماد الجاري إبطاله.
- فتح البلاغ يحول الحزمة إلى `conflicted` ويجعل `current_approval_id = NULL` فورًا من غير حذف التاريخ.
- لا يسمح بأكثر من بلاغ `open/investigating` واحد للحزمة، ولا بإنشاء approval جديدة أثناء وجود بلاغ نشط.
- حسم البلاغ محصور في `editorial_reviewer` نشط.
- `no_issue` يعيد نفس الاعتماد الذي أبطله البلاغ فقط إذا لم تتغير الحالة.
- `correction_required` يعيد assignments المعتمدة لنفس النسخة إلى `changes_requested`، ويجبر submission revisions جديدة واعتماد revision جديدة.
- `different_version` المؤكد يسحب الحزمة بدل تعديل وقائع تحت هوية نسخة خاطئة.
- SQLite تمنع إعادة approval أبطله تصحيح مؤكد، وتمنع أي approval تاريخية أقدم من أن تصبح current، وتمنع `verified` بلا current approval.
- P2-05 مدموجة على `main` في commit `16a6a844f9636373df83a44204579e0164ae9cd8` عبر PR #8.
- CI #142 على `main` بعد الدمج اجتاز **78/78 اختبارًا، 0 فشل**، ومعه migrations وlint وbuild ناجحة.

## P2Q-01 — تدقيق عشوائي غير متوقع بعد الإرسال — مكتمل على main

- أضيفت policy مستقلة في `lib/review-audit-selection.ts` لاختيار عينة التدقيق **بعد اكتمال validation وتجميد payload الإرسال النهائي**.
- القرعة تُولد على الخادم بـ`crypto.getRandomValues` كـCSPRNG؛ لا يأتي draw أو rate أو risk tier أو selected من المتصفح.
- السياسة الأولية صريحة وقابلة للمراجعة:
  - **10%** للحالات العادية (`1000 bps`).
  - **50%** للحالات عالية الحساسية (`5000 bps`).
- high-risk يعيد استخدام **نفس P2-03 thresholds**، فلا يوجد تعريف مخاطر موازٍ أو hidden heuristic.
- المقارنة تتم مباشرة على نطاق uint32 بدل `%`، فتتجنب modulo bias.
- high-risk ليست 100% عمدًا حتى لا يستطيع المراجع توقع أن كل حالة حساسة ستدخل تدقيقًا.
- قرار الاختيار يُكتب في **نفس D1 batch** الخاصة بالإرسال المقفول، واستجابة submit للمراجع لا تحتوي نتيجة الاختيار.
- جدول `review_audit_selections` يسجل قرارًا واحدًا لكل submission سواء selected أو لا: هوية submission/assignment/bundle/version/reviewer، risk tier، rate، draw، selected، triggers، ووقت الإنشاء.
- القرارات append-only؛ SQLite تمنع UPDATE/DELETE.
- SQLite تعيد التحقق من هوية submission الحالية، ومن high-risk thresholds، ومن 10%/50%، ومن أن `selected` يطابق draw الفعلي؛ down-rating أو تزوير نتيجة القرعة يُرفض.
- SQLite تمنع انتقال assignment إلى `approved` إذا لم توجد audit-selection decision للمراجعة الحالية، وتمنع جعل bundle `verified` إذا كانت أي submission حالية بلا decision.
- P2Q-01 تختار العينة وتسجل القرار فقط؛ تنفيذ التدقيق الفعلي وoutcome والمعايرة هي `P2Q-02`.
- migration `0007_random_audit_selection.sql` رفعت الإجمالي إلى **8 migrations / 18 product tables**.
- الاختبارات تشمل pure policy وSQLite guards للـrisk/rate/draw/immutability والاعتماد بلا decision.
- P2Q-01 مدموجة على `main` في commit `c308bc79ea8dfd7e01e6f68a6a565de0198efadd` عبر PR #10.
- CI #159 على `main` بعد الدمج نجح في **83/83 اختبارًا، 0 فشل**، ونجح `test:migrations` و`lint:local` و`build:local` أيضًا.

## P2Q-02 — نتيجة التدقيق ومعايرة المراجع — مكتملة تقنيًا على الفرع قبل الدمج

- أضيفت `review_audit_outcomes` و`review_audit_findings` كسجل append-only لنتيجة التدقيق الفعلي والـfindings.
- لا يسجل outcome إلا `editorial_reviewer` نشط وله reviewer identity نشطة ومستقلة عن المراجع الأصلي؛ self-audit ونفس مجموعة الاستقلال مرفوضان.
- selected submission تظل مانعة للاعتماد حتى يكتمل outcome بـ`confirmed`؛ SQLite تمنع editorial approval و`verified` قبل ذلك.
- `confirmed` لا يقبل findings. وجود `missed_event` أو `severity_difference` ينتج `correction_required` ويرجع الـassignment ذريًا إلى `changes_requested`.
- هوية المراجع والمدقق وشدة المراجع الأصلية تُحل من D1؛ العميل لا يستطيع إرسال أو تزوير `reviewerSeverity` أو server-owned identities.
- findings تدعم الحدث الفائت بمحور/شدة/توقيت مضبوط، وفرق الشدة ضد observation موجودة داخل نفس submission فقط.
- outcome النهائي والfindings محمية من UPDATE/DELETE بعد الإقفال؛ سجل audit يسجل confirmed أو correction_required.
- `getReviewerCalibrationSummary` يحسب النتائج من outcomes المكتملة المخزنة، وليس من قيمة client-side أو UI state.
- حجم العينة وraw counts متاحان للتدقيق، لكن normalized rates تظل `null` قبل **20 تدقيقًا مكتملًا** للمراجع؛ عند 20 تبدأ rates basis-points بالظهور.
- لا توجد composite `trustScore` ولا ranking للمراجعين؛ P2Q-02 تقدم evidence/counts/rates فقط.
- migration `0008_reviewer_calibration_outcomes.sql` رفعت الإجمالي إلى **9 migrations / 20 product tables**.
- checkpoint الحالي على الفرع اجتاز **95/95 اختبارًا، 0 فشل**، ونجح `test:migrations` بما فيه verifier الخاص بـP2Q-02، و`lint:local` و`build:local`.
- لم تُدمج P2Q-02 على `main` بعد؛ لا يُعتبر هذا القسم checkpoint نهائيًا على main حتى PR + CI + merge + main CI.

## Cloudflare — إعداد الإنتاج

- الهدف النهائي Cloudflare Workers + D1 من نفس المستودع؛ راجع `docs/CLOUDFLARE_DEPLOYMENT.md`.
- `vite.config.ts` يفصل preview المحلي عن production، والـplaceholder D1 لا يُستخدم في production config.
- `scripts/prepare-cloudflare-deploy.mjs` يولد config إنتاج بعد التحقق من D1 UUID/Name الحقيقيين؛ placeholder المحلي مرفوض.
- config الإنتاج يربط `DB` و`IMAGES` ويستخدم `nodejs_compat` وWorkers observability.
- Cloudflare Access عند تفعيله يتحقق server-side، والمسارات الداخلية تفشل مغلقًا إذا لم تكن المصادقة مضبوطة.
- أضيفت أوامر `cloudflare:prepare`, `cloudflare:build`, `cloudflare:migrate`, `cloudflare:deploy`، ولا تُنسخ API tokens أو Account IDs إلى Worker config.
- **لم يحدث remote deploy بعد** لأن الجلسة لا تملك Cloudflare API/CLI authentication متصلًا لإنشاء D1 حقيقية أو تنفيذ `wrangler deploy`. لا يوجد URL Cloudflare جديد يجوز ادعاؤه قبل ذلك.

## ما يزال تجريبيًا أو مؤجلًا

- البحث لا يتصل بقاعدة عناوين حقيقية.
- أسماء الأعمال والوقائع المعروضة للعامة أمثلة تصميمية وليست مراجعات منشورة.
- إعدادات الأسرة تعيش داخل حالة الصفحة فقط.
- زر الإبلاغ الظاهر في الواجهة العامة غير موصول بخدمة فتح البلاغ.
- لا توجد بيانات إنتاج حقيقية.
- تفعيل/معايرة المراجعين ضد **مجموعة مرجعية** لم يبدأ بعد؛ هذا هو P2Q-03.
- الإيقاف التلقائي عند نمط أخطاء/تواطؤ لم يبدأ بعد؛ هذا هو P2Q-04.

## الروابط الحالية

- المستودع: `https://github.com/Hosyss/qabl-almushahada`
- الموقع المنشور القديم: `https://qabl-almushahada.hosys.chatgpt.site`
- الرابط القديم لا يحتوي آخر سير العمل ولا يُعتبر نشر Cloudflare النهائي.

## نقطة البدء التالية

1. التالي: `P2Q-03` **حرج / Work** — مجموعة معايرة مرجعية واختبار اتفاق المراجعين قبل تفعيل حساب جديد وبعد الانحراف.
2. عند توفر Cloudflare authentication: إنشاء D1 حقيقية، تطبيق migrations، deploy إلى Worker، اختبار URL الفعلي، ثم إعداد Access للمسارات الداخلية.
3. أعمال الواجهة الخفيفة والبحث وربط البيانات العامة تبقى مؤجلة حسب ROADMAP ولا تسبق checkpoints الثقة الحرجة.

راجع `docs/ENGINE_TRUST_MODEL.md` و`docs/CLOUDFLARE_DEPLOYMENT.md` قبل أي تعديل في الثقة أو النشر.
