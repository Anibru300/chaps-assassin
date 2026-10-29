const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

test("navegación de ficha en móvil, tablet y escritorio", {
  skip: !process.env.CHAPS_PLAYWRIGHT,
  timeout: 90000
}, async (t) => {
  const { chromium } = require(process.env.CHAPS_PLAYWRIGHT);
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const file = path.join(root, pathname === "/" ? "index.html" : pathname);
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); res.end(); return; }
      res.setHeader("Content-Type", ({ ".js": "application/javascript", ".html": "text/html",
        ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg",
        ".png": "image/png", ".svg": "image/svg+xml" })[path.extname(file)] || "text/plain");
      res.end(data);
    });
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [360, 390, 768, 1023, 1024, 1440]) {
      await t.test(`ancho ${width}: enlaces accesibles, cierre y cabecera respetada`, async () => {
        const context = await browser.newContext({
          viewport: { width, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce",
          hasTouch: width < 1024
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await context.addInitScript(() => sessionStorage.setItem("chaps-auth-v1", "1"));
      await require("./legacy-fixture").seed(context);
        await page.route("https://www.gstatic.com/firebasejs/**", (route) => route.abort());
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        const sidebar = page.locator("#sheet-sidebar");
        const toggle = page.locator("#sheet-nav-toggle");
        const inventory = sidebar.locator('a[href="#section-inventory"]');
        assert.equal(await page.locator("#btn-header-export, #btn-header-import, #btn-export, #btn-import, #cloud-backup, input[accept*='.json']").count(), 0);
        if (width < 1024) {
          assert.equal(await sidebar.isVisible(), false);
          assert.equal(await toggle.isVisible(), true);
          await toggle.tap();
          assert.equal(await toggle.getAttribute("aria-expanded"), "true");
          assert.equal(await toggle.isVisible(), false, "botón flotante no tapa enlaces dentro de menú");
          assert.equal(await page.locator("#sheet-nav-search").evaluate((el) => el === document.activeElement), true);
          await page.keyboard.press("Shift+Tab");
          assert.equal(await page.locator("#sheet-nav-close").evaluate((el) => el === document.activeElement), true);
          await page.keyboard.press("Shift+Tab");
          assert.equal(await sidebar.locator("a").last().evaluate((el) => el === document.activeElement), true);
          await page.keyboard.press("Tab");
          assert.equal(await page.locator("#sheet-nav-close").evaluate((el) => el === document.activeElement), true);
        } else {
          assert.equal(await sidebar.isVisible(), true);
          assert.equal(await toggle.isVisible(), false);
          const menu = await sidebar.boundingBox(), header = await page.locator(".app-header").boundingBox();
          assert.ok(menu.y >= header.y + header.height - 1);
        }
        await page.locator("#sheet-nav-search").fill("inventario");
        assert.equal(await sidebar.locator("a:visible").count(), 1);
        const hit = await inventory.evaluate((el) => {
          const bounds = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
        });
        assert.equal(hit, true, "overlay no tapa enlace");
        if (width < 1024) await inventory.tap(); else await inventory.click();
        await page.waitForFunction(() => {
          const target = document.querySelector("#section-inventory").getBoundingClientRect();
          const header = document.querySelector(".app-header").getBoundingClientRect();
          return target.top >= header.bottom - 1 && target.top <= header.bottom + 20;
        });
        await page.waitForFunction(() => document.querySelector('a[href="#section-inventory"]').getAttribute("aria-current") === "location");
        assert.equal(await page.locator("#section-inventory").evaluate((el) => el === document.activeElement), true);
        if (width < 1024) {
          assert.equal(await toggle.getAttribute("aria-expanded"), "false");
          assert.equal(await sidebar.isVisible(), false);
          await toggle.tap();
          assert.equal(await sidebar.locator("a:visible").count(), await sidebar.locator("a").count());
          await page.keyboard.press("Escape");
          assert.equal(await toggle.evaluate((el) => el === document.activeElement), true);
          await toggle.tap();
          await page.locator("#sheet-overlay").tap({ position: { x: width - 10, y: 200 } });
          assert.equal(await toggle.getAttribute("aria-expanded"), "false");
          await toggle.tap();
          await page.locator("#sheet-nav-close").tap();
          assert.equal(await toggle.getAttribute("aria-expanded"), "false");
          await toggle.tap();
          await page.setViewportSize({ width: 1280, height: 900 });
          await page.waitForFunction(() => !document.body.classList.contains("sheet-nav-open") && !document.querySelector("#sheet-sidebar").inert);
        }
        await page.locator('.tab-btn[data-tab="combat"]').click();
        assert.equal(await toggle.isVisible(), false);
        assert.equal(await sidebar.isVisible(), false);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.setViewportSize({ width, height: 900 });
        await page.locator('.tab-btn[data-tab="table"]').click();
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        assert.equal(await page.locator("#table-name").isVisible(), true);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (process.env.CHAPS_SCREENSHOTS && [390, 1440].includes(width)) {
          await page.screenshot({ path: path.join(process.env.CHAPS_SCREENSHOTS, `mesa-${width}.png`), fullPage: true, animations: "disabled" });
        }
        assert.deepEqual(errors, []);
        await context.close();
      });
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
