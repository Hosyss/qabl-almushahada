# Cloudflare deployment target

هدف النشر النهائي لمشروع «قبل المشاهدة» هو Cloudflare Workers مع D1، وليس static Pages، لأن التطبيق يستخدم Server Actions وD1 ومسارات داخلية محمية.

## قواعد الأمان قبل النقل

- الموقع العام يبقى مفتوحًا للقراءة.
- `/internal` والـServer Actions الداخلية تستخدم مزود هوية صريحًا، ولا تعتمد تلقائيًا على هيدرز `oai-authenticated-user-*` خارج استضافة ChatGPT.
- عند Cloudflare يجب استخدام `cloudflare_access` والتحقق server-side من `Cf-Access-Jwt-Assertion` بالتوقيع و`issuer` و`audience`.
- لا يكفي الاعتماد على `Cf-Access-Authenticated-User-Email` وحده.
- أي غياب أو خطأ في إعدادات Access يفشل مغلقًا.
- D1 production database لا يُنشأ أو يُربط بمعرف وهمي داخل Git.

## متغيرات البيئة المقصودة

- `INTERNAL_AUTH_MODE=cloudflare_access`
- `CF_ACCESS_TEAM_DOMAIN=https://<team>.cloudflareaccess.com`
- `CF_ACCESS_AUD=<application-audience-tag>`
- `INTERNAL_BOOTSTRAP_ADMIN_EMAIL=<first-admin-email>` في مرحلة bootstrap فقط، ثم يفضل إزالته بعد إنشاء أول Admin.

للاستضافة المؤقتة الحالية فقط يمكن استخدام `INTERNAL_AUTH_MODE=chatgpt` إذا كانت المنصة الموثوقة هي التي تضيف هيدرز OpenAI وتزيل أي قيم مزورة من العميل.

## قبل أول نشر Cloudflare

1. إنشاء Worker production للمشروع من نفس المستودع.
2. إنشاء D1 production database وربط binding باسم `DB`.
3. تطبيق كل migrations بالترتيب على D1.
4. إنشاء Cloudflare Access application للمسارات الداخلية والحصول على Team Domain وAUD.
5. ضبط متغيرات البيئة السابقة.
6. تشغيل `npm run test:engine`, `npm run test:migrations`, `npm run lint:local`, `npm run build:local`.
7. تنفيذ dry-run للنشر ثم النشر الفعلي.
8. اختبار `/` و`/review` للعامة، واختبار أن `/internal` يفشل بدون Access وينجح فقط للمستخدم المصرح.
