# نموذج ثقة الإنچين

آخر تحديث تشغيلي: 13 أغسطس 2026

هذه الوثيقة تشرح **من أين تأتي الثقة، وما الذي يمكن نشره، وما الذي يملك سلطة إصدار حكم**. المشروع يملك الآن ثلاثة مسارات منفصلة لا يجوز خلط هوياتها أو استخدام أحدها لتمرير بوابات الآخر:

1. مسار مراجعة بشرية عالي الضبط من P2/P2Q.
2. مسار evidence-based كامل من P3S مرتبط بنسخة محددة.
3. مسار P4-03 تحريري جزئي ينشر وقائع مثبتة من مصادر مستقلة لكنه **لا يملك سلطة حكم الملاءمة**.

## الحقيقة الأساسية

لا يوجد مصدر واحد يملك سلطة الحقيقة أو النشر أو الحكم. لذلك نفصل بين سؤالين:

```text
هل توجد واقعة يمكن نشرها بأمان؟
        ↓
Editorial / Evidence Publication Gate
        ↓
هل الأدلة كاملة بما يكفي للحكم؟
        ↓
Suitability Decision Gate
        ↓
family policy + deterministic engine
```

النتيجة المهمة:

- نقص coverage يمكن أن يسمح **بصفحة تحريرية جزئية** إذا كانت الوقائع المنشورة نفسها متحققة ومصادرها ظاهرة.
- نفس النقص يمنع **حكم الملاءمة** ويُبقيه `insufficient_data`.
- لا يوجد مسار يحول unknown أو failure إلى «مناسب».

## القواعد المشتركة

1. **لا silence → safe**: عدم ذكر محور لا يساوي `none`.
2. **الفصل بين الواقعة والحكم**: إثبات واقعة لا يساوي age rating أو suitability verdict.
3. **استقلال المصدر**: وصف claim بأنها `corroborated` يحتاج مصدرين من مجموعتي استقلال مختلفتين على الأقل.
4. **Conflict fail-closed**: التعارض لا يُحل بالتخمين. في المسار الكامل يمنع readiness؛ وفي P4-03 يجعل المحور/claim غير محسومة بدل إخفاء الخلاف.
5. **Server-owned authority**: العميل لا يحدد reviewer identity أو actor أو policy version أو human-watch status أو decision eligibility.
6. **No hidden trust score**: لا توجد درجة ثقة رقمية مركبة تخفي حجم العينة أو نوع المصدر.
7. **No copied authority**: تقييم جهة خارجية أو رأي reviewer خارجي لا يتحول إلى حكمنا؛ نستخرج الوقائع فقط ونكتب تحليلنا بالعربية من الصفر.

## هوية النسخة

- المساران اللذان يمكن أن يقودا إلى حكم مكتمل — P2/P2Q وP3S — يحتاجان `title_version` محددة وبصمة/منصة/لغة/مدة وفق قواعدهما.
- P4-03 يسمح مؤقتًا بتحليل **على مستوى العمل** عندما لا توجد exact-version identity، بشرط إظهار هذا القيد صراحة وفرض:

```text
decisionEligible = false
decisionStatus = insufficient_data
```

هذا ليس تخفيفًا لبوابة النسخة؛ بل منع صريح لاستخدام التحليل الجزئي كحكم نسخة.

---

# المسار البشري — P2 / P2Q

هذا المسار باقٍ عند الحاجة إلى مراجعة بشرية فعلية.

## طبقات الحماية البشرية

- المراجعة مرتبطة ببصمة نسخة ومنصة ولغة ومدة.
- قائمة فحص صريحة لكل محور: موجود / غير موجود / غير محسوم.
- مشاهدة أقل من 95% لا تكفي للاعتماد.
- مراجعان مستقلان على الأقل ومن مجموعتي استقلال مختلفتين.
- اعتماد تحريري مستقل عن مجموعات المراجعين.
- submissions وapprovals revisions append-only ومتصلة بسلسلة مباشرة.
- `review_assignments.submission_id` و`review_bundles.current_approval_id` هما المؤشران للحالة الحالية.
- البلاغ الجوهري يسقط current approval فورًا ويحوّل الحالة fail-closed.
- audit selection/outcomes/calibration/reference calibration/Safety Hold محفوظة ومختبرة.

## P2-03 — متى نحتاج المراجع الثالث؟

تتطلب الحالة **3 مراجعين نشطين من 3 مجموعات استقلال مختلفة** عند:

- أي severity = 4.
- `selfHarm` من severity 1.
- `sexualContent` أو `flashingLights` من severity 2.
- `violence` أو `substances` أو `discrimination` أو `bullying` من severity 3.
- flag `flashing_sequence` من severity 1.
- flags `blood` أو `weapon` أو `physical_bullying` من severity 3.

غياب المراجع الثالث = نقص دليل، أما disagreement حقيقي فيظل conflict.

## P2Q-01 — التدقيق العشوائي

- baseline: **10% = 1000 bps**.
- high-risk: **50% = 5000 bps** وفق نفس P2-03 thresholds.
- الاختيار server-side بعد تجميد submission، باستخدام CSPRNG.
- لا يكشف للمراجع وقت الإرسال.
- SQLite تعيد التحقق من risk tier والrate والdraw والselected.

## P2Q-02 — نتيجة التدقيق

- selected audit تمنع الاعتماد حتى outcome مستقلة.
- `confirmed` بلا findings.
- `missed_event` أو `severity_difference` ينتج `correction_required`.
- normalized rates لا تظهر قبل **20 audit مكتملة**.
- لا trust score مركبة ولا ranking للمراجعين.

## P2Q-03 — المعايرة المرجعية

Pass قبل التفعيل يحتاج:

- 10 حالات على الأقل.
- ≥95% اتفاق المحاور.
- ≥90% recall.
- ≥90% precision.
- صفر high-sensitivity event فائت.
- أقصى severity delta = 1.

المراجع الجديد يبدأ `probation`، والعودة بعد الإيقاف تحتاج Pass حديثة بعد الإيقاف.

## P2Q-04 — Safety Hold

Immediate hold عند أحدث audit مستقلة إذا ظهر:

- high-sensitivity event فائت؛ أو
- severity delta = 3.

Aggregate rules لا تعمل قبل 20 audit مكتملة في active epoch. داخل آخر 20:

- 5 `correction_required`؛ أو
- 3 audits بها missed events؛ أو
- 3 audits بها severity delta ≥2.

الـHold يعلق سلطة الثقة، لا يمحو الحساب أو التاريخ. العودة:

```text
Human resolution
  → fresh reference calibration
  → Admin activation
```

---

# المسار evidence-based الكامل — P3S

الهدف هو تغطية الأعمال من أدلة مرخصة قابلة للتتبع من غير إنشاء reviewers وهميين لتمرير بوابات المسار البشري.

## P3S-04 — provenance

- `content_source_policy_snapshots`: policy versioned.
- `title_catalog_sources`: provenance للكتالوج.
- `version_evidence_sources`: evidence مرتبطة بنسخة محددة.
- السجلات append-only ومحكومة بـsource/use scope والرخصة والـhash.

## P3S-05 — الاستخراج وCoverage/Conflict

### سلطة Workers AI

Workers AI **ليست سلطة نشر**. دورها استخراج structured claims/facts من evidence المسموح بها.

بالنسبة إلى prose الآلية:

- المخرجات المسموحة: `present` أو `uncertain` فقط.
- `none` ممنوعة للنموذج؛ غياب الذكر ليس دليلًا على عدم الوجود.
- `present` تحتاج fact وlocator حقيقي.
- `uncertain` تحمل trace لنطاق المادة التي تم فحصها، لا فقرة داعمة مزعومة.
- لا نختلق runtime timestamps من نص لا يحتويها.

### `assessEvidenceReview`

تمنع readiness عند:

- محور بلا coverage.
- `uncertain`.
- `present` بلا fact.
- claim تشير لمصدر غير موجود أو نسخة أخرى.
- presence conflict بين المصادر.
- severity delta ≥2 بين المصادر في نفس المحور.
- malformed fact/assertion/source identity.

النتيجة الجاهزة من P3S-05 **ليست منشورة تلقائيًا**؛ candidate نفسها `publishable: false`.

## P3S-06 — بوابة النشر الكاملة

`prepareEvidencePublication()` تعيد تشغيل بوابات P3S-05 ثم تفرض:

- `status = ready` و`engineEligible = true`.
- عدد المصادر/claims/facts bounded.
- تطابق مجموعة `EvidenceSourceRef` مع مجموعة provenance واحدًا لواحد.
- تطابق version/policy snapshot/URL/revision/hash حرفيًا.
- source policy الحالية ما زالت تسمح `analysis_evidence`.
- license label وlicense URL يطابقان policy.
- attribution موجودة عندما تكون مطلوبة.
- `model_assisted + none` ممنوعة.
- `reviewMethod = evidence_based` server-owned.
- `humanWatchConfirmed = false` server-owned.

### Snapshot غير قابلة للمحو

migration P3S-06 تضيف:

- `evidence_review_publications`
- `evidence_publication_sources`
- `evidence_publication_assertions`
- `evidence_publication_facts`
- `evidence_publication_fact_flags`
- `evidence_review_publication_heads`

publication revisions متصلة مباشرة عبر `supersedes_publication_id`. الصفوف التاريخية وclaims/facts/flags لا تُعدّل ولا تُحذف.

### بوابة D1 نفسها

`evidence_review_publication_heads` لا تسمح بإنشاء/تحريك current head إلا إذا تحقق داخل D1 نفسها:

1. النسخة `active`.
2. snapshot تحمل `review_method = evidence_based`.
3. `human_watch_confirmed = 0`.
4. يوجد مصدر واحد مسموح على الأقل.
5. كل linked source لنفس النسخة وتطابق policy.
6. كل claim مرتبطة بمصدر داخل نفس publication snapshot.
7. المحاور العشرة كلها محسومة صراحة بـ`none` أو `present`.
8. لا `uncertain` يمكنها إغلاق coverage.
9. لا presence conflict.
10. كل `present` لها structured fact واحدة على الأقل.
11. severity delta ≥2 عبر مصادر متعددة يمنع finalization.
12. head الجديدة تكون revision التالية مباشرة وتsupersede current publication السابقة فقط.

هذا يجعل fail-closed property موجودة حتى لو حدث bug في طبقة TypeScript قبل finalization.

### العرض العام الكامل

```text
/review?bundleId=...       → human-reviewed full path
/review?publicationId=...  → evidence-based full path
```

public evidence loader يعيد التحقق بعد hydration؛ أي stale/current-head race يمنع العرض.

الواجهة الكاملة تقول بوضوح إن المشاهدة البشرية غير مدعاة عندما يكون المسار evidence-based، وتعرض المصدر والرخصة والعزو والrevision.

---

# المسار التحريري الجزئي — P4-03

هذا المسار موجود لحل مشكلة عملية مختلفة: قد نملك **وقائع مفيدة ومتقاطعة** عن عمل معروف، لكن لا نملك بعد coverage كاملة أو exact-version identity تسمح بحكم الملاءمة.

## ما الذي نأخذه من المراجعات المنشورة؟

**الوقائع فقط.** لا نأخذ تقييم المصدر أو age recommendation كحكمنا، ولا نخزن تعبيره التحريري.

عقد `EditorialSourceReference` يخزن فقط:

- `publisher`
- `sourceType`: `published_review` أو `official_classification`
- `sourceUrl`
- `accessedOn`
- `independenceGroupId`
- `supportedClaimIds`

لا يحتوي العقد على حقول source text/excerpt/quote/translation/paraphrase.

## قاعدة الاستقلال

كل claim لها أحد الوصفين:

- `corroborated`: تحتاج مجموعتي استقلال مختلفتين على الأقل.
- `single_source`: مسموحة في العقد للشفافية، لكن يجب أن تظهر كذلك ولا يجوز تسميتها corroborated.

Cars pilot الحالي لا ينشر إلا claims `corroborated`.

## Coverage في P4-03

كل محور من المحاور العشرة يجب أن يكون واحدًا من:

```text
present via one or more explicit editorial claims
uncertain
```

لا يوجد `none` مبني على silence في الـpilot.

`uncertain` **لا يمنع الصفحة التحريرية** لكنه يمنع قرار الملاءمة.

## سلطة النشر مقابل سلطة الحكم

`assessEditorialReviewPublication()` يمكن أن تعيد:

```text
publishable = true
```

مع وجود محاور `uncertain`، إذا كانت الوقائع نفسها قابلة للتتبع ومتسقة مع قواعد الاستقلال.

لكنها تعيد دائمًا:

```text
decisionEligible = false
decisionStatus = insufficient_data
```

وبالتالي لا يستطيع هذا المسار وحده استدعاء نفسه «verified suitability review» أو إنتاج suitable badge.

## العرض العام

```text
/review?editorialId=... → editorial partial facts path
```

`/review` يقبل locator واحدًا فقط من الثلاثة؛ أكثر من locator أو locator غير صالح يعيد حالة غير متاحة بدل المزج.

الواجهة تقول بوضوح:

- **«تحليل تحريري موثق جزئيًا»**.
- **«البيانات غير كافية للحكم»**.
- عدد الوقائع المتقاطعة.
- عدد المحاور `uncertain`.
- نطاق العمل، وأن exact cut غير مدعاة إذا لم تُثبت.
- قائمة المصادر، نوع كل مصدر، تاريخ الوصول، والادعاءات التي يدعمها.

## Cars pilot

الـpilot على `Cars` / `wd:Q182153` ينشر أربع claims متقاطعة في:

- `violence`
- `fear`
- `language`
- `sexualContent`

ويترك ستة محاور `uncertain`.

لا يوجد suitability verdict ولا human-watch claim ولا synthetic content fingerprint.

## حدود الـpilot الحالية

- persistence مؤقتة في registry versioned داخل المستودع، وليست D1 append-only بعد.
- لذلك **لا توسع إلى عنوان ثانٍ** قبل نجاح checkpoint الحالي ثم قرار persistence للتوسع.
- عند الانتقال إلى D1 يجب إعادة تطبيق immutability/current-pointer/audit history المناسبة لهذا المسار قبل cohort واسع.

---

# علاقة النشر بقرار الأسرة

### full review publication

وجود human/evidence publication مكتملة يعني أن الوقائع اجتازت بواباتها، ثم يمكن تطبيق Family Profile:

```text
verified current facts
  + Arab Family Policy / family overrides
  → deterministic engine verdict
```

### editorial partial publication

```text
corroborated editorial facts
  + unresolved categories
  → useful public analysis
  → decisionStatus = insufficient_data
```

لا يجوز تمرير الوقائع الجزئية إلى suitable badge أو age filter كأن coverage مكتملة.

---

# ما لا يمكن ضمانه بالكامل؟

- المصدر نفسه قد يحتوي خطأ أو نقصًا.
- عدة مصادر قد تكرر نفس الخطأ الأصلي؛ الاستقلال المؤسسي يقلل الخطر لكنه لا يلغيه.
- المراجعات المنشورة ليست checklist موحدة؛ لذلك silence لا يصبح `none`.
- model extraction قد يخطئ رغم structured output.
- human reviewers قد يتواطؤون أو يخطئون جماعيًا.
- sampling لا يكتشف كل خطأ.

تقليل هذه المخاطر يحتاج استمرار:

- تنويع المصادر المستقلة.
- حفظ claim-to-source trace بدل النص المنقول.
- مراجعة يدوية لأول cohort.
- corrections علنية قابلة للتتبع.
- عدم تخفيف Decision Gate لتسريع SEO أو الإعلانات.

## الحالات التشغيلية المختصرة

### المسار البشري

```text
draft → under_review → submitted + audit_selection_decision → verified
                     ↘ report_open → conflicted
                                      ├─ no_issue → verified
                                      ├─ correction_required → under_review → revisions جديدة → approval جديدة → verified
                                      └─ different_version → withdrawn
```

### المسار evidence-based الكامل

```text
licensed evidence
  → extraction
  → coverage/conflict assessment
  → ready candidate
  → P3S-06 publication snapshot
  → D1 current-head gate
  → public evidence review

uncertain / missing / conflict / stale policy / cross-version
  → not current / not public / insufficient_data
```

### المسار التحريري الجزئي

```text
published independent sources
  → manual fact extraction only
  → original Arabic claims
  → independent corroboration check
  → present + uncertain category partition
  → public editorial page
  → suitability decision remains insufficient_data
```

## مبدأ الفشل الآمن

- فشل سلامة claim أو source trace أو independence يمنع **نشر الواقعة/الصفحة التحريرية**.
- نقص coverage أو exact-version identity يمنع **حكم الملاءمة**، حتى لو كانت صفحة الوقائع مفيدة وقابلة للنشر.
- فشل هوية النسخة أو current state أو provenance في المسارات الكاملة يمنع full review publication كما كان قبل P4-03.

لا يوجد مسار افتراضي يحول الخطأ أو المجهول إلى «مناسب».
