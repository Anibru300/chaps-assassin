const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

test("tablero: selección, daño visible tras redibujar, estados y movimiento", {
  skip: !process.env.CHAPS_PLAYWRIGHT, timeout: 60000
}, async t => {
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
  await new Promise(resolve => server.on("listening", resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1440]) await t.test("ancho " + width, async () => {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      await context.addInitScript(() => sessionStorage.setItem("chaps-auth-v1", "1"));
      await require("./legacy-fixture").seed(context);
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://www.gstatic.com/firebasejs/**", route => route.abort());
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.locator('.tab-btn[data-tab="combat"]').click();
      await page.evaluate(() => {
        clearMap(); combat.enemies = [spawnEnemy("orc"), spawnEnemy("wolf")];
        combat.quiet = true; startCombat(); combat.quiet = false;
        combat.on = true; combat.order = [{ who: "p", init: 30 }, { who: "e", idx: 0, init: 10 }, { who: "e", idx: 1, init: 5 }]; combat.turn = 0;
        combat.p = newCombatPlayer(); combat.p.pos = { x: 2, y: 3 }; combat.p.action = true;
        combat.enemies[0].pos = { x: 3, y: 3 }; combat.enemies[0].hp = combat.enemies[0].maxHp = 500;
        combat.enemies[1].pos = { x: 7, y: 4 };
        addCond(combat.enemies[1], "poisoned");
        combat.map.terrain.push({ x: 5, y: 2, type: "fire" }, { x: 6, y: 2, type: "ice" });
        renderCombat();
      });
      assert.equal(await page.locator('[data-combatant="p"] img').count(), 1);
      await page.locator('[data-combatant="e1"]').click();
      assert.equal(await page.locator("#c-atk-target").inputValue(), "1");
      assert.equal(await page.locator("#cell-7-4").getAttribute("class").then(value => value.includes("targeted")), true);
      const hit = await page.evaluate(() => {
        const old = rollDie, previous = combat.enemies[0].hp;
        try { rollDie = () => 20; playerAttack(state.weapons[0], combat.enemies[0], []); }
        finally { rollDie = old; }
        return { damage: previous - combat.enemies[0].hp,
          numbers: document.querySelectorAll("#c-board .board-fx.crit").length,
          waves: document.querySelectorAll("#c-board .impact-wave").length,
          trails: document.querySelectorAll("#c-board .fx-line").length };
      });
      assert.ok(hit.damage > 0);
      assert.ok(hit.numbers > 0 && hit.waves > 0 && hit.trails > 0, "impacto sigue visible tras renderCombat");
      assert.equal(await page.locator("#cell-7-4.condition-poisoned .token-condition").count(), 1);
      assert.equal(await page.evaluate(() => playerMoveTo(1, 3)), true);
      assert.equal(await page.locator('#cell-1-3 [data-combatant="p"]').count(), 1);
      await page.evaluate(() => { combat.enemies[1].hp = 0; renderCombat(); });
      assert.equal(await page.locator("#cell-7-4.fallen").count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator("#c-board-zoom").click();
      assert.equal(await page.locator("#c-board-zoom").getAttribute("aria-pressed"), "true");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator("#c-board-zoom").click();
      if (process.env.CHAPS_SCREENSHOTS) await page.locator("#c-board").screenshot({
        path: path.join(process.env.CHAPS_SCREENSHOTS, `combate-${width}.png`), animations: "disabled"
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(await page.locator("#cell-5-2").evaluate(node => getComputedStyle(node).animationName), "none");
      assert.deepEqual(errors, []);
      await context.close();
    });
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
