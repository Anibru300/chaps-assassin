const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const root = path.resolve(__dirname, "..");

test("mapa y tirada visibles juntos; ayuda explica recursos sin gastarlos", {
  skip: !process.env.CHAPS_PLAYWRIGHT, timeout: 90000
}, async t => {
  const { chromium } = require(process.env.CHAPS_PLAYWRIGHT);
  const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, "http://localhost").pathname.replace(/^\/$/, "/index.html"));
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); res.end(); return; }
      res.setHeader("Content-Type", ({ ".js": "application/javascript", ".html": "text/html", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" })[path.extname(file)] || "text/plain"); res.end(data);
    });
  }).listen(0, "127.0.0.1");
  await new Promise(resolve => server.on("listening", resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1440, 900], [1280, 720], [1024, 768], [390, 844], [360, 740]]) await t.test(`${width} × ${height}`, async () => {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block", reducedMotion: "reduce" });
      await context.addInitScript(() => sessionStorage.setItem("chaps-auth-v1", "1"));
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://www.gstatic.com/firebasejs/**", route => route.abort());
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.locator('.tab-btn[data-tab="combat"]').click();
      await page.evaluate(() => {
        state.initiative = 100; combat.enemies = [spawnEnemy("orc")]; combat.enemies[0].hp = combat.enemies[0].maxHp = 500;
        document.querySelector("#cloud-disconnect").hidden = false;
        clearMap(); document.querySelector("#me-auto").checked = false; renderSetup();
      });
      await page.locator("#c-btn-start").click();
      await page.waitForFunction(() => document.querySelector("#battle-workspace").getBoundingClientRect().top >= document.querySelector(".app-header").getBoundingClientRect().bottom - 2);
      const beforeScroll = await page.evaluate(() => scrollY);
      await page.locator("#c-btn-attack").click();
      await page.waitForFunction(() => {
        const roll = document.querySelector("#c-atk-roll").getBoundingClientRect();
        return roll.top >= document.querySelector(".app-header").getBoundingClientRect().bottom && roll.bottom <= innerHeight;
      });
      const bounds = await page.evaluate(() => {
        const rect = id => { const r = document.querySelector(id).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width }; };
        return { map: rect("#c-board"), card: rect("#battle-map"), console: rect("#battle-console"), panel: rect("#c-attack-panel"), header: rect(".app-header"), scroll: scrollY, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(bounds.overflow, false);
      assert.ok(bounds.map.top >= bounds.header.bottom, "mapa queda bajo cabecera");
      assert.ok(bounds.map.bottom <= height, "mapa completo dentro de pantalla");
      if (width >= 900) {
        assert.ok(bounds.card.right < bounds.console.left, "mapa a izquierda, acciones a derecha");
        assert.ok(Math.abs(bounds.scroll - beforeScroll) < 5, "abrir tirada no desplaza página");
      } else assert.ok(bounds.map.bottom <= bounds.panel.top + 2, "tirada no tapa mapa móvil: " + JSON.stringify(bounds));
      if (process.env.CHAPS_SCREENSHOTS && [1440, 390].includes(width)) await page.screenshot({ path: path.join(process.env.CHAPS_SCREENSHOTS, `layout-combate-${width}.png`), animations: "disabled" });
      await page.locator("#c-atk-cancel").click();
      const beforeResources = await page.evaluate(() => JSON.stringify([combat.p.hp, combat.p.action, combat.p.ba, combat.p.react, combat.p.move]));
      await page.locator("#battle-player-card [data-combat-help]").click();
      assert.equal(await page.locator("#combat-help-dialog").isVisible(), true);
      assert.match(await page.locator("#combat-help-resources").textContent(), /Acción.*Disponible/s);
      assert.match(await page.locator("#combat-help-buttons").textContent(), /Dash.*acción adicional/s);
      assert.match(await page.locator("#combat-help-rules").textContent(), /Furtivo/);
      assert.equal(await page.locator("#bt-pause").getAttribute("aria-pressed"), "true");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector("#combat-help-dialog").open);
      assert.equal(await page.evaluate(() => JSON.stringify([combat.p.hp, combat.p.action, combat.p.ba, combat.p.react, combat.p.move])), beforeResources);
      await page.locator("#c-btn-dash").focus();
      assert.match(await page.locator("#battle-context-help").textContent(), /movimiento/);
      await page.locator("#c-btn-attack").click(); await page.locator("#c-atk-roll").click();
      assert.equal(await page.evaluate(() => combat.p.action), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await context.close();
    });
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
