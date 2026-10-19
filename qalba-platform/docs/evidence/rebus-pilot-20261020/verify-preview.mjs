/** Local review-preview QA only; does not run the app or contact external sites. */
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const checks = [];
try {
  for (const viewport of [{ width: 1160, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const failures = [];
    page.on("pageerror", error => failures.push(error.message));
    const externalRequests = [];
    page.on("request", request => { if (/^https?:/i.test(request.url())) externalRequests.push(request.url()); });
    await page.goto(new URL("index.html", import.meta.url).href);
    await page.locator(".card").last().waitFor();
    const initial = await page.evaluate(() => {
      const first = document.querySelector(".puzzle");
      const pieces = [...first.querySelectorAll(".piece")];
      return {
        cards: document.querySelectorAll(".card").length,
        loadedPictures: [...document.images].filter(image => image.complete && image.naturalWidth > 0).length,
        hiddenAnswers: [...document.querySelectorAll(".answer")].every(answer => answer.hidden),
        hiddenReview: [...document.querySelectorAll(".review")].every(review => review.hidden),
        rightToLeft: pieces[0].getBoundingClientRect().x > pieces[1].getBoundingClientRect().x,
        noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth,
        buttonsAtLeast44Px: [...document.querySelectorAll("button")].filter(button => button.getBoundingClientRect().height > 0).every(button => button.getBoundingClientRect().height >= 44 && button.getBoundingClientRect().width >= 44),
        imageAltsAvoidAnswers: [...document.images].every(image => /^الرسم \d+$/.test(image.alt)),
      };
    });
    await page.screenshot({ path: new URL(viewport.width === 390 ? "mobile-play.png" : "desktop-play.png", import.meta.url).pathname.replace(/^\/(.:\/)/, "$1"), fullPage: true });
    await page.locator("#review-mode").click();
    await page.locator(".review button").first().click();
    const revealWorks = await page.locator(".answer").first().isVisible();
    if (viewport.width === 1160) await page.screenshot({ path: new URL("desktop-review.png", import.meta.url).pathname.replace(/^\/(.:\/)/, "$1"), fullPage: true });
    await page.locator("#play-mode").click();
    const returnToPlayHidesAnswers = await page.locator(".answer").first().isHidden();
    const result = { viewport, ...initial, revealWorks, returnToPlayHidesAnswers, pageErrors: failures, externalRequests };
    checks.push(result);
    if (initial.cards !== 8 || initial.loadedPictures !== 16 || Object.values(initial).includes(false) || !revealWorks || !returnToPlayHidesAnswers || failures.length || externalRequests.length) throw new Error(JSON.stringify(result));
    await page.close();
  }
  await writeFile(new URL("preview-qa.json", import.meta.url), JSON.stringify({ checkedOn: "2026-10-20", scope: "LOCAL_PREVIEW_ONLY_NOT_HUMAN_PLAYTEST", checks }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(checks, null, 2));
} finally {
  await browser.close();
}
