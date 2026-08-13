"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import styles from "./title-search-combobox.module.css";

type Suggestion = { id: string; arabicName: string; englishName: string; releaseYear: number; href: string };
type Payload = { mode?: "empty" | "matches" | "did_you_mean" | "none"; suggestions?: Suggestion[]; error?: string };

export default function TitleSearchCombobox({ initialQuery = "", hiddenFields = {} }: { initialQuery?: string; hiddenFields?: Record<string, string> }) {
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [mode, setMode] = useState<Payload["mode"]>("empty");
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const listId = useId();
  const statusId = useId();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) { abortRef.current?.abort(); setItems([]); setOpen(false); setActive(-1); setMode("empty"); return; }
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController(); abortRef.current = controller;
      try {
        const response = await fetch(`/api/search-suggestions?q=${encodeURIComponent(value)}`, { signal: controller.signal, headers: { accept: "application/json" } });
        const payload = (await response.json()) as Payload;
        if (!response.ok) throw new Error(payload.error ?? "search_failed");
        const next = Array.isArray(payload.suggestions) ? payload.suggestions : [];
        setItems(next); setMode(payload.mode ?? (next.length ? "matches" : "none")); setOpen(next.length > 0); setActive(-1);
        setStatus(next.length ? `${next.length} اقتراحات حقيقية متاحة.` : "لا توجد اقتراحات قريبة موثوقة.");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setItems([]); setOpen(false); setActive(-1); setStatus("تعذّر تحميل الاقتراحات الآن.");
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setOpen(false); setActive(-1); return; }
    if (!items.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive((index) => (index + 1) % items.length); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive((index) => index <= 0 ? items.length - 1 : index - 1); return; }
    if (event.key === "Enter" && open && active >= 0) { event.preventDefault(); window.location.assign(items[active].href); }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (query.trim().length >= 2) return;
    event.preventDefault(); setStatus("اكتب حرفين على الأقل للبحث.");
  }

  return <form className={styles.form} action="/search" method="get" role="search" onSubmit={onSubmit}>
    {Object.entries(hiddenFields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
    <div className={styles.wrap}>
      <input className={styles.input} name="q" type="search" value={query} maxLength={80} autoComplete="off" spellCheck={false}
        placeholder="اكتب اسم الفيلم بالعربي أو الإنجليزي" role="combobox" aria-autocomplete="list" aria-expanded={open}
        aria-controls={listId} aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined} aria-describedby={statusId}
        onChange={(event) => setQuery(event.target.value)} onFocus={() => items.length > 0 && setOpen(true)} onKeyDown={onKeyDown} />
      {open && items.length > 0 ? <div className={styles.popup}>
        <div className={styles.heading}>{mode === "did_you_mean" ? "هل تقصد؟" : "اقتراحات من العناوين الموجودة"}</div>
        <div id={listId} className={styles.list} role="listbox">
          {items.map((item, index) => <a key={item.id} id={`${listId}-${index}`} href={item.href} role="option" aria-selected={index === active}
            className={`${styles.option}${index === active ? ` ${styles.active}` : ""}`} onMouseEnter={() => setActive(index)} onMouseDown={(event) => event.preventDefault()}>
            <strong>{item.arabicName}</strong><span dir="ltr">{item.englishName}</span><small>({item.releaseYear})</small>
          </a>)}
        </div>
        <div className={styles.hint}>↑ ↓ للتنقل · Enter للفتح · Esc للإغلاق</div>
      </div> : null}
    </div>
    <button className={styles.submit} type="submit">ابحث</button>
    <span id={statusId} className={styles.srOnly} aria-live="polite">{status}</span>
  </form>;
}
