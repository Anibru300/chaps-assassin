const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const root = path.resolve(__dirname, "..");

test("herramientas de combate: ocho mejoras integradas", {
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
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: "block", hasTouch: true });
    await context.addInitScript(() => sessionStorage.setItem("chaps-auth-v1", "1"));
    const page = await context.newPage(); page.on("pageerror", error => errors.push(error.stack));
    page.on("dialog", dialog => dialog.accept());
    await page.route("https://www.gstatic.com/firebasejs/**", route => route.abort());
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url);
    await page.evaluate(() => CHAPS_FEATURES.profiles.activate("account-a", "chaps", CHAPS_STORE.snapshot()));
    await page.locator('.tab-btn[data-tab="combat"]').click();
    async function reset() {
      await page.evaluate(() => {
        combat.on = false; combat.scenario = null; combat.log = []; clearMap(); moveMode = false;
        state.hpMax = state.hpCurrent = 100; state.initiative = 100; state.speed = 30;
        saveState();
        combat.enemies = [spawnEnemy("orc"), spawnEnemy("wolf")];
        startCombat(); combat.confirm = () => false;
        combat.p.pos = { x: 1, y: 3 }; combat.enemies[0].pos = { x: 5, y: 3 }; combat.enemies[1].pos = { x: 8, y: 4 };
        combat.order = [{ who: "p", init: 100 }, { who: "e", idx: 0, init: 10 }, { who: "e", idx: 1, init: 5 }]; combat.turn = 0;
        document.querySelector("#c-attack-panel").hidden = true; renderCombat();
      });
    }
    await t.test("clic mueve al instante, rodea obstáculos y cobra terreno difícil", async () => {
      await reset();
      const route = await page.evaluate(() => {
        addObstacle(2, 2, "wall"); addObstacle(2, 3, "wall"); combat.map.terrain.push({ x: 2, y: 4, type: "difficult" });
        renderCombat(); return movementPath(combat.p.pos, { x: 3, y: 3 }, 30);
      });
      assert.equal(route.at(-1).cost, 15);
      assert.equal(route.some(point => point.x === 2 && point.y === 3), false);
      await page.locator("#c-btn-move").click(); await page.locator("#cell-3-3").click();
      assert.equal(await page.locator("#bt-confirm-move").count(), 0);
      assert.match(await page.locator("#bt-route").textContent(), /15 ft/);
      assert.deepEqual(await page.evaluate(() => combat.p.pos), { x: 3, y: 3 });
      assert.equal(await page.evaluate(() => combat.p.move), 15);
      assert.equal(await page.evaluate(() => combat.tactical.feet), 15);
      await page.locator("#c-btn-move").click(); await page.locator("#cell-3-4").focus(); await page.keyboard.press("Enter");
      assert.deepEqual(await page.evaluate(() => combat.p.pos), { x: 3, y: 4 });
      await page.locator("#c-btn-move").tap(); await page.locator("#cell-2-4").tap();
      assert.deepEqual(await page.evaluate(() => combat.p.pos), { x: 2, y: 4 });
      assert.equal(await page.evaluate(() => combat.p.move), 0);
    });
    await t.test("aviso de oportunidad y peligros intermedios coinciden con movimiento", async () => {
      await reset();
      await page.evaluate(() => { combat.enemies[0].pos = { x: 2, y: 3 }; renderCombat(); });
      await page.locator("#c-btn-move").click(); await page.locator("#cell-1-5").hover();
      assert.match(await page.locator("#bt-route").textContent(), /Ataques de oportunidad: Orco/);
      await page.evaluate(() => {
        combat.p.diseng = true;
        combat.map.terrain.push({ x: 0, y: 4, type: "fire", dmg: "1", trigger: "enter" }, { x: 1, y: 4, type: "fire", dmg: "1", trigger: "enter" }, { x: 2, y: 4, type: "fire", dmg: "1", trigger: "enter" });
      });
      const before = await page.evaluate(() => combat.p.hp);
      await page.locator("#cell-1-5").click();
      assert.equal(await page.evaluate(() => combat.p.hp), before - 1);
    });
    await t.test("alcance, visión bloqueada y fichas ampliadas funcionan con toque y teclado", async () => {
      await reset();
      await page.evaluate(() => { addObstacle(2, 3, "wall"); renderCombat(); });
      await page.locator("#bt-weapon").selectOption("2");
      assert.equal(await page.locator("#cell-5-3.range-blocked").count(), 1);
      await page.locator('[data-combatant="e0"]').click();
      assert.match(await page.locator("#bt-inspector-body").textContent(), /Orco.*PG 15\/15/s);
      assert.match(await page.locator("#bt-inspector-body").textContent(), /Visión bloqueada/);
      if (process.env.CHAPS_SCREENSHOTS) await page.locator("#bt-inspector").screenshot({ path: path.join(process.env.CHAPS_SCREENSHOTS, "ficha-tactica-390.png"), animations: "disabled" });
      await page.locator('[data-combatant="p"]').click();
      assert.match(await page.locator("#bt-inspector-body").textContent(), /PG 100\/100/);
      await page.locator('[data-combatant="e1"]').focus(); await page.keyboard.press("Enter");
      assert.match(await page.locator("#bt-inspector-body").textContent(), /Lobo/);
    });
    await t.test("efectos fuego, hielo, veneno, flecha y curación acompañan acciones reales", async () => {
      await reset();
      const effects = await page.evaluate(() => {
        const old = rollDie; rollDie = sides => Math.min(10, sides);
        try {
          const spell = { es: "Descarga de Fuego", atk: 99, dmg: "1d4", range: 120, uses: 1, usesLeft: 1 };
          enemyCast(combat.enemies[0], spell);
          const fire = !!document.querySelector(".fx-line.element-fire");
          enemyCast(combat.enemies[0], { ...spell, es: "Rayo de hielo", usesLeft: 1 });
          const ice = !!document.querySelector(".fx-line.element-ice");
          addCond(combat.enemies[0], "poisoned");
          const poison = !!document.querySelector(".element-burst.element-poison");
          playerAttack(state.weapons[2], combat.enemies[1], { ally: false, strikes: [] });
          return { fire, ice, poison, arrow: !!document.querySelector(".fx-line.element-arrow") };
        } finally { rollDie = old; }
      });
      assert.deepEqual(effects, { fire: true, ice: true, poison: true, arrow: true });
      await page.locator("#combat-roll-close").click();
      await page.locator(".battle-healing-details summary").click();
      await page.locator("#bt-heal-amount").fill("3"); await page.locator("#bt-heal").click();
      assert.equal(await page.evaluate(() => combat.tactical.healed), 3);
      assert.equal(await page.locator(".board-fx.healing-fx").count(), 1);
    });
    await t.test("pausar detiene IA; paso ejecuta exactamente un enemigo; continuar respeta velocidad", async () => {
      await reset();
      if (await page.locator("#bt-pause").getAttribute("aria-pressed") !== "true") await page.locator("#bt-pause").click();
      await page.locator("#bt-speed").selectOption("200");
      await page.evaluate(() => {
        globalThis.executions = {}; globalThis.originalEnemyTakeTurn = enemyTakeTurn;
        enemyTakeTurn = function (enemy) { executions[enemy.key] = (executions[enemy.key] || 0) + 1; return originalEnemyTakeTurn(enemy); };
      });
      await page.locator("#c-btn-end").click(); await page.waitForTimeout(450);
      assert.equal(await page.evaluate(() => combat.turn), 1);
      assert.deepEqual(await page.evaluate(() => executions), {});
      await page.locator("#bt-step").click();
      assert.deepEqual(await page.evaluate(() => executions), { orc: 1 });
      assert.equal(await page.evaluate(() => combat.turn), 2);
      await page.locator("#bt-pause").click(); await page.waitForFunction(() => isPlayerTurn());
      assert.deepEqual(await page.evaluate(() => executions), { orc: 1, wolf: 1 });
      await page.evaluate(() => { enemyTakeTurn = originalEnemyTakeTurn; });
    });
    await t.test("escenarios verifican escape, defensa real de aliado y cinco rondas completas", async () => {
      await reset();
      for (const type of ["ambush", "escape", "protect", "survive"]) {
        await page.locator("#bt-scenario").selectOption(type); await page.locator("#bt-prepare").click();
        await page.locator("#c-btn-start").click();
        assert.equal(await page.evaluate(() => combat.scenario.type), type);
        if (type === "ambush") assert.ok(await page.evaluate(() => combat.enemies.some(enemy => enemy.pos.x < 4)));
        if (type === "escape") {
          assert.equal(await page.locator(".exit-cell").count(), 2);
          await page.evaluate(() => { combat.p.pos = { x: 11, y: 3 }; checkCombatEnd(); });
          assert.equal(await page.evaluate(() => combat.result), "victory");
        }
        if (type === "protect") {
          const result = await page.evaluate(() => {
            combat.enemies[0].pos = { x: 6, y: 3 }; combat.enemies[1].hp = 0;
            combat.turn = combat.order.findIndex(item => item.who === "e" && item.idx === 0);
            const before = combat.p.hp, old = rollDie; rollDie = sides => Math.min(10, sides);
            try { CHAPS_BATTLE.scheduleEnemy(combat.enemies[0]); document.querySelector("#bt-step").click(); }
            finally { rollDie = old; }
            return { hero: combat.p.hp, before, ally: combat.scenario.ally.hp, damage: combat.tactical.allyDamage };
          });
          assert.equal(result.hero, result.before); assert.ok(result.ally < 35 && result.damage > 0);
          await page.evaluate(() => { combat.scenario.ally.hp = 0; checkCombatEnd(); });
          assert.equal(await page.evaluate(() => combat.result), "defeat");
        }
        if (type === "survive") {
          await page.evaluate(() => { combat.round = 5; checkCombatEnd(); });
          assert.equal(await page.evaluate(() => combat.on), true);
          await page.evaluate(() => { combat.turn = combat.order.length - 1; nextTurn(); });
          assert.equal(await page.evaluate(() => combat.result), "victory");
        }
      }
    });
    await t.test("retomar después de recarga conserva acción usada, mapa y turno enemigo sin duplicar", async () => {
      await reset();
      if (await page.locator("#bt-pause").getAttribute("aria-pressed") !== "true") await page.locator("#bt-pause").click();
      await page.evaluate(() => { combat.p.hp = 79; combat.p.action = false; combat.enemies[0].hp = 12; addCond(combat.enemies[0], "poisoned"); addObstacle(3, 2, "crate"); renderCombat(); });
      await page.locator("#bt-save").click();
      await page.reload(); await page.locator('.tab-btn[data-tab="combat"]').click(); await page.locator("#bt-resume").click();
      assert.equal(await page.evaluate(() => combat.p.hp), 79);
      assert.equal(await page.evaluate(() => combat.p.action), false);
      assert.equal(await page.evaluate(() => combat.enemies[0].hp), 12);
      assert.equal(await page.evaluate(() => hasCond(combat.enemies[0], "poisoned")), true);
      assert.equal(await page.evaluate(() => getObstacle(3, 2).type), "crate");
      await page.locator("#c-btn-end").click(); await page.locator("#bt-save").click();
      const turn = await page.evaluate(() => combat.turn), hp = await page.evaluate(() => combat.p.hp);
      await page.reload(); await page.locator('.tab-btn[data-tab="combat"]').click(); await page.locator("#bt-resume").click();
      await page.waitForTimeout(450);
      assert.equal(await page.evaluate(() => combat.turn), turn);
      assert.equal(await page.evaluate(() => combat.p.hp), hp);
      await page.locator("#bt-step").click();
      assert.notEqual(await page.evaluate(() => combat.turn), turn);
    });
    await t.test("guardado aislado por cuenta y guardado inválido deja combate intacto", async () => {
      await page.evaluate(() => CHAPS_FEATURES.profiles.activate("account-b", "chaps", CHAPS_STORE.snapshot()));
      await page.locator("#bt-resume").click();
      assert.match(await page.locator("#bt-save-status").textContent(), /No hay combate guardado/);
      const before = await page.evaluate(() => JSON.stringify(combat.p));
      await page.evaluate(() => {
        const key = "chaps-battle-v1:" + JSON.stringify(CHAPS_FEATURES.profiles.current);
        localStorage.setItem(key, '{"schema":1,"state":{"turn":999}}');
      });
      await page.locator("#bt-resume").click();
      assert.equal(await page.evaluate(() => JSON.stringify(combat.p)), before);
    });
    await t.test("resumen mide daño efectivo, recursos y no se altera al simular", async () => {
      await reset();
      await page.evaluate(() => {
        combat.enemies[0].pos = { x: 2, y: 3 }; combat.enemies[0].hp = 5; combat.enemies[1].hp = 0;
        playerBonus("steady"); const old = rollDie; rollDie = sides => sides;
        try { playerAttack(state.weapons[0], combat.enemies[0], { ally: false, strikes: ["poison"] }); }
        finally { rollDie = old; }
      });
      const data = await page.evaluate(() => combat.tactical);
      assert.equal(data.damage, 5); assert.equal(data.actions, 1); assert.equal(data.bonus, 1); assert.equal(data.attacks, 1); assert.equal(data.sneaks, 1); assert.equal(data.cunningDice, 1); assert.equal(data.crits, 1);
      assert.match(await page.locator("#c-summary-body").textContent(), /Resumen táctico/);
      const after = await page.evaluate(() => { runMonteCarlo(2); return combat.tactical; });
      assert.deepEqual(after, data);
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
