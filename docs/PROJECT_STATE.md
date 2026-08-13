# حالة مشروع «قبل المشاهدة»

آخر تحديث: 13 أغسطس 2026

> هذا الملف يصف **الحالة الحالية ومصدر الحقيقة التشغيلي**. التاريخ التفصيلي محفوظ في `docs/ROADMAP.md`، وملفات checkpoint، وPull Requests وGit history.

## الهدف الحالي

«قبل المشاهدة» دليل عربي مستقل يساعد الأسرة على معرفة محتوى الفيلم أو المسلسل قبل تشغيله، ثم يطبق حدود الأسرة على **وقائع موثقة** ليعطي قرارًا مفسرًا بدل درجة غامضة أو نقل تصنيف أجنبي كما هو.

المقياس العملي للمرحلة الحالية:

> هل يستطيع الزائر البحث عن عمل معروف، ومعرفة هل له مراجعة أم لا، ثم — عند وجود مراجعة — رؤية وقائع قابلة للتتبع وقرار مفهوم يتغير مع حدود أسرته؟

## ترتيب العمل المعتمد الآن

1. كتالوج حقيقي — **مكتمل إنتاجيًا**.
2. بحث مفيد من D1 فقط — **مكتمل إنتاجيًا**.
3. 10–20 مراجعة evidence-based حقيقية لأعمال عائلية معروفة — **التالي**.
4. توصيل البلاغ العام والتصحيح الكامل.
5. اختبار المنتج مع 5 أسر، 3 أعمال لكل أسرة.
6. بعد المحتوى فقط: اختصار الصفحة الرئيسية وعرض أعمال حقيقية بدل الأمثلة التصميمية.
7. قبل التوسع: custom domain، أداء/إتاحة، rate limiting، monitoring، D1 backup/recovery، وتعطيل آمن عند الأعطال.

لا أولوية الآن لتسجيل مستخدمين أو توصيات AI أو نجوم أو تعليقات أو تطبيق موبايل أو إعادة تصميم كبيرة.

## المبدأ التحريري والثقة

- المصادر الخارجية تمدنا **بالبيانات أو الدليل** فقط؛ لا تصبح مراجعتنا.
- Wikidata مخصصة للـcatalog metadata تحت CC0 1.0.
- Wikipedia مخصصة لمسار analysis evidence وفق policy المشروع والعزو/الrevision المحفوظين.
- لا metadata → verified review تلقائيًا.
- لا fake/synthetic reviewers.
- لا ادعاء مشاهدة بشرية إذا لم تحدث.
- Workers AI طبقة استخراج غير موثوقة ولا تملك publish authority.
- `uncertain` أو conflict أو نقص coverage يفشل مغلقًا بدل إنتاج «مناسب».
- قرار الأسرة منفصل عن حقيقة وجود الواقعة نفسها.

النص العام الصحيح للثقة هو **«وقائع موثقة لنسخة محددة»**. داخل المراجعة يجب أن يظهر بوضوح إن كانت:

- مشاهدة بشرية مؤكدة؛ أو
- مراجعة مبنية على أدلة موثقة؛ أو
- البيانات غير كافية.

## P3S-05 / P3S-06 — evidence-based review path

المسار evidence-based مستقل عن سير المراجعين البشر القديم:

- evidence مرخص ومربوط بنسخة محددة.
- extraction schema-bound.
- coverage/conflict assessment deterministic.
- publication snapshots append-only.
- كل claim منشور مرتبط بمصدر داخل snapshot نفسها.
- لا `human_watch_confirmed = 1` في المسار evidence-based.
- `/review?publicationId=...` للمراجعة evidence-based.
- `/review?bundleId=...` للمسار البشري القديم.
- العرض العام يفشل مغلقًا عند stale/missing/current-head mismatch.

المسار البشري P2/P2Q محفوظ كاملًا كمسار جودة يدوي أو تصعيد، وليس شرطًا لتغطية آلاف الأعمال.

## P3S-07 — taxonomy موضوعية

مكتملة ومنشورة:

- `nudity`
- `kissing`
- `intimate_touching`
- `sexual_dialogue`
- `smoking_or_vaping`
- `alcohol_use`
- `drug_use`
- `gambling_activity`
- `religious_reference_or_practice`

الـsubtypes وصفية ولا تتحول تلقائيًا إلى age rating أو risk verdict مستقل. D1 category guards والـCHECKs متحقق منها production.

## P3S-08 — أول كتالوج production حقيقي — مكتمل 100%

### النتيجة الفعلية

تم استيراد **200/200 عنوان حقيقي** من Wikidata إلى D1 production مع provenance قانونية لكل عنوان.

- المصدر: Wikidata.
- الاستخدام: `catalog_metadata` فقط.
- الرخصة: CC0 1.0.
- لا posters.
- لا review state مصطنعة.
- لا evidence publication مصطنعة.
- لا title version مصطنعة لمجرد SEO.
- الاسم العربي يُفضّل عندما يتوفر، والاسم الإنجليزي المختلف يُحفظ كاسم بحث بديل.
- الاختيار الأولي مرتب بالشيوع عبر Wikidata sitelinks مع bounds صريحة.
- runtime/المدة **لا تُخزن كحقيقة عامة للعنوان**؛ تبقى خاصية للنسخة عندما تكون النسخة/القص محددين بدقة.

### الاستيراد والإثبات

- أول successful production import: Run `31690242194`، successful rerun job `94416044496`.
- validated records: **200**.
- exact remote verification: **200 title/provenance pairs**.
- first QID: `Q44578`.
- preview artifact: `wikidata-catalog-preview-31690242194`.
- artifact ID: `9177142287`.
- artifact ZIP SHA-256: `9e5ed4d87ce524959af37069851fecff93e98a8f112495fd195f04d9d2d857ab`.
- D1 import نفذ 400 statements للـ200 title + 200 provenance records.
- أول محاولتين فشلتا قبل أي D1 write؛ لم يتم تخطي fail-closed gates.

### الصفحات العامة

- `/titles` تعرض فقط عناوين لها provenance Wikidata/CC0 مسموح بها.
- `/title/[qid]` تعرض metadata + source/license/policy disclosure + canonical/JSON-LD.
- `/sitemap.xml` يولّد روابط العناوين القانونية فقط.
- `/robots.txt` يعلن sitemap ويمنع `/internal`.
- وجود العنوان في الكتالوج **لا يعني وجود مراجعة**.

## البحث الحقيقي — مكتمل 100%

البحث أصبح يعتمد على D1 الحقيقي فقط:

- `/api/search-suggestions?q=...` يستخدم نفس `searchPublicTitles` server-side.
- أقل من حرفين → لا اقتراحات.
- أقصى 5 اقتراحات.
- `no-store`، ولا fake fallback عند تعذر D1.
- Hero يستخدم debounce + AbortController.
- أزيلت الاقتراحات الثابتة القديمة مثل «البحث عن نيمو» و«إنسايد آوت 2» و«وينزداي».
- placeholder لا يعد بعنوان غير موجود.

حالات البحث العامة أصبحت صريحة:

- **موجود — مراجعة موثقة**.
- **موجود — قيد المراجعة**.
- **موجود — لم يُراجع بعد**.
- **غير موجود**.

لا يوجد زر «اطلب مراجعته» وهمي حتى يتم توصيل intake حقيقي.

### Live product smoke

أضيف Quality Gate مستقل يعمل بعد Cloudflare deploy الناجح على `main` ويختبر المنتج المنشور نفسه.

آخر إثبات حي:

- Cloudflare production deploy Run `31691881366`: success.
- main Checkpoint Run `31691881382`: success.
- Live product smoke Run `31691960997`: success.
- العينة production: `Titanic` / `wd:Q44578`.
- `/api/search-suggestions?q=Titanic` أعاد العنوان الحقيقي من D1.
- `/search?q=Titanic` أظهر حالة مراجعة صريحة.
- الصفحة الرئيسية احتوت «وقائع موثقة» ولم تحتوِ الاقتراحات الثابتة القديمة.

## Cloudflare production — الحالة الحالية

- Worker: `https://qabl-almushahada.buildtools.workers.dev`.
- D1: `qabl-almushahada-production`.
- D1 ID: `f2bd0d7a-660b-4f9e-bddc-40a918dd35cc`.
- migrations: **22/22**.
- product tables محليًا: **33**.
- bindings: `DB`, `IMAGES`, `AI`, `ASSETS`.
- latest production feature/checkpoint commit قبل docs: `f46fc4d61f46eccd71a3f4d924a0e806848e80f4`.
- latest Worker Version ID: `c8279c37-7500-48d7-bf1a-87317017fabf`.
- remote schema verification: success.
- remote objective taxonomy guards: success.
- standard public smoke: success.
- live product smoke: success.

## ما يزال تصميميًا أو غير موصول

- بعض بطاقات الصفحة الرئيسية أمثلة تصميمية ومعلّمة بوضوح وليست reviews production.
- زر البلاغ العام داخل المراجعة غير موصول بعد، رغم وجود منطق P2-05 الداخلي للبلاغات الجوهرية.
- «اطلب مراجعته» غير موصول ولن يظهر كزر وهمي.
- لا posters غير مرخصة.
- لا مراجعات production حقيقية كافية بعد؛ هذه هي الأولوية التالية.

## الخطوة التالية — أول 10–20 مراجعة حقيقية

ابدأ من عناوين عائلية معروفة داخل الكتالوج الـ200، وليس من آلاف عناوين فارغة.

لكل عنوان:

1. تأكد من title/version identity ولا تخترع runtime أو cut.
2. اجلب analysis evidence فقط من source مسموح بها ومثبتة provenance.
3. استخرج الوقائع مع source locators؛ silence لا يصبح `none`.
4. coverage/conflict gate يجب أن ينجح.
5. راجع الوقائع يدويًا قبل publish لأول مجموعة إطلاق.
6. انشر فقط snapshot مستوفية P3S-06.
7. اختبر القرار مع أكثر من Family Profile للتأكد أن تغيّر الحدود يغيّر القرار عندما ينبغي.
8. سجّل أي title لا تكفيه الأدلة كـ`insufficient_data` بدل ملء الفراغ.

**العدد الصغير الموثوق أفضل من آلاف العناوين الفارغة.**

بعد هذه المجموعة: وصل البلاغ العام والتصحيح، ثم اختبر مع 5 أسر قبل أي تحسين واجهة كبير.

## روابط المصدر

- المستودع: `https://github.com/Hosyss/qabl-almushahada`
- الإنتاج: `https://qabl-almushahada.buildtools.workers.dev`
- Roadmap: `docs/ROADMAP.md`
- سياسة المصادر: `docs/CONTENT_SOURCE_POLICY.md`
- Trust model: `docs/ENGINE_TRUST_MODEL.md`
- Cloudflare: `docs/CLOUDFLARE_DEPLOYMENT.md`
