# قبل المشاهدة — جاهزية نقل الرابط العام

**التاريخ:** 18 أغسطس 2026  
**الحالة:** خطة فقط — لا تغيير DNS أو Worker route أو canonical ضمن هذا checkpoint.

## الوضع الحالي

الرابط العام الحالي:

`https://qabl-almushahada.buildtools.workers.dev`

بنية `workers.dev` هي:

`<WORKER_NAME>.<ACCOUNT_SUBDOMAIN>.workers.dev`

لذلك:

- `qabl-almushahada` هو اسم الـWorker.
- `buildtools` هو subdomain على مستوى حساب Cloudflare، وليس جزءًا من اسم مشروع «قبل المشاهدة» نفسه.

## الخيارات الرسمية في Cloudflare

### 1. Custom Domain — المسار المفضل للإنتاج عند امتلاك Domain

Cloudflare توصي بـCustom Domain عندما يكون الـWorker هو origin للتطبيق.

المتطلبات:

- Zone نشطة داخل Cloudflare.
- Domain أو subdomain مملوك داخل هذه الـZone.
- لا يمكن ربط hostname في Zone لا نملكها.

عند إضافة Custom Domain، Cloudflare تنشئ DNS/certificate المطلوبين تلقائيًا.

هذا هو المسار الأنظف طويل الأجل مثل:

`qabl.example.com` أو domain مستقل للعلامة.

### 2. تغيير account-level workers.dev subdomain

Cloudflare تسمح بتغيير `<ACCOUNT_SUBDOMAIN>.workers.dev` من Dashboard.

لكن هذا قرار **على مستوى الحساب**، وليس Worker «قبل المشاهدة» وحده. بما أن كل Worker في الحساب يأخذ شكل `<worker>.<account-subdomain>.workers.dev`، فلا نغيّر `buildtools` من أجل هذا المشروع فقط من دون جرد كل Workers والروابط العامة التي تعتمد عليه.

### 3. إنشاء Route أمام origin خارجي

Routes مناسبة عندما يوجد origin خارجي خلف Cloudflare. «قبل المشاهدة» نفسه Worker origin، لذلك Custom Domain أنسب من Route عند توافر Domain.

## المبدأ الحاكم للنقل

**لا نحذف الرابط القديم قبل إثبات الرابط الجديد.**

النقل يجب أن يتم على مرحلتين:

1. **Attach + verify**: إضافة hostname الجديد مع إبقاء `workers.dev` الحالي فعالًا.
2. **Canonical cutover**: بعد نجاح smoke/SEO/SSL، تغيير مصدر canonical في الكود إلى hostname الجديد ثم نشره.

بعد cutover يمكن إبقاء الرابط القديم يعمل فترة انتقالية، والأفضل لاحقًا تحويله إلى الجديد إن أمكن بطريقة لا تنتج redirect loops ولا تكسر APIs.

## مصدر canonical الحالي

المشروع يملك مصدرًا مركزيًا واحدًا للـorigin العام في `lib/public-catalog.ts`:

`PUBLIC_SITE_ORIGIN`

وهو مستخدم في canonical URLs وstructured data وsitemap. هذه ميزة مهمة: عند النقل لا نعمل search/replace عشوائيًا على عشرات الملفات؛ نغيّر المصدر المركزي بعد تجهيز hostname الجديد فقط ثم نجري regression كامل.

## خطة النقل الفعلية عندما يتوفر hostname معتمد

### المرحلة A — قبل أي تغيير خارجي

- اختيار hostname النهائي.
- التأكد أن Zone مملوكة ومضافة إلى Cloudflare إذا كان Custom Domain.
- التأكد أن الاسم لا يحمل اسمًا شخصيًا أو تسمية مؤقتة.
- أخذ snapshot من:
  - الصفحة الرئيسية.
  - robots.txt.
  - sitemap.xml.
  - canonical للرئيسية وصفحة title وصفحة review.
  - Search Console إن كان مربوطًا.

### المرحلة B — إضافة hostname فقط

- إضافة Custom Domain إلى Worker مع إبقاء `workers.dev` فعالًا.
- انتظار SSL حتى Active.
- Smoke على hostname الجديد:
  - `/`
  - `/titles`
  - `/search?q=nemo`
  - editorial review منشورة.
  - `/review-policy`, `/privacy`, `/corrections`, `/about` عندما تكون منشورة.
  - `/robots.txt`, `/sitemap.xml`.
- التأكد أن D1/Images/AI bindings هي نفسها ولا يوجد Worker جديد بقاعدة منفصلة بالخطأ.

### المرحلة C — canonical cutover

- تغيير `PUBLIC_SITE_ORIGIN` إلى hostname الجديد في PR مستقل.
- تحديث أي tests ثابتة على الـorigin القديم.
- تشغيل Checkpoint + Public Quality + B4 + Browser QA.
- نشر التغيير فقط بعد الموافقة الصريحة.
- فحص HTML الحي للتأكد أن canonical/OpenGraph/JSON-LD/sitemap جميعها تشير إلى الجديد.

### المرحلة D — النقل في محركات البحث

- إبقاء القديم قابلًا للوصول مؤقتًا.
- إذا تقرر عمل redirect، يستخدم redirect دائم إلى نفس path/query على الجديد بعد التأكد من عدم وجود loop.
- تقديم sitemap الجديد/فحص URL في Search Console عند الحاجة.
- عدم حذف القديم أو تعطيله قبل التأكد أن الجديد يعمل للمستخدمين ومحركات البحث.

## لماذا لا نغيّر account subdomain الآن؟

لأن `buildtools` account-level. تغييره قد يغيّر workers.dev URLs لمشاريع أخرى على الحساب نفسه. هذا خارج نطاق «قبل المشاهدة» وحده ويحتاج جردًا وموافقة لأنه تغيير متعدد المشاريع وقابل للتسبب في كسر روابط قائمة.

## لماذا لا ننشئ Domain أو حسابًا جديدًا الآن؟

شراء/تسجيل Domain، أو إنشاء حساب Cloudflare منفصل، أو نقل D1/Worker بين حسابات هي إجراءات خارجية حرجة. لا تُنفذ تلقائيًا ضمن مراجعة كود أو checkpoint داخلي.

## المصادر الرسمية

- workers.dev: https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- Routes and domains: https://developers.cloudflare.com/workers/configuration/routing/
- Custom Domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- Wrangler routing configuration: https://developers.cloudflare.com/workers/wrangler/configuration/

## القرار الحالي

لا تغيير للرابط الآن. نحافظ على Production الحالي، ونجهز فقط مسار النقل بحيث يكون التغيير المستقبلي إضافةً واختبارًا أولًا، ثم canonical cutover، وليس «إطفاء القديم ثم تجربة الجديد».
