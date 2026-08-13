# حالة مشروع «قبل المشاهدة»

آخر تحديث: 14 أغسطس 2026

## الحالة الحالية

- الكتالوج الحقيقي: **200/200** عنوان داخل D1.
- صفحات التحليل التحريري الجزئي الحالية: **4 فقط** — Cars وE.T. وHarry Potter 1 وMinions.
- `P4-03B2`: **مكتملة ومتحققة إنتاجيًا**.
- `P4-03B3`: **مكتملة ومتحققة إنتاجيًا**.
- `P4-03B4 — Editorial Persistence`: **مكتملة ومتحققة إنتاجيًا** عند final product checkpoint `8acb3b3ad3b59919b194ab606bba857e16fd8ca5`.
- لم نضف عنوانًا خامسًا ولم نبدأ `P4-03C` ولم نفتح قناة البلاغ العام ولم نخفض أي بوابة حكم أو ثقة.

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

## التوقف بعد B4

`P4-03B4` مغلقة إنتاجيًا. **نتوقف هنا قبل إضافة فيلم خامس أو بدء `P4-03C` أو فتح قناة البلاغ العام.**
