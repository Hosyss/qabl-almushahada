# الاستمرار على الخطة المجانية بأقل استهلاك

هذه الخطة تجعل GitHub هو مصدر الحقيقة، فلا يعتمد استمرار المشروع على بقاء مساحة عمل أو محادثة بعينها.

وفق [التسعير الرسمي لـ ChatGPT Work وCodex](https://learn.chatgpt.com/docs/pricing)، السعات والميزات تختلف حسب الخطة والمنطقة وإعدادات الحساب. لذلك لا نعتمد في الخطة التالية على Sites أو جلسة سحابية بعينها.

## حالة التسليم الحالية — 12 أغسطس 2026

- مرحلة `P2-01` إلى `P2-05` الخاصة بقاعدة البيانات وسير المراجعة والثقة مكتملة على `main`.
- `P2Q-01` مكتملة على `main`: اختيار audit بعد الإرسال المقفول بـCSPRNG server-side، **10% baseline / 50% high-risk** باستخدام نفس P2-03 thresholds، والنتيجة لا تُعاد للمراجع.
- `P2Q-02` مكتملة على `main`: outcome للتدقيق الفعلي + missed events + severity differences + independent auditor + calibration sample size. selected audit تمنع الاعتماد حتى outcome = `confirmed`، ووجود finding ينتج `correction_required` ويرجع الـassignment إلى `changes_requested`.
- `P2Q-03` مكتملة على `main`: مجموعة معايرة مرجعية مستقلة قبل التفعيل وبعد الإيقاف، وPass/Fail deterministic بلا trust score. الحساب الجديد يبدأ `probation`، وإعادة التفعيل تحتاج Pass حديثة على المجموعة المرجعية الحالية.
- `P2Q-04` مكتملة تقنيًا على فرع `agent/p2q-04-automatic-safety-holds` وجاهزة للدمج بعد آخر CI/PR: Safety Hold مفسرة ومؤقتة، توقف reviewer والحساب وتُسقط الثقة الحالية من الحزم المرتبطة به كمراجع أو مدقق أو معتمد تحريري، مع سجل append-only وحسم بشري قبل إعادة المعايرة.
- سياسة P2Q-04 الحالية `2026-08-12.v1`: Hold فوري عند missed high-sensitivity event أو severity delta = 3؛ وقواعد aggregate بعد **20 audit مكتملة** فقط: 5 تصحيحات أو 3 audits بها missed events أو 3 audits بها severity delta >=2 داخل آخر 20.
- الاشتباه اليدوي في التواطؤ ليس حكمًا بالذنب: هو `COLLUSION_SUSPICION` لفتح تحقيق بشري، Admin-only، ويتطلب أدلة audit مخزنة مرتبطة بالمراجع المستهدف.
- مسار استئناف المراجع بعد Safety Hold: **Human Admin resolution → fresh P2Q-03 reference calibration → Admin activation**. لا يكفي الحسم وحده ولا calibration قديمة.
- آخر code checkpoint قبل التوثيق لـP2Q-04 اجتاز **122/122 اختبارًا** مع `test:migrations` و`lint:local` و`build:local`؛ قاعدة البيانات عند **18 migration files / 24 product tables**.
- **التالي بعد دمج P2Q-04:** `P2Q-05` — لوحة جودة داخلية تعرض أسباب الوقف والتعارض ومؤشرات المعايرة بلا ranking تنافسي أو composite trust score.
- البنود المناسبة للخطة المجانية عندما نريد توفير الرصيد: `P0-05`, `P3-02`, `P3-04`, `P3-05`, `P3-06`, `P4-01`، بشرط عدم تعديل إنچين الثقة أو schema أثناء تنفيذها.
- البنود المتوسطة يمكن تنفيذها على دفعات صغيرة: `P2Q-05`, `P3-01`, `P3-03`, `P4-02`, `P4-04`, `P4-05`.
- نشر Cloudflare الفعلي ما زال يحتاج حساب Cloudflare مصادقًا وD1 حقيقية؛ لا تعتبر رابط `chatgpt.site` نشر الإنتاج النهائي.

## تجهيز الجهاز مرة واحدة

1. ثبّت Git وNode.js 22 وVS Code.
2. على Windows استخدم WSL أو Git Bash للأوامر الكاملة، أو أوامر `:local` للتطوير العادي.
3. انسخ المستودع:

```bash
git clone <REPOSITORY_URL>
cd qabl-almushahada
npm ci
npm run dev:local
```

## طريقة كل جلسة

1. افتح `docs/PROJECT_STATE.md`.
2. اختر **مهمة واحدة فقط** من `docs/ROADMAP.md`.
3. أنشئ فرعًا صغيرًا:

```bash
git switch -c task/P3-02-search-results
```

4. اختر بندًا موسومًا **خفيف / مجاني** أو قسّم بندًا **متوسطًا** إلى جزء واحد صغير، ثم اطلب من المساعد قراءة الملفات الضرورية فقط.
5. اختبر:

```bash
npm run lint:local
npm run build:local
npm run test:engine
npm run test:migrations
```

6. احفظ تقدمك:

```bash
git add <files-you-changed>
git commit -m "Complete one roadmap task"
git push -u origin <your-branch>
```

## Prompt قصير يوفر الرصيد

انسخه وعدّل رقم المهمة فقط:

```text
افتح مستودع qabl-almushahada. اقرأ AGENTS.md وdocs/PROJECT_STATE.md وبند P3-04 فقط من docs/ROADMAP.md. نفّذ هذا البند وحده، لا تغيّر الإنچين أو schema، شغّل الاختبارات المطلوبة في AGENTS.md، ثم حدّث PROJECT_STATE.md باختصار.
```

## قواعد توفير الاستخدام

- مهمة واحدة في الرسالة بدل «كمّل المشروع كله».
- اطلب قراءة الملفات المرتبطة بالمهمة فقط.
- لا ترسل تاريخ المحادثة؛ `PROJECT_STATE.md` يحتوي الحالة اللازمة.
- اجعل الصور وتوليدها لجلسة مستقلة لأنها تستهلك رصيدًا أكبر.
- استخدم نموذجًا أخف للمهام الميكانيكية إن كان متاحًا في حسابك.
- نفّذ الاختبارات محليًا، ثم أرسل فقط الخطأ الفعلي إن فشل شيء.
- حدّث `PROJECT_STATE.md` بعد كل جلسة حتى يبدأ أي مساعد جديد من مكان صحيح.
- لا تطلب من الخطة المجانية إعادة تصميم الإنچين من الصفر؛ نواة القرار وبوابات الجودة والمخطط محفوظة ومختبرة بالفعل.
- لو المهمة موسومة **حرج / Work**، لا تختصرها بإلغاء قيد أمان حتى «تشتغل»؛ اتركها pending إلى جلسة مناسبة.
- لا تعدّل migrations قديمة تم دمجها على `main`؛ أي تغيير schema جديد يكون migration جديدة ومراجعة منفصلة.
- لا تعتبر نجاح build وحده كافيًا؛ الأربع أوامر السابقة هي checkpoint الإلزامي.
- لا تجعل audit-selection client-side، ولا تُظهر للمراجع هل تم اختياره؛ هذا يكسر هدف P2Q-01.
- لا تسمح للعميل بإرسال `reviewerSeverity` أو هوية المدقق/المراجع في P2Q-02؛ هذه قيم server-owned.
- لا تعرض rates قبل 20 outcome مكتملة، ولا تحول counts/rates إلى trust score أو ترتيب تنافسي.
- لا تتجاوز بوابة P2Q-03 ولا تجعل Reviewer جديدًا/موقوفًا `active` من غير reference calibration صحيحة وحديثة.
- لا تضعف أو تحذف Safety Hold triggers/guards في P2Q-04 أثناء شغل UI أو refactor، ولا تجعل threshold قابلة للتعديل من الواجهة.
- لا تحول Safety Hold إلى trust score أو ranking؛ هي مجموعة شروط versioned ومفسرة، وليست درجة سمعة.
- `COLLUSION_SUSPICION` تعني «تحقيق بشري مطلوب» فقط؛ لا تعرضها أو تخزنها كإثبات تواطؤ.
- لا تُعد reviewer بعد Hold إلى الإنتاج بمجرد resolution؛ يجب إتمام معايرة مرجعية جديدة ثم Admin activation.
- أي dashboard في P2Q-05 يجب أن تعرض evidence/counts/trigger codes وحالة الحسم، لا ترتيبًا تنافسيًا للمراجعين.

## لو لم يتوفر ربط GitHub داخل الخطة

لا يتوقف المشروع: نزّل المستودع على الجهاز، عدّل محليًا في VS Code، ثم ارفع التغييرات بأوامر Git. ويمكنك إعطاء المساعد ملفًا واحدًا أو رسالة الخطأ بدل تحميل المشروع كله.

## الاستعادة في أي وقت

آخر نسخة سليمة تكون دائمًا على الفرع `main`. لو تجربة فشلت، لا تمسح الملفات يدويًا؛ ارجع للفرع الرئيسي أو افتح فرعًا جديدًا من آخر commit ناجح.
