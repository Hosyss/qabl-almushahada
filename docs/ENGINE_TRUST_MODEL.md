# نموذج ثقة الإنچين

آخر تحديث تشغيلي: 13 أغسطس 2026

هذه الوثيقة تشرح **من أين تأتي الثقة وما الذي يمنع النشر**. المشروع الآن يملك مسارين منفصلين: مسار مراجعة بشرية عالي الضبط من P2/P2Q، ومسار evidence-based قابل للتوسع من P3S. لا يجوز خلط هوياتهما أو تزوير أحدهما لتمرير بوابات الآخر.

## الحقيقة الأساسية

الإنچين لا يعرف أن الإنسان صادق لمجرد أنه أدخل بيانات، ولا يعرف أن مخرجات النموذج الآلي صحيحة لمجرد أنها بصيغة JSON صحيحة. لذلك لا يوجد مصدر واحد يملك سلطة الحقيقة أو النشر.

المبدأ العام:

```text
source/evidence
  → structured facts
  → coverage + conflict gates
  → immutable/current state gate
  → family policy + engine
  → public presentation
```

أي نقص أو تعارض أو stale state يعيد أو يفرض حالة غير قابلة للنشر بدل التحول إلى «مناسب».

## القواعد المشتركة بين المسارين

1. **نسخة محددة**: كل حقيقة أو مراجعة مرتبطة بـ`title_version` محددة؛ cross-version evidence ممنوعة.
2. **Coverage صريحة**: الحقل الحرج غير المعروف لا يُفترض أنه آمن.
3. **Conflict fail-closed**: اختلاف وجود المحور أو فرق شدة كبير يمنع النشر.
4. **History غير قابلة للمحو**: التصحيح ينشئ revision جديدة بدل الكتابة فوق التاريخ.
5. **Current pointer صريح**: لا نختار أحدث صف بالصدفة؛ هناك current approval أو current evidence publication head.
6. **Server-owned authority**: العميل لا يحدد reviewer identity أو actor أو policy version أو human-watch status.
7. **Race protection**: القراءة العامة تعيد فحص الحالة الحالية بعد hydration قبل العرض.
8. **No hidden trust score**: لا توجد درجة ثقة رقمية مركبة تختصر الأدلة أو تخفي حجم العينة.

---

# المسار البشري — P2 / P2Q

هذا المسار باقٍ ومستخدم عند الحاجة إلى مراجعة بشرية فعلية، لكنه لم يعد شرط التوسع الوحيد للموقع.

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

# المسار evidence-based — P3S

الهدف هو تغطية آلاف الأعمال من **أدلة مرخصة قابلة للتتبع** من غير توظيف مراجعين يشاهدون كل عنوان، ومن غير إنشاء reviewers وهميين لتمرير بوابات المسار البشري.

## P3S-04 — provenance

- `content_source_policy_snapshots`: policy قانونية versioned.
- `title_catalog_sources`: provenance للكتالوج.
- `version_evidence_sources`: evidence مرتبطة بنسخة محددة.
- السجلات append-only ومحكومة بـsource/use scope والرخصة والـhash.

## P3S-05 — الاستخراج وCoverage/Conflict

### سلطة Workers AI

Workers AI **ليست سلطة نشر**. دورها استخراج structured claims/facts من evidence مرخصة.

بالنسبة إلى prose الآلية:

- المخرجات المسموحة: `present` أو `uncertain` فقط.
- `none` ممنوعة للنموذج؛ غياب الذكر ليس دليلًا على عدم الوجود.
- `present` تحتاج fact وlocator `P####` حقيقي.
- `uncertain` تحمل trace لنطاق الـchunk الذي تم فحصه، لا فقرة داعمة مزعومة.
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

---

# P3S-06 — بوابة النشر المستقلة

P3S-06 تضيف سلطة نشر جديدة خاصة بالمسار evidence-based. هذه السلطة **موازية** للمسار البشري ولا تستخدم `review_bundles` أو `editorial_approvals` بصورة مزيفة.

## قواعد ما قبل persistence

`prepareEvidencePublication()` تعيد تشغيل بوابات P3S-05 ثم تفرض:

- `status = ready` و`engineEligible = true`.
- عدد المصادر/claims/facts bounded.
- تطابق مجموعة `EvidenceSourceRef` مع مجموعة provenance واحدًا لواحد.
- تطابق version/policy snapshot/URL/revision/hash حرفيًا.
- source policy الحالية ما زالت تسمح `analysis_evidence` تجاريًا.
- license label وlicense URL يطابقان policy.
- attribution موجودة عندما تكون مطلوبة.
- `model_assisted + none` ممنوعة.
- `reviewMethod = evidence_based` server-owned.
- `humanWatchConfirmed = false` server-owned.

## Snapshot غير قابلة للمحو

migration P3S-06 تضيف:

- `evidence_review_publications`
- `evidence_publication_sources`
- `evidence_publication_assertions`
- `evidence_publication_facts`
- `evidence_publication_fact_flags`
- `evidence_review_publication_heads`

publication revisions متصلة مباشرة عبر `supersedes_publication_id`. الصفوف التاريخية وclaims/facts/flags لا تُعدّل ولا تُحذف.

## لماذا الـDB نفسها بوابة نشر؟

التطبيق لا يكفي وحده. `evidence_review_publication_heads` لا تسمح بإنشاء/تحريك current head إلا إذا تحقق داخل D1 نفسها:

1. النسخة `active`.
2. snapshot تحمل `review_method = evidence_based`.
3. `human_watch_confirmed = 0`.
4. يوجد مصدر واحد مرخص على الأقل.
5. كل linked source هي `analysis_evidence` لنفس النسخة ورخصتها مطابقة للـpolicy.
6. كل claim مرتبطة بمصدر داخل نفس publication snapshot.
7. المحاور العشرة كلها محسومة صراحة بـ`none` أو `present`.
8. لا `uncertain` يمكنها إغلاق coverage.
9. لا presence conflict.
10. كل `present` لها structured fact واحدة على الأقل.
11. severity delta ≥2 عبر مصادر متعددة يمنع finalization.
12. head الجديدة تكون revision التالية مباشرة وتsupersede current publication السابقة فقط.

هذا يجعل fail-closed property موجودة حتى لو حدث bug في طبقة TypeScript قبل finalization.

## معاملة النشر

`publishEvidenceReview()` تكتب في D1 batch واحدة:

- missing provenance إن لم تكن موجودة بعد.
- immutable publication snapshot.
- source links.
- assertion snapshots.
- fact snapshots والflags.
- ثم current head كآخر statement.

لو تغير head في نفس الوقت، optimistic condition تمنع overwrite الصامت ويجب إعادة البناء من الحالة الحالية.

## العرض العام

المساران في `/review` منفصلان:

```text
/review?bundleId=...       → human-reviewed path
/review?publicationId=...  → evidence-based path
```

وجود الاثنين أو غيابهما يفشل مغلقًا.

public evidence loader يعمل:

```text
initial gate
  → hydrate sources/claims/facts
  → validate rows + licenses
  → re-run assessEvidenceReview
  → final gate with same revision
  → render
```

أي تغيير في current head أثناء القراءة يمنع العرض بدل مزج state قديمة وجديدة.

## ما الذي يظهر للمستخدم؟

الواجهة يجب أن تقول بوضوح:

- **«مراجعة مبنية على أدلة»**.
- **«المشاهدة البشرية — غير مدعاة»**.
- **«لا ندّعي مشاهدة بشرية لم تحدث»**.
- المصدر والرخصة والعزو والrevision متاحون من snapshot المنشورة.
- التوقيت غير الموجود يظهر كغير متاح؛ لا يتم اختلاق timestamp.

النص التحريري الثابت:

> **نحن لا ننقل مراجعة الآخرين؛ المصادر تمدنا بالدليل، والمراجعة النهائية وتجميع الوقائع وقرار الأسرة من منهج «قبل المشاهدة».**

هذه العبارة لا تعني أن الموقع شاهد العمل؛ هي تصف ملكية منهج التنظيم والتقييم والقرار فقط.

## علاقة النشر بقرار الأسرة

وجود evidence publication جاهزة يعني أن **الوقائع المنشورة اجتازت بوابة الأدلة**، وليس أن العمل «مناسب» لكل أسرة.

قرار الأسرة يظل خطوة منفصلة:

```text
current evidence facts
  + Arab Family Policy / family overrides
  → deterministic engine verdict
```

لا يجوز اختزال publication نفسها إلى age rating أو suitable badge من غير تطبيق حدود الأسرة.

---

# ما لا يمكن ضمانه بالكامل؟

- المصدر المرخص نفسه قد يحتوي خطأ أو نقصًا.
- عدة مصادر قد تكرر نفس الخطأ الأصلي.
- Wikipedia ليست exhaustive Parents Guide؛ لذلك silence لا يصبح `none`.
- model extraction قد يخطئ رغم structured output.
- human reviewers قد يتواطؤون أو يخطئون جماعيًا.
- sampling لا يكتشف كل خطأ.

تقليل هذه المخاطر يحتاج استمرار:

- إضافة مصادر evidence مستقلة عند توفر حق استخدامها التجاري.
- P3S-07 taxonomy أوضح وأكثر موضوعية.
- P4-03 مقارنة 20 مراجعة evidence-based فعلية يدويًا قبل التوسع.
- corrections علنية قابلة للتتبع.
- عدم تخفيف fail-closed بصمت لتسريع SEO أو الإعلانات.

## الحالات التشغيلية المختصرة

### المسار البشري

```text
draft → under_review → submitted + audit_selection_decision → verified
                     ↘ report_open → conflicted
                                      ├─ no_issue → verified
                                      ├─ correction_required → under_review → revisions جديدة → approval جديدة → verified
                                      └─ different_version → withdrawn
```

### المسار evidence-based

```text
licensed evidence
  → extraction
  → coverage/conflict assessment
  → ready candidate (still not publish authority)
  → P3S-06 publication snapshot
  → D1 current-head gate
  → public evidence review

uncertain / missing / conflict / stale policy / cross-version / invalid licence
  → not current / not public
```

## مبدأ الفشل الآمن

أي فشل في هوية النسخة، التغطية، سلامة المصدر أو الرخصة، التتبع، الاتساق، lineage التاريخ، current state، استقلال المراجعة البشرية عندما تُستخدم، التدقيق، المعايرة، Safety Hold، أو publication gate يمنع النشر أو يعيد:

```text
verdict = insufficient_data
```

ولا يوجد مسار افتراضي يحول الخطأ إلى «مناسب».