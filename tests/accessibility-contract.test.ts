import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [layoutSource, accessibilityCss, searchSource, searchCss, artworkSource] = await Promise.all([
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/accessibility.css", import.meta.url), "utf8"),
  readFile(new URL("../app/search/title-search-combobox.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/search/title-search-combobox.module.css", import.meta.url), "utf8"),
  readFile(new URL("../app/title-artwork.tsx", import.meta.url), "utf8"),
]);

test("root document keeps Arabic direction and exposes a keyboard skip target", () => {
  assert.match(layoutSource, /<html lang="ar" dir="rtl">/);
  assert.match(layoutSource, /className="skip-link" href="#main-content"/);
  assert.match(layoutSource, /id="main-content" className="content-root" tabIndex=\{-1\}/);
  assert.match(layoutSource, /import "\.\/accessibility\.css"/);
});

test("global keyboard focus remains visible and forced-colors compatible", () => {
  assert.match(accessibilityCss, /:focus-visible/);
  assert.match(accessibilityCss, /outline:\s*3px solid var\(--a11y-focus\)/);
  assert.match(accessibilityCss, /@media \(forced-colors: active\)/);
  assert.match(accessibilityCss, /outline-color:\s*CanvasText/);
});

test("reduced-motion users do not receive smooth scrolling or long transitions", () => {
  assert.match(accessibilityCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(accessibilityCss, /scroll-behavior:\s*auto !important/);
  assert.match(accessibilityCss, /animation-duration:\s*0\.01ms !important/);
  assert.match(accessibilityCss, /transition-duration:\s*0\.01ms !important/);
});

test("search combobox has an explicit label and one keyboard focus model", () => {
  assert.match(searchSource, /<label className=\{styles\.srOnly\} htmlFor=\{inputId\}>اسم الفيلم أو المسلسل<\/label>/);
  assert.match(searchSource, /id=\{inputId\} className=\{styles\.input\}/);
  assert.match(searchSource, /role="combobox"/);
  assert.match(searchSource, /aria-activedescendant=/);
  assert.match(searchSource, /role="listbox" aria-labelledby=\{headingId\}/);
  assert.match(searchSource, /role="option" aria-selected=\{index === active\}/);
  assert.match(searchSource, /tabIndex=\{-1\}/);
});

test("repeated search artwork is hidden from the accessibility tree", () => {
  assert.match(searchSource, /<TitleArtwork[^>]*fallback decorative \/>/);
  assert.match(artworkSource, /decorative = false/);
  assert.match(artworkSource, /alt=\{decorative \? "" : artwork\.altAr\}/);
});

test("small search and brand text colors meet WCAG AA normal-text contrast on their light backgrounds", () => {
  const heading = extractColor(searchCss, /\.heading\{[^}]*color:(#[0-9a-f]{6})/i);
  const brandCaption = extractColor(accessibilityCss, /\.brand__text small\s*\{[^}]*color:\s*(#[0-9a-f]{6})/is);
  assert.ok(contrastRatio(heading, "#fffdf8") >= 4.5, `Search heading contrast is too low: ${heading}`);
  assert.ok(contrastRatio(brandCaption, "#fdfaf4") >= 4.5, `Brand caption contrast is too low: ${brandCaption}`);
});

function extractColor(source: string, pattern: RegExp): string {
  const match = source.match(pattern);
  assert.ok(match?.[1], `Expected color pattern was not found: ${pattern}`);
  return match[1];
}

function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const rgb = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = rgb.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
