"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  VERDICT_LABELS_AR,
  createExampleFamilyProfile,
  createVerifiedDemoBundle,
  decideForFamily,
  type Severity,
} from "@/lib/review-engine";
import {
  LOCAL_FAMILY_SETTINGS_STORAGE_KEY,
  parseLocalFamilySettings,
  serializeLocalFamilySettings,
  type LocalFamilySettings,
} from "@/lib/local-family-settings";

type SearchSuggestion = {
  id: string;
  canonicalName: string;
  originalName: string | null;
  kind: "movie" | "series" | "episode" | "special";
  releaseYear: number;
};

function LeafMark() {
  return (
    <span className="leaf-mark" aria-hidden="true">
      <span className="leaf-mark__branch" />
      <span className="leaf-mark__leaf leaf-mark__leaf--one" />
      <span className="leaf-mark__leaf leaf-mark__leaf--two" />
      <span className="leaf-mark__dot" />
    </span>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.4" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 5.5 5.7v5.8c0 4.2 2.8 7.6 6.5 9.5 3.7-1.9 6.5-5.3 6.5-9.5V5.7L12 3Z" />
      <path d="m9 12 2 2 4.2-4.2" />
    </svg>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [suggestionsState, setSuggestionsState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [selectedTitle, setSelectedTitle] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [childAge, setChildAge] = useState(9);
  const [fearLimit, setFearLimit] = useState<Severity>(2);
  const [avoidBullying, setAvoidBullying] = useState(true);
  const [familyStorageStatus, setFamilyStorageStatus] = useState<"pending" | "saved" | "unavailable">("pending");

  const demoTitles = [
    {
      title: "رحلة ألوان",
      type: "فيلم عائلي",
      year: "2026",
      age: "+7",
      verdict: "مناسب",
      note: "لحظات حزن خفيفة وموضوعات عائلية دافئة.",
      tone: "mint",
      symbol: "◒",
    },
    {
      title: "أسرار المدرسة",
      type: "مسلسل غموض",
      year: "2025",
      age: "+12",
      verdict: "بمرافقة",
      note: "توتر متكرر وتنمّر لفظي في بعض الحلقات.",
      tone: "night",
      symbol: "✦",
    },
    {
      title: "مدينة الغيم",
      type: "مغامرة رسوم",
      year: "2024",
      age: "+9",
      verdict: "بمرافقة",
      note: "مطاردات خيالية ومشهد فقد قصير غير صريح.",
      tone: "sky",
      symbol: "☁",
    },
  ];

  const activeTitle = demoTitles[selectedTitle];
  const demoReviewBundle = useMemo(() => createVerifiedDemoBundle(), []);
  const liveDecision = useMemo(
    () =>
      decideForFamily(
        demoReviewBundle,
        createExampleFamilyProfile({ childAge, fearLimit, avoidBullying }),
      ),
    [avoidBullying, childAge, demoReviewBundle, fearLimit],
  );
  const liveVerdict = VERDICT_LABELS_AR[liveDecision.verdict];
  const liveDecisionStops =
    liveDecision.verdict === "not_suitable" || liveDecision.verdict === "insufficient_data";
  const liveReason = liveDecision.reasons[0]?.messageAr ?? liveDecision.summaryAr;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = parseLocalFamilySettings(
          window.localStorage.getItem(LOCAL_FAMILY_SETTINGS_STORAGE_KEY),
        );
        if (stored) {
          setChildAge(stored.childAge);
          setFearLimit(stored.fearLimit);
          setAvoidBullying(stored.avoidBullying);
          setFamilyStorageStatus("saved");
        }
      } catch {
        setFamilyStorageStatus("unavailable");
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSuggestionsState("loading");
      try {
        const response = await fetch(`/api/search-suggestions?q=${encodeURIComponent(cleanQuery)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("suggestions unavailable");
        const payload = (await response.json()) as { suggestions?: SearchSuggestion[] };
        if (!Array.isArray(payload.suggestions)) throw new Error("invalid suggestions payload");
        setSearchSuggestions(payload.suggestions);
        setSuggestionsState("ready");
      } catch {
        if (controller.signal.aborted) return;
        setSearchSuggestions([]);
        setSuggestionsState("unavailable");
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function persistFamilySettings(settings: LocalFamilySettings) {
    try {
      window.localStorage.setItem(
        LOCAL_FAMILY_SETTINGS_STORAGE_KEY,
        serializeLocalFamilySettings(settings),
      );
      setFamilyStorageStatus("saved");
    } catch {
      setFamilyStorageStatus("unavailable");
    }
  }

  function changeChildAge(delta: number) {
    const nextAge = Math.min(17, Math.max(3, childAge + delta));
    if (nextAge === childAge) return;
    setChildAge(nextAge);
    persistFamilySettings({ childAge: nextAge, fearLimit, avoidBullying });
  }

  function changeFearLimit(nextFearLimit: Severity) {
    setFearLimit(nextFearLimit);
    persistFamilySettings({ childAge, fearLimit: nextFearLimit, avoidBullying });
  }

  function changeAvoidBullying(nextAvoidBullying: boolean) {
    setAvoidBullying(nextAvoidBullying);
    persistFamilySettings({ childAge, fearLimit, avoidBullying: nextAvoidBullying });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setSearchMessage("اكتب اسم فيلم أو مسلسل علشان نبحث عنه.");
      return;
    }
    window.location.assign(`/search?q=${encodeURIComponent(cleanQuery)}`);
  }

  function chooseSuggestion(value: string) {
    setQuery(value);
    setSearchMessage(`جاهز للبحث عن «${value}».`);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="قبل المشاهدة — الرئيسية">
          <LeafMark />
          <span className="brand__text">
            <strong>قبل المشاهدة</strong>
            <small>قرار أهدى لكل بيت</small>
          </span>
        </a>

        <nav className="main-nav" aria-label="التنقل الرئيسي">
          <a href="#discover">اكتشف</a>
          <a href="#method">كيف نراجع؟</a>
          <a href="#story">قصتنا</a>
        </nav>

        <a className="family-button" href="#family-profile">
          <span className="family-button__icon" aria-hidden="true">⌁</span>
          حدود أسرتي
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero__ambient hero__ambient--one" aria-hidden="true" />
        <div className="hero__ambient hero__ambient--two" aria-hidden="true" />

        <div className="hero__content">
          <div className="eyebrow">
            <span className="eyebrow__dot" />
            دليل عربي يُراجع قبل ما يحكم
          </div>

          <h1>
            خلّي لحظة المشاهدة
            <span> أهدى وأوضح.</span>
          </h1>

          <p className="hero__lead">
            اعرف محتوى الفيلم أو المسلسل، وحدد اللي يناسب أسرتك، وخد قرارك
            من وقائع واضحة — من غير حرق ولا تخمين.
          </p>

          <div className="search-panel">
            <form className="hero-search" onSubmit={submitSearch}>
              <button type="submit" aria-label="ابحث عن العنوان">ابحث</button>
              <div className="hero-search__field">
                <SearchIcon />
                <label className="sr-only" htmlFor="title-search">
                  ابحث باسم فيلم أو مسلسل
                </label>
                <input
                  id="title-search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSearchMessage("");
                  }}
                  placeholder="اكتب اسم فيلم أو مسلسل"
                  autoComplete="off"
                />
              </div>
            </form>

            {query.trim().length >= 2 ? (
              <div className="suggestions" aria-label="اقتراحات من الدليل الحقيقي">
                <span>
                  {suggestionsState === "loading"
                    ? "بنبحث في الدليل…"
                    : suggestionsState === "unavailable"
                      ? "الاقتراحات غير متاحة الآن"
                      : searchSuggestions.length > 0
                        ? "من الدليل:"
                        : "لا توجد اقتراحات مطابقة"}
                </span>
                {searchSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => chooseSuggestion(suggestion.canonicalName)}
                    title={`${suggestion.releaseYear} · ${suggestion.kind === "movie" ? "فيلم" : suggestion.kind === "series" ? "مسلسل" : "عنوان"}`}
                  >
                    {suggestion.canonicalName}
                  </button>
                ))}
              </div>
            ) : (
              <div className="suggestions" aria-label="طريقة عمل اقتراحات البحث">
                <span>الاقتراحات تظهر من العناوين الموجودة فعلًا في الدليل بعد كتابة حرفين.</span>
              </div>
            )}

            <p className={`search-message${searchMessage ? " is-visible" : ""}`} aria-live="polite">
              {searchMessage || " "}
            </p>
          </div>

          <div className="trust-strip" aria-label="مبادئ الثقة">
            <div>
              <ShieldCheckIcon />
              <span><strong>وقائع موثقة</strong><small>للنسخة المحددة</small></span>
            </div>
            <div>
              <span className="trust-strip__icon" aria-hidden="true">◎</span>
              <span><strong>سبب واضح</strong><small>وراء كل نتيجة</small></span>
            </div>
            <div>
              <span className="trust-strip__icon" aria-hidden="true">◌</span>
              <span><strong>لا نعرف؟ نقول</strong><small>ولا نخمّن أبدًا</small></span>
            </div>
          </div>
        </div>

        <div className="hero__visual" aria-label="تصور لمساحة مشاهدة عائلية هادئة">
          <div className="sun-orb" aria-hidden="true" />
          {/* The transparent hero asset is already resized and compressed for this static prototype. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="hero__grove"
            src="/hero-grove.webp"
            alt="عائلة تجلس مطمئنة وسط أشجار الزيتون تحت ظلال تحيط بها"
          />

          <div className="result-card">
            <div className="result-card__head">
              <span className="result-card__label">نتيجة أسرتك</span>
              <span className="verified-pill">موثّق</span>
            </div>
            <strong className="result-card__title">مناسب بمرافقة</strong>
            <p>لأن مشاهد الخوف وصلت لحدّ أسرتك.</p>
            <div className="result-card__meter">
              <span style={{ width: "68%" }} />
            </div>
            <div className="result-card__foot">
              <span>العمر الإرشادي · بدون حرق</span>
              <strong>+9</strong>
            </div>
          </div>

          <div className="visual-badges">
            <div className="floating-card floating-card--top">
              <span className="floating-card__check">✓</span>
              <span><strong>تمت مراجعة النسخة</strong><small>العربية • 2026</small></span>
            </div>
          </div>
        </div>
      </section>

      <section className="first-peek" aria-label="لمحة عن التجربة">
        <p>من الواقعة لقرار بيتك</p>
        <h2>نجمع وقائع موثقة لنسخة محددة، نتحقق منها، ثم نطبّق حدود أسرتك.</h2>
        <div className="peek-line" aria-hidden="true"><span /></div>
      </section>

      <section className="discover-section" id="discover">
        <div className="section-heading section-heading--row">
          <div>
            <span className="section-kicker">لمحة من الدليل</span>
            <h2>معلومة سريعة، من غير ما تخبّي التفاصيل المهمة.</h2>
          </div>
          <p>دي بيانات توضيحية للتصميم، وليست مراجعات منشورة.</p>
        </div>

        <div className="discover-grid">
          <div className="demo-titles" aria-label="أمثلة عناوين">
            {demoTitles.map((item, index) => (
              <button
                className={`demo-title${selectedTitle === index ? " is-active" : ""}`}
                key={item.title}
                onClick={() => {
                  setSelectedTitle(index);
                  setDetailOpen(false);
                }}
                type="button"
              >
                <span className={`demo-cover demo-cover--${item.tone}`} aria-hidden="true">
                  <i>{item.symbol}</i>
                  <small>{item.year}</small>
                </span>
                <span className="demo-title__copy">
                  <small>{item.type}</small>
                  <strong>{item.title}</strong>
                  <span>{item.verdict}</span>
                </span>
                <b>{item.age}</b>
              </button>
            ))}
          </div>

          <article className="title-detail" aria-live="polite">
            <div className="title-detail__top">
              <span className={`demo-cover demo-cover--${activeTitle.tone}`} aria-hidden="true">
                <i>{activeTitle.symbol}</i>
                <small>{activeTitle.year}</small>
              </span>
              <div>
                <span className="title-detail__status"><i /> مراجعة توضيحية</span>
                <h3>{activeTitle.title}</h3>
                <p>{activeTitle.type} · {activeTitle.year}</p>
              </div>
              <strong className="age-stamp">{activeTitle.age}</strong>
            </div>

            <div className="title-detail__verdict">
              <span>النتيجة العامة</span>
              <strong>{activeTitle.verdict}</strong>
              <p>{activeTitle.note}</p>
            </div>

            <div className="axis-list">
              <div><span>الخوف والتوتر</span><i><b style={{ width: "48%" }} /></i><em>متوسط</em></div>
              <div><span>العنف والإصابة</span><i><b style={{ width: "24%" }} /></i><em>خفيف</em></div>
              <div><span>الألفاظ والتنمر</span><i><b style={{ width: "35%" }} /></i><em>خفيف</em></div>
            </div>

            <div className="title-detail__actions">
              <button className="detail-button" type="button" aria-expanded={detailOpen} onClick={() => setDetailOpen((open) => !open)}>
                {detailOpen ? "اخفِ اللمحة" : "اعرف ليه"} <span>{detailOpen ? "↑" : "←"}</span>
              </button>
              <Link className="full-review-link" href="/review">افتح المراجعة الكاملة <span aria-hidden="true">↗</span></Link>
            </div>
            {detailOpen && (
              <div className="detail-note">
                <span>من غير حرق</span>
                <p>توجد مطاردة خيالية قصيرة ولحظة فقد عاطفية؛ لا تظهر إصابة صريحة. هذا مثال لطريقة عرض الواقعة، وليس تقييمًا لعمل حقيقي.</p>
              </div>
            )}
          </article>
        </div>
      </section>

      <section className="method-section" id="method">
        <div className="method-intro">
          <span className="section-kicker">الثقة مش جملة تسويقية</span>
          <h2>كل نتيجة ماشية في طريق واضح.</h2>
          <p>الإنچين ما بيخمنش الفيلم. إحنا بنفصل الوقائع الموثقة عن رأي العمر، وبعدها نطبّق حدود البيت.</p>
        </div>

        <div className="method-steps">
          <article>
            <span className="method-number">01</span>
            <div className="method-icon">◫</div>
            <h3>نوثّق نسخة محددة</h3>
            <p>النسخة واللغة والسياق ظاهرين قدر ما تسمح الأدلة؛ والمشاهدة البشرية لا نذكرها إلا لو حدثت فعلًا.</p>
            <small>الواقعة أولًا</small>
          </article>
          <article>
            <span className="method-number">02</span>
            <div className="method-icon">⌁</div>
            <h3>نسجّل وقائع منظمة</h3>
            <p>شدة وتكرار وسياق ووقت تقريبي عندما يكون متاحًا، بدل جملة عامة من ذوق شخص واحد.</p>
            <small>قابل للتدقيق</small>
          </article>
          <article>
            <span className="method-number">03</span>
            <div className="method-icon">◎</div>
            <h3>نطبّق حدود أسرتك</h3>
            <p>نفس العمل قد يناسب بيتًا ولا يناسب آخر، والسبب يظل ظاهرًا ومفهومًا.</p>
            <small>قرارك أنت</small>
          </article>
        </div>

        <div className="method-promise">
          <ShieldCheckIcon />
          <p><strong>قاعدة الأمان:</strong> لو معلومة أساسية ناقصة أو متعارضة، النتيجة تكون «البيانات غير كافية» — مش «مناسب».</p>
          <a href="#story">اعرف التزامنا بالتصحيح</a>
        </div>
      </section>

      <section className="family-profile" id="family-profile">
        <div className="family-profile__copy">
          <span className="section-kicker section-kicker--light">جرّب الفرق بنفسك</span>
          <h2>مش كل بيت له نفس الحدود.</h2>
          <p>عدّل المثال وشوف إزاي النتيجة تتغير، من غير ما نغيّر الوقائع الأصلية للعمل.</p>

          <div className="family-points">
            <span>
              <i>✓</i>{" "}
              {familyStorageStatus === "unavailable"
                ? "تعذر الحفظ المحلي في المتصفح؛ الإعدادات ستظل لهذه الجلسة فقط"
                : familyStorageStatus === "saved"
                  ? "الإعدادات محفوظة على جهازك فقط"
                  : "الإعدادات تُحفظ محليًا على جهازك فقط"}
            </span>
            <span><i>✓</i> لا نطلب اسم الطفل أو تاريخ ميلاده</span>
            <span><i>✓</i> تقدر تعرف السبب وراء كل حكم</span>
          </div>
        </div>

        <div className="profile-lab">
          <div className="profile-lab__head">
            <div><span>نموذج أسرة</span><strong>حدود المشاهدة</strong></div>
            <span className="local-pill">
              {familyStorageStatus === "unavailable"
                ? "الحفظ غير متاح"
                : familyStorageStatus === "saved"
                  ? "محفوظ على الجهاز"
                  : "محلي على الجهاز"}
            </span>
          </div>

          <div className="age-control">
            <span>عمر الطفل</span>
            <div>
              <button type="button" aria-label="تقليل العمر" onClick={() => changeChildAge(-1)}>−</button>
              <strong>{childAge}<small> سنة</small></strong>
              <button type="button" aria-label="زيادة العمر" onClick={() => changeChildAge(1)}>+</button>
            </div>
          </div>

          <label className="range-control">
            <span><b>أقصى خوف مقبول</b><em>{['ممنوع', 'خفيف', 'متوسط', 'قوي'][fearLimit]}</em></span>
            <input
              type="range"
              min="0"
              max="3"
              value={fearLimit}
              onChange={(event) => changeFearLimit(Number(event.target.value) as Severity)}
            />
            <i><span>ممنوع</span><span>خفيف</span><span>متوسط</span><span>قوي</span></i>
          </label>

          <label className="toggle-control">
            <span><b>التنمر اللفظي</b><small>عنصر ممنوع تمامًا</small></span>
            <input type="checkbox" checked={avoidBullying} onChange={(event) => changeAvoidBullying(event.target.checked)} />
            <i aria-hidden="true"><b /></i>
          </label>

          <div className={`live-result${liveDecisionStops ? " live-result--stop" : ""}`} aria-live="polite">
            <span>نتيجة «مدينة الغيم» لهذه الأسرة · ثقة {liveDecision.confidence === "high" ? "مرتفعة" : "غير متاحة"}</span>
            <strong>{liveVerdict}</strong>
            <p>{liveReason}</p>
          </div>
        </div>
      </section>

      <section className="founder-section" id="story">
        <div className="founder-card">
          <div className="founder-seal" aria-hidden="true"><span>ق</span><i>✦</i></div>
          <div className="founder-copy">
            <span className="section-kicker">من صاحب المشروع</span>
            <h2>الفكرة بدأت من سؤال بسيط: ليه الأسرة العربية لازم تحتار؟</h2>
            <blockquote>
              «أنا مش عايز منك تصدّق درجة غامضة أو اسم كبير. عايزك تشوف إيه اللي اتراجع، وإمتى، وليه ظهرت النتيجة — ولو غلطنا، تعرف تبلغنا ونصححه قدامك.»
            </blockquote>
            <div className="founder-signature">
              <span className="founder-avatar">ح</span>
              <span><strong>مؤسس «قبل المشاهدة»</strong><small>مصمم ويب عربي يبني المشروع بشفافية</small></span>
            </div>
          </div>
          <div className="founder-values">
            <div><strong>لا</strong><span>نبيع التقييم أو نغيّره لرعاية</span></div>
            <div><strong>100%</strong><span>من النتائج تذكر حالة التحقق</span></div>
            <div><strong>واضح</strong><span>سجل التصحيح وتاريخ المراجعة</span></div>
          </div>
        </div>
      </section>

      <section className="closing-cta">
        <span className="closing-cta__leaf" aria-hidden="true">✦</span>
        <p>قرار مشاهدة أهدى يبدأ بمعلومة أوضح.</p>
        <h2>قبل ما تشغّل الفيلم، شوفه بعين أسرتك.</h2>
        <a href="#top">ابحث عن عنوان <span>↑</span></a>
      </section>

      <footer className="site-footer">
        <a className="brand brand--footer" href="#top"><LeafMark /><span className="brand__text"><strong>قبل المشاهدة</strong><small>دليل عربي للقرار</small></span></a>
        <p>نموذج تصميم مبدئي — التقييمات الظاهرة أمثلة وليست أحكامًا منشورة.</p>
        <div><a href="#method">المنهج</a><a href="#story">الثقة والتصحيح</a><a href="#top">الرئيسية</a></div>
      </footer>
    </main>
  );
}
