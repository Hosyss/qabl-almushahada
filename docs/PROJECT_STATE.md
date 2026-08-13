# حالة مشروع «قبل المشاهدة»

آخر تحديث: 13 أغسطس 2026

## الحالة الحالية

- الكتالوج الحقيقي: **200/200** عنوان Wikidata داخل D1.
- البحث والاقتراحات من D1: **مكتملان إنتاجيًا**.
- Editorial Publication الحالية: **4 فقط** — Cars وE.T. وHarry Potter 1 وMinions.
- `P4-03B2`: المراجعة اليدوية والتنفيذ على فرع الجودة مكتملان؛ الإغلاق النهائي ينتظر PR ثم `main` وCloudflare وLive Smoke.
- لم نضف عنوانًا جديدًا ولم نغير بوابة الحكم.
- لا يبدأ `P4-03C` قبل إغلاق B2 وإبلاغ المستخدم.

## قواعد الثقة

- `corroborated` تحتاج مجموعتي استقلال على الأقل.
- `single_source` تعني مجموعة استقلال واحدة فقط وتظهر بهذا الوصف للزائر.
- ما لم يثبت يظل `uncertain`، وصمت المصدر لا يتحول إلى `none`.
- كل الصفحات تظل `decisionEligible = false` و`decisionStatus = insufficient_data`.
- mixed review locators تفشل مغلقًا.

## نتيجة مراجعة المصادر

المجموعة المنشورة الحالية لا تحتسب Common Sense Media أو Plugged In أو BBFC أو Dove. كل صفحة تستخدم حاليًا:

- Wikipedia revision ثابتة تحت `CC BY-SA 4.0`.
- Kids-In-Mind كـ`link_only_factual_reference` فقط، من دون نقل نص المراجعة أو ترجمتها أو درجاتها أو بنيتها.

التفاصيل: `docs/P4_03_B2_SOURCE_RIGHTS.md`.

## قوة الأدلة الحالية

| الصفحة | المصادر | corroborated | single_source | uncertain |
|---|---:|---:|---:|---:|
| Cars | 2 | 1 | 3 | 6/10 |
| E.T. | 2 | 4 | 1 | 5/10 |
| Harry Potter 1 | 2 | 3 | 1 | 6/10 |
| Minions | 2 | 1 | 3 | 6/10 |

في Minions عاد `fear` إلى `uncertain` بعد إزالة المصدر المستقل الثاني غير المؤهل.

## جودة الصفحات بعد B2

- شرح عربي واضح لعدم كفاية البيانات بدل الاعتماد على الرمز الإنجليزي.
- كل claim تعرض قوة الإسناد وروابط مصادرها.
- الاتفاق المستقل منفصل عن الدليل الأحادي والمحاور غير المحسومة.
- أساس استخدام كل مصدر والرخصة أو الشروط ظاهر للزائر.
- metadata ديناميكية وcanonical وArticle JSON-LD.
- `sitemap.xml` يستخدم نفس canonical helper.
- Render فعلي في Chrome على `1440px` و`390px` للصفحات الأربع، ولم يظهر overflow أو تداخل.

تفاصيل المراجعة: `docs/P4_03_B2_QUALITY_AUDIT.md`.

## الاختبارات

الاختبارات تغطي استقلال المصادر، قوة claim، بيانات الحقوق، منع تخزين تعبير المصدر أو تقييمه، منع المصادر المستبعدة، عدم تحويل الصمت إلى `none`، fail-closed للحكم، وmetadata/canonical/structured data/sitemap.

آخر Checkpoint على نسخة المنتج الحالية: Engine + migrations + lint + build = **success**.

## الخطوة التالية

إغلاق `P4-03B2` فقط: إزالة Workflow المراجعة المؤقت، Quality Gate على آخر head، PR وmerge، ثم نجاح `main` وCloudflare وLive Smoke الموسع. بعدها نتوقف قبل أي توسع إلى 10–20.
