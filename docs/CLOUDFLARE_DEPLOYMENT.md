# Cloudflare deployment target

آخر تحديث تشغيلي: 13 أغسطس 2026

هدف النشر النهائي لمشروع «قبل المشاهدة» هو **Cloudflare Workers + D1** من نفس المستودع. هذا هو الإنتاج الفعلي الحالي؛ `chatgpt.site` ليس مصدر النشر.

## الإنتاج الحالي المؤكد

- Worker: `https://qabl-almushahada.buildtools.workers.dev`
- D1: `qabl-almushahada-production`
- آخر production commit مؤكد قبل P3S-06: `701604e7570671671ff94b3b97e111d837ab626f`
- D1 المؤكدة: **20/20 migrations**
- bindings المؤكدة: `DB`, `IMAGES`, `AI`, `ASSETS`
- Worker Version ID: `a0de055e-8a85-4cd9-9ab6-57971b909fae`
- Cloudflare production Run الناجح لـP3S-05: `31676888290`

P3S-06 ما تزال على feature branch في هذا checkpoint؛ migration رقم 21 وجداول publication الجديدة لا تعتبر production-active حتى merge + deploy ناجحين.

## قواعد الأمان

- الموقع العام مفتوح للقراءة.
- `/internal` والـServer Actions الداخلية تستخدم مزود هوية صريحًا.
- Cloudflare Access يتحقق server-side من `Cf-Access-Jwt-Assertion` بالتوقيع وissuer/audience/expiry؛ هيدر البريد وحده غير كافٍ.
- إذا لم تُضبط Access، المسارات الداخلية تفشل مغلقًا بدل fallback صامت.
- D1 production لا تُربط بمعرف وهمي.
- `CLOUDFLARE_API_TOKEN` و`CLOUDFLARE_ACCOUNT_ID` خاصان بـWrangler/CI ولا يتم نسخ أي منهما إلى Worker vars أو Git.
- لا يُعد أي deploy ناجحًا قبل migration verification + schema verification + Worker deploy + smoke tests.

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
11. Worker deploy.
12. public smoke tests.
13. summary بالـWorker URL وD1 والcommit.

لو credentials ناقصة، workflow تكتب بوضوح أن النشر لم يبدأ ولا تلمس Cloudflare resources.

## P3S-05 — آخر deploy ناجح مؤكد

Cloudflare Run `31676888290` أثبت:

- **20/20 migrations** applied.
- source-policy verification ناجحة.
- `env.AI` موجودة فعليًا في Worker bindings.
- Worker deploy ناجح.
- public smoke tests ناجحة.

لذلك P3S-05 تعتبر production-complete.

## P3S-06 — ما الذي يجب أن يثبته deploy التالي؟

بعد merge P3S-06، لا تعتبر production-complete إلا إذا تحقق كله:

- main CI أخضر على squash commit.
- D1 تصبح **21/21 migrations**.
- migration `0018_evidence_publication_gate.sql` تطبق remote بنجاح.
- remote schema verification يجد الجداول الستة:
  - `evidence_review_publications`
  - `evidence_publication_sources`
  - `evidence_publication_assertions`
  - `evidence_publication_facts`
  - `evidence_publication_fact_flags`
  - `evidence_review_publication_heads`
- `AI` binding تظل موجودة بعد deploy.
- `/` و`/review` و`/search?q=nemo` تعمل.
- `/review?publicationId=missing-publication` تعيد **حالة آمنة** ولا تعرض Demo/fallback.
- `/review-policy`, `/privacy`, `/corrections` تظل سليمة.

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
  → Remote schema verification
  → Worker deploy
  → Smoke tests
```

أي فشل في أي نقطة يوقف التقدم إلى المرحلة التالية حتى يُفهم السبب ويُصلح.