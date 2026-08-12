# Cloudflare deployment target

هدف النشر النهائي لمشروع «قبل المشاهدة» هو Cloudflare Workers مع D1، وليس static Pages، لأن التطبيق يستخدم Server Actions وD1 ومسارات داخلية محمية.

## قواعد الأمان قبل النقل

- الموقع العام يبقى مفتوحًا للقراءة.
- `/internal` والـServer Actions الداخلية تستخدم مزود هوية صريحًا، ولا تعتمد تلقائيًا على هيدرز `oai-authenticated-user-*` خارج استضافة ChatGPT.
- عند تفعيل Cloudflare Access يجب التحقق server-side من `Cf-Access-Jwt-Assertion` بالتوقيع و`issuer` و`audience`؛ لا يكفي هيدر البريد وحده.
- إذا لم تُضبط Access بعد، يمكن نشر الصفحات العامة فقط؛ `/internal` يفشل مغلقًا لأن `INTERNAL_AUTH_MODE` غير موجود.
- D1 production لا يُربط بمعرف وهمي. المعرّف المحلي `00000000-0000-4000-8000-000000000000` مرفوض صراحة في مولد إعداد الإنتاج.
- API token وAccount ID خاصان بأداة Wrangler/CI ولا يتم نسخ أي منهما إلى Worker vars.

## إعداد الإنتاج المولد

لا نلتزم بـ`wrangler.jsonc` يحتوي IDs ثابتة في Git. بدلًا من ذلك:

- `scripts/prepare-cloudflare-deploy.mjs` يتحقق من قيم الإنتاج ثم يولد ملفًا داخل `.wrangler/production/wrangler.jsonc`؛ المجلد كله ignored من Git.
- `vite.config.ts` يستخدم binding المحلي الوهمي فقط عند التطوير/المعاينة. عند وجود `CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH` يترك ملف Wrangler الخارجي مصدر الحقيقة بدل أن يطغى عليه بالـplaceholder.
- إعداد الإنتاج يضيف:
  - Worker باسم افتراضي `qabl-almushahada`.
  - D1 binding باسم `DB` مع `migrations_dir` الذي يشير إلى `drizzle`.
  - Images binding باسم `IMAGES` لأن `worker/index.ts` يستخدمه لمسار تحسين الصور.
  - `nodejs_compat`.
  - Workers observability بنسبة sampling قدرها 10%.

## المتغيرات المطلوبة لبناء/نشر الإنتاج

مطلوبة دائمًا:

- `CF_D1_DATABASE_ID=<real-d1-uuid>`
- `CF_D1_DATABASE_NAME=<real-d1-name>`

اختيارية:

- `CF_WORKER_NAME=qabl-almushahada`

لتفعيل `/internal` عبر Cloudflare Access، يجب ضبط **الاثنين معًا**:

- `CF_ACCESS_TEAM_DOMAIN=https://<team>.cloudflareaccess.com`
- `CF_ACCESS_AUD=<application-audience-tag>`

ولأول bootstrap فقط يمكن إضافة:

- `INTERNAL_BOOTSTRAP_ADMIN_EMAIL=<first-admin-email>`

بعد إنشاء أول Admin، احذف متغير bootstrap من بيئة الإنتاج.

Wrangler authentication في الجهاز أو CI يستخدم `CLOUDFLARE_API_TOKEN` و`CLOUDFLARE_ACCOUNT_ID` عند الحاجة؛ مولد الإعداد يتجاهلهما ولا يضعهما داخل Worker config.

## أوامر المشروع

- `npm run cloudflare:prepare` — يولد config فقط ويفشل إذا كان D1 ID/Name ناقصين أو placeholder.
- `npm run cloudflare:build` — يولد config ثم يبني vinext/Vite مع نفس config الإنتاج؛ لا ينفذ remote writes.
- `npm run cloudflare:migrate` — يطبق migrations على D1 remote عبر binding `DB`. هذا أمر remote write صريح.
- `npm run cloudflare:deploy` — يبني بإعداد الإنتاج ثم ينفذ `wrangler deploy`. يتطلب Wrangler authentication فعليًا.

Cloudflare Vite plugin يولد output Worker configuration أثناء build؛ بعد نجاح build يستخدم `wrangler deploy` ذلك output تلقائيًا.

## ترتيب أول نشر

1. في حساب Cloudflare الحالي، أنشئ D1 جديدًا **لهذا المشروع فقط**؛ لا تعيد استخدام قاعدة مشروع آخر.
2. ضع الاسم والـUUID الحقيقيين في متغيرات بيئة البناء.
3. شغّل الأربع فحوص الإلزامية للمشروع.
4. شغّل `npm run cloudflare:build` للتأكد من أن production config نفسه يبني بنجاح.
5. شغّل `npm run cloudflare:migrate` وراجع migrations التي ستطبق على D1 الجديدة.
6. شغّل `npm run cloudflare:deploy` واحفظ URL الحقيقي الناتج من `workers.dev`.
7. اختبر `/` و`/review` من الرابط الحقيقي.
8. قبل فتح `/internal`، أنشئ Access application وحدد Team Domain وAUD ثم أعد deploy بمتغيرات Access.
9. اختبر أن `/internal` مرفوض بدون Access، ويعمل للمستخدم المصرح فقط، ثم نفذ bootstrap لأول Admin واحذف متغير bootstrap بعد نجاحه.

## حالة الاتصال الحالية

المستودع أصبح قابلًا للبناء بإعداد Cloudflare إنتاج حقيقي، لكن هذه الجلسة لا تملك Cloudflare API/CLI authentication متصلًا لإنشاء D1 أو تنفيذ `wrangler deploy` باسم المستخدم. لذلك لا يجوز الادعاء بوجود URL Cloudflare جديد قبل تنفيذ الخطوات remote والحصول على الرابط من Cloudflare نفسها.
