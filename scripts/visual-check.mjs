import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
});

const cases = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
];

for (const item of cases) {
  const page = await browser.newPage({ viewport: item });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));

  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator(".dashboard").waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `/tmp/cloakclub-${item.name}.png`, fullPage: true });

  const metrics = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyHeight: document.body.scrollHeight,
    visibleRails: [...document.querySelectorAll(".left-rail, .feed-column, .right-rail")]
      .filter((node) => getComputedStyle(node).display !== "none").length,
    tabNavigations: document.querySelectorAll(".desktop-nav, .mobile-nav").length,
    walletText: document.querySelector(".wallet-wrap button")?.textContent?.trim() ?? null
  }));

  if (metrics.scrollWidth !== metrics.viewportWidth) errors.push("page has horizontal overflow");
  if (metrics.visibleRails !== 3) errors.push(`expected 3 visible sections, found ${metrics.visibleRails}`);
  if (metrics.tabNavigations !== 0) errors.push(`expected no tab navigation, found ${metrics.tabNavigations}`);

  console.log(JSON.stringify({ name: item.name, metrics, errors }));
  if (errors.length) process.exitCode = 1;
  await page.close();
}

await browser.close();
