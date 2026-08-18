# قبل المشاهدة — حالة ما بعد نشر P4

**التاريخ:** 18 أغسطس 2026  
**Production main:** `282c2b8311fafd7ef3c98a3a51c968be644c0266`  
**Production origin الحالي:** `https://qabl-almushahada.buildtools.workers.dev`

## مصدر الحقيقة الحالي

هذا الملف أحدث من `PROJECT_HANDOFF.md` و`docs/PROJECT_STATE.md` و`docs/ROADMAP.md` في البنود الخاصة بـP4. لا تستخدم أرقامها القديمة للحكم على حالة P4 الحالية.

## ما هو منشور الآن

- العدد العام ثابت عند **10 تحليلات تحريرية**؛ لا يوجد فيلم حادي عشر ضمن هذا checkpoint.
- الحكم العملي للأسرة للتحليلات التحريرية الناضجة منشور، مع الحفاظ على `unknown ≠ none` وعدم اختراع Severity.
- إعدادات الأسرة محلية، مع fallback للجلسة إذا تعذر `localStorage`.
- تحسينات الوصول منشورة: skip link، focus ring مزدوج، keyboard combobox، reduced motion، وتحسين التباين.
- تحسين Mobile/slow-network منشور: تعطيل speculative Next.js prefetch من روابط الرئيسية، مع الحفاظ على التنقل عند الضغط.
- SEO/indexing readiness منشور: canonical للرئيسية والسياسات والمراجعات، `/search` noindex، `/internal/*` noindex/nofollow، و`robots.txt` يمنع `/internal` و`/api/`.
- Backend استقبال البلاغات العامة منشور من PR #71، وجدول `public_report_intakes` موجود على Remote D1 مع payload immutability وno-delete triggers.

## أدلة ما بعد النشر

- PR #82 دمج شجرة التكامل التي جمعت Practical Verdict + Performance + Accessibility + SEO بعد PR #71.
- Combined CI قبل الدمج: Checkpoint verification + Public Quality + B4 editorial persistence = success.
- Combined Chrome QA قبل الدمج: `failures: []`.
- Live smoke بعد الدمج أثبت أن النسخة الجديدة حية: homepage/review copy، canonical/noindex، robots، وhoneypot report path.
- Remote D1 verification بعد الدمج استخدم `SELECT` فقط وأثبت وجود:
  - `public_report_intakes`
  - `public_report_intakes_payload_immutable_update`
  - `public_report_intakes_no_delete`

## Public Report UI — PR #84

Draft PR #84 يكمل تجربة البلاغ العامة بواجهة للمستخدم على المراجعات الصحيحة فقط.

المبادئ الثابتة في الـDraft:

- target kind/id تأتي من المراجعة المحملة server-side؛ لا يستطيع المستخدم اختيار target عشوائي من النموذج.
- ستة أسباب بلاغ مطابقة لعقد الـAPI.
- البلاغ يدخل triage أولًا ولا يغير الحكم المنشور تلقائيًا.
- evidence/editorial reports لا تُسقط المحتوى تلقائيًا.
- لا بريد أو حساب مطلوبان.
- IP الخام لا يُخزن في intake row؛ يستخدم Worker عنوان الاتصال لاشتقاق HMAC client key لمكافحة الإساءة.
- QA الوظيفي للواجهة يستخدم D1 محليًا وSecret اختبار فقط؛ لا Production write.

## BLOCKER قبل نشر #84

`PUBLIC_REPORT_HMAC_SECRET` **غير مضبوط أو غير متاح حاليًا على Production Worker**.

تم إثبات ذلك بprobe آمن لا يمكنه إنشاء row: POST صالح غير honeypot إلى editorial target غير موجود عمدًا. لو كان الـSecret متاحًا لمر الطلب عبر HMAC ثم وصل إلى target lookup وعاد application-level `404`. النتيجة الفعلية كانت `503` مع fail-closed message، وبالتالي لم يحدث أي D1 write.

**لا تدمج #84 ولا تعرض نموذج البلاغ للعامة قبل:**

1. ضبط Worker secret `PUBLIC_REPORT_HMAC_SECRET` بقيمة عشوائية قوية (32 حرفًا على الأقل) من دون طباعتها في logs أو حفظها في Git.
2. إعادة missing-target readiness probe والتأكد أنه يعيد `404` بدل `503`.
3. تشغيل CI وBrowser QA النهائي على clean head لـ#84.
4. مراجعة Work المستقلة للـPR قبل الدمج.

ضبط Production secret إجراء خارجي حرج؛ لا يتم ضمن مراجعة أو Draft عادية.

## ما لا يتغير

- Full Evidence / Exact Version يبقى fail-closed.
- absence of evidence ليست evidence of absence.
- لا Severity أو version أو reviewer أو fingerprint أو license مخترعة.
- Kids-In-Mind يبقى link-only factual reference وفق العقد الحالي.
- لا schema/migration جديدة في #84.
- تغيير hostname الحالي موضوع مستقل، وليس جزءًا من #84.

## الخطوة التالية

أكمل #84 محليًا حتى clean Draft مع QA أخضر، ثم توقف عند حاجز Production secret. بعد مراجعة Work وضبط الـSecret، أعد probe الحقيقي ثم ادمج/انشر فقط إذا بقيت كل البوابات خضراء.
