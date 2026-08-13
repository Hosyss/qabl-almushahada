import {
  assessEditorialReviewPublication,
  parseEditorialReviewId,
  type EditorialReviewPublication,
} from "./editorial-review.ts";

const CARS_2006_EDITORIAL_REVIEW: EditorialReviewPublication = {
  id: "cars-2006-editorial-pilot-v1",
  titleId: "wd:Q182153",
  titleLabel: "Cars",
  releaseYear: 2006,
  kind: "movie",
  policyVersion: "2026-08-13.1",
  publishedAt: "2026-08-13T14:45:00+03:00",
  scopeAr:
    "هذا تحليل تحريري على مستوى العمل Cars (2006) مبني على مراجع مستقلة منشورة ومرجع تصنيف رسمي. لا ندّعي أن فريق «قبل المشاهدة» شاهد نسخة بعينها، ولا نربط الوقائع هنا ببصمة cut أو منصة أو مدة محددة؛ لذلك لا يملك هذا المسار وحده سلطة إصدار حكم ملاءمة مكتمل.",
  analysisAr:
    "المصادر المستقلة تتفق على أن الفيلم يتضمن سباقات وقيادة خطرة فيها اصطدامات وفقدان سيطرة، مع لحظات توتر قصيرة خارج الحلبة، وألفاظ وتعليقات خفيفة، إضافة إلى غزل وتلميحات بسيطة مبنية على عالم السيارات. هذه الخلاصة مكتوبة من الصفر اعتمادًا على الوقائع المتقاطعة بين المصادر، لا على نقل نص أي مراجعة. أما المحاور التي لا تملك تغطية كافية ومتسقة فتبقى غير محسومة بدل تحويل الصمت إلى «غير موجود».",
  decisionStatus: "insufficient_data",
  decisionEligible: false,
  sources: [
    {
      id: "cars-source-common-sense-media",
      publisher: "Common Sense Media",
      sourceType: "published_review",
      sourceUrl: "https://www.commonsensemedia.org/movie-reviews/cars",
      accessedOn: "2026-08-13",
      independenceGroupId: "common-sense-media",
      supportedClaimIds: [
        "cars-claim-violence",
        "cars-claim-fear",
        "cars-claim-language",
      ],
    },
    {
      id: "cars-source-plugged-in",
      publisher: "Plugged In",
      sourceType: "published_review",
      sourceUrl: "https://www.pluggedin.com/movie-reviews/cars/",
      accessedOn: "2026-08-13",
      independenceGroupId: "plugged-in",
      supportedClaimIds: [
        "cars-claim-violence",
        "cars-claim-language",
        "cars-claim-sexual-content",
      ],
    },
    {
      id: "cars-source-bbfc",
      publisher: "BBFC",
      sourceType: "official_classification",
      sourceUrl: "https://www.bbfc.co.uk/release/cars-q29sbgvjdglvbjpwwc00mtc2mjc",
      accessedOn: "2026-08-13",
      independenceGroupId: "bbfc",
      supportedClaimIds: [
        "cars-claim-violence",
        "cars-claim-fear",
        "cars-claim-language",
      ],
    },
    {
      id: "cars-source-kids-in-mind",
      publisher: "Kids-In-Mind",
      sourceType: "published_review",
      sourceUrl: "https://kids-in-mind.com/c/cars.htm",
      accessedOn: "2026-08-13",
      independenceGroupId: "kids-in-mind",
      supportedClaimIds: [
        "cars-claim-violence",
        "cars-claim-language",
        "cars-claim-sexual-content",
      ],
    },
    {
      id: "cars-source-dove",
      publisher: "Dove.org",
      sourceType: "published_review",
      sourceUrl: "https://dove.org/review/5768-cars/",
      accessedOn: "2026-08-13",
      independenceGroupId: "dove",
      supportedClaimIds: [
        "cars-claim-violence",
        "cars-claim-fear",
        "cars-claim-language",
        "cars-claim-sexual-content",
      ],
    },
  ],
  claims: [
    {
      id: "cars-claim-violence",
      category: "violence",
      summaryAr:
        "السباقات وبعض مطاردات الطريق تتضمن اصطدامات وفقدان سيطرة وأضرارًا واضحة لسيارات، وتعرض أكثر من مصدر لحوادث قوية داخل الحلبة وخارجها.",
      verification: "corroborated",
      sourceIds: [
        "cars-source-common-sense-media",
        "cars-source-plugged-in",
        "cars-source-bbfc",
        "cars-source-kids-in-mind",
        "cars-source-dove",
      ],
    },
    {
      id: "cars-claim-fear",
      category: "fear",
      summaryAr:
        "توجد مواقف خطر قصيرة قد ترفع التوتر عند الطفل، ومنها قيادة سريعة على الطريق ومشهد عبور سكة حديد مع اقتراب قطار.",
      verification: "corroborated",
      sourceIds: [
        "cars-source-common-sense-media",
        "cars-source-bbfc",
        "cars-source-dove",
      ],
    },
    {
      id: "cars-claim-language",
      category: "language",
      summaryAr:
        "توجد ألفاظ وتعليقات خفيفة وبعض الإهانات أو صيحات التعجب المتناثرة؛ لا نعتمد على عدّ حرفي موحّد لأن المواد المنشورة قد تصف نسخًا مختلفة.",
      verification: "corroborated",
      sourceIds: [
        "cars-source-common-sense-media",
        "cars-source-plugged-in",
        "cars-source-bbfc",
        "cars-source-kids-in-mind",
        "cars-source-dove",
      ],
    },
    {
      id: "cars-claim-sexual-content",
      category: "sexualContent",
      summaryAr:
        "توجد إشارات غزل ونكات أو تلميحات خفيفة مبنية على عالم السيارات، وهي تفاصيل قد يلتقطها الكبار أكثر من الأطفال.",
      verification: "corroborated",
      sourceIds: [
        "cars-source-plugged-in",
        "cars-source-kids-in-mind",
        "cars-source-dove",
      ],
    },
  ],
  uncertainCategories: [
    "bullying",
    "substances",
    "discrimination",
    "selfHarm",
    "grief",
    "flashingLights",
  ],
};

const ET_1982_EDITORIAL_REVIEW: EditorialReviewPublication = {
  id: "et-1982-editorial-batch-v1",
  titleId: "wd:Q11621",
  titleLabel: "إي تي",
  releaseYear: 1982,
  kind: "movie",
  policyVersion: "2026-08-13.1",
  publishedAt: "2026-08-13T15:11:00+03:00",
  scopeAr:
    "هذا تحليل تحريري على مستوى فيلم E.T. the Extra-Terrestrial (1982)، مبني على وقائع متقاطعة بين مراجعات مستقلة وبيانات تصنيف رسمية. توجد إصدارات مختلفة للفيلم، لذلك نتجنب التفاصيل التي تتغير باختلاف القص أو إعادة الإصدار، ولا ندّعي مشاهدة نسخة محددة أو امتلاك بصمة لها.",
  analysisAr:
    "تتقاطع المصادر على وجود مطاردات ومواقف احتجاز وخطر قد تكون مؤثرة على الأطفال الأصغر، وعلى لحظات مرض وفقدان مؤقت ترفع التوتر العاطفي. كما تسجل عدة جهات ألفاظًا واضحة، ومشهد شرب يؤدي إلى سلوك مخمور، وقبلة قصيرة في سياق المدرسة. صغنا هذه الخلاصة بالعربية من الوقائع المشتركة فقط، وتركنا المحاور التي لا تملك إثباتًا كافيًا في حالة غير محسومة. بعض تفاصيل المطاردة تغيرت بين إصدارات الفيلم، لذلك لا نعامل تفصيلًا خاصًا بنسخة واحدة كحقيقة عامة لكل النسخ.",
  decisionStatus: "insufficient_data",
  decisionEligible: false,
  sources: [
    {
      id: "et-source-common-sense-media",
      publisher: "Common Sense Media",
      sourceType: "published_review",
      sourceUrl: "https://www.commonsensemedia.org/movie-reviews/et-the-extra-terrestrial",
      accessedOn: "2026-08-13",
      independenceGroupId: "common-sense-media",
      supportedClaimIds: [
        "et-claim-fear",
        "et-claim-violence",
        "et-claim-language",
        "et-claim-substances",
        "et-claim-sexual-content",
      ],
    },
    {
      id: "et-source-plugged-in",
      publisher: "Plugged In",
      sourceType: "published_review",
      sourceUrl: "https://www.pluggedin.com/movie-reviews/et-the-extra-terrestrial-1982/",
      accessedOn: "2026-08-13",
      independenceGroupId: "plugged-in",
      supportedClaimIds: [
        "et-claim-fear",
        "et-claim-language",
        "et-claim-substances",
      ],
    },
    {
      id: "et-source-bbfc",
      publisher: "BBFC",
      sourceType: "official_classification",
      sourceUrl: "https://www.bbfc.co.uk/release/e-t-the-extra-terrestrial-q29sbgvjdglvbjpwwc0zmdgynjy",
      accessedOn: "2026-08-13",
      independenceGroupId: "bbfc",
      supportedClaimIds: ["et-claim-fear", "et-claim-language"],
    },
    {
      id: "et-source-kids-in-mind",
      publisher: "Kids-In-Mind",
      sourceType: "published_review",
      sourceUrl: "https://kids-in-mind.com/e/et.htm",
      accessedOn: "2026-08-13",
      independenceGroupId: "kids-in-mind",
      supportedClaimIds: [
        "et-claim-fear",
        "et-claim-violence",
        "et-claim-language",
        "et-claim-substances",
        "et-claim-sexual-content",
      ],
    },
  ],
  claims: [
    {
      id: "et-claim-fear",
      category: "fear",
      summaryAr:
        "توجد مطاردات ومواجهات ليلية ومواقف مرض واحتجاز، مع لحظات يبدو فيها أن الشخصية الفضائية قد تموت؛ وهي عناصر تسجلها عدة مصادر باعتبارها مصدر توتر واضح للصغار.",
      verification: "corroborated",
      sourceIds: [
        "et-source-common-sense-media",
        "et-source-plugged-in",
        "et-source-bbfc",
        "et-source-kids-in-mind",
      ],
    },
    {
      id: "et-claim-violence",
      category: "violence",
      summaryAr:
        "تتضمن القصة مطاردة واحتجازًا للشخصية الفضائية ومحاولات لمنع الأطفال من الهرب، لكننا لا نعمم تفاصيل الأسلحة لأن بعض الإصدارات غيرت هذه الجزئية.",
      verification: "corroborated",
      sourceIds: ["et-source-common-sense-media", "et-source-kids-in-mind"],
    },
    {
      id: "et-claim-language",
      category: "language",
      summaryAr:
        "تسجل المصادر ألفاظًا وشتائم متفرقة أقوى من المتوقع في فيلم عائلي صغير السن، إلى جانب إهانات وصيحات تعجب.",
      verification: "corroborated",
      sourceIds: [
        "et-source-common-sense-media",
        "et-source-plugged-in",
        "et-source-bbfc",
        "et-source-kids-in-mind",
      ],
    },
    {
      id: "et-claim-substances",
      category: "substances",
      summaryAr:
        "يوجد مشهد يشرب فيه E.T. كمية من البيرة ويظهر عليه أثر السكر، وينعكس السلوك المخمور على Elliott؛ كما تسجل بعض المصادر ظهور تدخين في محيط المراهقين.",
      verification: "corroborated",
      sourceIds: [
        "et-source-common-sense-media",
        "et-source-plugged-in",
        "et-source-kids-in-mind",
      ],
    },
    {
      id: "et-claim-sexual-content",
      category: "sexualContent",
      summaryAr:
        "توجد قبلة قصيرة في المدرسة مرتبطة بما تشاهده الشخصية الفضائية على التلفاز، من دون أن نبني على ذلك استنتاجًا أوسع عن بقية المحور.",
      verification: "corroborated",
      sourceIds: ["et-source-common-sense-media", "et-source-kids-in-mind"],
    },
  ],
  uncertainCategories: [
    "bullying",
    "discrimination",
    "selfHarm",
    "grief",
    "flashingLights",
  ],
};

const HARRY_POTTER_2001_EDITORIAL_REVIEW: EditorialReviewPublication = {
  id: "harry-potter-philosophers-stone-2001-editorial-batch-v1",
  titleId: "wd:Q102438",
  titleLabel: "هاري بوتر وحجر الفيلسوف",
  releaseYear: 2001,
  kind: "movie",
  policyVersion: "2026-08-13.1",
  publishedAt: "2026-08-13T15:11:00+03:00",
  scopeAr:
    "هذا تحليل تحريري على مستوى فيلم Harry Potter and the Philosopher's Stone (2001). نعتمد فقط على وقائع تتكرر في مراجع مستقلة وتصنيف رسمي، ولا نفترض أن كل إصدار منزلي أو سينمائي مطابق تمامًا للآخر، ولا ندّعي مشاهدة بشرية أو هوية نسخة محددة.",
  analysisAr:
    "تتفق المصادر على أن الفيلم يحتوي خطرًا خياليًا متكررًا ومواجهات مع مخلوقات وساحر شرير، إلى جانب عنف فانتازي في مباراة شطرنج ومواجهة النهاية. موت والدي Harry حاضر في خلفية القصة وتتم الإشارة إليه أكثر من مرة. كما تسجل جهات متعددة ألفاظًا خفيفة، مع اختلاف بين المصادر في شدة توصيف هذا المحور. لم نحول أي خانة تقول «غير موجود» أو أي صمت في مصدر واحد إلى حكم عام؛ لذلك تبقى بقية المحاور غير محسومة ويظل قرار الملاءمة غير متاح.",
  decisionStatus: "insufficient_data",
  decisionEligible: false,
  sources: [
    {
      id: "hp1-source-common-sense-media",
      publisher: "Common Sense Media",
      sourceType: "published_review",
      sourceUrl: "https://www.commonsensemedia.org/movie-reviews/harry-potter-and-the-sorcerers-stone",
      accessedOn: "2026-08-13",
      independenceGroupId: "common-sense-media",
      supportedClaimIds: ["hp1-claim-fear", "hp1-claim-violence", "hp1-claim-grief"],
    },
    {
      id: "hp1-source-plugged-in",
      publisher: "Plugged In",
      sourceType: "published_review",
      sourceUrl: "https://www.pluggedin.com/movie-reviews/harrypotterandthesorcerersstone/",
      accessedOn: "2026-08-13",
      independenceGroupId: "plugged-in",
      supportedClaimIds: ["hp1-claim-fear", "hp1-claim-violence", "hp1-claim-grief"],
    },
    {
      id: "hp1-source-bbfc",
      publisher: "BBFC",
      sourceType: "official_classification",
      sourceUrl: "https://www.bbfc.co.uk/release/harry-potter-and-the-philosophers-stone-q29sbgvjdglvbjpwwc0zmzm2odi",
      accessedOn: "2026-08-13",
      independenceGroupId: "bbfc",
      supportedClaimIds: [
        "hp1-claim-fear",
        "hp1-claim-violence",
        "hp1-claim-language",
        "hp1-claim-grief",
      ],
    },
    {
      id: "hp1-source-kids-in-mind",
      publisher: "Kids-In-Mind",
      sourceType: "published_review",
      sourceUrl: "https://kids-in-mind.com/h/harry_potter_and_the_sorcerers_stone_2001.htm",
      accessedOn: "2026-08-13",
      independenceGroupId: "kids-in-mind",
      supportedClaimIds: [
        "hp1-claim-fear",
        "hp1-claim-violence",
        "hp1-claim-language",
        "hp1-claim-grief",
      ],
    },
    {
      id: "hp1-source-dove",
      publisher: "Dove.org",
      sourceType: "published_review",
      sourceUrl: "https://dove.org/review/3564-harry-potter-and-the-sorcerers-stone/",
      accessedOn: "2026-08-13",
      independenceGroupId: "dove",
      supportedClaimIds: [
        "hp1-claim-fear",
        "hp1-claim-violence",
        "hp1-claim-language",
        "hp1-claim-grief",
      ],
    },
  ],
  claims: [
    {
      id: "hp1-claim-fear",
      category: "fear",
      summaryAr:
        "توجد مطاردات ومخلوقات مخيفة ومواقف خطر داخل المدرسة والغابة، إضافة إلى مواجهة نهائية ذات صور خيالية قد تكون قوية على الأطفال الأصغر.",
      verification: "corroborated",
      sourceIds: [
        "hp1-source-common-sense-media",
        "hp1-source-plugged-in",
        "hp1-source-bbfc",
        "hp1-source-kids-in-mind",
        "hp1-source-dove",
      ],
    },
    {
      id: "hp1-claim-violence",
      category: "violence",
      summaryAr:
        "يتضمن الفيلم قتالًا فانتازيًا مع مخلوقات، ومباراة شطرنج بالحجم الطبيعي تتكسر فيها القطع، ومواجهة ينتهي فيها جسد خصم بالتفتت بصورة غير واقعية.",
      verification: "corroborated",
      sourceIds: [
        "hp1-source-common-sense-media",
        "hp1-source-plugged-in",
        "hp1-source-bbfc",
        "hp1-source-kids-in-mind",
        "hp1-source-dove",
      ],
    },
    {
      id: "hp1-claim-language",
      category: "language",
      summaryAr:
        "تسجل عدة جهات ألفاظًا خفيفة متفرقة، مع اختلاف واضح بين المصادر في ما إذا كانت هذه الألفاظ تستحق تصنيف المحور أصلًا؛ لذلك نثبت الوجود فقط ولا نستنتج درجة ملاءمة.",
      verification: "corroborated",
      sourceIds: ["hp1-source-bbfc", "hp1-source-kids-in-mind", "hp1-source-dove"],
    },
    {
      id: "hp1-claim-grief",
      category: "grief",
      summaryAr:
        "موت والدي Harry جزء أساسي من خلفية القصة، وتوجد إشارات متكررة إلى مقتلهما وإلى تضحية الأم، وهو محتوى عاطفي حاضر عبر أكثر من مصدر.",
      verification: "corroborated",
      sourceIds: [
        "hp1-source-common-sense-media",
        "hp1-source-plugged-in",
        "hp1-source-bbfc",
        "hp1-source-kids-in-mind",
        "hp1-source-dove",
      ],
    },
  ],
  uncertainCategories: [
    "bullying",
    "sexualContent",
    "substances",
    "discrimination",
    "selfHarm",
    "flashingLights",
  ],
};

const MINIONS_2015_EDITORIAL_REVIEW: EditorialReviewPublication = {
  id: "minions-2015-editorial-batch-v1",
  titleId: "wd:Q13619743",
  titleLabel: "المينيون",
  releaseYear: 2015,
  kind: "movie",
  policyVersion: "2026-08-13.1",
  publishedAt: "2026-08-13T15:11:00+03:00",
  scopeAr:
    "هذا تحليل تحريري على مستوى فيلم Minions (2015)، مبني على وقائع متقاطعة بين مراجعات مستقلة وتصنيف رسمي. لا نعامل نبرة الكوميديا كدليل على الأمان، ولا نفترض غياب محور لمجرد أن جهة لم تسجله، ولا نصدر حكم ملاءمة من هذه الصفحة.",
  analysisAr:
    "تتقاطع المصادر على كثرة العنف الكرتوني والحوادث والانفجارات والتهديدات التي تقدم غالبًا في إطار ساخر، وعلى ألفاظ خفيفة وإهانات متفرقة، ومشاهد مزاح بصري تتضمن ملابس داخلية أو أردافًا كرتونية. ثلاث جهات مستقلة تسجل أيضًا ظهور مشروبات كحولية، رغم اختلاف جهة أخرى في تصنيف هذا المحور؛ لذلك نعرض واقعة الظهور ولا نحولها إلى استنتاج شامل. المحاور غير المثبتة بما يكفي تظل غير محسومة، والقرار النهائي يبقى `insufficient_data`.",
  decisionStatus: "insufficient_data",
  decisionEligible: false,
  sources: [
    {
      id: "minions-source-common-sense-media",
      publisher: "Common Sense Media",
      sourceType: "published_review",
      sourceUrl: "https://www.commonsensemedia.org/movie-reviews/minions",
      accessedOn: "2026-08-13",
      independenceGroupId: "common-sense-media",
      supportedClaimIds: [
        "minions-claim-violence",
        "minions-claim-fear",
        "minions-claim-language",
        "minions-claim-sexual-content",
      ],
    },
    {
      id: "minions-source-plugged-in",
      publisher: "Plugged In",
      sourceType: "published_review",
      sourceUrl: "https://www.pluggedin.com/movie-reviews/minions/",
      accessedOn: "2026-08-13",
      independenceGroupId: "plugged-in",
      supportedClaimIds: [
        "minions-claim-violence",
        "minions-claim-fear",
        "minions-claim-language",
        "minions-claim-substances",
      ],
    },
    {
      id: "minions-source-bbfc",
      publisher: "BBFC",
      sourceType: "official_classification",
      sourceUrl: "https://www.bbfc.co.uk/release/minions-q29sbgvjdglvbjpwwc00nzm5ody",
      accessedOn: "2026-08-13",
      independenceGroupId: "bbfc",
      supportedClaimIds: ["minions-claim-violence"],
    },
    {
      id: "minions-source-kids-in-mind",
      publisher: "Kids-In-Mind",
      sourceType: "published_review",
      sourceUrl: "https://kids-in-mind.com/m/minions.htm",
      accessedOn: "2026-08-13",
      independenceGroupId: "kids-in-mind",
      supportedClaimIds: [
        "minions-claim-violence",
        "minions-claim-fear",
        "minions-claim-language",
        "minions-claim-substances",
        "minions-claim-sexual-content",
      ],
    },
    {
      id: "minions-source-dove",
      publisher: "Dove.org",
      sourceType: "published_review",
      sourceUrl: "https://dove.org/review/11407-minions/",
      accessedOn: "2026-08-13",
      independenceGroupId: "dove",
      supportedClaimIds: [
        "minions-claim-violence",
        "minions-claim-fear",
        "minions-claim-language",
        "minions-claim-substances",
        "minions-claim-sexual-content",
      ],
    },
  ],
  claims: [
    {
      id: "minions-claim-violence",
      category: "violence",
      summaryAr:
        "الفيلم مليء بعنف كرتوني وحوادث وانفجارات وضرب وسقوط وتهديدات، وتظهر أدوات تعذيب في سياق هزلي لا يسبب عادة إصابات واقعية للشخصيات الرئيسية.",
      verification: "corroborated",
      sourceIds: [
        "minions-source-common-sense-media",
        "minions-source-plugged-in",
        "minions-source-bbfc",
        "minions-source-kids-in-mind",
        "minions-source-dove",
      ],
    },
    {
      id: "minions-claim-fear",
      category: "fear",
      summaryAr:
        "توجد مواقف تهديد وربط ومحاولات تعذيب ومخاطر قريبة من الموت، لكنها تقدم غالبًا بنبرة كوميدية؛ عدة مصادر تسجل هذه الوقائع رغم اختلافها في تقدير شدتها.",
      verification: "corroborated",
      sourceIds: [
        "minions-source-common-sense-media",
        "minions-source-plugged-in",
        "minions-source-kids-in-mind",
        "minions-source-dove",
      ],
    },
    {
      id: "minions-claim-language",
      category: "language",
      summaryAr:
        "توجد إهانات وألفاظ خفيفة متفرقة من الشخصيات البشرية، بينما كلام المينيون نفسه في معظمه لغة مختلقة؛ أكثر من مصدر يسجل حضور هذا النوع من التعبير.",
      verification: "corroborated",
      sourceIds: [
        "minions-source-common-sense-media",
        "minions-source-plugged-in",
        "minions-source-kids-in-mind",
        "minions-source-dove",
      ],
    },
    {
      id: "minions-claim-substances",
      category: "substances",
      summaryAr:
        "تسجل ثلاثة مصادر مستقلة ظهور مشروب يشبه المارتيني ومشاهد شرب بيرة في حانة، بما في ذلك شرب الملكة؛ نثبت هذه اللقطات فقط مع بقاء اختلاف التصنيف بين الجهات ظاهرًا في التحليل.",
      verification: "corroborated",
      sourceIds: [
        "minions-source-plugged-in",
        "minions-source-kids-in-mind",
        "minions-source-dove",
      ],
    },
    {
      id: "minions-claim-sexual-content",
      category: "sexualContent",
      summaryAr:
        "توجد نكات بصرية خفيفة حول الملابس الداخلية والأرداف والعري الكرتوني غير المفصل، مع بعض الغزل والإيحاءات البسيطة المستخدمة للكوميديا.",
      verification: "corroborated",
      sourceIds: [
        "minions-source-common-sense-media",
        "minions-source-kids-in-mind",
        "minions-source-dove",
      ],
    },
  ],
  uncertainCategories: [
    "bullying",
    "discrimination",
    "selfHarm",
    "grief",
    "flashingLights",
  ],
};

const EDITORIAL_REVIEW_PUBLICATIONS = [
  CARS_2006_EDITORIAL_REVIEW,
  ET_1982_EDITORIAL_REVIEW,
  HARRY_POTTER_2001_EDITORIAL_REVIEW,
  MINIONS_2015_EDITORIAL_REVIEW,
] as const;

export function getEditorialReviewPublicationById(
  editorialId: string,
): EditorialReviewPublication | null {
  const normalized = parseEditorialReviewId(editorialId);
  const publication = EDITORIAL_REVIEW_PUBLICATIONS.find((item) => item.id === normalized) ?? null;
  if (!publication) return null;
  return getValidatedPublication(publication);
}

export function getEditorialReviewPublicationForTitleId(
  titleId: string,
): EditorialReviewPublication | null {
  const publication = EDITORIAL_REVIEW_PUBLICATIONS.find((item) => item.titleId === titleId) ?? null;
  if (!publication) return null;
  return getValidatedPublication(publication);
}

export function listEditorialReviewPublications(): EditorialReviewPublication[] {
  return EDITORIAL_REVIEW_PUBLICATIONS.map((publication) => {
    const validated = getValidatedPublication(publication);
    if (!validated) throw new TypeError(`Invalid editorial review publication: ${publication.id}`);
    return validated;
  });
}

function getValidatedPublication(
  publication: EditorialReviewPublication,
): EditorialReviewPublication | null {
  const assessment = assessEditorialReviewPublication(publication);
  if (!assessment.publishable || assessment.decisionEligible !== false) return null;
  return {
    ...publication,
    sources: publication.sources.map((source) => ({
      ...source,
      supportedClaimIds: [...source.supportedClaimIds],
    })),
    claims: publication.claims.map((claim) => ({ ...claim, sourceIds: [...claim.sourceIds] })),
    uncertainCategories: [...publication.uncertainCategories],
  };
}
