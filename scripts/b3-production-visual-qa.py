import json
import os
import time
from pathlib import Path

from PIL import Image, ImageDraw
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE = os.environ.get("SITE_URL", "https://qabl-almushahada.buildtools.workers.dev").rstrip("/")
OUT = Path("visual-qa")
OUT.mkdir(exist_ok=True)
REVIEWS = [
    ("cars", "Q182153", "cars-2006-editorial-pilot-v1", "سيارات", "Cars", "2006"),
    ("et", "Q11621", "et-1982-editorial-batch-v1", "إي تي", "E.T. the Extra-Terrestrial", "1982"),
    ("harry", "Q102438", "harry-potter-philosophers-stone-2001-editorial-batch-v1", "هاري بوتر وحجر الفيلسوف", "Harry Potter and the Philosopher's Stone", "2001"),
    ("minions", "Q13619743", "minions-2015-editorial-batch-v1", "المينيون", "Minions", "2015"),
]


def browser(width, height):
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--force-device-scale-factor=1")
    options.add_argument(f"--window-size={width},{height}")
    driver = webdriver.Chrome(options=options)
    driver.set_window_size(width, height)
    driver.set_page_load_timeout(40)
    return driver


def ready(driver):
    WebDriverWait(driver, 20).until(lambda d: d.execute_script("return document.readyState") == "complete")
    time.sleep(0.35)


def open_page(driver, url, label):
    driver.get(url)
    ready(driver)
    widths = driver.execute_script("return [document.documentElement.scrollWidth, document.documentElement.clientWidth]")
    assert widths[0] <= widths[1] + 1, f"horizontal overflow on {label}: {widths}"


def body_text(driver):
    return driver.find_element(By.TAG_NAME, "body").text


def shot(driver, mode, name):
    path = OUT / f"{mode}-{name}.png"
    driver.save_screenshot(str(path))
    return path


def run_mode(mode, width, height):
    driver = browser(width, height)
    screenshots = []
    checks = []
    try:
        open_page(driver, BASE + "/", mode + ":home")
        text = body_text(driver)
        assert "تحليلات منشورة حديثًا" in text
        assert "تحليل تحريري جزئي — الحكم غير مكتمل" in text
        assert "مناسب بمرافقة" not in text and "ثقة مرتفعة" not in text and "تمت مراجعة النسخة" not in text
        combo = WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.CSS_SELECTOR, '[role="combobox"]')))
        assert combo.get_attribute("aria-autocomplete") == "list"
        assert combo.get_attribute("aria-controls")
        screenshots.append(shot(driver, mode, "home"))
        checks.append("homepage real content + no overflow")

        combo.click()
        combo.send_keys("HarryPotter")
        WebDriverWait(driver, 15).until(lambda d: "هل تقصد؟" in body_text(d))
        assert combo.get_attribute("aria-expanded") == "true"
        options = driver.find_elements(By.CSS_SELECTOR, '[role="listbox"] [role="option"]')
        assert options
        suggestion = options[0].text
        assert "هاري بوتر وحجر الفيلسوف" in suggestion
        assert "Harry Potter and the Philosopher's Stone" in suggestion
        assert "2001" in suggestion
        screenshots.append(shot(driver, mode, "harry-suggestions"))
        combo.send_keys(Keys.ARROW_DOWN)
        assert combo.get_attribute("aria-activedescendant")
        combo.send_keys(Keys.ESCAPE)
        WebDriverWait(driver, 5).until(lambda d: combo.get_attribute("aria-expanded") == "false")
        combo.click()
        WebDriverWait(driver, 15).until(lambda d: combo.get_attribute("aria-expanded") == "true")
        combo.send_keys(Keys.ARROW_DOWN)
        combo.send_keys(Keys.ENTER)
        WebDriverWait(driver, 15).until(EC.url_contains("/title/Q102438"))
        ready(driver)
        checks.append("combobox ARIA + arrows/Enter/Escape")

        open_page(driver, BASE + "/titles", mode + ":titles")
        titles = body_text(driver)
        assert "دليل الأفلام والمسلسلات" in titles and "المراجعة الموثقة" in titles and "التالي" in titles
        main_font = float(driver.execute_script("return parseFloat(getComputedStyle(document.querySelector('main')).fontSize)"))
        assert main_font >= 17, main_font
        screenshots.append(shot(driver, mode, "titles"))
        open_page(driver, BASE + "/titles?q=Harry%20Potter&kind=movie&year=2001", mode + ":titles-filtered")
        filtered = body_text(driver)
        assert "2001" in filtered and "Harry Potter" in filtered
        checks.append("titles pagination/filter/readability")

        for slug, qid, eid, ar, en, year in REVIEWS:
            open_page(driver, f"{BASE}/title/{qid}", f"{mode}:{slug}-title")
            title_text = body_text(driver)
            assert ar in title_text and en in title_text and year in title_text
            assert "تحليل تحريري" in title_text

            open_page(driver, f"{BASE}/review?editorialId={eid}", f"{mode}:{slug}-review")
            review = body_text(driver)
            assert ar in review and en in review and year in review
            assert "المعلومات غير كافية لإصدار حكم نهائي" in review
            assert "اقرأ التحليل كاملًا" in review and "محاور لم نستطع حسمها" in review
            assert "insufficient_data" not in review and "decisionEligible" not in review and "P4-03" not in review and "مؤهل" not in review
            font = float(driver.execute_script("return parseFloat(getComputedStyle(document.querySelector('.review-page')).fontSize)"))
            line = float(driver.execute_script("return parseFloat(getComputedStyle(document.querySelector('.review-page')).lineHeight)"))
            assert font >= 17 and line / font >= 1.75, (font, line)
            screenshots.append(shot(driver, mode, "review-" + slug))

            trigger = driver.find_element(By.XPATH, "//button[contains(normalize-space(.), 'اقرأ التحليل كاملًا')]")
            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", trigger)
            trigger.click()
            dialog = WebDriverWait(driver, 5).until(lambda d: d.find_element(By.CSS_SELECTOR, "dialog[open]"))
            assert driver.execute_script("return arguments[0].contains(document.activeElement)", dialog)
            if slug == "harry":
                screenshots.append(shot(driver, mode, "harry-dialog"))
            driver.switch_to.active_element.send_keys(Keys.ESCAPE)
            WebDriverWait(driver, 5).until(lambda d: not d.find_elements(By.CSS_SELECTOR, "dialog[open]"))
            assert driver.execute_script("return document.activeElement === arguments[0]", trigger)
        checks.append("four reviews + modal focus + large text + no overflow")

        open_page(driver, BASE + "/review", mode + ":invalid")
        assert "المراجعة غير متاحة حاليًا" in body_text(driver)
        assert driver.find_elements(By.CSS_SELECTOR, 'meta[name="robots"][content*="noindex"]')
        assert driver.find_elements(By.CSS_SELECTOR, 'a[href="/search"]')
        checks.append("invalid review fail closed")
    finally:
        driver.quit()
    return {"mode": mode, "viewport": [width, height], "checks": checks}, screenshots


def sheet(paths, output, columns, thumb_width):
    cards = []
    for path in paths:
        image = Image.open(path).convert("RGB")
        ratio = thumb_width / image.width
        image = image.resize((thumb_width, max(1, int(image.height * ratio))))
        card = Image.new("RGB", (thumb_width, image.height + 28), "white")
        card.paste(image, (0, 28))
        ImageDraw.Draw(card).text((8, 7), path.stem, fill="black")
        cards.append(card)
    rows = (len(cards) + columns - 1) // columns
    cell_h = max(card.height for card in cards)
    result = Image.new("RGB", (thumb_width * columns, cell_h * rows), "white")
    for i, card in enumerate(cards):
        result.paste(card, ((i % columns) * thumb_width, (i // columns) * cell_h))
    result.save(output, quality=72, optimize=True)


desktop, desktop_shots = run_mode("desktop", 1440, 1000)
mobile, mobile_shots = run_mode("mobile", 390, 844)
sheet(desktop_shots, OUT / "desktop-contact-sheet.jpg", 2, 620)
sheet(mobile_shots, OUT / "mobile-contact-sheet.jpg", 1, 360)
(OUT / "qa-report.json").write_text(json.dumps([desktop, mobile], ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps([desktop, mobile], ensure_ascii=False, indent=2))
