"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

import TitleSearchCombobox from "./search/title-search-combobox";

export function HomeSearchUpgrade() {
  const pathname = usePathname();
  const [target, setTarget] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const scheduleTarget = (value: HTMLDivElement | null) => {
      window.setTimeout(() => setTarget(value), 0);
    };
    if (pathname !== "/") {
      scheduleTarget(null);
      return;
    }

    const panel = document.querySelector<HTMLElement>(".search-panel");
    if (!panel) return;

    const mount = document.createElement("div");
    mount.className = "home-search-upgrade";
    panel.classList.add("search-panel--b3");
    panel.appendChild(mount);
    scheduleTarget(mount);

    return () => {
      scheduleTarget(null);
      mount.remove();
      panel.classList.remove("search-panel--b3");
    };
  }, [pathname]);

  if (!target) return null;

  return createPortal(
    <div className="home-search-upgrade__inner">
      <TitleSearchCombobox />
      <p>الاقتراحات تأتي من D1 فقط. لو المطابقة تقريبية هنقول «هل تقصد؟» بدل ما نعتبرها نتيجة مؤكدة.</p>
    </div>,
    target,
  );
}
