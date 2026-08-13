# Cloudflare deployment target

آخر تحديث تشغيلي: 13 أغسطس 2026

هدف النشر النهائي لمشروع «قبل المشاهدة» هو **Cloudflare Workers + D1** من نفس المستودع. هذا هو الإنتاج الفعلي الحالي؛ `chatgpt.site` ليس مصدر النشر.

## الإنتاج الحالي المؤكد

- Worker: `https://qabl-almushahada.buildtools.workers.dev`
- D1: `qabl-almushahada-production`
- آخر production feature commit مؤكد: `8b8ae4d535881d439c9097f2729df421b787c879`
- Cloudflare production Run: `31686061613`
- main Checkpoint verification Run: `31686061646`
- D1: **22/22 migrations**
- product tables محليًا بعد كل migrations: **33**
- remote objective taxonomy CHECKs/category guards: verified
- bindings: `DB`, `IMAGES`, `AI`, `ASSETS`
- Worker Version ID: `3b0ab9e1-f66c-426b-9547-a543bb1dbca5`

P3S-07 منشورة ومتحقق منها فعليًا على production.

## قواعد الأمان

- الموقع العام مفتوح للقراءة.
- `/internal` والـServer Actions الداخلية تستخدم مزود هوية صريحًا.
- Cloudflare Access يتحقق server-side من `Cf-Access-Jwt-Assertion` بالتوقيع وissuer/audience/expiry؛ هيدر البريد وحده غير كافٍ.
- إذا لم تُضبط Access، المسارات الداخلية تفشل مغلقًا بدل fallback صامت.
- D1 production لا تُربط بمعرف وهمي.
- `CLOUDFLARE_API_TOKEN` و`CLOUDFLARE_ACCOUNT_ID` خاصان بـWrangler/CI ولا يتم نسخ أي منهما إلى Worker vars أو Git.
- لا يُعد أي deploy ناجحًا قبل migration verification + schema verification + أي remote feature guards المطلوبة + Worker deploy + smoke tests.

## إعداد الإنتاج المولد

لا نلتزم بـ`wrangler.jsonc` يحتوي IDs ثابتة في Git.

`scripts/prepare-cloudflare-deploy.mjs` يولد `.wrangler/production/wrangler.jsonc` بعد التحقق من:

- `CF_D1_DATABASE_ID=<real-d1-uuid>`
- `CF_D1_DATABASE_NAME=<real-d1-name>`
- Worker name، افتراضيًا `qabl-almushahada`

الإعداد يتضمن:

- D1 binding باسم `DB`.
- Images binding باسم `IMAGES`.
- Workers AI binding باسم `AI`.
- static assets binding باسم `ASSETS`.
- `nodejs_compat`.
- `workers_dev: true`.
- observability sampling المحددة في مولد الإعداد.

`vite.config.ts` يستخدم placeholder محلي فقط للتطوير، ولا يطغى على config الإنتاج الخارجي.

## أوامر المشروع

- `npm run cloudflare:prepare` — يولد config فقط.
- `npm run cloudflare:build` — يبني artifact الإنتاج بنفس config الحقيقي.
- `npm run cloudflare:migrate` — يطبق migrations على D1 remote.
- `npm run cloudflare:deploy` — build + `wrangler deploy`.

## نقل migrations إلى D1

المشروع لا يعتمد على `wrangler d1 migrations apply --remote` مباشرة لأن trigger-heavy migrations سببت سابقًا `SQLITE_ERROR: incomplete input` رغم نجاح نفس SQL محليًا.

`scripts/cloudflare-migrate.mjs` يستخدم file ingestion محافظًا:

1. يقرأ `d1_migrations` ويرفض gap/divergence.
2. يجهز migration معلقة كملف مؤقت بعد تطبيع line endings.
3. يضيف تسجيل migration داخل نفس import file.
4. ينفذ `wrangler d1 execute --remote --file`.
5. يعيد قراءة سجل migrations بعد كل ملف.
6. يرفض الاستمرار لو لم تسجل migration الصحيحة بالترتيب.
7. يحذف ملفات staging دائمًا.

بهذا لا نعدل SQL الموثوق لمجرد تجاوز parser، ولا ندعي النجاح عند تنفيذ جزئي.

## GitHub Actions — مسار الإنتاج

`.github/workflows/deploy-cloudflare.yml` يعمل عند push إلى `main` أو `workflow_dispatch` ويطبق بالترتيب:

1. Node 22 + `npm ci`.
2. فحص وجود Cloudflare credentials.
3. `npm run test:engine`.
4. `npm run test:migrations`.
5. `npm run lint:local`.
6. `npm run build:local`.
7. resolve/reuse exact D1 باسم `qabl-almushahada-production` أو إنشاء واحدة فقط إذا غير موجودة.
8. `npm run cloudflare:build`.
9. `npm run cloudflare:migrate`.
10. remote D1 schema verification.
11. remote P3S-07 objective taxonomy CHECK/trigger verification.
12. Worker deploy.
13. public smoke tests.
14. summary بالـWorker URL وD1 والcommit.

لو credentials ناقصة، workflow تكتب بوضوح أن النشر لم يبدأ ولا تلمس Cloudflare resources.

## P3S-05 — checkpoint السابق

Cloudflare Run `31676888290` أثبت:

- **20/20 migrations** applied.
- source-policy verification ناجحة.
- `env.AI` موجودة فعليًا في Worker bindings.
- Worker deploy ناجح.
- public smoke tests ناجحة.

Worker Version ID وقتها: `a0de055e-8a85-4cd9-9ab6-57971b909fae`.

## P3S-06 — checkpoint السابق

PR #38 دُمجت إلى main commit `d914b223c9db1d8622c4ba33a5681b7436842cf9`.

Cloudflare Run `31679684634` أثبت:

- `test:engine`: **219/219 passed, 0 failed**.
- `test:migrations`: **21 migration files / 33 product tables** محليًا.
- migration `0018_evidence_publication_gate.sql` نُفذت remote عبر atomic file ingestion.
- Cloudflare D1 migrations اكتملت: **21/21**.
- remote schema verification وجد جداول P3S-06 الستة:
  - `evidence_review_publications`
  - `evidence_publication_sources`
  - `evidence_publication_assertions`
  - `evidence_publication_facts`
  - `evidence_publication_fact_flags`
  - `evidence_review_publication_heads`
- Worker bindings بعد النشر:
  - `env.DB` → `qabl-almushahada-production`
  - `env.IMAGES`
  - `env.AI`
  - `env.ASSETS`
- Worker deploy نجح على:
  - `https://qabl-almushahada.buildtools.workers.dev`
- Worker Version ID:
  - `cab77fad-1466-42c7-a057-736a18384020`
- smoke tests نجحت للمسارات:
  - `/`
  - `/review`
  - `/search?q=nemo`
  - `/review-policy`
  - `/privacy`
  - `/corrections`
- `/review?publicationId=missing-publication` أعادت النص الآمن **«المراجعة غير متاحة حاليًا»**، أي لا Demo/fallback عند locator غير صالح.

لذلك **P3S-06 production-complete**.

## P3S-07 — deploy الإنتاجي المؤكد

PR #40 دُمجت إلى main commit `8b8ae4d535881d439c9097f2729df421b787c879`.

Cloudflare Run `31686061613` أثبت:

- `test:engine`: **227/227 passed, 0 failed**.
- `test:migrations`: **22 migration files / 33 product tables** محليًا.
- migration `0019_objective_content_taxonomy.sql` نُفذت remote عبر atomic file ingestion.
- Cloudflare D1 migrations اكتملت: **22/22**.
- remote schema verification نجح بعد migration رقم 22.
- remote objective taxonomy verification قرأ `sqlite_master` وأكد:
  - وجود كل subtypes الجديدة في CHECKs لكل من `observation_flags` و`evidence_publication_fact_flags`.
  - وجود `observation_flags_p3s07_category_guard`.
  - وجود `evidence_publication_fact_flags_p3s07_category_guard`.
  - وجود قواعد توافق `sexualContent`, `substances`, و`religious_reference_or_practice` داخل الـtriggers.
- Worker bindings بعد النشر:
  - `env.DB` → `qabl-almushahada-production`
  - `env.IMAGES`
  - `env.AI`
  - `env.ASSETS`
- Worker deploy نجح على:
  - `https://qabl-almushahada.buildtools.workers.dev`
- Worker Version ID:
  - `3b0ab9e1-f66c-426b-9547-a543bb1dbca5`
- smoke tests نجحت للمسارات:
  - `/`
  - `/review`
  - `/review?publicationId=missing-publication`
  - `/search?q=nemo`
  - `/review-policy`
  - `/privacy`
  - `/corrections`

لذلك **P3S-07 production-complete**.

## الخطوة التالية: P3S-08

P3S-08 هي أول catalog production من Wikidata إلى D1 ثم أول صفحات SEO حقيقية من البيانات القانونية.

قواعدها قبل أي كتابة production:

- preview/validation/provenance أولًا.
- metadata الكتالوجية لا تصبح review أو evidence publication تلقائيًا.
- لا زرع مراجعات موثقة مصطنعة لأغراض SEO.
- لا posters أو مصادر غير مرخصة.
- أي تغيير في deployment contract أو D1 schema يمر بنفس سلسلة الجودة الكاملة.

## Cloudflare Access

لتفعيل `/internal` عبر Cloudflare Access:

- `CF_ACCESS_TEAM_DOMAIN=https://<team>.cloudflareaccess.com`
- `CF_ACCESS_AUD=<application-audience-tag>`

ولأول bootstrap فقط:

- `INTERNAL_BOOTSTRAP_ADMIN_EMAIL=<first-admin-email>`

بعد إنشاء أول Admin، يحذف bootstrap variable.

## قاعدة الإغلاق

لا تقل إن شيء «منشور» أو «ناجح» بناءً على build محلي أو branch CI فقط.

الحالة تصبح production-confirmed فقط بعد:

```text
Branch CI
  → PR CI
  → Merge
  → Main CI
  → Remote migrations
  → Remote schema/feature-guard verification
  → Worker deploy
  → Smoke tests
```

أي فشل في أي نقطة يوقف التقدم إلى المرحلة التالية حتى يُفهم السبب ويُصلح.