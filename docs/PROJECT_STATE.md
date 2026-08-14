# حالة مشروع «قبل المشاهدة»

آخر تحديث: 14 أغسطس 2026

## الحالة الحالية

- الكتالوج الحقيقي: **200/200** عنوان داخل D1.
- صفحات التحليل التحريري الجزئي الحالية: **7** — Cars وE.T. وHarry Potter 1 وMinions وBarbie وJurassic Park وMy Neighbor Totoro.
- `P4-03B2`: **مكتملة ومتحققة إنتاجيًا**.
- `P4-03B3`: **مكتملة ومتحققة إنتاجيًا**.
- `P4-03B4 — Editorial Persistence`: **مكتملة ومتحققة إنتاجيًا** عند final product checkpoint `8acb3b3ad3b59919b194ab606bba857e16fd8ca5`.
- `P4-03C1`: مكتملة على `main` عند `fc1b7a3d183dc6f7d419c14abb39b21d131763d6` وأضافت ثلاثة تحليلات جزئية فقط.
- `P4-03C2A — Asymmetric Decision Semantics`: **مكتملة على Draft PR #67 وقيد مراجعة المالك**؛ لم تُدمج إلى `main` ولم يحدث Production D1 write أو deploy.
- `P4-03C2B — Original Editorial Artwork`: **مكتملة على نفس الـDraft PR من ناحية التنفيذ والـCI والـDesktop/Mobile visual QA**؛ سبعة أغلفة توضيحية أصلية محلية للسبعة المنشورين، مع fallback محايد لبقية الكتالوج وبدون مصدر صور خارجي.
- لا يوجد فيلم ثامن، ولا Exact Version Migration.

## P4-03C2B — صور السبعة

- ملفات WebP محلية `720×960` تحت `public/artwork/`، ولا يوجد hotlink أو TMDB/IMDb/Commons runtime.
- الربط allowlist صريحة حسب `titleId`؛ العنوان غير المعروف لا يرث صورة عمل آخر.
- تظهر في الرئيسية والدليل والبحث والاقتراحات وصفحة العمل وصفحات التحليل/المراجعة.
- صفحة العمل والتحليل توضّح أن الصورة «غلاف توضيحي أصلي — ليس الملصق الرسمي».
- الصور للعرض فقط ولا تدخل إلى evidence أو decision engine أو D1.
- تفاصيل المصدر والتوجيه البصري في `docs/P4_03_C2B_EDITORIAL_ARTWORK.md`.
- GitHub Checkpoint على commit إصلاح الـlayout `64602ef23f69e8d45ae53a60e49ee6e068b80cc7`: Engine **273/273** + migrations + lint + production build كلها ناجحة (`31799767945`).
- Public Quality ناجح (`31799765395`) وB4 Persistence ناجح (`31799768017`).
- Real visual QA بعد الإصلاح ناجح في run `31799765313`: **24** فحص rendered على Desktop `1440×1000` وMobile `390×844`، بدون صور مكسورة، وبدون horizontal overflow، و`max initial CLS = 0.0000`.
- keyboard/ARIA للاقتراحات ناجح: `ArrowDown` يحدد `aria-activedescendant` و`Escape` يغلق القائمة.
- lazy loading مثبت: الموبايل لا يجلب كل أغلفة الرئيسية قبل الحاجة، ثم يحمل الباقي بعد scroll؛ بحث `HarryPotter` يجلب غلاف Harry فقط عند ظهور الاقتراح.
- الـQA كشف مشكلة حقيقية واحدة وأُصلحت: شبكة دليل العناوين على Desktop كانت تسمح بأربع بطاقات ضيقة فتُكسّر الاسم الإنجليزي الطويل لـHarry Potter بشكل سيئ. تغيّر الحد الأدنى للعمود من `245px` إلى `320px`، ثم أُعيدت مصفوفة الـ24 فحصًا ونجحت، وصورة `desktop-titles` بعد الإصلاح روجعت بصريًا.
- Artifact الدليل البصري: ID `9218835497`، digest `sha256:b5ed5d37a00c06c47a073502fb2be8360d2c07567d8d2a61ef2287da27ff61b3`.
- لا يوجد مانع QA معروف داخل C2B الآن؛ المتبقي هو مراجعة المالك للـdiff قبل أي merge/deploy.

## P4-03C2A — حالة فرع المراجعة

- المبدأ الجديد غير متماثل: دليل `present` مؤهل مع شدة موثقة تتجاوز حدود الأسرة يستطيع إثبات `exceeds_family_limits` حتى مع محاور أخرى مجهولة.
- `within_family_limits` يظل محميًا: يحتاج exact-version + نجاح Full Evidence Gate صراحةً + تغطية مؤهلة كاملة للمحاور العشرة بلا unknown/conflict/severity gap.
- `unknown` لا يتحول إلى `none`.
- بيانات P4 الجزئية تحمل `decisionScope=work_level` فقط؛ لا تدعي أن نسخ العرض متطابقة.
- Jurassic Park هو الطيار الوحيد في الواجهة. Wikipedia المسموحة تثبت وجود الخوف والعنف على مستوى العمل، لكن C1 لا يحتوي شدة رقمية مؤهلة لهما، لذلك النتيجة الفعلية ما زالت `insufficient_data` بدل اختراع شدة.
- Kids-In-Mind يبقى link-only ولا يحسم القرار.
- تسمية preset العامة أصبحت «إعدادات افتراضية قابلة للتعديل» مع نفي صريح لأي تصنيف عمري رسمي أو عالمي؛ وعند وجود إعدادات محلية توضح الواجهة أنها overrides للخوف/التنمر فوق defaults لبقية المحاور، وليست تخصيصًا كاملًا.
- تصميم Exact Version البديل مسجل في ADR فقط، بلا migration/schema change.

## P4-03B4 — ما أصبح إنتاجيًا

- مسار persistence مستقل للتحليل التحريري الجزئي داخل D1، منفصل عن `evidence_review_publications` وعن `review_bundles` والمراجعات البشرية.
- publication revisions وchildren المنشورة append-only وغير قابلة للتعديل أو الحذف تاريخيًا.
- لكل عمل `current-head` واحد مرتبط دائمًا بـ`title_id`، والانتقال إلى successor مباشر فقط مع optimistic revision lock وفشل مغلق عند stale/concurrent write.
- current-head لا يقبل snapshot ناقصة؛ revision والمصادر والوقائع وروابط claim/source والمحاور غير المحسومة يجب أن تكون مكتملة قبل أن تصبح current.
- snapshot تحفظ حالة النشر والعناوين والسنة/النوع ونسخة السياسة والتواريخ والنطاق والخلاصة وحالة القرار وأهلية القرار والبصمة.
- المصادر تحفظ الرابط والنوع وتاريخ الوصول ومجموعة الاستقلال وأساس الاستخدام/الحقوق والعزو عند الحاجة، والوقائع تحفظ المحور والنص العربي وقوة الإسناد وروابط المصادر.
- الأربع صفحات الحالية جُمّدت كـbootstrap fixtures بعد إثبات parity والبصمات مع الـTypeScript registry السابقة، ثم حُذفت Registry وملفات publications الأربعة القديمة داخل نفس checkpoint.
- bootstrap idempotent؛ redeploy لا ينشئ نسخًا مكررة ويعيد التحقق من current-heads بدل افتراض سلامتها.
- `cloudflare:migrate` يطبق schema ثم bootstrap الأربع صفحات ويقارن current-heads الإنتاجية بالـfixtures: `title_id` وrevision والبصمة وحالة النشر والقرار وعدد المصادر/الوقائع/روابط الإسناد والمحاور، حتى إذا لم توجد migration جديدة في redeploy.
- القراءة العامة أصبحت D1-only: الرئيسية و`/review` وصفحة العنوان والبحث والـsitemap تستخدم current-head ولا يوجد fallback صامت إلى Registry.
- البحث يجلب metadata خفيفة للـcurrent editorial heads من D1 فقط، بلا قائمة ثابتة للأعمال الأربعة.
- `/titles` يحتوي فلترًا حقيقيًا «له تحليل تحريري» من current-head في D1، منفصلًا عن `hasVerifiedReview` البشري.
- الـhydrator يعيد بناء publication من D1، يمرر قواعد النشر الجزئي، ويعيد حساب fingerprint؛ أي mismatch أو state غير صالحة يفشل مغلقًا.

## اختبارات وضمانات B4

- immutability للrevision والchildren المنشورة.
- منع snapshot ناقصة من أن تصبح current.
- current-head successor/revision lock والتزامن ومحاولة stale update والrollback.
- current-head/IDOR: المسار العام لا يختار revision تاريخية مباشرة.
- fingerprint tamper = fail closed.
- bootstrap parity والبصمات للصفحات الأربع.
- bootstrap D1 idempotence وعدم تكرار الصفوف.
- منع رجوع runtime Registry أو bootstrap-data fallback داخل `app`/`db`/`lib`.
- production current-head verifier يرفض تغيير القرار أو البصمة أو العدادات أو وجود head غير متوقعة في هذا checkpoint.
- فلتر الدليل يعتمد على `editorial_publication_heads.current_revision_id` وحالة revision المنشورة.
- بعد أول deploy لـB4 كشف Live Smoke regression في ترتيب اقتراحات `HarryPotter`: أثناء cutover أُعيدت خوارزمية بحث أقدم بالخطأ. PR #64 أعاد خوارزمية B3 المحافظة كما كانت وأضيف regression دائم يثبت tie-break الأقدم أولًا عند تعادل أجزاء السلسلة.

## قاعدة الحكم لم تتغير

- الصفحات الأربع تظل داخليًا `decisionEligible = false` و`decisionStatus = insufficient_data`.
- ما لم يثبت يظل `uncertain`، وصمت المصدر لا يتحول إلى `none`.
- التحليل التحريري الجزئي لا يدعي مشاهدة نسخة محددة ولا يصدر «مناسب/غير مناسب».
- مسار المراجعة الموثقة لنسخة محددة يحتفظ بكل بوابات النسخة والمراجعين والاعتماد والتدقيق والبلاغات كما هو.
- persistence الجديدة لا تمنح أي سلطة قرار إضافية؛ هي تخزين وتاريخ نشر وتدقيق فقط.

## Production checkpoint — B4

Final product commit قبل توثيق الإغلاق:

`8acb3b3ad3b59919b194ab606bba857e16fd8ca5`

التحقق النهائي:

- PR #63: تنفيذ Editorial Persistence الأساسي، ثم الدمج إلى main عند `56ec293144ef5f1c788f35a311acb5f4dabb0d91`.
- PR #64: إصلاح regression ترتيب البحث المكتشف بواسطة Live Smoke، ثم الدمج إلى main عند `8acb3b3ad3b59919b194ab606bba857e16fd8ca5`.
- main Checkpoint run `31748757205`: **success** — engine + directory + persistence + migrations + lint + production build.
- main B4 persistence run `31748757222`: **success**.
- Cloudflare production deploy run `31748757264`: **success** — local gates + D1 bootstrap/current-head verification + remote schema/taxonomy + Worker + public routes.
- Live Product Smoke run `31748835647`: **success** — homepage + Harry conservative discovery + الأربع editorial paths + `/titles` + invalid/mixed locators + sitemap.
- live editorial-directory filter diagnostic run `31748924588`: **success** — `/titles?editorialStatus=editorial` يعرض بالضبط Q182153 وQ11621 وQ102438 وQ13619743 فقط في هذا checkpoint.

## بلاغ المستخدم — مؤجل أمنيًا

الـbackend الداخلي لدورة البلاغات موجود، لكن public intake ما زال `false`. الربط العام يحتاج checkpoint أمني مستقلًا يشمل server-owned binding وvalidation وrate limiting/anti-spam وحماية دورة التصحيح. لذلك لم يُضف زر أو endpoint عام جزئي.

## حالة التوقف الحالية

`P4-03C2A` و`P4-03C2B` مكتملتان على Draft PR #67 من ناحية التنفيذ والـCI والـvisual QA، لكنهما **غير مدمجتين وغير منشورتين**. التوقف الآن للمراجعة النهائية للمالك قبل أي merge أو Production deploy.