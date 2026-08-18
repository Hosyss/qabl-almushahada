# قبل المشاهدة — Full Chat Handoff

**تاريخ نقطة التسليم:** 18 أغسطس 2026  
**Repository:** `Hosyss/qabl-almushahada`  
**Production main:** `282c2b8311fafd7ef3c98a3a51c968be644c0266`  
**Production Worker:** `qabl-almushahada`  
**Production origin الحالي:** `https://qabl-almushahada.buildtools.workers.dev`  
**Production D1 name:** `qabl-almushahada-production`

> هذا الملف هو نقطة البداية للشات التالي. اعتبره أحدث من ملفات roadmap/state القديمة في البنود التي تعارضه. لا تعيد تنفيذ checkpoints المكتملة من الصفر.

---

## 1) الهدف الأصلي للمشروع

«قبل المشاهدة» دليل عربي للأسرة قبل مشاهدة فيلم أو مسلسل. الفكرة ليست إعطاء رقم أو نجوم، بل فصل عدة طبقات بوضوح:

1. **الدليل/الكتالوج:** بيانات العمل الأساسية وإمكانية الوصول إليه بالبحث العربي والإنجليزي.
2. **الأدلة/المراجعة الموثقة:** ما يمكن إثباته من مصادر مقبولة مع provenance/version discipline.
3. **التحليل التحريري:** تحليل عربي أصلي يشرح ما نعرفه وما لم نستطع حسمه.
4. **الحكم العملي للأسرة:** توصية عملية مبنية على تفضيلات الأسرة، لكن لا تتحول المعلومة الناقصة إلى طمأنة زائفة.

لا نستخدم rating رقميًا كمصدر الحقيقة، ولا نختلق ملاءمة عمرية رسمية.

---

## 2) قواعد الثقة غير القابلة للكسر

هذه القواعد تحكم أي تعديل جديد:

- `unknown ≠ none`.
- غياب الدليل **ليس** دليلًا على الغياب.
- Full Evidence / Exact Version gates تظل fail-closed.
- لا Severity مخترعة.
- لا version مخترعة.
- لا reviewer identity مخترعة.
- لا fingerprint أو license أو provenance مخترع.
- أي صفحة review/locator غير صالح تفشل مغلقة ولا تعرض ادعاءات جزئية كأنها مراجعة موثوقة.
- الـpublic report intake لا يساوي material report تلقائيًا؛ يدخل triage بشري أولًا.
- لا تغيير Decision Engine أو قواعد الأدلة لمجرد تحسين UI/SEO/Ads.
- لا فيلم 11 تلقائيًا. العدد التحريري الحالي متوقف عند 10 حتى قرار تحريري مستقل.

---

## 3) سياسة المصادر والحقوق

القرارات التاريخية المهمة:

- Wikidata مستخدم لبيانات catalog metadata وفق policy snapshot مع CC0/provenance gates.
- Wikipedia كان مسموحًا فقط ضمن العقود المحددة/المراجعات الثابتة عندما ينطبق ذلك، وليس كذريعة لاختلاق تفاصيل.
- Kids-In-Mind يظل **link-only factual reference** وفق العقد الحالي، ولا ننسخ محتواه.
- Common Sense Media / Plugged In / BBFC / Dove وغيرها ليست مصادر يتم نسخ محتواها ضمن هذا المسار الحالي.
- الصور الحالية ليست official posters؛ هي **project-created illustrations** محلية، ومعلن للمستخدم أنها ليست الملصق الرسمي.
- لا تستخدم Poster من Google Images أو TMDB/OMDb/IMDb بلا أساس حقوق مناسب.
- دراسة الحقوق اللاحقة أثبتت أن TMDB ليس مسارًا مجانيًا تلقائيًا لمشروع ربحي، وOMDb ليس ترخيصًا تجاريًا عامًا، وIMDb الرسمي مرخّص، وWikimedia Commons يحتاج فحص كل asset على حدة.

---

## 4) المراحل التاريخية المكتملة باختصار

### P2 — workflow داخلي ومراجعات

تم بناء وتأمين workflow داخلي للمراجعات، immutable revisions، report resolution/reapproval، quality/audit/calibration gates، وD1 migrations المرتبطة بها. هذه البنية ليست مجالًا لإعادة التصميم الآن.

### P3 — المنتج العام

تم بناء:

- البحث العربي والإنجليزي.
- did-you-mean المحافظ.
- دليل `/titles` والفلاتر.
- صفحات `/title/[qid]`.
- صفحات review الحقيقية fail-closed.
- إعدادات الأسرة المحلية.
- صفحات سياسات المراجعة/الخصوصية/التصحيح.
- source provenance/evidence publication pipeline.
- objective taxonomy وD1 guards.
- Wikidata production catalog import workflow.

### P4 — المحتوى التحريري والجودة العامة

تم الوصول إلى 10 تحليلات تحريرية فقط، ثم:

- practical family verdict.
- accessibility pass.
- mobile/slow-network performance pass.
- SEO/indexing readiness.
- public report intake backend + triage.
- integration rehearsal + Production deploy.

---

## 5) العشرة تحليلات التحريرية الحالية

هذه هي المجموعة الحالية ولا يُضاف رقم 11 تلقائيًا:

1. **Cars (2006)** — QID `Q182153` — editorial id `cars-2006-editorial-pilot-v1`
2. **E.T. the Extra-Terrestrial (1982)** — QID `Q11621` — `et-1982-editorial-batch-v1`
3. **Harry Potter and the Philosopher's Stone (2001)** — QID `Q102438` — `harry-potter-philosophers-stone-2001-editorial-batch-v1`
4. **Minions (2015)** — QID `Q13619743` — `minions-2015-editorial-batch-v1`
5. **Barbie (2023)** — QID `Q55436290` — `barbie-2023-editorial-c1-v1`
6. **Jurassic Park (1993)** — QID `Q167726` — `jurassic-park-1993-editorial-c1-v1`
7. **My Neighbor Totoro (1988)** — QID `Q39571` — `my-neighbor-totoro-1988-editorial-c1-v1`
8. **Alice in Wonderland (2010)** — QID `Q174385` — `alice-in-wonderland-2010-editorial-c2-v1`
9. **The Hunger Games (2012)** — QID `Q212965` — `the-hunger-games-2012-editorial-c2-v1`
10. **Spider-Man: No Way Home (2021)** — QID `Q68934496` — `spider-man-no-way-home-2021-editorial-c2-v1`

Live smoke بعد نشر P4 أثبت أن `/titles?editorialStatus=editorial` يعرض هذه العشرة بالضبط، وأن homepage تعرض أحدث أربعة فقط وفق العقد الحالي: Alice + Hunger Games + Spider-Man + Barbie.

---

## 6) ما هو منشور على Production الآن

`main` الحالي هو merge commit `282c2b8311fafd7ef3c98a3a51c968be644c0266`.

المنشور فعليًا:

- backend public report intake من PR #71.
- practical family verdict.
- family settings مع `localStorage` fallback إلى session-only إذا فشل التخزين.
- accessibility: skip link، keyboard combobox، dual-tone focus، reduced motion، contrast fixes.
- homepage mobile performance: تعطيل speculative prefetch غير الضروري.
- SEO/indexing: canonical للرئيسية والسياسات والمراجعات، `/search` noindex، `/internal/*` noindex/nofollow، robots يمنع `/internal` و`/api/`، إزالة metadata التطوير القديمة.
- review metadata fail-closed للـhuman/evidence/editorial locators.

Live Production QA بعد الدمج أثبت:

- homepage/review الجديدة حية.
- canonical/noindex/robots صحيحة.
- العشرة تحليلات في sitemap والدليل.
- practical verdict ظاهر.
- لا horizontal overflow في الاختبارات المستهدفة.

---

## 7) Remote D1 / public report backend

PR #71 نُشر بالفعل وأضاف `public_report_intakes`.

Remote D1 read-only verification بعد النشر أثبت وجود:

- `public_report_intakes`
- `public_report_intakes_payload_immutable_update`
- `public_report_intakes_no_delete`

Promotion إلى material human-review report يعيد التحقق من revision/status/approval/version داخل D1 batch؛ evidence/editorial intakes لا تُسقط المحتوى تلقائيًا.

### `PUBLIC_REPORT_HMAC_SECRET`

كان غائبًا بعد أول نشر، والمسار الحقيقي كان يعيد HTTP 503 fail-closed.

بعد موافقة المستخدم الصريحة:

- تم توليد secret عشوائي 64-byte داخل runner.
- لم تُطبع قيمته ولم تدخل Git.
- `wrangler secret put` نجح على Worker `qabl-almushahada`.
- missing-target probe الآمن انتقل من `503` إلى `404` كما يجب.
- الهدف كان وهميًا ولذلك لم يُنشأ Production intake row.
- الاسم فقط أصبح bound؛ القيمة غير قابلة للقراءة.

---

## 8) PR #84 — Public Report UI — ينتظر Work الخميس

**PR:** #84 `P4 public report UI and real-path readiness`  
**Branch:** `agent/public-report-ui-readiness-2026-08-18`  
**Head:** `2d0d3eaa26bcc5b8c194f65f5e1e8509c496674a`  
**State:** Open + Draft + mergeable.  
**غير مدموج.**

ما يحتويه:

- نموذج بلاغ يظهر فقط على review صحيحة.
- `targetKind` و`targetId` يأتون server-side من المراجعة المحملة؛ لا حقول تسمح للمستخدم بتغييرهما.
- 6 أسباب بلاغ مطابقة للـAPI.
- honeypot خارج tab order.
- حالات 202/429/503 وUUID reference.
- privacy/corrections copy متوافق مع triage/HMAC behavior.
- تنظيف لهجة عامية قديمة من human/evidence review UI.
- Production config يعلن اسم `PUBLIC_REPORT_HMAC_SECRET` ضمن `secrets.required` من دون قيمته.

Browser QA المحلي:

- Chrome `151.0.7922.108`.
- D1 محلي + secret اختبار فقط.
- أول بلاغ editorial قُبل بUUID.
- duplicate لنفس العميل/الهدف مُنع.
- local `COUNT(*) = 1` بعد المحاولتين.
- invalid review لا تعرض النموذج.
- 390px بلا overflow.

Clean CI:

- Checkpoint `32122817962`: success.
- Public Quality `32122818013`: success.
- B4 `32122817999`: success.

**قرار ثابت:** لا تدمج #84 قبل مراجعة Work المستقلة يوم الخميس. Work يراجع ولا يدمج بنفسه؛ يرجع blockers/approval للشات ثم نقرر.

---

## 9) الشغل المستقل أثناء انتظار Work — #86 إلى #91

كل هذه PRs بدأت من Production `main` الحالي لتبقى مستقلة عن #84.

### #86 — About / transparency

Head `259c7b36e8b4c2c4af8d1594d18b050b83c38cfa`.

- `/about` أصلية.
- تشرح ما يفعله الموقع وما لا يفعله.
- الفرق بين الدليل/التحليل/الحكم العملي.
- self-canonical + sitemap + transparency nav.
- Browser QA Desktop + 390px success.
- Clean CI all green.

### #87 — AdSense readiness policy

Head `e36e1af74e3edcfabb5f90ef58bf34546da2a43b`.

Docs-only:

- لا AdSense script ولا Publisher ID ولا cookies ولا CMP.
- لا تعديل Privacy Policy بادعاءات إعلانية قبل وجود AdSense فعلًا.
- يمنع ads مستقبلًا على search/internal/API/error/fail-closed/low-value navigation.
- content-value audit للعشرة: لا exact duplicate في `analysisAr` أو `scopeAr`، والنص الأساسي المقاس 923–1208 حرفًا؛ الرقم ليس معيار Google ولا مبررًا للحشو.

### #88 — artwork rights gate

Head `b1a22ae2ab5522fc35a38772fd3527b8cda44291`.

- لا تغيير بصري.
- العشرة assets الحالية موسومة `project_created_illustration`.
- أي external asset مستقبلي يحتاج `sourceUrl + rightsBasis + attribution`.
- لا official poster بلا ترخيص صالح.

### #89 — Article structured data

Head `47ceca2d76d1ad6f6e6e8349d79a45f98d8c05a7`.

- Article JSON-LD صادق للhuman/evidence review الصالحة فقط.
- editorial كان عنده Article JSON-LD بالفعل فلم نكرره.
- لا rating/aggregateRating/stars.
- أصلح الاستخدام الخاطئ لـ`approvedAt` كـmodifiedTime عندما كان يسبق publishedAt.
- fail-closed pages بلا Article markup.

### #90 — favicon readiness

Head `f9f5516a979926cc5a6e8f35fad6344a27691a87`.

- نفس SVG ونفس الشكل.
- intrinsic size من 24×24 إلى 64×64.
- SEO guard يثبت square + ≥48px + root icon metadata.

### #91 — Worker security headers

Head `dc7cdb4ccbe588182f9b3bc6e30cb5e24c661ab1`.

- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- HTML فقط: `Content-Security-Policy: frame-ancestors 'none'` + `X-Frame-Options: DENY`.
- إزالة `X-Powered-By` إن ظهر.
- لا broad CSP للscripts حاليًا.
- Production read-only baseline أثبت أن هذه headers غائبة حاليًا على النسخة المنشورة، لذلك التغيير يعالج gap حقيقي.

كل #86–#91: Open + Draft + mergeable + CI green.

---

## 10) #98 — Combined post-P4 hardening rehearsal

**PR #98** يجمع #86 + #87 + #88 + #89 + #90 + #91 فقط، ولا يشمل #84.

Head `6ecb48354d288079c9940fbddcd9b584d15b3e6d`.

- تعارض #86/#90 الوحيد في SEO test حُل بالحفاظ على About + favicon guards معًا.
- local Cloudflare production-style build نجح دون deploy.
- security wrapper runtime contract نجح.
- `/about` rendered canonical نجح.
- favicon 64×64 rendered نجح.
- clean integrated CI:
  - Checkpoint `32134887423` success.
  - Public Quality `32134887453` success.
  - B4 `32134887431` success.

#98 validation Draft فقط؛ لا يُدمج تلقائيًا.

---

## 11) #99 — خطة إزالة buildtools من الرابط

**PR #99** Docs-only.  
Head `46b5e941b77964776c03b88df18014f0817d11d2`.

المهم:

- `buildtools` هو account-level workers.dev subdomain؛ تغييره من الحساب يمكن أن يؤثر على Workers أخرى، لذلك **لا تغيّره تلقائيًا**.
- المسار الآمن النهائي هو Custom Domain/Route عندما يتوفر Domain/Zone مناسب.
- zero-downtime plan: attach/verify الجديد أولًا، القديم يظل شغالًا، ثم canonical/sitemap cutover في commit واحد بعد نجاح الجديد.
- `PUBLIC_SITE_ORIGIN` يجب أن يظل مصدر canonical/structured-data/sitemap عند النقل.
- لا DNS/route/domain purchase بدون موافقة صريحة.

---

## 12) #100 — GitHub Actions supply-chain hardening

**PR #100**  
Branch `agent/github-actions-sha-pinning-2026-08-18`  
Head `3c4437a6c753c1490b420a9e32f33fcdeeaac32e`  
State: Open + Draft + mergeable.

سبب العمل:

الـworkflows كانت تستخدم mutable tags مثل `actions/checkout@v4` و`setup-node@v4`.

تم تثبيت references على الـSHAs التي حلها GitHub runner ناجح لنفس المشروع:

- `actions/checkout@11d5960a326750d5838078e36cf38b85af677262`
- `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020`
- `actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02`

وأضيف:

- explicit `permissions: contents: read` للworkflows التي كانت تعتمد defaults.
- `tests/github-actions-supply-chain.test.mjs` يمنع أي external `uses:` غير مثبت full 40-char SHA مستقبلًا.
- Checkpoint يشغل هذا guard.

ملاحظة تنفيذية مهمة: GitHub Actions bot نفسه رفض push لتعديل `.github/workflows` لعدم امتلاك `workflows` permission، لكن GitHub connector المصرّح له نجح في كتابة الملفات. لا تحاول الالتفاف على هذا الحارس من داخل Actions.

بعد commit أخير عبر connector، الثلاث بوابات اشتغلت طبيعيًا وأصبحت:

- Checkpoint success.
- Public Quality success.
- B4 success.

#100 لا يغير runtime/product/D1.

---

## 13) #101 — npm security audit — أول أولوية تقنية بعد النقل

**PR #101**  
Branch `agent/npm-security-audit-2026-08-18`  
Clean head `575b5eeada48db2d7fef8f2378372c5a73eea298`  
State: Open + Draft + mergeable.  
Final diff: Docs-only (`docs/NPM_SECURITY_AUDIT_2026-08-18.md`); temporary audit workflow deleted.

Read-only audit run `32181239264` / job `95854498305`: success.

### Full graph

- 0 info
- 1 low
- 4 moderate
- 16 high
- 0 critical
- total 21

### Production-only `--omit=dev`

- 0 info
- 0 low
- 0 moderate
- **4 high**
- 0 critical

Production high packages reported by npm:

1. `next` — direct.
2. `nanoid` — transitive.
3. `postcss` — transitive through Next graph.
4. `sharp` — transitive through Next graph.

npm reports a non-major fix path to `next@16.3.1`, but **لم يتم تطبيق أي upgrade بعد**.

Artifact exact JSON: `npm-security-audit-json`, ID `9340848579`, SHA-256 `95e39a6ff1c151b552be69584947065d8f6717a883e5147637a9dc6a901204d3`.

Full graph also reports dev/build highs around Cloudflare/Vite/vinext/wrangler/miniflare/ws/undici/image-size/js-yaml/etc.

### قاعدة الإصلاح

**لا تشغّل `npm audit fix` عشوائيًا.**

ابدأ runtime remediation مستقلًا:

1. افحص current package versions وNext compatibility مع vinext/Cloudflare.
2. جرّب smallest supported Next patch/minor path التي تغلق runtime advisories.
3. لا تخلط major `vinext` أو `drizzle-kit` migration معها إلا إذا كان ذلك ضروريًا.
4. بعد كل upgrade: engine + catalog + persistence + migrations + lint + production build + Cloudflare build.
5. لأن Next/runtime يتغير: Browser smoke على homepage/search/title/review/practical verdict + SEO metadata + mobile overflow.
6. أعد `npm audit --omit=dev`؛ الهدف صفر production High/Critical أو توثيق blocker upstream دقيق.
7. لا Merge/Deploy قبل مراجعة النتيجة.

هذه هي **أول مهمة تنفيذية مقترحة للشات الجديد** ما لم يقرر المستخدم خلاف ذلك.

---

## 14) حالة SEO / Search / AdSense

منشور حاليًا:

- canonical discipline.
- sitemap للعناوين/المراجعات الحالية.
- `/search` noindex.
- `/internal/*` noindex/nofollow.
- robots يمنع `/internal` و`/api/`.
- root WebSite + Organization JSON-LD موجودان بالفعل؛ لا تكرر WebSite schema.
- title pages عندها Movie/TVSeries structured data.
- editorial review لديها Article structured data بالفعل في main.

Draft hardening يضيف About/favicons/human+evidence Article/security headers.

لا يوجد Google Analytics/gtag/Tag Manager/PostHog/Plausible/Matomo/Clarity/Facebook Pixel في repo عند آخر sweep.

لا تركب AdSense ولا تعدل privacy إلى claims إعلانية قبل قرار فعلي. صفحات search/internal/error/fail-closed ليست مواضع Ads مستقبلًا.

---

## 15) الصور

طلب المستخدم سابقًا صور الأفلام الأصلية، لكن القرار الفني/الحقوقي الحالي:

- الموجود الآن رسومات أصلية محلية، وليست official posters.
- لا تولد بدائل AI من نفسك بدل الصور المطلوبة.
- لا تستبدلها بصورة «حقيقية» غير مناسبة فقط لأنها متاحة على Commons.
- لو وُجد لاحقًا official/licensed asset صالح تجاريًا، يجب أن يدخل عبر provenance/rights gate الخاص بـ#88.
- لا hotlink عشوائي.

---

## 16) اللغة والواجهة

- النص العام يجب أن يكون عربية حديثة واضحة/فصحى سهلة، لا لهجة مصرية عامية قديمة داخل المنتج.
- تم تنظيف تعبيرات مثل «إيه/إزاي/دي/ينفع» من surfaces التي راجعناها.
- يمكن استخدام العامية المصرية في **محادثة المستخدم**، لكن ليس في UI الأساسي للموقع.
- لا تعرض enums تقنية raw مثل `insufficient_data`, `work_level`, إلخ للمستخدم العام.

---

## 17) عملية العمل المتفق عليها مع المستخدم

المستخدم يريد التنفيذ التلقائي:

- لا تنتظر «كمل/يلا» بين الخطوات العادية.
- أكمل تلقائيًا في القراءة، الفروع، Draft PRs، الاختبارات، QA، docs، والإصلاحات القابلة للرجوع.
- توقف فقط عند قرار حرج خارجي أو غير قابل للرجوع بسهولة، مثل:
  - Merge إلى `main` عندما يطلق Production deploy.
  - Remote D1 write/migration غير الموافق عليها مسبقًا.
  - Deploy Production جديد عندما ليس داخل موافقة واضحة سابقة.
  - DNS/domain/account-level workers.dev subdomain mutation.
  - شراء/دفع/اشتراك.
  - إنشاء/ربط حساب خارجي حقيقي.
  - AdSense application/Publisher ID/CMP/tracking activation.

المستخدم سمح سابقًا صراحة بضبط `PUBLIC_REPORT_HMAC_SECRET` على Production، وتم ذلك وانتهى.

---

## 18) Work يوم الخميس

Work لم يراجع #84 بعد. الموعد الذي ذكره المستخدم: **الخميس** (بعد نقطة التسليم الحالية يوم الثلاثاء 18 أغسطس 2026؛ أي الخميس 20 أغسطس 2026).

عند توفر Work:

1. أعطه هذا الملف + PR #84.
2. اطلب مراجعة مستقلة للـdiff الكامل، لا وصف PR فقط.
3. التركيز: target spoofing، privacy/corrections semantics، fail-closed، `secrets.required`, عدم تسريب secret، اللغة، عدم المساس بالDecision Engine/D1 schema.
4. Work لا يدمج.
5. لو Approve بلا blockers: ارجع للشات لاتخاذ قرار Merge/Production UI.
6. لو blockers: أصلح على #84 ثم أعد CI/Browser QA المتأثر.

---

## 19) ما لا يجب فعله في الشات الجديد

- لا تبدأ من PR #70–#74؛ هذه تم دمج محتواها بالفعل عبر #71/#82.
- لا تعد إصلاح P4 production integration من الصفر.
- لا تنشئ فيلم 11 لمجرد استمرار العمل.
- لا تغيّر `buildtools` account subdomain من Dashboard تلقائيًا.
- لا تدمج #84 قبل Work.
- لا تدمج #98 كأنه feature PR؛ هو validation tree.
- لا تعمل `npm audit fix`.
- لا تعمل major framework/toolchain upgrade مختلطًا بدون عزل واختبار.
- لا تدّعي أن TMDB/IMDb/OMDb posters مجانية تجاريًا.
- لا تضف Ads/Analytics/CMP قبل قرار فعلي.

---

## 20) الترتيب المقترح فور فتح الشات الجديد

1. اقرأ هذا الملف أولًا.
2. أعد التحقق السريع أن `main` ما زال `282c2b8...` وأن #84/#86–#101 لم تتحرك رؤوسها بشكل مادي.
3. أكمل #101: تأكد أن clean Checkpoint النهائي أغلق success، ثم حدث وصف PR إن لزم.
4. افتح **runtime dependency remediation Draft** من `main` لعلاج production audit highs، بدءًا بـNext compatibility دون merge/deploy.
5. أعد `npm audit --omit=dev` بعد التحديث.
6. اعمل full CI + Cloudflare local build + browser regression.
7. أبق #84 مجمدًا حتى Work الخميس.
8. بعد runtime security remediation، يمكن دمجه في rehearsal مع #100 ثم مع #98 فقط إذا كان ذلك يفيد التحقق؛ لا تدفع إلى main بدون قرار حرج واضح.

---

## 21) مرجع PRs الحالية السريع

- #84 — Public Report UI — Draft — head `2d0d3eaa...` — **ينتظر Work**.
- #85 — Docs handoff branch — Draft — هذا الملف يعيش عليه.
- #86 — About — Draft — `259c7b36...`.
- #87 — AdSense readiness docs — Draft — `e36e1af7...`.
- #88 — Artwork rights gate — Draft — `b1a22ae2...`.
- #89 — Review Article structured data — Draft — `47ceca2d...`.
- #90 — Favicon 64px — Draft — `f9f5516a...`.
- #91 — Worker security headers — Draft — `dc7cdb4c...`.
- #98 — combined #86–#91 rehearsal — Draft — `6ecb4835...`.
- #99 — hostname migration plan — Draft — `46b5e941...`.
- #100 — immutable GitHub Action SHA pinning — Draft — `3c4437a6...` — clean CI success.
- #101 — npm security audit docs — Draft — `575b5eea...`; audit found 4 production High, 0 Critical.

Older #75 is a historical pre-production integration handoff and is stale relative to this file.

---

## 22) كلمة أخيرة للشات التالي

لا تسأل المستخدم «نكمل منين؟». الحالة معروفة: **المشروع منشور ومستقر على P4 main، #84 ينتظر Work الخميس، وأول شغل مستقل ذو أولوية الآن هو معالجة production npm security findings على Draft منفصل بدون Merge/Deploy.** أكمل تلقائيًا وفق الحدود أعلاه.
