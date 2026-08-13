# Cloudflare deployment target

آخر تحديث تشغيلي: 13 أغسطس 2026

هدف النشر النهائي لمشروع «قبل المشاهدة» هو **Cloudflare Workers + D1** من نفس المستودع. `chatgpt.site` ليس مصدر النشر الحالي.

## الإنتاج الحالي المؤكد

- Worker: `https://qabl-almushahada.buildtools.workers.dev`
- D1: `qabl-almushahada-production`
- D1 ID: `f2bd0d7a-660b-4f9e-bddc-40a918dd35cc`
- migrations: **22/22**
- product tables محليًا: **33**
- bindings: `DB`, `IMAGES`, `AI`, `ASSETS`
- آخر feature/live-smoke commit قبل docs: `f46fc4d61f46eccd71a3f4d924a0e806848e80f4`
- Cloudflare production Run: `31691881366`
- main Checkpoint Run: `31691881382`
- Worker Version ID: `c8279c37-7500-48d7-bf1a-87317017fabf`
- Live product smoke Run: `31691960997`

## قاعدة الإغلاق الإنتاجي

لا نعتبر feature منشورة بناءً على branch CI أو build فقط.

```text
Branch CI
  → PR CI
  → Squash merge
  → Main CI
  → Remote migrations
  → Remote schema / feature guards
  → Worker deploy
  → Standard public smoke
  → Live product smoke عند وجود سلوك مستخدم يعتمد على D1
```

أي فشل يوقف الانتقال للمرحلة التالية حتى يُفهم السبب ويُصلح.

## GitHub Actions — Cloudflare production deploy

`.github/workflows/deploy-cloudflare.yml` يعمل على push إلى `main` و`workflow_dispatch`، وينفذ:

1. Node 22 + `npm ci`.
2. Cloudflare credential gate.
3. `npm run test:engine`.
4. `npm run test:migrations`.
5. `npm run lint:local`.
6. `npm run build:local`.
7. resolve/reuse exact D1 باسم `qabl-almushahada-production`.
8. Cloudflare production build.
9. remote D1 migrations.
10. remote schema verification.
11. remote objective taxonomy CHECK/trigger verification.
12. Worker deploy.
13. standard public smoke.

المشروع لا ينشئ D1 جديدة إذا كانت production database موجودة ومحددة، ولا يعتبر credentials الناقصة deploy ناجحًا.

## نقل migrations إلى D1

`scripts/cloudflare-migrate.mjs` يستخدم file ingestion بدل الاعتماد على inline migration parser في trigger-heavy SQL:

- يقرأ `d1_migrations` ويرفض gap/divergence.
- يحافظ على ترتيب migrations.
- يضيف تسجيل migration داخل نفس import file.
- ينفذ `wrangler d1 execute --remote --file`.
- يعيد التحقق بعد كل migration.
- يفشل مغلقًا عند التنفيذ الجزئي أو mismatch.

الحالة الحالية: **22/22 migrations** مطبقة ومتحقق منها remote.

## P3S-07 remote taxonomy gate

قبل Worker deploy، production workflow يتحقق من `sqlite_master` ويثبت:

- objective subtype CHECKs موجودة.
- `observation_flags_p3s07_category_guard` موجود.
- `evidence_publication_fact_flags_p3s07_category_guard` موجود.
- توافق `sexualContent`, `substances`, و`religious_reference_or_practice` محفوظ.

هذا gate ما زال أخضر في آخر production deploy.

## P3S-08 — Wikidata production catalog import

الاستيراد الحقيقي منفصل عن schema deploy.

`.github/workflows/import-wikidata-catalog.yml` يدعم:

- manual `workflow_dispatch`؛ و
- GitOps request مراجع عبر `ops/wikidata-catalog-import.json` على `main`.

### قواعد الأمان

- Wikidata `catalog_metadata` فقط.
- CC0 1.0 فقط.
- preview + exact SQL artifact قبل أي D1 write.
- target bounded حتى 200 record في run الواحدة.
- production request يحدد minimum validated count.
- exact production D1 + source-policy snapshot verification قبل الكتابة.
- import SQL تكتب `titles` + `title_catalog_sources` فقط.
- ممنوع إنشاء `title_versions`, `review_bundles`, approvals أو evidence publications بغرض ملء الكتالوج.
- بعد الكتابة يتم التحقق من كل `titleId/QID/contentSha256` على D1.
- smoke حي لـ`/titles`, `/title/<QID>`, `/sitemap.xml`.

### أول import production الناجح

- Run: `31690242194`
- successful rerun job: `94416044496`
- request: `p3s-08-first-known-200-retry-2`
- validated/imported: **200/200**
- exact remote provenance verification: **200/200**
- first QID: `Q44578`
- artifact: `wikidata-catalog-preview-31690242194`
- artifact ID: `9177142287`
- artifact ZIP SHA-256: `9e5ed4d87ce524959af37069851fecff93e98a8f112495fd195f04d9d2d857ab`

المحاولات السابقة توقفت قبل D1 write عند failure في request parsing / preview / upstream availability؛ لم يتم تجاوز fail-closed behavior.

## Live product smoke

`.github/workflows/live-product-smoke.yml` يعمل تلقائيًا بعد اكتمال **Cloudflare production deploy** بنجاح على `main`.

هدفه اختبار فائدة المنتج المنشور، لا مجرد صحة البنية.

العينة الثابتة الحالية من أول production catalog:

- query: `Titanic`
- expected D1 id: `wd:Q44578`

الـgate يتحقق حيًا من:

1. `/api/search-suggestions?q=Titanic` يعيد suggestions حقيقية من D1، بحد 1–5، وبها `wd:Q44578`.
2. `/search?q=Titanic` يعرض حالة مراجعة صريحة: موثقة / قيد المراجعة / لم يُراجع بعد.
3. الصفحة الرئيسية تعرض «وقائع موثقة».
4. الصفحة الرئيسية لا تحتوي اقتراحات البحث الثابتة القديمة.

آخر Live product smoke: Run `31691960997` — **success**.

## Cloudflare Access

الموقع العام مفتوح للقراءة. `/internal` فقط يستخدم مزود هوية صريحًا.

Cloudflare Access يعتمد على:

- `CF_ACCESS_TEAM_DOMAIN=https://<team>.cloudflareaccess.com`
- `CF_ACCESS_AUD=<application-audience-tag>`

التحقق server-side من JWT يشمل signature وissuer/audience/expiry. هيدر البريد وحده غير كافٍ، ولا يوجد fallback صامت إلى هوية أخرى.

لأول bootstrap فقط:

- `INTERNAL_BOOTSTRAP_ADMIN_EMAIL=<first-admin-email>`

ثم يحذف bootstrap variable بعد إنشاء أول Admin.

## الأسرار

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

تظل GitHub repository secrets ولا تُنسخ إلى Worker vars أو Git.

## الخطوة التشغيلية التالية

البنية/الكتالوج/البحث أصبحت production-proven. الأولوية التالية ليست deploy جديدًا أو تجميلًا؛ هي **إنتاج 10–20 مراجعة evidence-based حقيقية**، ثم البلاغ العام، ثم اختبار 5 أسر.
