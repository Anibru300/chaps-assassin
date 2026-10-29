const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const root = path.resolve(__dirname, "..");

test("tirada interactiva real y acción adicional independiente de ataque", {
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
    for (const width of [1440, 390]) await t.test("ancho " + width, async () => {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      await context.addInitScript(() => sessionStorage.setItem("chaps-auth-v1", "1"));
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://www.gstatic.com/firebasejs/**", route => route.abort());
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.locator('.tab-btn[data-tab="combat"]').click();
      async function reset() {
        await page.evaluate(() => {
          if (globalThis.originalDie) rollDie = originalDie;
          combat.on = false; combat.scenario = null; combat.log = []; clearMap(); moveMode = false;
          state.initiative = 100; combat.enemies = [spawnEnemy("orc")]; combat.enemies[0].hp = combat.enemies[0].maxHp = 500;
          startCombat(); combat.round = 2; combat.p.pos = { x: 1, y: 3 }; combat.enemies[0].pos = { x: 2, y: 3 }; combat.enemies[0].acted = true;
          combat.confirm = () => false; globalThis.originalDie = rollDie; globalThis.d20Calls = 0;
          rollDie = sides => { if (sides === 20) d20Calls++; return Math.min(13, sides); };
          document.querySelector("#c-attack-panel").hidden = true; renderCombat();
        });
      }
      await reset();
      await page.locator("#c-btn-attack").click();
      assert.equal(await page.evaluate(() => d20Calls), 0, "abrir panel no tira dados");
      assert.match(await page.locator("#combat-roll-prep").textContent(), /d20 \+9/);
      await page.locator("#c-atk-roll").click();
      assert.equal(await page.evaluate(() => d20Calls), 1, "animación no vuelve a tirar");
      assert.equal(await page.locator(".roll-formula").getAttribute("data-total"), "22");
      assert.match(await page.locator(".roll-formula").textContent(), /13.*\+5 DES.*\+4 competencia.*22/);
      assert.match(await page.locator(".roll-versus").textContent(), /22 contra CA 13/);
      assert.match(await page.locator(".roll-verdict").textContent(), /¡IMPACTO! · 9 de daño/);
      assert.match(await page.locator(".roll-damage").textContent(), /Daño: 9/);
      assert.equal(await page.evaluate(() => combat.enemies[0].hp), 491);
      assert.equal(await page.evaluate(() => combat.p.action), false);
      assert.equal(await page.locator("#c-btn-hide").isEnabled(), true);
      assert.equal(await page.locator("#combat-roll-hide").isEnabled(), true);
      if (process.env.CHAPS_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.CHAPS_SCREENSHOTS, `tirada-${width}.png`), animations: "disabled" });
      await page.locator("#combat-roll-hide").click();
      assert.equal(await page.evaluate(() => combat.p.hidden), true);
      assert.equal(await page.evaluate(() => combat.p.ba), false);
      assert.equal(await page.evaluate(() => combat.p.react), true);
      assert.equal(await page.evaluate(() => combat.turn), 0);
      assert.match(await page.locator("#combat-roll-followup").textContent(), /Ocultar: d20/);
      assert.match(await page.locator("#combat-roll-resources").textContent(), /gastada en Ocultar/);

      await reset();
      await page.locator("#c-btn-steady").click(); await page.locator("#c-btn-attack").click(); await page.locator("#c-atk-roll").click();
      assert.equal(await page.locator("#c-btn-hide").isEnabled(), false);
      assert.match(await page.locator("#combat-roll-resources").textContent(), /gastada en Puntería/);
      assert.equal(await page.locator(".roll-die").count(), 2);

      await reset();
      await page.evaluate(() => { rollDie = sides => sides === 20 ? (d20Calls++, 1) : 1; combat.enemies[0].ac = 5; });
      await page.locator("#c-btn-attack").click(); await page.locator("#c-atk-roll").click();
      assert.match(await page.locator(".roll-verdict").textContent(), /FALLO · 0 de daño/);
      assert.equal(await page.evaluate(() => combat.enemies[0].hp), 500);
      assert.equal(await page.locator("#c-btn-hide").isEnabled(), true);

      await reset();
      await page.evaluate(() => { rollDie = sides => sides === 20 ? (d20Calls++, 20) : sides; combat.enemies[0].ac = 100; });
      await page.locator("#c-btn-attack").click(); await page.locator("#c-atk-roll").click();
      assert.match(await page.locator(".roll-verdict").textContent(), /¡CRÍTICO! · 13 de daño/);
      assert.match(await page.locator("#combat-roll-body").textContent(), /20 natural/);
      assert.equal(await page.evaluate(() => d20Calls), 1);

      await reset();
      await page.evaluate(() => { combat.enemies[0].hp = 1; });
      await page.locator("#c-btn-attack").click(); await page.locator("#c-atk-roll").click();
      assert.equal(await page.evaluate(() => combat.on), false);
      assert.equal(await page.locator("#combat-roll-result").isVisible(), true);
      assert.match(await page.locator("#combat-roll-resources").textContent(), /Combate finalizado/);

      await reset();
      await page.evaluate(() => {
        state.weapons.push({ name: "Cimitarra de prueba", weaponId: "scimitar", dice: 1, sides: 6, bonus: 5, props: "light", mastery: "Nick" });
        combat.p.action = false; combat.p.nickReady = true; combat.p.nickFree = false; combat.enemies[0].pos = { x: 8, y: 3 }; renderCombat();
      });
      await page.locator("#c-btn-extra").click();
      await page.locator("#c-atk-weapon").selectOption(await page.evaluate(() => String(state.weapons.length - 1)));
      await page.locator("#c-atk-roll").click();
      assert.equal(await page.evaluate(() => combat.p.ba), true, "extra inválido no gasta adicional");
      assert.equal(await page.evaluate(() => combat.p.nickReady), true);
      assert.equal(await page.evaluate(() => d20Calls), 0);
      assert.equal(await page.locator("#c-attack-panel").isVisible(), true);
      await page.evaluate(() => { combat.enemies[0].pos = { x: 2, y: 3 }; renderCombat(); });
      await page.locator("#c-atk-roll").click();
      assert.equal(await page.evaluate(() => combat.p.ba), false);
      assert.match(await page.locator("#combat-roll-resources").textContent(), /ataque extra/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await context.close();
    });
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
