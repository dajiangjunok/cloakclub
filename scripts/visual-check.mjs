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
    walletText: document.querySelector(".wallet-wrap button")?.textContent?.trim() ?? null
  }));

  if (item.name === "desktop") {
    await page.getByRole("button", { name: "写匿名帖" }).click();
    await page.getByLabel("帖子内容").fill("这是一条自动验证的匿名帖子。");
    await page.getByRole("button", { name: "生成证明并发布" }).click();
    await page.getByText("这是一条自动验证的匿名帖子。").waitFor({ timeout: 5_000 });
  } else {
    await page.locator(".mobile-nav").getByRole("button", { name: "投票" }).click();
    await page.getByRole("button", { name: "像素工作坊" }).click();
    await page.getByText("你已经匿名投过票了").waitFor({ timeout: 5_000 });
  }

  console.log(JSON.stringify({ name: item.name, metrics, errors }));
  await page.close();
}

await browser.close();
