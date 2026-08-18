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

## الشغل المستقل المنجز أثناء انتظار Work

هذه PRs **ليست جزءًا من #84**، وكلها بدأت من `main` الحالي حتى تبقى مراجعة #84 مستقلة:

### PR #86 — About / Product transparency

- صفحة `/about` عامة أصلية تشرح الغرض من الموقع وحدوده، والفرق بين الدليل والتحليل التحريري والحكم العملي.
- تربط مبدأ `unknown ≠ none` بلغة عربية واضحة، وتوضح أن الموقع ليس خدمة بث ولا جهة تصنيف عمري رسمية.
- self-canonical + sitemap + transparency navigation.
- Browser QA: run `32131230729` success، Desktop + 390px screenshots سليمة.
- Clean CI: Checkpoint `32131411945`, Public Quality `32131411903`, B4 `32131411915` — كلها success.
- Clean head: `259c7b36e8b4c2c4af8d1594d18b050b83c38cfa`.

### PR #87 — AdSense readiness policy

- Docs-only؛ لا AdSense code/cookie/tracking/CMP.
- يحدد الصفحات غير المناسبة للإعلانات مستقبلًا: search/internal/API/error/fail-closed/low-value navigation.
- content-value audit للعشرة تحليلات: لا exact duplicate في `scopeAr` أو `analysisAr`، والنص الأساسي المقاس داخليًا يتراوح من 923 إلى 1208 حرفًا من دون اعتبار ذلك معيار Google أو سببًا للحشو.
- Audit run `32131607925` success.
- Clean CI: Checkpoint `32131785605`, Public Quality `32131785501`, B4 `32131785527` — كلها success.
- Clean head: `e36e1af74e3edcfabb5f90ef58bf34546da2a43b`.

### PR #88 — Artwork rights gate

- لا تغيير بصري.
- الصور الحالية موثقة كـ`project_created_illustration` وتظل معلنة للمستخدم بأنها ليست الملصق الرسمي.
- أي asset خارجي مستقبلي يحتاج `sourceUrl + rightsBasis + attribution` على مستوى النوع.
- توثيق أن TMDB/OMDb/IMDb ليست مسارات مجانية تلقائية لمشروع ربحي، وأن Commons يحتاج مراجعة ترخيص asset-by-asset.
- Clean CI: Checkpoint `32132264706`, Public Quality `32132264654`, B4 `32132264685` — كلها success.
- Clean head: `b1a22ae2ab5522fc35a38772fd3527b8cda44291`.

### PR #89 — Review Article structured data

- يضيف Article JSON-LD الصادق للمراجعات البشرية ومراجعات الأدلة الصالحة فقط.
- التحريري كان يملك Article JSON-LD بالفعل؛ لم نكرر markup.
- لا `reviewRating` أو `aggregateRating` أو stars.
- أصلح استخدام `approvedAt` القديم كـ`modifiedTime` رغم أنه يسبق `publishedAt`؛ المراجعة البشرية الآن لا تدعي تاريخ تعديل غير موجود.
- invalid/fail-closed review لا تحصل على Article markup.
- Clean CI: Checkpoint `32133350907`, Public Quality `32133351008`, B4 `32133350993` — كلها success.
- Clean head: `47ceca2d76d1ad6f6e6e8349d79a45f98d8c05a7`.

### PR #90 — Favicon search readiness

- نفس الرسم والألوان والـviewBox؛ لا إعادة تصميم.
- رفع intrinsic SVG size من 24×24 إلى 64×64 مع 1:1، مع بقاء `/favicon.svg` مربوطًا من root metadata.
- Clean CI: Checkpoint `32133480753`, Public Quality `32133480792`, B4 `32133480852` — كلها success.
- Clean head: `f9f5516a979926cc5a6e8f35fad6344a27691a87`.

### PR #91 — Worker security headers

- `nosniff` + `strict-origin-when-cross-origin` لكل responses.
- HTML فقط: `frame-ancestors 'none'` + `X-Frame-Options: DENY`.
- حذف `X-Powered-By` إن ظهر.
- لا broad script CSP؛ لا `default-src/script-src/style-src/unsafe-inline/unsafe-eval`.
- functional tests على HTML/JSON responses.
- Production baseline read-only أثبت أن headers الأربعة كانت غائبة قبل التغيير: run `32133764795`.
- Clean CI: Checkpoint `32134038640`, Public Quality `32134038686`, B4 `32134038690` — كلها success.
- Clean head: `dc7cdb4ccbe588182f9b3bc6e30cb5e24c661ab1`.

## Combined hardening rehearsal — PR #98

PR #98 يجمع **#86 + #87 + #88 + #89 + #90 + #91** فوق `main` للتحقق فقط؛ لا يشمل #84.

- تعارض #86/#90 الوحيد في SEO test حُل بالحفاظ على About + favicon guards معًا.
- Combined local runtime QA run `32134665658`: success.
  - production-style Cloudflare build محلي نجح من دون deploy.
  - security wrapper runtime contract نجح.
  - `/about` rendered canonical نجح.
  - favicon 64×64 rendered نجح.
- بعد حذف QA workflow المؤقت، clean integrated head: `6ecb48354d288079c9940fbddcd9b584d15b3e6d`.
- Clean integrated CI: Checkpoint `32134887423`, Public Quality `32134887453`, B4 `32134887431` — كلها success.
- PR #98 يبقى Draft validation فقط ولا يُدمج من المراجعة نفسها.

## PR #99 — Hostname migration readiness

- Docs-only؛ لا DNS/route/canonical mutation.
- يوضح أن `buildtools` هو account-level `workers.dev` subdomain، لذلك تغييره قد يؤثر في Workers أخرى بالحساب.
- يخطط Zero-downtime migration: attach + verify hostname الجديد أولًا، ثم canonical cutover، ثم انتقال البحث، مع إبقاء القديم حيًا أثناء التحقق.
- Clean CI: Checkpoint `32134809406`, Public Quality `32134809419`, B4 `32134809430` — كلها success.
- Clean head: `46b5e941b77964776c03b88df18014f0817d11d2`.

## Privacy / language sweeps

- repo sweep لم يجد `gtag`, Google Analytics/Tag Manager, PostHog, Plausible, Matomo, Clarity أو Facebook Pixel؛ لا tracker معروف مخفي خلف سياسة الخصوصية الحالية.
- sweep للكلمات العامية القديمة المستهدفة مثل `إيه / ينفع / إزاي / مش` لم يُظهر hits في repo الحالي.
- لا `target="_blank"` في repo الحالي، لذلك لا يوجد gap حالي متعلق بـ`rel="noopener noreferrer"`.

## ما لا يتغير

- Full Evidence / Exact Version يبقى fail-closed.
- absence of evidence ليست evidence of absence.
- لا Severity أو version أو reviewer أو fingerprint أو license مخترعة.
- Kids-In-Mind يبقى link-only factual reference وفق العقد الحالي.
- لا schema/migration جديدة في #84.
- لا فيلم 11 ضمن هذا checkpoint.
- تغيير hostname الحالي موضوع مستقل، وليس جزءًا من #84.

## المطلوب من Work الخميس

### أولًا — راجع #84 مستقلًا

اعمل مراجعة مستقلة لـPR #84 على clean head `2d0d3eaa26bcc5b8c194f65f5e1e8509c496674a`، مع التركيز على:

1. سلامة public report UI وعدم السماح للعميل بتزوير target kind/id.
2. اتساق سياسة الخصوصية/التصحيح مع backend الحالي.
3. صحة fail-closed semantics، خصوصًا أن public intake لا يساوي material report تلقائيًا.
4. عدم المساس بـDecision Engine / Exact-Version gates / D1 schema.
5. صحة `secrets.required` في Production config وعدم تسريب قيمة السر.
6. ملاءمة النص العربي العام وعدم إعادة المصطلحات التقنية الخام أو اللهجة العامية القديمة.
7. مراجعة diff الكامل والـCI المذكور أعلاه، لا الاكتفاء بوصف PR.

### ثانيًا — راجع حزمة hardening

بعد #84، راجع PR #98 كشجرة تكامل لـ#86–#91، ثم افتح PRs الأصلية عند الحاجة لمعرفة سبب كل تغيير وقرار النطاق. راجع #99 منفصلًا كخطة hostname فقط.

**لا تدمج #84 أو #98 من المراجعة نفسها.** إذا وجدت Work blocker، سجله أولًا. إذا كانت النتيجة Approve بلا blocker، ارجع للمستخدم/الشات لاتخاذ قرار Merge/Production صريح.
