# P2-02 — نموذج الدخول والصلاحيات للمراجعين

هذا المستند يثبت قواعد الجزء الأمني من P2-02. الواجهة الداخلية لا تملك سلطة أمان؛ كل قرار صلاحية والتحقق النهائي يحدث على الخادم.

## الأدوار وأقل صلاحية

| الدور | المسموح | غير المسموح |
|---|---|---|
| Admin | bootstrap الأول مرة واحدة، provisioning للحسابات، الإيقاف الآمن، وقراءة سجل التدقيق | إدخال مراجعة أو اعتماد محتوى لمجرد كونه Admin، أو إعادة تفعيل حساب موقوف قبل مسار P2Q |
| منسق المراجعات | إنشاء/توزيع المهام وقراءة حالة المهام | كتابة وقائع نيابة عن المراجع أو اعتماد النتيجة |
| مراجع | قراءة مهمته فقط، حفظ مسودتها، وإرسالها | فتح مهمة مراجع آخر، تغيير النسخة/المراجع، أو الاعتماد |
| معتمد تحريري | قراءة المراجعات المرسلة، طلب تعديل، إعلان conflict، والاعتماد وفق الاستقلال | اعتماد مراجعته أو مراجعة من مجموعة الاستقلال نفسها |

Admin لا يرث تلقائيًا صلاحيات المنسق أو المراجع أو المعتمد.

## مصدر الهوية والـbootstrap

1. الخادم يقرأ البريد المصادق عليه من `app/chatgpt-auth.ts`.
2. البريد يُطبع إلى lowercase ثم يُطابق `internal_users.auth_email`.
3. الدور وهوية المراجع ومجموعة الاستقلال تُحمّل من D1.
4. `role` و`reviewerId` القادمان من المتصفح لا يحددان هوية الفاعل.
5. أي قيمة مخزنة مجهولة أو حساب غير مفعّل يفشل مغلقًا.
6. إنشاء أول Admin مسموح فقط إذا كانت `internal_users` فارغة وكان بريد الجلسة يساوي `INTERNAL_BOOTSTRAP_ADMIN_EMAIL` المضبوط في بيئة التشغيل.
7. بعد وجود أول حساب داخلي، bootstrap يُرفض دائمًا.

## Provisioning وإيقاف الحسابات

- Admin فقط يستطيع إنشاء حساب داخلي جديد.
- البريد والدور يمران بتحقق server-side وunknown fields تُرفض.
- أدوار `reviewer` و`editorial_reviewer` لا تقبل `reviewerId` من الطلب.
- الخادم يولد هوية `reviewers` ويربطها بالحساب مع `displayLabel` و`independenceGroupId` المحددين إداريًا.
- قاعدة البيانات تمنع تعديل `auth_email` أو `role` أو `reviewer_id` بعد provisioning؛ تغيير الهوية لا يحدث بتحديث صامت.
- Admin يستطيع إيقاف حساب آخر بقفل `internal_users.revision`، وإيقاف reviewer يحول الحزم التي شارك فيها إلى `conflicted` ويرفع revision.
- إعادة تفعيل حساب موقوف محظورة حاليًا حتى تنفيذ سياسة المعايرة والاستئناف ضمن P2Q؛ هذا يمنع عودة مراجعات قديمة للأهلية بمجرد إعادة الحساب إلى `active`.

## توزيع المهام

- منسق المراجعات فقط يملك `assign_reviews`.
- الطلب يرسل بريد المراجع، لكن الخادم يحله إلى حساب داخلي بدور `reviewer` وحالة نشطة ثم يأخذ `reviewer_id` من D1.
- النسخة لا تأتي من المتصفح؛ تؤخذ من `review_bundles.version_id`.
- إنشاء المهمة يقفل `review_bundles.revision` ويستخدم `workflow_transition_id`، لذلك طلب stale لا يستطيع إنشاء assignment بعد تحديث منافس.
- SQLite triggers تمنع تبديل `bundle_id` أو `version_id` أو `reviewer_id` بعد إنشاء المهمة.

## حالات المهمة

```text
draft → assigned → in_progress → submitted
                              ↘ changes_requested → in_progress
submitted → approved
submitted → conflicted → changes_requested
```

- لا يوجد مسار `assigned → submitted` مباشر.
- `submitted` حالة مقفلة للمراجع.
- `changes_requested` و`conflicted` لا ينفذهما إلا معتمد تحريري مستقل عن المراجع.
- كل transition يمر بقفل revision ويسجل حدثًا؛ لا يوجد reopen صامت.

## حدود الإدخال قبل الإرسال

الإرسال النهائي يرفض على الخادم إذا تحقق أي من الآتي:

- تغطية المشاهدة أقل من 95%.
- محور ناقص أو `uncertain`.
- `present` من دون واقعة.
- `none` مع وجود واقعة لنفس المحور.
- قيمة enum مجهولة أو flag مجهول.
- توقيت خارج مدة النسخة أو ترتيب وقت غير صالح.
- `declaredComplete !== true`.
- حقول غير معروفة مثل `role` أو `reviewerId` أو `versionId` داخل payload.
- revision قديم أو المهمة مقفلة.

النسخة والمراجع لا يأتيان من payload. معرّفات الوقائع النهائية يولدها الخادم قبل الكتابة إلى الجداول التي يستهلكها الإنچين.

عند انتقال المهمة إلى `submitted` ترفع قاعدة البيانات revision الحزمة تلقائيًا، حتى لا يعتمد أو ينشر مسار آخر snapshot أقدم من المراجعة المقفلة.

## الاعتماد التحريري

- الاعتماد يتطلب `editorial_reviewer` نشطًا وهوية reviewer مرتبطة به.
- `assertCanApproveEditorially` يُطبق على كل assignment في الحزمة: لا self-approval ولا نفس مجموعة الاستقلال.
- الطلب يجب أن يحمل كل assignment IDs الحالية مع revisions المطابقة؛ إسقاط مهمة أو revision قديم يوقف الاعتماد.
- يجب تأكيد بصمة النسخة صراحة.
- spot checks تُراجع ضد الوقائع الفعلية في الحزمة.
- قبل أي كتابة، يبني الخادم candidate `EditorialApproval` ويشغّل `assessReviewQuality` على الحزمة كاملة.
- إذا كانت الجودة غير publishable فلا يتم إنشاء approval ولا تحويل assignments إلى `approved`.
- عند النجاح فقط تُكتب `editorial_approvals` وروابط submissions وspot checks، ثم تتحول المهام إلى `approved` بقفل revisions.

## الكتابة المتزامنة والتدقيق

- assignment drafts/submission تستخدم `review_assignments.revision` و`last_transition_id`.
- coordinator/editorial operations تقفل كذلك `review_bundles.revision` وتستخدم `workflow_transition_id`.
- الحسابات الداخلية لها `revision` و`last_transition_id` لإدارة التغييرات الإدارية بدون lost updates.
- أحداث الحزم تذهب إلى `review_audit_events`.
- أحداث الأمن العامة مثل bootstrap/provisioning تذهب إلى `internal_audit_events`.
- كلا الجدولين محميان بـSQLite triggers تمنع `UPDATE` و`DELETE`؛ السجل append-only على مستوى قاعدة البيانات وليس convention في التطبيق فقط.

## الاختبارات المثبتة

- `test:engine`: 49 اختبارًا تشمل إنچين القرار + IDOR + mass assignment + separation of duties + provisioning + coordinator assignment + editorial transitions/approval + منع reactivation قبل P2Q.
- `test:migrations`: يطبق 5 migrations على SQLite مؤقتة ويتحقق من 17 جدولًا والقيود والـtriggers وسجلات التدقيق غير القابلة للتعديل.
- `verify-workflow-transitions.mjs`: يثبت أن stale bundle revision لا ينشئ assignment وأن `submitted` يرفع bundle revision بينما `in_progress` لا يفعل.
- `lint:local` و`build:local` جزء من checkpoint verification الإلزامي.

## ما تبقى داخل P2-02

الجزء المعماري والأمني الحرج أصبح منفذًا. المتبقي هو `P2-02B` **خفيف / مجاني**:

- صفحة `/internal` حسب الدور.
- قوائم المهام.
- نموذج reviewer منظم للوقت والتغطية وchecklist والوقائع.
- forms بسيطة للـAdmin/Coordinator/Editorial تستدعي server actions الحالية.

هذه الواجهة لا يجوز أن تضيف صلاحيات جديدة أو تصبح مصدر validation بديلًا للخادم.
