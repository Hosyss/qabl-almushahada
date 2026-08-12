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

## P2-02 — سير المراجعة الداخلي المحمي — مكتمل على main

- أدوار أقل صلاحية منفصلة: `admin`، `review_coordinator`، `reviewer`، `editorial_reviewer`، وAdmin لا يرث صلاحيات الأدوار الأخرى.
- bootstrap/provisioning محميان server-side، والخادم يولد هوية reviewer ولا يقبل `reviewerId` من المتصفح.
- المنسق يوزع المهمة باستخدام بريد حساب داخلي؛ reviewer والنسخة يُحلان من D1 على الخادم.
- SQLite تمنع تبديل bundle/version/reviewer بعد إنشاء المهمة.
- حفظ المسودة والإرسال يستخدمان optimistic revision locking؛ لا يوجد `assigned → submitted` مباشر.
- validation النهائي يرفض تغطية أقل من 95%، المحاور الناقصة/`uncertain`، التناقضات، القيم المجهولة، التوقيت الخاطئ وmass assignment.
- الاعتماد التحريري يشغّل `assessReviewQuality` قبل الكتابة ويغطي كل المراجعات الحالية وspot checks وبصمة النسخة.
- `internal_audit_events` و`review_audit_events` append-only على مستوى SQLite.
- المصادقة الداخلية مستقلة عن الاستضافة: `INTERNAL_AUTH_MODE` إجباري، ووضع Cloudflare Access يتحقق من JWT RS256 وissuer/audience/expiry قبل الثقة في البريد.
- `/internal` مكتملة حسب الدور: Admin / Coordinator / Reviewer / Editorial، والقراءة والكتابة مقيدتان على الخادم.

## P2-03 — المراجعة الثالثة حسب المخاطر — مكتمل على main

- سياسة مخاطر deterministic في `lib/review-engine/risk-policy.ts`؛ لا توجد heuristics مخفية أو AI يقرر متى نطلب المراجع الثالث.
- القاعدة العامة مراجعان نشطان مستقلان على الأقل.
- يرتفع الحد إلى 3 مراجعين نشطين من 3 مجموعات استقلال مختلفة عند قواعد الخطر الصريحة: أي severity=4، `selfHarm` من 1، `sexualContent`/`flashingLights` من 2، `violence`/`substances`/`discrimination`/`bullying` من 3، وflags الحساسة المحددة.
- النقص في المراجع الثالث أو مجموعة الاستقلال الثالثة يمنع القرار والنشر والاعتماد التحريري.

## P2-04 — revisions غير قابلة للمحو — مكتمل على main

- كل إعادة إرسال تنشئ `review_submission` revision جديدة مرتبطة مباشرة بالسابقة، ولا تمسح facts القديمة.
- `review_assignments.submission_id` يشير للمراجعة الحالية فقط؛ التاريخ يبقى محفوظًا.
- كل اعتماد تحريري جديد ينشئ revision جديدة، و`review_bundles.current_approval_id` يشير للحالية فقط.
- SQLite تمنع UPDATE/DELETE للتاريخ القديم وتفرض lineage مباشرًا.
- P2-04 مدموجة على `main` في commit `d32434356eeae46e51c0547fd46f430fa350e0a5`.

## P2-05 — حسم البلاغ والتصحيح وإعادة الاعتماد — مكتمل على main

- البلاغ الجوهري لا يفتح إلا على حزمة `verified` لها current approval فعلية، ويحفظ snapshot server-side للنسخة والحالة والrevision والاعتماد الجاري إبطاله.
- فتح البلاغ يحول الحزمة إلى `conflicted` ويسقط `current_approval_id` فورًا من غير حذف التاريخ.
- لا يسمح بأكثر من بلاغ نشط واحد للحزمة ولا باعتماد جديد أثناء البلاغ النشط.
- الحسم محصور في `editorial_reviewer` نشط.
- `no_issue` يعيد نفس الاعتماد الذي أبطله البلاغ فقط إذا لم تتغير الحالة.
- `correction_required` يعيد assignments إلى `changes_requested` ويجبر submission revisions واعتماد revision جديدين.
- `different_version` المؤكد يسحب الحزمة بدل تعديل وقائع تحت هوية نسخة خاطئة.
- P2-05 مدموجة على `main` في commit `16a6a844f9636373df83a44204579e0164ae9cd8` عبر PR #8.

## P2Q-01 — تدقيق عشوائي غير متوقع — مكتمل على main

- اختيار العينة يحدث بعد تجميد الإرسال النهائي باستخدام CSPRNG على الخادم.
- السياسة الأولية: 10% للحالات العادية و50% للحالات عالية الحساسية وفق نفس قواعد P2-03.
- كل submission تحصل على decision append-only سواء اختيرت أم لا.
- SQLite تعيد التحقق من risk tier والنسبة والdraw و`selected`، ولا اعتماد أو `verified` من دون decision للمراجعة الحالية.
- P2Q-01 مدموجة عبر PR #10 في commit `c308bc79ea8dfd7e01e6f68a6a565de0198efadd`.

## P2Q-02 — نتيجة التدقيق ومعايرة المراجع — مكتملة على main

- `review_audit_outcomes` و`review_audit_findings` append-only.
- التدقيق لا يسجله إلا `editorial_reviewer` نشط ومستقل؛ self-audit ونفس مجموعة الاستقلال مرفوضان.
- `confirmed` يمر بلا findings، و`correction_required` يرجع assignment إلى `changes_requested`.
- هوية المراجع والمدقق وشدة المراجع الأصلية تُحل من D1 server-side.
- raw counts وحجم العينة متاحان دائمًا، لكن normalized rates تظل `null` قبل 20 تدقيقًا مكتملًا.
- لا توجد composite `trustScore` ولا ranking للمراجعين.
- P2Q-02 مدموجة عبر PR #12 في commit `120a43d62517141a3ed0c14cd07d6128655303fa`.

## P2Q-03 — المعايرة المرجعية قبل التفعيل — مكتملة على main

- المراجع الجديد يبدأ `probation` ولا يصبح `active` قبل Pass مرجعي ناجح.
- Pass/Fail صريح: 10 حالات على الأقل، ≥95% اتفاق المحاور، ≥90% recall، ≥90% precision، صفر حدث عالي الحساسية فائت، وأقصى فرق شدة = 1.
- المقارنة deterministic ولا تستخدم AI/semantic matching.
- الـAdmin وحده ينشئ/يفعّل المجموعة المرجعية، والمراجع لا يرى الإجابات المرجعية.
- SQLite تمنع مجموعة نشطة ناقصة أو أكثر من مجموعة نشطة، وتمنع تعديل الحالات بعد التفعيل، وتعيد التحقق من صلاحية المرجع أثناء المحاولة حتى الإقفال.
- إعادة تفعيل reviewer موقوفة تحتاج Pass حديثًا بعد وقت الإيقاف.
- الإجمالي بعد P2Q-03: 10 migrations / 24 product tables.
- P2Q-03 دُمجت عبر PR #14 في commit `6c2c6fdd9db420de36d88fac9b67e49320792313`، وCI #199 على `main` نجح بالكامل.

## P2Q-04 — Safety Hold تلقائي وآمن — مكتملة على main

- السياسة versioned في `lib/reviewer-safety-hold.ts` ولا تنتج trust score أو ranking.
- Hold فوري مؤقت عند حدث عالي الحساسية فائت أو `maxSeverityDelta = 3`.
- قواعد النمط لا تعمل قبل 20 audit مكتملة في دورة المراجع الحالية؛ داخل آخر 20: 5 `correction_required` أو 3 audits بها missed events أو 3 audits بها severity delta ≥2 تؤدي إلى Hold.
- hold/resolution append-only في `internal_audit_events`.
- الـHold يعلق reviewer والحساب الداخلي ويحافظ على الهوية والدور والتاريخ.
- الـHold تسقط الثقة الحالية من أي bundle تعتمد على الهوية كمراجع أو مدقق أو معتمد تحريري، بينما الحزم غير المرتبطة تظل سليمة.
- الاشتباه اليدوي في التواطؤ Admin-only ويتطلب audit evidence مخزنة مرتبطة بالمراجع، ويعني تحقيقًا لا إدانة.
- العودة تتطلب: Human resolution → fresh P2Q-03 calibration → Admin activation.
- checkpoint = 18 migration files / 24 product tables.
- P2Q-04 دُمجت عبر PR #16 في commit `70eeb381bdb834ff89b646ac20263602e531d61f`، وCI #234 على `main` نجح بالكامل.

## P2Q-05 — لوحة الجودة والأدلة — مكتملة على main

- أضيفت صفحة داخلية مرئية `/internal/quality` لعرض أدلة الجودة الفعلية من D1.
- الوصول محصور server-side في `admin` و`editorial_reviewer` النشطين؛ المراجع والمنسق لا يحصلان على هذه الرؤية.
- الصفحة read-only ولا تحتوي أي mutation للـHold أو نتائج التدقيق أو المعايرة.
- تعرض Safety Holds مع أسبابها وقرارات الحسم البشري، الحزم/البلاغات المتعارضة، Audit Calibration، وReference Calibration.
- normalized audit rates لا تظهر قبل 20 تدقيقًا مكتملًا، بما يطابق P2Q-02.
- لا توجد trust score أو ranking أو leaderboard للمراجعين.
- أضيف مدخل مرئي من `/internal` للأدوار المصرح لها، مع إعادة التحقق من الصلاحية داخل الخدمة نفسها.
- استعلامات لوحة الجودة تُختبر على SQLite بعد تطبيق جميع migrations، وليس بالـcompile فقط.
- لا schema أو migrations جديدة في P2Q-05؛ الإجمالي يظل **18 migration files / 24 product tables**.
- checkpoint التشغيلي موثق في `docs/P2Q-05_QUALITY_DASHBOARD_CHECKPOINT.md`.
- P2Q-05 دُمجت عبر PR #18 في commit `f2bccaa7a92ba07bf73523139774c05c92f08b1d`.
- CI #250 على `main` بعد الدمج نجح في `test:engine`, `test:migrations`, `lint:local`, و`build:local` بالكامل.

## Cloudflare — إعداد الإنتاج

- الهدف النهائي Cloudflare Workers + D1 من نفس المستودع؛ راجع `docs/CLOUDFLARE_DEPLOYMENT.md`.
- `vite.config.ts` يفصل preview المحلي عن production، والـplaceholder D1 لا يُستخدم في production config.
- `scripts/prepare-cloudflare-deploy.mjs` يولد config إنتاج بعد التحقق من D1 UUID/Name الحقيقيين؛ placeholder المحلي مرفوض.
- config الإنتاج يربط `DB` و`IMAGES` ويستخدم `nodejs_compat` وWorkers observability.
- Cloudflare Access عند تفعيله يتحقق server-side، والمسارات الداخلية تفشل مغلقًا إذا لم تكن المصادقة مضبوطة.
- أوامر `cloudflare:prepare`, `cloudflare:build`, `cloudflare:migrate`, `cloudflare:deploy` موجودة، ولا تُنسخ API tokens أو Account IDs إلى Worker config.
- **لم يحدث remote deploy بعد** لأن الجلسة لا تملك Cloudflare API/CLI authentication متصلًا لإنشاء D1 حقيقية أو تنفيذ `wrangler deploy`. لا يوجد URL Cloudflare جديد يجوز ادعاؤه قبل ذلك.

## ما يزال تجريبيًا أو مؤجلًا

- البحث لا يتصل بقاعدة عناوين حقيقية.
- أسماء الأعمال والوقائع المعروضة للعامة أمثلة تصميمية وليست مراجعات منشورة.
- إعدادات الأسرة تعيش داخل حالة الصفحة فقط.
- زر الإبلاغ الظاهر في الواجهة العامة غير موصول بخدمة فتح البلاغ.
- لا توجد بيانات إنتاج حقيقية.

## الروابط الحالية

- المستودع: `https://github.com/Hosyss/qabl-almushahada`
- آخر PR مكتمل: `https://github.com/Hosyss/qabl-almushahada/pull/18`
- الموقع المنشور القديم: `https://qabl-almushahada.hosys.chatgpt.site`
- الرابط القديم لا يحتوي آخر سير العمل ولا يُعتبر نشر Cloudflare النهائي.

## نقطة البدء التالية

1. التالي: `P3-01` **متوسط** — بحث عربي يدعم اختلافات الكتابة والاسم الأصلي.
2. عند توفر Cloudflare authentication: إنشاء D1 حقيقية، تطبيق migrations، deploy إلى Worker، اختبار URL الفعلي، ثم إعداد Access للمسارات الداخلية.
3. أعمال الواجهة الخفيفة وربط البيانات العامة تستمر حسب ROADMAP من دون تخفيف بوابات الثقة المكتملة.

راجع `docs/ENGINE_TRUST_MODEL.md` و`docs/CLOUDFLARE_DEPLOYMENT.md` قبل أي تعديل في الثقة أو النشر.