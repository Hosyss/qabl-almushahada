# حالة مشروع «قبل المشاهدة»

آخر تحديث: 13 أغسطس 2026

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
- Hero عائلي برسمة أشجار، بحث حقيقي متصل بـD1، اقتراحات قابلة للنقر، وحدود أسرة تفاعلية.
- صفحة `/search` حقيقية تعرض نتائج الدليل وحالة المراجعة من البيانات الفعلية، وتربط المراجعة الموثقة بالحزمة المنشورة نفسها.
- صفحة `/review` حقيقية تقرأ مراجعة D1 موثقة محددة بـ`bundleId` وتفشل مغلقًا عند stale/invalid state بدل أي Demo fallback، مع وضع «من غير حرق» لا يؤلف وقائع بديلة.
- حدود الأسرة تُحفظ محليًا في المتصفح بعقد صارم لا يحتوي اسم طفل أو تاريخ ميلاد، وتعود بعد إعادة فتح الصفحة عندما يكون التخزين المحلي متاحًا.
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
- المصادقة الداخلية مستقلة عن الاستضافة: `INTERNAL_AUTH_MODE` إجباري، ووضع Cloudflare Access يتحقق server-side من JWT RS256 وissuer/audience/expiry قبل الثقة في البريد.
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

## P2Q-02 — نتيجة التدقيق ومعايرة المراجع — مكتملة على main

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
- P2Q-02 مدموجة على `main` في commit `120a43d62517141a3ed0c14cd07d6128655303fa` عبر PR #12.
- CI #178 على `main` بعد الدمج اجتاز **95/95 اختبارًا، 0 فشل**، ونجح `test:migrations` و`lint:local` و`build:local` أيضًا.

## P2Q-03 — المعايرة المرجعية قبل التفعيل — مكتملة على main

- أضيفت `reviewer_reference_sets`, `reviewer_reference_cases`, `reviewer_reference_attempts`, و`reviewer_reference_case_results`؛ الإجمالي أصبح **10 migrations / 24 product tables**.
- المراجع الجديد يبدأ `probation` على مستوى قاعدة البيانات ولا يمكن أن يصبح `active` قبل اجتياز معايرة مرجعية ناجحة على المجموعة النشطة.
- سياسة Pass/Fail صريحة بلا trust score مركبة: **10 حالات على الأقل، ≥95% اتفاق المحاور، ≥90% recall، ≥90% precision، صفر واقعة عالية الحساسية فائتة، وأقصى فرق شدة = 1**.
- مقارنة الوقائع deterministic حسب المحور والتوقيت، وتتطلب overlap مع فرق بداية لا يزيد عن 20 ثانية؛ لا يوجد AI/semantic matching في المعايرة.
- الـAdmin وحده ينشئ/يفعّل المجموعة المرجعية، والمراجع يبدأ محاولته من حسابه من دون اختيار المجموعة أو رؤية الإجابات المرجعية.
- SQLite تمنع أكثر من مجموعة مرجعية نشطة، وتمنع تفعيل مجموعة ناقصة، وتمنع إضافة/تعديل/حذف الحالات بعد التفعيل.
- هوية attempt (`reviewer_id`, `set_id`, `purpose`, `started_at`) ثابتة بعد البداية، والنتائج append-only، والـPass النهائي يعيد حساب metrics من case results المخزنة بدل الثقة في summary من التطبيق.
- reference case يجب أن تأتي من submission حالية معتمدة داخل bundle `verified`، وأن تكون مستقلة عن المراجع الجاري اختباره؛ self-reference ونفس مجموعة الاستقلال مرفوضان.
- صلاحية المرجع يعاد التحقق منها عند بدء المحاولة، وعند كتابة كل case result، وعند الإقفال النهائي؛ سحب المرجع أو دخوله conflict أثناء المحاولة يفشل المسار مغلقًا.
- تقاعد المجموعة ممنوع أثناء وجود attempts مفتوحة، وإعادة تفعيل reviewer موقوفة تحتاج Pass حديثًا بعد وقت الإيقاف.
- `drizzle.config.ts` صار يقرأ `db/schema.ts` و`db/review-workflow-schema.ts` معًا، وتمت مطابقة partial unique indexes في Drizzle مع SQLite الفعلية.
- P2Q-03 دُمجت على `main` عبر PR #14 في commit `6c2c6fdd9db420de36d88fac9b67e49320792313`.
- CI #199 على `main` بعد الدمج نجح في `test:engine`, `test:migrations`, `lint:local`, و`build:local` بالكامل.

## P2Q-04 — Safety Hold تلقائي وآمن — مكتملة على main

- السياسة versioned في `lib/reviewer-safety-hold.ts` ولا تنتج trust score أو ranking.
- Hold فوري مؤقت عند أحدث audit مستقلة إذا ظهر **حدث عالي الحساسية فائت** أو `maxSeverityDelta = 3`.
- قواعد النمط المتكرر لا تعمل قبل **20 audit مكتملة في دورة المراجع الحالية**؛ داخل آخر 20: **5 correction_required** أو **3 audits بها missed events** أو **3 audits بها severity delta ≥2** تؤدي إلى Hold.
- الـepoch الحالية مرتبطة بوقت آخر activation/reactivation، وSQLite تمنع timestamp-only update لمراجع active من تصفير النافذة بالخطأ.
- hold/resolution تُسجل كأحداث append-only في `internal_audit_events`؛ لا يوجد جدول حالة موازٍ قابل للانحراف.
- أي Hold صالح يعلق `reviewers.status` والحساب الداخلي المقابل، مع الحفاظ على الهوية والدور والتاريخ.
- الـHold تسقط الثقة الحالية من أي bundle تعتمد على نفس الهوية **كمراجع أو كمدقق audit أو كمعتمد تحريري**، وتحولها إلى `conflicted` وتسقط `current_approval_id` من غير حذف التاريخ؛ الحزم غير المرتبطة تظل سليمة.
- الحزمة التي أنتجت `correction_required` مستثناة من invalidation العام حتى يستطيع نفس transaction إكمال `changes_requested` و`under_review` بعد وضع الـHold.
- الاشتباه اليدوي في التواطؤ Admin-only، ويتطلب 1–20 audit evidence IDs موجودة، ويجب أن يكون بعضها مرتبطًا بالمراجع المستهدف. `COLLUSION_SUSPICION` يعني تحقيقًا مطلوبًا وليس إثبات تواطؤ.
- المتصفح لا يحدد reviewerId/source/policyVersion/triggerCodes/actor؛ الخادم يملك هذه الهوية والقيم.
- unresolved hold يمنع activation ويمنع بدء reference reactivation/drift. الحسم البشري Admin-only ومرة واحدة، لكنه لا يعيد التفعيل وحده.
- مسار العودة: **Human resolution → fresh P2Q-03 reference calibration → Admin activation**؛ لذلك لا قرار بشري وحده ولا calibration قديمة تكفي.
- اختبارات SQLite تثبت 4/20 لا توقف و5/20 توقف، وأن الـ20th `confirmed` تقيّم النافذة، وأن Hold لا تكسر transaction التصحيح للحزمة التي كشفت الخطأ.
- لم تُضف جداول منتج جديدة؛ checkpoint = **18 migration files / 24 product tables**.
- P2Q-04 دُمجت على `main` عبر PR #16 في commit `70eeb381bdb834ff89b646ac20263602e531d61f`.
- CI #234 على `main` بعد الدمج نجح في `test:engine`, `test:migrations`, `lint:local`, و`build:local` بالكامل.
- آخر checkpoint قبل الدمج كان **122/122 اختبارًا، 0 فشل**؛ التفاصيل التشغيلية في `docs/P2Q-04_SAFETY_HOLD_CHECKPOINT.md`.

## P2Q-05 — لوحة الجودة والأدلة — مكتملة على main

- أضيفت صفحة داخلية مرئية `/internal/quality` تعرض أدلة الجودة الفعلية من D1 بدل إنشاء score أو حالة موازية.
- الوصول محصور server-side في `admin` و`editorial_reviewer` النشطين؛ المراجع والمنسق لا يملكان مدخل اللوحة.
- الصفحة read-only بالكامل؛ لا توجد mutation لتغيير Hold أو حسمه أو تعديل نتيجة تدقيق أو معايرة من لوحة الجودة.
- تعرض Safety Holds مع أسبابها وقرارات الحسم البشري، الحزم والبلاغات المتعارضة، Audit Calibration، وReference Calibration.
- normalized audit rates تظل مخفية قبل **20 تدقيقًا مكتملًا** بما يطابق P2Q-02، ولا توجد `trustScore` أو ranking أو leaderboard.
- أضيف مدخل مرئي من `/internal` للأدوار المصرح لها، والخدمة نفسها تعيد التحقق من الدور والحالة على الخادم حتى لو عُرف الرابط يدويًا.
- اختبارات P2Q-05 تغطي policy الوصول، parsing للـHold/Resolution، إخفاء المعدلات تحت 20 عينة، وعدم وجود score/ranking.
- استعلامات لوحة الجودة نفسها تُنفذ داخل `test:migrations` على SQLite بعد تطبيق جميع migrations، حتى لا يكفي مجرد نجاح TypeScript build.
- لا schema أو migrations جديدة في P2Q-05؛ الإجمالي يظل **18 migration files / 24 product tables**.
- التفاصيل التشغيلية موثقة في `docs/P2Q-05_QUALITY_DASHBOARD_CHECKPOINT.md`.
- P2Q-05 دُمجت على `main` عبر PR #18 في commit `f2bccaa7a92ba07bf73523139774c05c92f08b1d`.
- CI #250 على `main` بعد الدمج نجح في `test:engine`, `test:migrations`, `lint:local`, و`build:local` بالكامل.

## P3-01 — البحث العربي الحقيقي — مكتملة على main

- أضيفت سياسة بحث deterministic في `lib/public-title-search.ts` تدعم `canonical_name` و`original_name` من غير fuzzy AI أو تشابه دلالي مخفي.
- التطبيع يدعم NFKC، إزالة التشكيل والتطويل، توحيد أشكال الألف/الياء والهمزات، وتحويل الأرقام العربية والفارسية إلى ASCII، مع إزالة علامات الترقيم ودمج المسافات.
- مدخل البحث fail-closed ومحدود: من **2 إلى 80 حرفًا**، وبحد أقصى **8 tokens** مختلفة؛ الطلب يقبل `query` فقط ويرفض mass-assignment fields.
- D1 تستخدم query parameterized بالكامل؛ لا يُدمج نص المستخدم داخل SQL. طبقة candidates محدودة بـ **256** صفًا، ثم ranking نهائي deterministic بحد أقصى **8 نتائج**.
- ترتيب المطابقة: canonical exact ثم original exact ثم prefix ثم contains ثم token match؛ وجود مراجعة موثقة يعمل tie-break فقط ولا يتغلب على مطابقة نصية أدق.
- `hasVerifiedReview` لا يصبح true إلا بوجود نسخة `active` وحزمة `verified` و`current_approval_id` فعلية؛ وجود العنوان في جدول `titles` وحده لا يُعرض كمراجعة موثقة.
- أضيفت خدمة D1 server-side وServer Action عامة تعيد رسائل عربية آمنة؛ أخطاء الإدخال لا تتحول إلى 500، وأخطاء D1 غير المتوقعة لا تكشف تفاصيل داخلية للمستخدم.
- اختبارات policy تغطي العربية والاسم الأصلي والـranking والحدود وSQL parameterization ومدخلات شبيهة بالحقن.
- `scripts/verify-public-title-search.mts` يطبق كل migrations على SQLite ثم ينفذ **نفس SQL المولدة** ببيانات عربية/إنجليزية فعلية، ويثبت أن wildcard/injection-like text لا يغير دلالة الاستعلام.
- P3-01 لا تضيف migration أو جدولًا جديدًا؛ الإجمالي يظل **18 migration files / 24 product tables**.
- P3-01 دُمجت على `main` عبر PR #20 في commit `5b35f66fcd10beead3e022afcc5e98faffb478e0`.
- CI #261 على `main` بعد الدمج نجح في **143/143 اختبارًا، 0 فشل**، ونجح `test:migrations`, `lint:local`, و`build:local` أيضًا.

## P3-02 — نتائج البحث الحقيقية — مكتملة على main

- أضيفت صفحة `/search` عامة تقرأ من خدمة P3-01 الحقيقية وتعرض الاسم العربي، الاسم الأصلي، النوع، وسنة الإصدار.
- حالة النتيجة لا تُستنتج من UI: **مراجعة موثقة** تعني نسخة active داخل bundle `verified` ذات `current_approval_id`، و**قيد المراجعة** يتطلب workflow فعليًا على نسخة active في `draft/under_review/conflicted`.
- إذا كان العنوان مسجلًا بلا مراجعة نشطة أو منشورة تظهر حالة **موجود في الدليل**، وعدم وجود مطابقة يعرض **غير موجود**.
- عند وجود مراجعة موثقة ونسخة أخرى قيد المراجعة لنفس العنوان، الحالة المنشورة الموثقة لها الأولوية ولا يتم تخفيضها بصريًا.
- Hero الصفحة الرئيسية صار يرسل البحث إلى `/search?q=...` بدل رسالة placeholder القديمة، مع ترميز الاستعلام بـ`encodeURIComponent` ومنع الإرسال الفارغ.
- صفحة النتائج لا تربط إلى `/review` الوهمية؛ الربط بمراجعة فعلية مؤجل عمدًا لـP3-03.
- أضيفت اختبارات `public-search-result-state` وثُبّتت حالات verified/in_review/catalog_only، وتم توسيع SQLite verifier لإدخال bundle حقيقية `under_review` والتحقق من الحالة من SQL نفسها.
- لا schema أو migrations جديدة في P3-02؛ الإجمالي يظل **18 migration files / 24 product tables**.
- PR #22 نُظّفت قبل الدمج من تغييرات تنسيق غير وظيفية؛ الـdiff النهائي كان 468 إضافة / 13 حذف بدل 182 حذفًا مضللًا.
- P3-02 دُمجت على `main` عبر PR #22 في commit `a34ae4c67305553b90a53b1b943ce8cad3cf040f`.
- CI #271 على `main` بعد الدمج نجح في **146/146 اختبارًا، 0 فشل**، ونجح `test:migrations`, `lint:local`, و`build:local` أيضًا.

## P3-03 — صفحة المراجعة الحقيقية — مكتملة على main

- `/review` أصبحت Server Page تقرأ locator محددًا `bundleId` من الرابط وتطلب المراجعة عبر خدمة D1 الحقيقية؛ لا يوجد fallback إلى النموذج التجريبي عند missing/invalid/stale locator.
- بوابة العرض العام تشترط حزمة `verified` منشورة، نسخة `active`، `current_approval_id` حالية وحالتها `approved`، وعدم وجود بلاغ `open` أو `investigating`.
- القراءة تلتقط `bundle revision` و`current approval` قبل hydration ثم تعيد نفس البوابة بعده؛ أي تغيير بين القراءتين يفشل الطلب مغلقًا بدل خلط state قديمة بجديدة.
- DTO العامة تتحقق كذلك من title/version/runtime/content fingerprint ووقت الاعتماد مقابل الحزمة المحملة، ولا تعرّض هوية المراجعين أو fingerprint للواجهة.
- `/search` يعيد `verifiedBundleId` للحزمة المنشورة الفعلية، ويربط النتيجة الموثقة مباشرة بـ`/review?bundleId=...` بدل title id أو اختيار نسخة عشوائية.
- Client المراجعة يستقبل `PublicReviewView` فقط ولا يقرأ D1. النصوص القديمة التي كانت تصدر قرار أسرة/عمرًا ثابتًا أو تفاصيل Demo حُذفت.
- وضع «من غير حرق» يخفي summary المخزنة عندما `spoilerLevel` ليس `none`، ولا يؤلف حدثًا بديلًا. الثقة تعرض label نوعيًا فقط ولا توجد numeric trust score جديدة.
- `scripts/verify-public-review.mts` يطبق كل migrations على SQLite ويثبت: الحالة الصالحة تمر، report المفتوح/قيد التحقيق يمنع، bundle conflicted/withdrawn يمنع، version superseded/withdrawn يمنع، وإزالة/تغيير current approval يمنع stale request مع سلامة foreign keys.
- لا schema أو migration جديدة في P3-03؛ الإجمالي يظل **18 migration files / 24 product tables**.
- P3-03 دُمجت إلى `main` عبر PR #24 في commit `adc037eafb5ac9ba6f9089f2ed503ef9084f82a7`.
- قبل الدمج اجتاز checkpoint **155/155 اختبارًا، 0 فشل**، مع `test:migrations`, `lint:local`, و`build:local` ناجحة.

## P3-04 — حفظ حدود الأسرة محليًا — مكتملة وظيفيًا

- أضيف عقد تخزين versioned بالمفتاح `qabl-almushahada.family-settings.v1` داخل `lib/local-family-settings.ts`.
- البيانات المحفوظة محصورة صراحة في `childAge`, `fearLimit`, و`avoidBullying` فقط؛ لا اسم طفل ولا تاريخ ميلاد ولا معرف شخصي.
- parser يرفض JSON التالف، النسخة غير المعروفة، القيم خارج حدود الواجهة، وأي حقول إضافية بدل الاحتفاظ بها بصمت.
- الصفحة الرئيسية تستعيد الإعدادات المحفوظة بعد التحميل، وتحفظ التغييرات عند تفاعل المستخدم. إذا كان `localStorage` غير متاح تستمر الإعدادات للجلسة الحالية فقط وتعرض الواجهة ذلك بدل ادعاء نجاح الحفظ.
- لا تُرسل حدود الأسرة إلى D1 أو Worker، ولا توجد schema/migration جديدة؛ الإجمالي يظل **18 migration files / 24 product tables**.
- اختبارات P3-04 تثبت round-trip للحقول المسموح بها، رفض `childName` و`dateOfBirth` كحقول إضافية، ورفض القيم malformed/stale/out-of-range.
- checkpoint الفرع بعد إصلاح React synchronization نجح في `test:engine`, `test:migrations`, `lint:local`, و`build:local` بالكامل.

## Cloudflare — الإنتاج الفعلي

- الإنتاج يعمل على Cloudflare Workers + D1 من نفس المستودع؛ راجع `docs/CLOUDFLARE_DEPLOYMENT.md`.
- D1 الإنتاجية `qabl-almushahada-production` موجودة ومطبّق عليها **18/18 migrations**، والتحقق البعيد أكد وجود جداول المشروع المطلوبة.
- Worker الإنتاج يملك bindings فعلية: `DB`, `IMAGES`, و`ASSETS`. إضافة `ASSETS` كانت مطلوبة لمنع 404 على المسارات العامة مع Vinext.
- آخر نشر مؤكد على commit `1b58d4bd2a458bbf5a4fa5ea234597092195570f` نجح كاملًا، بما فيه smoke tests على `/`, `/review`, و`/search?q=nemo`.
- رابط Worker العام: `https://qabl-almushahada.buildtools.workers.dev`.
- Cloudflare Access للمسارات الداخلية يظل fail-closed ما لم تُضبط متغيرات Access الكاملة؛ لا يوجد fallback صامت لهوية غير موثقة.
- لا تُنسخ API tokens أو Account IDs إلى Worker config.

## ما يزال تجريبيًا أو مؤجلًا

- أسماء الأعمال والوقائع الموجودة داخل أقسام العرض التجريبية في الصفحة الرئيسية ما زالت أمثلة تصميمية وليست مراجعات منشورة.
- زر الإبلاغ الظاهر في الواجهة العامة غير موصول بخدمة فتح البلاغ.
- لم تُزرع بيانات مراجعات إنتاج مصطنعة لمجرد إظهار الصفحة؛ غياب bundle موثقة حقيقية يظل fail-closed.
- P3-05 فلاتر البحث، P3-06 صفحات السياسة، ومراحل الجودة/الإطلاق ما زالت لاحقة حسب ROADMAP.

## الروابط الحالية

- المستودع: `https://github.com/Hosyss/qabl-almushahada`
- الموقع العام على Cloudflare: `https://qabl-almushahada.buildtools.workers.dev`
- الموقع القديم `https://qabl-almushahada.hosys.chatgpt.site` ليس مصدر النشر الحالي.

## نقطة البدء التالية

1. ثبّت P3-04 على `main` فقط بعد CI أخضر وفحص الـdiff، ثم تحقق من Cloudflare deploy وsmoke tests بعد الدمج.
2. لا تُدخل بيانات مراجعات إنتاج مصطنعة لمجرد إظهار الصفحة؛ غياب مراجعة حقيقية يجب أن يظل fail-closed.
3. بعد تثبيت P3-04، البند التالي في ROADMAP هو `P3-05` — فلاتر واضحة حسب النوع والعمر وحالة التحقق.

راجع `docs/ENGINE_TRUST_MODEL.md` و`docs/CLOUDFLARE_DEPLOYMENT.md` قبل أي تعديل في الثقة أو النشر.
