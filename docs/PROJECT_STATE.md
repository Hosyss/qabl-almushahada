# حالة مشروع «قبل المشاهدة»

آخر تحديث: 14 أغسطس 2026

## الحالة الحالية

- الكتالوج الحقيقي: **200/200** عنوان داخل D1.
- صفحات التحليل التحريري الجزئي الحالية: **4 فقط** — Cars وE.T. وHarry Potter 1 وMinions.
- `P4-03B2`: **مكتملة ومتحققة إنتاجيًا**.
- `P4-03B3`: **مكتملة ومتحققة إنتاجيًا** عند checkpoint المستخدم المعتمد.
- `P4-03B4 — Editorial Persistence`: **التنفيذ على الفرع مكتمل، والتحقق الإنتاجي ما زال pending حتى الدمج والنشر والـLive Smoke**.
- لم نضف عنوانًا خامسًا ولم نبدأ `P4-03C` ولم نفتح قناة البلاغ العام ولم نخفض أي بوابة حكم أو ثقة.

## P4-03B4 — ما تم تنفيذه

- أضيف مسار persistence مستقل للتحليل التحريري الجزئي داخل D1، منفصل عن `evidence_review_publications` وعن `review_bundles` والمراجعات البشرية.
- revisions التحليل التحريري append-only؛ السجل المنشور وchildren المرتبطة به غير قابلة للتعديل أو الحذف تاريخيًا.
- لكل عمل `current-head` واحد مرتبط دائمًا بـ`title_id`، والانتقال إلى successor مباشر فقط مع optimistic revision lock وفشل مغلق عند stale/concurrent write.
- current-head لا يقبل snapshot ناقصة: publication revision + المصادر + الوقائع + روابط claim/source + المحاور غير المحسومة يجب أن تكون مكتملة قبل أن تصبح current.
- snapshot تحفظ حالة النشر، العناوين، السنة/النوع، نسخة السياسة، تاريخ النشر/التحديث، النطاق، الخلاصة، حالة القرار، أهلية القرار، والبصمة.
- المصادر تحفظ الرابط والنوع وتاريخ الوصول ومجموعة الاستقلال وأساس الاستخدام/الحقوق والعزو عند الحاجة؛ الوقائع تحفظ المحور والنص العربي وقوة الإسناد وروابط المصادر.
- الأربع صفحات الحالية جُمّدت كـbootstrap fixtures بعد إثبات parity مع الـTypeScript registry السابقة والبصمات قبل حذف الـRegistry.
- bootstrap يعاد تشغيله بأمان: يستخدم IDs ثابتة للسجل التاريخي ويضيف head فقط عند اكتمال البيانات؛ redeploy يعيد التحقق بدل إنشاء نسخ مكررة.
- `cloudflare:migrate` يطبق schema أولًا، ثم bootstrap الأربع صفحات idempotently، ثم يقارن current-heads الإنتاجية بالـfixtures: `title_id` وrevision والبصمة وحالة النشر والقرار وعدد المصادر/الوقائع/روابط الإسناد والمحاور.
- القراءة العامة أصبحت من D1 فقط: الرئيسية و`/review` وصفحة العنوان والبحث والـsitemap تستخدم current-head ولا يوجد fallback صامت إلى Registry.
- البحث يجلب metadata خفيفة للـcurrent editorial heads من D1 فقط بعد ترتيب النتائج، بلا تحميل كامل للـchildren وبلا قائمة ثابتة للأعمال الأربعة.
- `/titles` أصبح يحتوي فلترًا حقيقيًا «له تحليل تحريري» من current-head في D1، منفصلًا عن `hasVerifiedReview` البشري.
- الـhydrator يعيد بناء publication من D1، يمررها على قواعد النشر الجزئي، ويعيد حساب fingerprint؛ أي mismatch أو state غير صالحة يفشل مغلقًا.
- TypeScript content registry وملفات publications الأربعة القديمة أزيلت بعد نجاح parity؛ بقي helper generic بلا IDs أو محتوى ثابت لقراءة presentation/fingerprint المرفقين من الـD1 hydrated publication.

## اختبارات B4

- immutability للrevision والchildren المنشورة.
- منع snapshot ناقصة من أن تصبح current.
- current-head successor/revision lock والتزامن ومحاولة stale update والrollback.
- current-head/IDOR: المسار العام لا يختار revision تاريخية مباشرة.
- fingerprint tamper = fail closed.
- bootstrap parity والبصمات للصفحات الأربع.
- bootstrap D1 idempotence وعدم تكرار الصفوف.
- منع رجوع runtime Registry أو bootstrap-data fallback داخل `app`/`db`/`lib`.
- production current-head verifier يرفض تغيير القرار أو البصمة أو العدادات أو وجود head غير متوقعة في هذا checkpoint.
- directory query regression يثبت أن حالة التحليل مشتقة من `editorial_publication_heads.current_revision_id` وحالة revision المنشورة، وليس من IDs ثابتة.

## قاعدة الحكم لم تتغير

- الصفحات الأربع تظل داخليًا `decisionEligible = false` و`decisionStatus = insufficient_data`.
- ما لم يثبت يظل `uncertain`، وصمت المصدر لا يتحول إلى `none`.
- التحليل التحريري الجزئي لا يدعي مشاهدة نسخة محددة ولا يصدر «مناسب/غير مناسب».
- مسار المراجعة الموثقة لنسخة محددة يحتفظ بكل بوابات النسخة والمراجعين والاعتماد والتدقيق والبلاغات كما هو.
- persistence الجديدة لا تمنح أي سلطة قرار إضافية؛ هي تخزين وتاريخ نشر وتدقيق فقط.

## ما بقي لإغلاق B4 إنتاجيًا

- فتح PR مستقل من فرع B4 بعد آخر Quality Gates.
- نجاح Checkpoint + Public Quality + B4 persistence checks على الـPR.
- الدمج إلى `main` ثم نجاح Checkpoint على main.
- Cloudflare deploy: migrations + bootstrap D1 + current-head verification قبل Worker deploy.
- فحص D1 الإنتاجية للأربع current-heads.
- Live Product Smoke للأربع صفحات والمسارات invalid/mixed والسitemap، مع فحص حي إضافي لفلتر `/titles?editorialStatus=editorial`.
- بعد نجاح كل ما سبق فقط تتحول حالة `P4-03B4` إلى **مكتملة ومتحققة إنتاجيًا**.

## آخر تحقق على فرع B4 قبل التوثيق

- branch: `agent/p4-03-b4-editorial-persistence-final`.
- Checkpoint عند `0efcb8b92608ac69122a45eb7d818a80e134acbd`: **success** — engine + directory + persistence + migrations + lint + production build.
- Public Quality على نفس commit: **success**.
- تغييرات لاحقة تخص توثيق B4 فقط يجب أن تمر بنفس البوابات قبل فتح الـPR.

## بلاغ المستخدم — مؤجل أمنيًا

الـbackend الداخلي لدورة البلاغات موجود، لكن public intake ما زال `false`. الربط العام يحتاج checkpoint أمني مستقلًا يشمل server-owned binding وvalidation وrate limiting/anti-spam وحماية دورة التصحيح. لذلك لم يُضف زر أو endpoint عام جزئي.

## الخطوة الحالية

إغلاق `P4-03B4` كـcheckpoint مستقل فقط. **لا نضيف فيلمًا خامسًا، لا نبدأ `P4-03C`، ولا نفتح قناة البلاغ العام في هذه الجلسة.**
