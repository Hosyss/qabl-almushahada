# CHAT HANDOFF — «قبل المشاهدة» — 12 أغسطس 2026

> هذا الملف مخصص لنقل المشروع إلى محادثة جديدة **من دون إعادة المشروع من الصفر أو فقد قرارات الجلسات السابقة**. مصدر الحقيقة النهائي هو GitHub + ملفات المشروع المذكورة أدناه. لا تعتمد على ذاكرة المحادثة وحدها إذا تعارضت مع GitHub.

## 1) المصدر والروابط

- Repository: https://github.com/Hosyss/qabl-almushahada
- آخر `main` موثوق عند بدء P3-03: `512edb7315b443fae12ad69147b65952ff5cb857`
- الفرع النشط الآن: `agent/p3-03-real-review-page`
- آخر checkpoint على الفرع وقت كتابة هذا الملف: `e94aaf07c9d441b0f9422696bb392b322b671609`
- Commit: https://github.com/Hosyss/qabl-almushahada/commit/e94aaf07c9d441b0f9422696bb392b322b671609
- آخر CI لهذا checkpoint: Run #275 / `31636383775` — SUCCESS
- الموقع المنشور القديم فقط: https://qabl-almushahada.hosys.chatgpt.site
- **الرابط القديم لا يحتوي آخر تغييرات P2Q/P3 ولا يعتبر نشر Cloudflare النهائي.**
- لا يوجد حتى الآن Worker/D1 إنتاج حقيقي تم نشره عن بُعد من هذه الجلسة، ولا يجوز اختلاق رابط Cloudflare.

## 2) ابدأ أي محادثة جديدة بهذا الترتيب

لا تعدّل أي ملف قبل قراءة هذه الملفات بالترتيب:

1. `AGENTS.md`
2. `README.md`
3. `docs/CHAT_HANDOFF_2026-08-12.md` — هذا الملف
4. `docs/PROJECT_STATE.md`
5. `docs/ROADMAP.md` كاملًا
6. `docs/ENGINE_TRUST_MODEL.md`
7. `docs/FREE_PLAN_WORKFLOW.md`
8. `docs/CLOUDFLARE_DEPLOYMENT.md`

ثم افحص `main` والفرع النشط والـhead والـCI قبل أي كتابة. لا تنشئ مشروعًا جديدًا، ولا تعيد أي جزء مكتمل من الصفر.

## 3) قواعد المستخدم وطريقة العمل — ملزمة

- المستخدم يريد العربية المصرية المباشرة والواضحة.
- لا تعمل لفترات طويلة بصمت؛ عند كل milestone حقيقي قل ماذا تم وماذا يحدث الآن.
- بعد **كل تغيير فعلي** اعرض نسبة المهمة الحالية ونسبة المشروع ككل.
- النسبة العامة المتداولة حاليًا: **99%**؛ لا تحولها إلى 100% قبل الإطلاق الحقيقي وإقفال بوابات الإطلاق. هذه نسبة جاهزية هندسية وليست عدد checkboxes حرفيًا.
- الخطأ غير مقبول خصوصًا في محرك القرار، الثقة، البيانات، والـworkflow. أي CI أحمر = توقف عن إضافة features وأصلح السبب أولًا.
- المستخدم استاء من كثرة رسائل GitHub Actions الفاشلة. **لا ترفع commits وسيطة ناقصة بلا داعٍ.** اجمع التغييرات المرتبطة في checkpoint متماسك، وافحص الـdiff، ثم ارفع. لا تجعل CI وسيلة اكتشاف الأخطاء البسيطة التي يمكن تجنبها.
- لا تتسرع من أجل موعد. المستخدم قال صراحة إن الاحترافية العالية جدًا أهم من الوقت.
- لا تعد بموعد إذا كان سيؤدي للتسرع.
- نظّف الـdiff من formatting noise قبل PR. في P3-02 تم إيقاف الدمج وإصلاح `package.json` وملفات البحث لأن الضغط الشكلي صنع 182 حذفًا مضللًا؛ بعد التنظيف صار الـPR 468 إضافة/13 حذف.
- لا force-push، لا تمسح history، لا reset واسع، ولا تغيّر `main` مباشرة في feature work. Feature branch → checkpoint CI → PR CI → merge → main CI.
- لا تدّعِ أن commit/PR/merge/CI/Cloudflare deploy حدث قبل التحقق الفعلي.
- لا تطلب من المستخدم لصق Cloudflare API token في الشات.
- المستخدم محدود الإنترنت أحيانًا؛ GitHub هو handoff الدائم، فلا تعتمد على ملفات محلية غير مرفوعة.
- المستخدم يريد رؤية التغيير الفعلي في الموقع، لكن وافق ألا نستعجل. الاتفاق الحالي: **بعد إقفال P3-03 مباشرة نتوقف عن بناء P3-04 مؤقتًا وننفذ أول Deploy حقيقي على Cloudflare** حتى يرى البحث وصفحة المراجعة الفعلية، ثم نكمل الخطة.

## 4) هوية المنتج والواجهة — ثوابت

«قبل المشاهدة» دليل عربي مستقل يساعد الأسرة على معرفة ما يوجد داخل فيلم/مسلسل قبل تشغيله، ثم يصدر قرارًا مفسرًا ومخصصًا بدل تقييم رقمي عام.

الثوابت:

- Arabic RTL.
- نبرة بسيطة ومصرية مفهومة.
- دافئ/هادئ/عائلي.
- Cream + forest green + orange `#D9683B`.
- H1: «خلّي لحظة المشاهدة أهدى وأوضح»، وكلمة/جزء «أهدى وأوضح» برتقالي واضح.
- لا blur خلف النصوص أو أثناء الحركة.
- شارة المراجعة تتحرك بخفة مع `top/margin`، لا fractional transform يطمس النص.
- لا زحمة بطاقات عائمة.
- البحث RTL وزر واضح «ابحث».
- كل تفاعل أساسي keyboard/touch accessible مع aria عند الحاجة.
- لا تنشر حكمًا على عنوان حقيقي من دون بيانات مراجعة موثقة لنسخة محددة.
- لا تحول نقص البيانات إلى تخمين.

## 5) نموذج الثقة — لا يُضعف

- exact version identity/fingerprint.
- reviewer مستقلان نشطان كحد أدنى.
- >=95% watch coverage.
- كل category يجب أن تكون `present | none | uncertain`، و`uncertain` تمنع النشر.
- present/none conflict يمنع.
- severity gap >=2 يمنع.
- معتمد تحريري مستقل ونشط + fingerprint confirmation + spot checks.
- high-risk في P2-03 يحتاج 3 reviewers نشطين من 3 independence groups.
- append-only audit/history.
- material report يوقف النتيجة فورًا.
- لا fail-open path.
- لا `trustScore` مركبة ولا ranking للمراجعين.
- Audit rates لا تظهر قبل 20 تدقيقًا مكتملًا.

## 6) أهم الإنجازات المكتملة على main

### P2-03 — ثالث مراجع للحالات الحساسة
- PR #6.
- main commit `62ed3168f030e7a933f9faa5666f1a5f1cea6c43`.
- high-risk thresholds موحدة في `lib/review-engine/risk-policy.ts`.

### P2-04 — immutable revisions
- PR #7.
- main commit `d32434356eeae46e51c0547fd46f430fa350e0a5`.
- submissions/approvals revisions append-only + lineage + current pointers.

### P2-05 — report resolution/correction/reapproval
- PR #8.
- main commit `16a6a844f9636373df83a44204579e0164ae9cd8`.
- material report يسقط current approval، correction تجبر revisions واعتماد جديد، different_version يسحب bundle.

### P2Q-01 — unpredictable audit sampling
- PR #10.
- main commit `c308bc79ea8dfd7e01e6f68a6a565de0198efadd`.
- 10% baseline / 50% high-risk، CSPRNG بعد تجميد submission، decision append-only، لا يكشف selected للمراجع.

### P2Q-02 — audit outcomes + reviewer calibration
- PR #12.
- main commit `120a43d62517141a3ed0c14cd07d6128655303fa`.
- independent auditor، findings append-only، correction → changes_requested، minimum sample 20، no trustScore.

### P2Q-03 — reference calibration gate
- PR #14.
- main commit `6c2c6fdd9db420de36d88fac9b67e49320792313`.
- reviewer يبدأ probation.
- min 10 reference cases؛ >=95% category agreement؛ >=90% recall؛ >=90% precision؛ zero missed high-sensitivity event؛ max severity delta = 1.
- deterministic matching، independent references، stale-reference rechecks، reactivation يحتاج fresh pass.

### P2Q-04 — automatic/manual Safety Hold
- PR #16.
- main commit `70eeb381bdb834ff89b646ac20263602e531d61f`.
- immediate hold عند high-sensitivity missed event أو severity delta=3.
- aggregate بعد 20 audit: 5 corrections / 3 missed-event audits / 3 large-delta audits في آخر 20.
- hold يعلق reviewer + internal account ويسقط current trust لأي bundle تعتمد عليه كمراجع/مدقق/محرر.
- manual collusion suspicion Admin-only + stored evidence؛ suspicion ليست إدانة.
- resume = human resolution → fresh P2Q-03 calibration → Admin activation.

### P2Q-05 — internal quality evidence dashboard
- PR #18.
- main commit `f2bccaa7a92ba07bf73523139774c05c92f08b1d`.
- `/internal/quality` read-only لـAdmin وactive Editorial فقط.
- Safety Holds/conflicts/audit calibration/reference calibration.
- no score/ranking؛ rates تحت 20 مخفية.

### P3-01 — Arabic real search engine
- PR #20.
- main commit `5b35f66fcd10beead3e022afcc5e98faffb478e0`.
- deterministic Arabic/original-title normalization/ranking.
- همزات/ياء/تشكيل/تطويل/أرقام عربية وفارسية.
- input 2–80 chars / max 8 tokens.
- parameterized SQL؛ candidate cap 256؛ final results 8.
- no fuzzy AI.
- `hasVerifiedReview` لا تصبح true إلا active version + verified bundle + current approval.

### P3-02 — real search results UI
- PR #22.
- main commit `a34ae4c67305553b90a53b1b943ce8cad3cf040f`.
- main CI #271 SUCCESS؛ **146/146** engine tests وقتها.
- `/search` حقيقية.
- الحالات: verified / in_review / catalog_only / not_found.
- in_review لا تُخمن؛ تحتاج workflow حقيقي على active version.
- verified لها الأولوية لو نسخة أخرى under review.
- Hero يذهب إلى `/search?q=...` بدل رسالة placeholder.
- لا link لمراجعة وهمية؛ ذلك مؤجل لـP3-03.

### آخر handoff على main قبل P3-03
- PR #23.
- main commit `512edb7315b443fae12ad69147b65952ff5cb857`.
- CI #273 SUCCESS.

## 7) P3-03 — المهمة الحالية بالضبط

Roadmap: ربط `/review` ببيانات فعلية بدل النموذج hard-coded.

### الحالة الحالية
- الفرع: `agent/p3-03-real-review-page`
- head قبل هذا handoff: `e94aaf07c9d441b0f9422696bb392b322b671609`
- commit message: `Add fail-closed public review loader`
- CI #275 SUCCESS.
- **151/151 engine tests، 0 fail**.
- `test:migrations` SUCCESS: **18 migration files / 24 product tables**.
- `lint:local` SUCCESS.
- `build:local` SUCCESS.
- تقدير P3-03 بعد هذا checkpoint: حوالي **40–45%**. المشروع العام يظل **99%**.

### ما أضيف فعليًا في checkpoint الحالي

1. `lib/public-review.ts`
   - strict `parsePublicReviewLocator` يقبل `bundleId` فقط.
   - طول bundle id محدود بـ160 ولا control characters.
   - يبني DTO عامة من bundle موثقة فقط.
   - يعيد استخدام `assessReviewQuality` بدل تكرار trust rules.
   - لا يخرج reviewer identities أو independence groups للواجهة العامة.
   - يخرج counts/categories/facts/severity/spoiler level وmetadata العامة اللازمة.
   - لا يخترع نص spoiler إضافيًا.

2. `db/public-review-service.ts`
   - `loadPublicReview({ bundleId })` يحمل bundle من `loadReviewBundle`.
   - ثم يعمل **Final DB Gate** قبل إرجاع أي public data:
     - `review_bundles.status = verified`
     - `current_approval_id IS NOT NULL`
     - `published_at IS NOT NULL`
     - `title_versions.status = active`
     - current editorial approval تخص نفس bundle وحالتها `approved`
     - لا `review_reports` بحالة `open` أو `investigating`
   - URL/bundleId مجرد locator وليس authority.
   - metadata parser يرفض أي قيم غير صالحة أو ناقصة.

3. `tests/public-review.test.ts`
   - locator strict/bounded.
   - verified bundle → public DTO بلا reviewer identities.
   - metadata identity mismatch → fail closed.
   - blocking report → refuse public DTO.
   - spoiler level محفوظ كما هو ولا يتم اختلاق expanded spoiler copy.

4. `package.json`
   - `tests/public-review.test.ts` داخل `test:engine`.

### قرار عرض مهم اتخذناه
- لا توجد taxonomy عربية رسمية محفوظة في DB تقول 1=خفيف/2=متوسط/…؛ لذلك **لا تخترع level labels**.
- اعرض مثلًا «شدة 2 من 4» مع شريط بصري فقط إذا لزم.
- وضع «من غير حرق»: إذا `spoilerLevel=contextual/major` أخفِ/اختصر النص المخزن؛ **لا تضف تتمة من خيال الواجهة** كما كان الـDemo القديم يفعل.

### `/review` الحالية قبل الإكمال
- `app/review/page.tsx` ما زالت Client Component hard-coded لنموذج «مدينة الغيم».
- فيها `reviewCategories` ثابتة، قرار ثابت، عمر 9، confidence card، version demo، وإضافة نص spoiler مخترع عند إيقاف spoiler-free.
- يجب إزالة البيانات الوهمية وربط الصفحة بـDTO الجديدة مع الحفاظ قدر الإمكان على التصميم والتفاعل.

## 8) الخطوات التالية الدقيقة لـP3-03

نفّذها بهذا الترتيب، ولا تقفز إلى P3-04:

1. أضف **SQLite verifier للـpublic-review final DB gate**، لا تكتفِ pure tests:
   - verified/current/active/published/approved → يسمح.
   - open/investigating report → يمنع.
   - bundle conflicted/withdrawn → يمنع.
   - active version تتحول superseded/withdrawn → يمنع stale URL.
   - current approval تُزال/تتغير → يمنع.
   - foreign-key/invariants تظل سليمة.
2. اربط verifier داخل `test:migrations`.
3. CI كامل. أي أحمر: أصلح قبل UI.
4. حوّل `/review` إلى Server Page تقرأ locator من query/path بشكل واضح، وتستدعي `loadPublicReview`.
5. افصل التفاعل الحالي إلى Client presentation component يستقبل `PublicReviewView` فقط؛ لا D1 داخل client.
6. حالات الصفحة العامة:
   - review موجودة وصالحة → العرض الحقيقي.
   - locator مفقود/غير صالح/not current → حالة «المراجعة غير متاحة حاليًا» + رجوع للبحث، لا fallback demo.
7. اربط نتائج `/search` التي حالتها verified بالـbundle الحالية الصحيحة. لا تجعل title id وحده يفتح نسخة عشوائية إذا كان هناك أكثر من version.
8. حافظ على spoiler-free بدون اختلاق نصوص.
9. لا تعرض confidence كـ«درجة ثقة رقمية»؛ إن استخدمت `high/medium` من QualityAssessment فاعرضها كحالة جودة مفهومة، لا score.
10. أضف tests للـpresentation mapping والـlocator link.
11. شغّل الأربع checkpoints:
    - `npm run test:engine`
    - `npm run test:migrations`
    - `npm run lint:local`
    - `npm run build:local`
12. افحص diff يدويًا بحثًا عن formatting noise أو حذف تاريخ.
13. حدّث `docs/ROADMAP.md` و`docs/PROJECT_STATE.md` فقط بما تم فعليًا.
14. PR من SHA مختبرة → PR CI → verify mergeable/head unchanged → squash merge → main CI.
15. **بعد نجاح main CI لـP3-03: لا تبدأ P3-04. انتقل إلى Cloudflare deployment first.**

## 9) اتفاق النشر بعد P3-03

المستخدم سأل متى سيرى التغييرات الفعلية واتفقنا على التالي:

- بعد P3-03 مباشرة نوقف بناء roadmap مؤقتًا.
- أول Deploy حقيقي على Cloudflare Workers + D1.
- تطبيق جميع migrations على D1 الحقيقية.
- اختبار public home/search/review.
- المسارات الداخلية تبقى fail-closed، ثم Cloudflare Access قبل استخدامها فعليًا.
- لا يوجد production URL حتى يتم deploy واختباره.
- المستخدم قد يحتاج فقط خطوة تسجيل/ربط Cloudflare؛ لا تطلب منه نسخ secret/API token داخل المحادثة.
- بعد أن يرى النسخة المنشورة ويختبرها، نكمل P3-04 وما بعدها.

## 10) ما بعد P3-03 حسب ROADMAP

- `P3-04` خفيف/مجاني — حفظ حدود الأسرة محليًا بلا اسم طفل أو تاريخ ميلاد.
- `P3-05` خفيف/مجاني — فلاتر النوع/العمر/حالة التحقق.
- `P3-06` خفيف/مجاني — صفحات سياسة المراجعة والخصوصية والتصحيح.
- `P0-05` مراجعة بصرية نهائية مؤجلة.
- `P4-01` accessibility.
- `P4-02` performance على موبايل/اتصال بطيء.
- `P4-03` critical: 20 مراجعة تجريبية + مقارنة قرارات engine يدويًا.
- `P4-04` إطلاق مغلق لـ10 أسر.
- `P4-05` إصلاحات ثم أول إطلاق عام.

## 11) ملاحظات تشغيلية صغيرة لا تُنسى

- كان هناك عدد كبير من GitHub Failure emails أثناء P2Q-03/P2Q-04 بسبب commits وسيطة؛ تم تغيير الأسلوب إلى checkpoints أكبر ونظيفة.
- في P3-02 تم اكتشاف formatting noise قبل merge وإصلاحه؛ افحص diff دائمًا حتى مع CI أخضر.
- ظهر branch فارغ اسمه `noop` بالخطأ أثناء استخدام أداة GitHub؛ لم يغير أي ملف ولم يلمس `main`. أداة الجلسة وقتها لم تسمح بحذف ref. يمكن تنظيفه لاحقًا فقط لو توجد طريقة آمنة لحذف branch؛ **لا force ولا التفاف خطر لمجرد تنظيفه**.
- في جلسة أقدم حدثت كتابات GitHub عرضية لملفات `x` و`dummy` بسبب اختيار أداة خاطئة، وتم حذفها فورًا والتحقق من استعادة tree؛ لا تكرر ذلك.
- لا تعتمد على CI الأخضر وحده في trust work؛ اعمل manual architecture/security review للـinvariants قبل PR.
- لا تزيد النسبة بسبب documentation/check فقط بصورة مبالغ فيها؛ النسبة ترتفع مع milestone حقيقي.

## 12) Prompt قصير جاهز للمحادثة الجديدة

انسخ هذا فقط في محادثة جديدة إذا أردت:

> استكمل مشروع «قبل المشاهدة» من آخر checkpoint، ولا تنشئ مشروعًا جديدًا ولا تعيد أي جزء من الصفر. المستودع: https://github.com/Hosyss/qabl-almushahada . الفرع الحالي: `agent/p3-03-real-review-page`. أولًا اقرأ بالترتيب: `AGENTS.md`, `README.md`, `docs/CHAT_HANDOFF_2026-08-12.md`, `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, `docs/ENGINE_TRUST_MODEL.md`, `docs/FREE_PLAN_WORKFLOW.md`, `docs/CLOUDFLARE_DEPLOYMENT.md`. تحقق من head/CI قبل التعديل. آخر checkpoint قبل handoff كان `e94aaf07c9d441b0f9422696bb392b322b671609` وCI #275 أخضر بـ151/151 اختبار و18 migrations/24 tables. المهمة الحالية P3-03: ربط `/review` بالبيانات الحقيقية fail-closed. كمل من الخطوات المكتوبة في handoff. الجودة أهم من السرعة، لا commits وسيطة ناقصة، أي CI أحمر يتصلح قبل أي feature، وبعد كل تغيير حقيقي اكتب نسبة P3-03 ونسبة المشروع. بعد اكتمال P3-03 وmain CI، لا تبدأ P3-04؛ نفذ أول Cloudflare deploy حقيقي لكي أرى التغييرات.
