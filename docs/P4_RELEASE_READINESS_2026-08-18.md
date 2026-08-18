# P4 Release Readiness Handoff — 2026-08-18

> هذا الملف وثيقة تنسيق فقط. لا يدمج أي PR ولا ينشر Production ولا يكتب إلى Remote D1.

## 1) مصدر الحقيقة الحالي

- `main`: `b8ed2f8c0b0465cef3c687ba03d0bc9f409241c6`.
- هذا الـmain يتضمن PR #69 ويثبت الإجمالي عند **10 تحليلات تحريرية فقط**.
- لا فيلم حادي عشر ولا دفعة محتوى جديدة ضمن مرحلة الاستعداد الحالية.
- كل العمل اللاحق موجود في Draft PRs مستقلة مبنية من نفس baseline، لذلك يجب مراجعتها وإعادة ربطها تدريجيًا قبل الدمج.

## 2) Draft PRs الجاهزة للمراجعة

| PR | الغرض | Clean head | الحالة قبل الدمج |
|---|---|---|---|
| #70 | Practical family verdict فوق التحليل التحريري الناضج من غير إضعاف Full Evidence / Exact Version | `c448edc062c90e7bbd11a1bb40afe9f27c9bf8a0` | Draft، mergeable، CI + Browser QA ناجحان |
| #71 | Secure public report intake + triage queue + migration `0027` | `4254456374efc2b96474016de67236e013e0ecc5` | Draft، mergeable، Checkpoint/Public Quality/B4 ناجحة |
| #72 | P4-01 Accessibility baseline | `7557dd2d784f40f02eba66f73ad1cca759ec665c` | Draft، mergeable، CI + Browser QA ناجحان |
| #73 | P4-02 Mobile/slow-network optimization | `423ef465134b70132390a075cdba8c7688a54869` | Draft، mergeable، CI + Browser QA ناجحان |
| #74 | SEO/indexing readiness + rendered metadata contract | `acfee7d0a3f704a88d83ee6adbde1cecd414ee9d` | Draft، mergeable، CI + rendered metadata QA ناجحان |

هذه الحالات لا تعني أن الـPRs يمكن دمجها دفعة واحدة من دون إعادة تحقق؛ جميعها بدأت من baseline واحد، وبعضها يلمس الملفات نفسها.

## 3) خريطة التداخل المعروفة

### تداخلات تحتاج rebase + مراجعة حل التعارض

- #70 ↔ #73:
  - `app/page.tsx`
  - `package.json`
- #70 ↔ #74:
  - `app/review-policy/page.tsx`
  - `app/review/page.tsx`
  - `tests/public-quality-checkpoint.test.ts`
- #72 ↔ #74:
  - `app/layout.tsx`
- #70/#71/#72/#73:
  - أكثر من PR يضيف/يغير scripts داخل `package.json`، ولذلك يجب دمج المقاصد لا اختيار نسخة ملف كاملة من أحد الفروع.

### شبه مستقل

- #71 لا يتداخل في ملفات المنتج الرئيسية مع #72/#73/#74؛ التداخل المتوقع أساسًا في `package.json` عند دخوله بعد PR آخر.
- #73 لا يتداخل مباشرة مع #74.

## 4) ترتيب المراجعة/الدمج المقترح

هذا ترتيب لتقليل المخاطر والتعارض، وليس تصريحًا بالدمج:

1. **#71 Public Report Intake**
   - لأنه الوحيد الذي يضيف migration جديدة ودورة triage أمنية.
   - Work يراجع rate limiting، HMAC/IP privacy، snapshot binding، atomic promotion، وحدود editorial/evidence correction قبل أي exposure عام.
2. **#70 Practical Verdict**
   - يراجع semantics والحكم العملي أولًا على أحدث `main` بعد #71.
   - يحافظ على `unknown != none`، ولا يخترع Severity أو Exact Version.
3. **#73 Performance**
   - يعاد ربطه بعد #70 لأن الاثنين يلمسان `app/page.tsx`.
   - يجب الحفاظ على الحكم العملي الجديد مع تعطيل prefetch غير الضروري فقط.
4. **#72 Accessibility**
   - يعاد ربطه بعد تغييرات المنتج السابقة؛ package scripts تُدمج additive.
5. **#74 SEO / Indexing**
   - يراجع ويعاد ربطه أخيرًا حتى تُطبق metadata/canonical/noindex على النسخة النهائية من `layout` و`review` والصفحات العامة.

## 5) قاعدة ما بعد كل Merge

بعد دمج أي PR — وبعد rebase الـPR التالي عليه — لا نعتمد أدلة CI القديمة وحدها. نعيد على الـHEAD الجديد:

- Checkpoint verification.
- Public Quality checkpoint.
- B4 Editorial Persistence.
- `git diff`/changed-files audit للتأكد أن حل التعارض لم يسقط جزءًا من PR سابق.

ويعاد Targeted Browser QA عندما يمس حل التعارض ملفًا سبق اختباره بالمتصفح:

- #70: verdict/form/copy على Desktop + Mobile.
- #72: keyboard/focus/reduced-motion/contrast.
- #73: prefetch contract + navigation + mobile overflow.
- #74: rendered robots/noindex/canonical contract إذا تغير `layout` أو `review` أثناء rebase.

## 6) بوابة Production الواحدة

الـworkflow الحالي `Cloudflare production deploy` يعمل تلقائيًا عند `push` إلى `main`.

عندما تكون أسرار Cloudflare متاحة، الـworkflow يقوم قبل النشر بـ:

1. Engine verification.
2. Local migration verification.
3. Lint.
4. Local build.
5. Resolve/create production D1 بصورة fail-closed.
6. Build Cloudflare artifact.
7. **Apply D1 migrations remotely**.
8. Verify remote D1 schema/guards.
9. Deploy Worker.

لهذا فإن قرار أول Merge بعد هذه المرحلة هو أيضًا قرار قد يطلق Production deploy وRemote D1 writes. لا يتم أي Merge قبل موافقة صريحة على هذا الأثر.

## 7) Final integrated QA بعد آخر Merge معتمد

لا نعتبر المرحلة منتهية إلا بعد التحقق على Production النهائي من نفس السلسلة المدمجة:

- Production deploy = success، وليس مجرد نجاح CI.
- Remote D1 migration/schema verification = success.
- Live Product Smoke = success.
- العدد العام يظل **10 تحليلات بالضبط**.
- لا فيلم 11 أو publication غير متوقع.
- الصفحة الرئيسية، `/titles`، البحث، صفحات الأعمال، وصفحات التحليل تعمل على Desktop/Mobile.
- Practical verdict لا يغيّر unknown إلى none ولا يعرض positive verdict من غير شروطه.
- Public report endpoint يفشل مغلقًا عند إعداد ناقص ولا يسمح للمستخدم باختيار actor/revision/approval.
- Accessibility: skip link/focus/combobox/dialog/reduced motion لا تتراجع.
- Performance: لا يعود prefetch غير المطلوب قبل تفاعل المستخدم.
- SEO: canonical/noindex/robots/sitemap كما في #74 بعد الدمج النهائي.
- لا metadata عامة باسم ChatGPT/OpenAI/Codex.

## 8) AdSense readiness — لا تركيب إعلانات الآن

### لا ننفذ قبل توافر بيانات حقيقية

- لا نضيف AdSense script أو Publisher ID placeholder.
- لا نضيف `ads.txt` بقيم متخيلة؛ ننتظر الـpublisher ID الحقيقي وتعليمات الحساب الفعلية.
- لا نكتب في سياسة الخصوصية أن Google ads/cookies تعمل قبل أن تكون مفعلة فعلًا.
- لا نفعل CMP شكليًا قبل اختيار/تهيئة الحل الحقيقي المطلوب للحساب والجمهور.

### قبل تفعيل AdSense فعليًا

- تحديث سياسة الخصوصية بصورة صادقة لتوضح استخدام Google/أطراف الإعلانات للكوكيز وخيارات المستخدم عندما يبدأ هذا الاستخدام.
- إعداد Google-certified CMP/consent flow عندما تنطبق متطلبات EEA/UK/Switzerland.
- مراجعة مواضع الإعلانات يدويًا قبل التفعيل؛ لا نضع إعلانات على الشاشات قليلة/عديمة المحتوى أو صفحات التنبيه/الأخطاء/الأدوات التي لا يكون المحتوى فيها هو الغرض الأساسي.
- تبقى `/internal/*` و`/api/*` خارج أي inventory إعلاني.
- `/search` لا يُستخدم كصفحة هبوط إعلانية؛ هو utility route و`noindex` في #74.
- المرشحون المبدئيون فقط بعد المراجعة: صفحات المحتوى الغنية (تحليل منشور/صفحة عمل غنية وربما الرئيسية/الدليل) مع التأكد أن الإعلان لا يغطي المحتوى ولا يربك قرار الأسرة.

المراجع التي يجب إعادة التحقق منها لحظة التفعيل لأن السياسات قد تتغير: Google Publisher Policies، AdSense Required Content/Privacy، وGoogle CMP requirements.

## 9) قرار الدومين منفصل

كل canonical/sitemap الحالية تستخدم `PUBLIC_SITE_ORIGIN` الحالي. تغيير hostname أو custom domain لا يدخل تلقائيًا ضمن أي PR من #70–#74.

قبل خطوة فهرسة/ناشر نهائية، إذا تقرر نقل الدومين فيجب تنفيذ ذلك كـcheckpoint منفصل مع:

- origin/canonical/sitemap/robots update.
- redirects من العنوان السابق.
- Search Console verification/migration plan.
- Production smoke بعد النقل.

لا يتم تغيير hostname ضمن حل تعارض أو تحسين SEO بصورة جانبية.

## 10) تعريف Done لهذه المرحلة

تكون مرحلة P4 pre-release جاهزة للمراجعة النهائية عندما:

1. Work يراجع #70–#74 ويحدد أي إصلاحات.
2. الإصلاحات تطبق على كل PR في نطاقه قبل الدمج.
3. PRs تعاد ربطها ودمجها بالتتابع مع CI بعد كل خطوة.
4. Production deployment النهائي ينجح، بما فيه Remote D1 verification.
5. Final integrated Browser/Live/SEO/Accessibility/Performance QA ينجح.
6. لا يتم تركيب AdSense أو تغيير الدومين إلا بقرار منفصل وبيانات حقيقية.

حتى ذلك الحين: **Production يبقى كما هو، وDraft PRs هي مساحة العمل والمراجعة فقط.**

## 11) Live Production baseline المثبت قبل أي Merge

تم تشغيل فحص read-only مستقل على Production الحالي في run `32101692072`. الفحص استخدم `curl` فقط ولم يكتب إلى D1 أو يغيّر Worker.

النتيجة:

- الصفحة الرئيسية تعرض بالضبط أحدث **4** تحليلات: Alice in Wonderland، Barbie، Spider-Man: No Way Home، The Hunger Games.
- الـsitemap يحتوي **10** editorial review IDs بالضبط.
- فلتر `/titles?editorialStatus=editorial` يعرض **10** title QIDs بالضبط.
- `robots.txt` يمنع `/internal` حاليًا.
- `robots.txt` **لا يمنع `/api/` حاليًا** — يعالجه #74.
- `/search` **لا يحمل `noindex` حاليًا** — يعالجه #74.
- `/search` **لا يحمل canonical حاليًا** — يعالجه #74.
- الـpublic homepage head ما زال يحتوي `codex-preview` — يزيله #74.
- الفحص انتهى `success` ولم يجد انحرافًا في عدد المحتوى المنشور.

هذا يثبت أن #74 يغلق فروقًا موجودة على Production الحالي، وليس مجرد hardening نظري.

## 12) Production configuration prerequisite لـ #71

قناة البلاغ العامة في #71 تعتمد على Worker secret اسمه `PUBLIC_REPORT_HMAC_SECRET` لاشتقاق HMAC-SHA256 من عنوان العميل بدل تخزين IP خام.

قبل اعتبار القناة مفعلة للعامة:

- يجب ضبط `PUBLIC_REPORT_HMAC_SECRET` كـCloudflare Worker secret خارج المستودع.
- الحد الأدنى الذي يفرضه الكود هو **32 حرفًا**.
- لا يوضع secret أو placeholder داخل Git أو docs أو `wrangler.jsonc`.
- إذا كان السر غائبًا أو أقصر من الحد، تفشل عملية القبول مغلقًا وتعيد API حالة عدم توفر بدل تخزين بلاغ بمفتاح غير آمن.
- D1 binding المطلوبة اسمها `DB` وتظل binding المشروع الحالية؛ migration `0027` تنشئ جدول intake عند الدمج/النشر المعتمد.
- عدم وجود public UI button في #71 متعمد؛ لا نفتح واجهة البلاغ قبل مراجعة Work لعقد التصحيح editorial/evidence وتجهيز secret الحقيقي.
