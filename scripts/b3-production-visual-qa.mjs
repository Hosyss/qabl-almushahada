import { execFileSync, spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const BASE = (process.env.SITE_URL || "https://qabl-almushahada.buildtools.workers.dev").replace(/\/$/u, "");
const OUT = path.resolve("visual-qa");
await mkdir(OUT, { recursive: true });

const REVIEWS = [
  ["cars", "Q182153", "cars-2006-editorial-pilot-v1", "سيارات", "Cars", "2006"],
  ["et", "Q11621", "et-1982-editorial-batch-v1", "إي تي", "E.T. the Extra-Terrestrial", "1982"],
  ["harry", "Q102438", "harry-potter-philosophers-stone-2001-editorial-batch-v1", "هاري بوتر وحجر الفيلسوف", "Harry Potter and the Philosopher's Stone", "2001"],
  ["minions", "Q13619743", "minions-2015-editorial-batch-v1", "المينيون", "Minions", "2015"],
];

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(String(data));
      if (message.id) {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
        else entry.resolve(message.result ?? {});
        return;
      }
      const waiters = this.events.get(message.method) ?? [];
      this.events.set(message.method, []);
      for (const resolve of waiters) resolve(message.params ?? {});
    };
  }
  command(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  waitEvent(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs);
      const wrapped = (params) => { clearTimeout(timer); resolve(params); };
      const current = this.events.get(method) ?? [];
      current.push(wrapped);
      this.events.set(method, current);
    });
  }
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function assert(condition, message) { if (!condition) throw new Error(message); }

async function startBrowser(width, height, port) {
  const chrome = execFileSync("bash", ["-lc", "command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser"], { encoding: "utf8" }).trim();
  assert(chrome, "Chrome executable not found on runner");
  const profile = path.join(os.tmpdir(), `b3-chrome-${port}`);
  const child = spawn(chrome, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, "about:blank",
  ], { stdio: "ignore" });
  let targets;
  for (let i = 0; i < 60; i += 1) {
    try {
      targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      if (Array.isArray(targets) && targets[0]?.webSocketDebuggerUrl) break;
    } catch {}
    await sleep(150);
  }
  assert(targets?.[0]?.webSocketDebuggerUrl, "Could not attach to headless Chrome");
  const socket = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  const cdp = new Cdp(socket);
  await cdp.command("Page.enable");
  await cdp.command("Runtime.enable");
  await cdp.command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 500 });
  return { child, socket, cdp };
}

async function evaluate(cdp, expression) {
  const result = await cdp.command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(`Browser JS failed: ${JSON.stringify(result.exceptionDetails)}`);
  return result.result?.value;
}

async function navigate(cdp, url) {
  const loaded = cdp.waitEvent("Page.loadEventFired", 20000);
  await cdp.command("Page.navigate", { url });
  await loaded;
  await sleep(350);
  const overflow = await evaluate(cdp, "document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1");
  assert(overflow, `Horizontal overflow at ${url}`);
}

async function waitFor(cdp, expression, label, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await evaluate(cdp, expression)) return;
    await sleep(180);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function key(cdp, keyName, code, virtualKeyCode) {
  await cdp.command("Input.dispatchKeyEvent", { type: "keyDown", key: keyName, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode });
  await cdp.command("Input.dispatchKeyEvent", { type: "keyUp", key: keyName, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode });
}

async function screenshot(cdp, fileName) {
  const result = await cdp.command("Page.captureScreenshot", { format: "jpeg", quality: 38, captureBeyondViewport: false });
  const filePath = path.join(OUT, fileName);
  await writeFile(filePath, Buffer.from(result.data, "base64"));
  return filePath;
}

async function modeQa(mode, width, height, port) {
  const { child, socket, cdp } = await startBrowser(width, height, port);
  const checks = [];
  const images = [];
  try {
    await navigate(cdp, `${BASE}/`);
    const homeText = await evaluate(cdp, "document.body.innerText");
    assert(homeText.includes("تحليلات منشورة حديثًا"), "Homepage real analyses section missing");
    assert(homeText.includes("تحليل تحريري جزئي — الحكم غير مكتمل"), "Homepage real state missing");
    for (const forbidden of ["مناسب بمرافقة", "ثقة مرتفعة", "تمت مراجعة النسخة"]) assert(!homeText.includes(forbidden), `Fake homepage language visible: ${forbidden}`);
    const aria = await evaluate(cdp, `(() => { const el=document.querySelector('[role="combobox"]'); return el ? {auto:el.getAttribute('aria-autocomplete'), controls:el.getAttribute('aria-controls')} : null; })()`);
    assert(aria?.auto === "list" && aria.controls, "Combobox ARIA contract missing");
    await evaluate(cdp, `document.querySelector('[role="combobox"]').focus(); true`);
    await cdp.command("Input.insertText", { text: "HarryPotter" });
    await waitFor(cdp, `document.body.innerText.includes('هل تقصد؟')`, "HarryPotter did-you-mean");
    const suggestion = await evaluate(cdp, `(() => { const input=document.querySelector('[role="combobox"]'); const option=document.querySelector('[role="listbox"] [role="option"]'); return {expanded:input?.getAttribute('aria-expanded'), text:option?.innerText || ''}; })()`);
    assert(suggestion.expanded === "true", "Combobox did not expand");
    assert(suggestion.text.includes("هاري بوتر وحجر الفيلسوف") && suggestion.text.includes("Harry Potter and the Philosopher's Stone") && suggestion.text.includes("2001"), "Suggestion is missing bilingual name/year");
    images.push(await screenshot(cdp, `${mode}-search-suggestions.jpg`));
    await key(cdp, "ArrowDown", "ArrowDown", 40);
    assert(await evaluate(cdp, `Boolean(document.querySelector('[role="combobox"]').getAttribute('aria-activedescendant'))`), "ArrowDown did not activate an option");
    await key(cdp, "Escape", "Escape", 27);
    await waitFor(cdp, `document.querySelector('[role="combobox"]').getAttribute('aria-expanded') === 'false'`, "Escape close");
    await key(cdp, "ArrowDown", "ArrowDown", 40);
    await key(cdp, "Enter", "Enter", 13);
    await waitFor(cdp, `location.pathname === '/title/Q102438'`, "keyboard Enter navigation");
    checks.push("homepage/combobox ARIA + Arrow/Enter/Escape + HarryPotter suggestion");

    await navigate(cdp, `${BASE}/titles`);
    const titles = await evaluate(cdp, `({text:document.body.innerText,font:parseFloat(getComputedStyle(document.querySelector('main')).fontSize)})`);
    assert(titles.text.includes("دليل الأفلام والمسلسلات") && titles.text.includes("المراجعة الموثقة") && titles.text.includes("التالي"), "/titles UI contract missing");
    assert(titles.font >= 17, `/titles font too small: ${titles.font}`);
    await navigate(cdp, `${BASE}/titles?q=Harry%20Potter&kind=movie&year=2001`);
    const filtered = await evaluate(cdp, "document.body.innerText");
    assert(filtered.includes("Harry Potter") && filtered.includes("2001"), "Server-filtered title result missing");
    checks.push("/titles pagination/filter/readability/no-overflow");

    for (const [slug, qid, editorialId, ar, en, year] of REVIEWS) {
      await navigate(cdp, `${BASE}/title/${qid}`);
      const titleText = await evaluate(cdp, "document.body.innerText");
      assert(titleText.includes(ar) && titleText.includes(en) && titleText.includes(year), `${slug} title page missing bilingual identity`);
      assert(titleText.includes("تحليل تحريري"), `${slug} title page lost editorial link/state`);

      await navigate(cdp, `${BASE}/review?editorialId=${encodeURIComponent(editorialId)}`);
      const review = await evaluate(cdp, `({text:document.body.innerText,font:parseFloat(getComputedStyle(document.querySelector('.review-page')).fontSize),line:parseFloat(getComputedStyle(document.querySelector('.review-page')).lineHeight)})`);
      assert(review.text.includes(ar) && review.text.includes(en) && review.text.includes(year), `${slug} review missing bilingual identity`);
      assert(review.text.includes("المعلومات غير كافية لإصدار حكم نهائي") && review.text.includes("اقرأ التحليل كاملًا") && review.text.includes("محاور لم نستطع حسمها"), `${slug} review public copy incomplete`);
      for (const forbidden of ["insufficient_data", "decisionEligible", "P4-03", "مؤهل"]) assert(!review.text.includes(forbidden), `${slug} exposes ${forbidden}`);
      assert(review.font >= 17 && review.line / review.font >= 1.75, `${slug} readability too small/tight: ${review.font}/${review.line}`);

      await evaluate(cdp, `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('اقرأ التحليل كاملًا')); if(!b) return false; b.scrollIntoView({block:'center'}); b.click(); return true; })()`);
      await waitFor(cdp, `Boolean(document.querySelector('dialog[open]'))`, `${slug} modal open`);
      assert(await evaluate(cdp, `document.querySelector('dialog[open]').contains(document.activeElement)`), `${slug} modal focus did not move inside`);
      if (slug === "harry") images.push(await screenshot(cdp, `${mode}-harry-dialog.jpg`));
      await key(cdp, "Escape", "Escape", 27);
      await waitFor(cdp, `!document.querySelector('dialog[open]')`, `${slug} modal close`);
      assert(await evaluate(cdp, `document.activeElement?.textContent?.includes('اقرأ التحليل كاملًا')`), `${slug} modal focus did not return to trigger`);
    }
    checks.push("four title/review pages + modal focus/escape + readability/no-overflow");

    await navigate(cdp, `${BASE}/review`);
    const invalid = await evaluate(cdp, `({text:document.body.innerText,noindex:Boolean(document.querySelector('meta[name="robots"][content*="noindex"]')),search:Boolean(document.querySelector('a[href="/search"]'))})`);
    assert(invalid.text.includes("المراجعة غير متاحة حاليًا") && invalid.noindex && invalid.search, "Invalid review did not fail closed");
    checks.push("invalid review noindex/fail-closed");
    return { mode, viewport: [width, height], checks, images };
  } finally {
    socket.close();
    child.kill("SIGTERM");
  }
}

const desktop = await modeQa("desktop", 1440, 1000, 9333);
const mobile = await modeQa("mobile", 390, 844, 9334);
const report = [desktop, mobile].map(({ images, ...item }) => ({ ...item, images: images.map((file) => path.basename(file)) }));
await writeFile(path.join(OUT, "qa-report.json"), JSON.stringify(report, null, 2));
console.log(`B3_VISUAL_REPORT=${JSON.stringify(report)}`);

for (const file of [...desktop.images, ...mobile.images]) {
  const base64 = (await readFile(file)).toString("base64");
  const name = path.basename(file);
  const chunkSize = 6000;
  const total = Math.ceil(base64.length / chunkSize);
  for (let index = 0; index < total; index += 1) {
    const chunk = base64.slice(index * chunkSize, (index + 1) * chunkSize);
    console.log(`B3IMG:${name}:${index + 1}/${total}:${chunk}`);
  }
}
