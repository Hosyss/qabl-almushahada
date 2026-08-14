"use client";

import { useRef, type KeyboardEvent } from "react";

export type EditorialSummaryDialogProps = {
  titleAr: string;
  titleEn: string;
  releaseYear: number;
  analysisAr: string;
  corroboratedFacts: string[];
  uncertainLabels: string[];
  sources: Array<{ publisher: string; sourceUrl: string; rightsLabel: string }>;
  fingerprint: string;
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function EditorialSummaryDialog(props: EditorialSummaryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  function openDialog() {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function keepFocusInsideDialog(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (element) => element.tabIndex >= 0 && element.getAttribute("aria-hidden") !== "true",
    );
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !dialog.contains(active)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (active === last || !dialog.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button ref={openerRef} type="button" className="editorial-summary-open" onClick={openDialog} aria-haspopup="dialog">
        اقرأ التحليل كاملًا <span aria-hidden="true">←</span>
      </button>
      <dialog
        ref={dialogRef}
        className="editorial-summary-dialog"
        aria-labelledby="editorial-summary-dialog-title"
        aria-describedby="editorial-summary-dialog-description"
        onKeyDown={keepFocusInsideDialog}
        onClose={() => openerRef.current?.focus()}
      >
        <div className="editorial-summary-watermark" aria-hidden="true">© قبل المشاهدة</div>
        <header className="editorial-summary-dialog__head">
          <div>
            <small>التحليل التحريري الأصلي</small>
            <h2 id="editorial-summary-dialog-title">{props.titleAr}</h2>
            <p dir="ltr">{props.titleEn} ({props.releaseYear})</p>
          </div>
          <button type="button" className="editorial-summary-close" onClick={closeDialog} aria-label="إغلاق التحليل">×</button>
        </header>
        <div className="editorial-summary-dialog__body" id="editorial-summary-dialog-description">
          <section><h3>الخلاصة</h3><p>{props.analysisAr}</p></section>
          <section>
            <h3>ما اتفق عليه أكثر من مصدر</h3>
            {props.corroboratedFacts.length > 0 ? <ul>{props.corroboratedFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul> : <p>لا توجد واقعة وصلت حاليًا إلى اتفاق مصدرين مستقلين.</p>}
          </section>
          <section><h3>ما يزال غير محسوم</h3><p>{props.uncertainLabels.join("، ")}.</p></section>
          <section><h3>لماذا لا نصدر حكمًا نهائيًا؟</h3><p>المعلومات غير كافية لإصدار حكم نهائي. وجود وقائع موثقة لا يعني أن المحاور العشرة اكتملت، وما لم يثبت يظل غير محسوم ولا يتحول صمت المصدر إلى «غير موجود».</p></section>
          <section><h3>المصادر والعزو</h3><ul className="editorial-summary-sources">{props.sources.map((source) => <li key={source.sourceUrl}><a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.publisher}</a><span>{source.rightsLabel}</span></li>)}</ul></section>
          <section className="editorial-summary-proof"><strong>© قبل المشاهدة — تحليل تحريري أصلي</strong><code dir="ltr">{props.fingerprint}</code></section>
        </div>
        <footer className="editorial-summary-dialog__footer"><button type="button" onClick={closeDialog}>إغلاق</button></footer>
      </dialog>
    </>
  );
}
