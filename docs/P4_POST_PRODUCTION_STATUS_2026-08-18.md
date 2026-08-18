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
- `PUBLIC_REPORT_HMAC_SECRET` أصبح مربوطًا فعليًا بالـProduction Worker `qabl-almushahada`.

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
- Production config يعلن `PUBLIC_REPORT_HMAC_SECRET` ضمن `secrets.required` من دون حفظ قيمته في Git.

## Browser QA لـ#84

- Chrome `151.0.7922.108`.
- QA استخدم D1 محليًا وSecret اختبار محلي فقط؛ لا Production write.
- أول بلاغ editorial قُبل مع UUID صالح.
- محاولة ثانية لنفس العميل/الهدف مُنعت كـduplicate/rate-limit.
- `COUNT(*)` المحلي بعد المحاولتين = `1` فقط.
- invalid review لم تعرض نموذج البلاغ.
- Mobile 390px: لا horizontal overflow.
- Browser QA run `32116318791`: success؛ artifact `public-report-ui-browser-qa` ID `9316858475`.

## Production HMAC readiness — مكتمل

قبل الضبط، missing-target probe الحقيقي كان يعيد HTTP `503` لأن `PUBLIC_REPORT_HMAC_SECRET` غير موجود.

بعد موافقة المستخدم الصريحة تم تنفيذ bootstrap مؤقت آمن على Worker الإنتاج:

- Production bootstrap run `32122706695` / job `95666447450`: success.
- Wrangler `4.92.0`.
- `secret list` أكد أن `PUBLIC_REPORT_HMAC_SECRET` كان غائبًا قبل التنفيذ.
- تم توليد قيمة عشوائية 64-byte داخل runner وتم تمريرها مباشرة إلى `wrangler secret put`؛ لم تُحفظ في Git ولم تُطبع في logs.
- `wrangler secret put` نجح ثم `secret list` أكد أن اسم السر أصبح bound، بينما قيمة السر نفسها بقيت غير قابلة للقراءة.
- missing-target probe الحقيقي أصبح HTTP `404` مع `accepted:false` والرسالة `المحتوى لم يعد متاحًا بهذه الحالة.`
- الهدف المستخدم وهمي وغير موجود عمدًا، لذلك لم يُنشأ Production intake row.
- homepage smoke بعد نشر السر نجح.
- workflow المؤقت الخاص بالbootstrap حُذف بعد حفظ الدليل، ولا يبقى في diff الخاص بـ#84.

## Clean-head #84 بعد تنظيف كل QA/bootstrap workflows المؤقتة

**Head:** `2d0d3eaa26bcc5b8c194f65f5e1e8509c496674a`

- PR #84 ما زال **Open + Draft + mergeable**.
- 12 changed files فقط.
- Checkpoint verification run `32122817962`: success — engine + catalog + persistence + migrations + lint + production build.
- Public Quality run `32122818013`: success.
- B4 editorial persistence run `32122817999`: success.
- لا QA workflow مؤقت، ولا bootstrap workflow مؤقت، ولا secret value في Git.

## ما لا يتغير

- Full Evidence / Exact Version يبقى fail-closed.
- absence of evidence ليست evidence of absence.
- لا Severity أو version أو reviewer أو fingerprint أو license مخترعة.
- Kids-In-Mind يبقى link-only factual reference وفق العقد الحالي.
- لا schema/migration جديدة في #84.
- لا فيلم 11 ضمن هذا checkpoint.
- تغيير hostname الحالي موضوع مستقل، وليس جزءًا من #84.

## المطلوب من Work الآن

اعمل مراجعة مستقلة لـPR #84 على clean head `2d0d3eaa26bcc5b8c194f65f5e1e8509c496674a`، مع التركيز على:

1. سلامة public report UI وعدم السماح للعميل بتزوير target kind/id.
2. اتساق سياسة الخصوصية/التصحيح مع backend الحالي.
3. صحة fail-closed semantics، خصوصًا أن public intake لا يساوي material report تلقائيًا.
4. عدم المساس بـDecision Engine / Exact-Version gates / D1 schema.
5. صحة `secrets.required` في Production config وعدم تسريب قيمة السر.
6. ملاءمة النص العربي العام وعدم إعادة المصطلحات التقنية الخام أو اللهجة العامية القديمة.
7. مراجعة diff الكامل والـCI المذكور أعلاه، لا الاكتفاء بوصف PR.

**لا تدمج PR #84 من المراجعة نفسها.** إذا وجدت Work blocker، سجله أولًا. إذا كانت النتيجة Approve بلا blocker، ارجع للمستخدم/الشات لاتخاذ قرار Merge/Production UI صريح.