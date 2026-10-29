const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

test("PWA instalada conserva ficha, Mesa y notas al recargar offline", {
  skip: !process.env.CHAPS_PLAYWRIGHT, timeout: 60000
}, async () => {
  const { chromium } = require(process.env.CHAPS_PLAYWRIGHT);
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const file = path.join(root, pathname === "/" ? "index.html" : pathname);
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); res.end(); return; }
      res.setHeader("Content-Type", ({ ".js": "application/javascript", ".html": "text/html",
        ".css": "text/css", ".json": "application/json", ".png": "image/png",
        ".jpg": "image/jpeg", ".svg": "image/svg+xml" })[path.extname(file)] || "text/plain");
      res.end(data);
    });
  }).listen(0, "127.0.0.1");
  await new Promise(resolve => server.on("listening", resolve));
  const browser = await chromium.launch({ headless: true,
    args: ["--host-resolver-rules=MAP www.gstatic.com ~NOTFOUND"] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => sessionStorage.setItem("chaps-auth-v1", "1"));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    const assets = await page.evaluate(async () => {
      const cache = await caches.open("chaps-v12-tactical-combat");
      return (await cache.keys()).map(request => new URL(request.url).pathname);
    });
    for (const asset of ["/js/profile-store.js", "/js/account-auth.js", "/js/features.js", "/css/features.css", "/js/combat-tools.js", "/css/combat-visuals.css"]) {
      assert.ok(assets.includes(asset), "precaché incluye " + asset);
    }
    await page.locator("#f-name").fill("CHAPS OFFLINE");
    await page.locator('.tab-btn[data-tab="table"]').click();
    await page.locator("#table-observation").fill("Nota guardada antes de perder red");
    await page.locator("#table-note-add").click();
    await context.setOffline(true);
    await page.reload();
    assert.equal(await page.locator("#f-name").inputValue(), "CHAPS OFFLINE");
    await page.locator('.tab-btn[data-tab="table"]').click();
    await page.locator("#table-observation").fill("Nota creada sin conexión");
    await page.locator("#table-note-add").click();
    await page.reload();
    assert.equal(await page.evaluate(() => state.journal.length), 2);
    await page.locator('.tab-btn[data-tab="combat"]').click();
    await page.evaluate(() => {
      combat.enemies = [spawnEnemy("orc")]; const old = rollDie; rollDie = () => 10;
      try { startCombat(); } finally { rollDie = old; }
      combat.p.hp = 42; combat.p.action = false; renderCombat();
    });
    await page.locator("#bt-save").click(); await page.reload();
    await page.locator('.tab-btn[data-tab="combat"]').click(); await page.locator("#bt-resume").click();
    assert.equal(await page.evaluate(() => combat.p.hp), 42);
    assert.equal(await page.evaluate(() => combat.p.action), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
