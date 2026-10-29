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
      await require("./legacy-fixture").seed(context);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    const assets = await page.evaluate(async () => {
      const cache = await caches.open("chaps-v17-character-platform");
      return (await cache.keys()).map(request => new URL(request.url).pathname);
    });
    for (const asset of ["/js/character-rules.js", "/js/character-equipment.js", "/js/character-builder.js", "/js/character-magic.js", "/css/characters.css", "/assets/adventurer.svg", "/js/profile-store.js", "/js/account-auth.js", "/js/features.js", "/css/features.css", "/js/combat-tools.js", "/css/combat-visuals.css", "/js/combat-help.js", "/css/combat-layout.css", "/js/combat-rolls.js"]) {
      assert.ok(assets.includes(asset), "precaché incluye " + asset);
    }
    const icons = await page.evaluate(async () => {
      const manifest = await (await fetch("manifest.json")).json();
      const entries = [...manifest.icons,
        { src: document.querySelector('[rel="apple-touch-icon"]').getAttribute("href"), sizes: "180x180" },
        { src: document.querySelector('[rel="icon"]').getAttribute("href"), sizes: "48x48" }];
      return Promise.all(entries.map(async entry => {
        const image = new Image(); image.src = entry.src; await image.decode();
        return { ...entry, actual: `${image.naturalWidth}x${image.naturalHeight}` };
      }));
    });
    assert.equal(icons.length, 5);
    assert.ok(icons.some(icon => icon.purpose === "maskable"));
    for (const icon of icons) {
      assert.equal(icon.actual, icon.sizes);
      assert.ok(assets.includes("/" + icon.src), "icono disponible offline");
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
    await page.locator('.tab-btn[data-tab="table"]').click();
    await page.evaluate(() => { state.hpCurrent = 1; state.hitDiceSpent = 0; saveState(); renderIdentity(); });
    await page.locator('#table-short-rest').click();
    await page.locator('#short-rest-spend').click();
    assert.equal(await page.evaluate(() => state.hitDiceSpent), 1);
    assert.ok(await page.evaluate(() => state.hpCurrent > 1));
    await page.locator('#short-rest-close').click();
    await page.reload();
    assert.equal(await page.evaluate(() => state.hitDiceSpent), 1);
    await page.locator('.tab-btn[data-tab="table"]').click();
    await page.locator('#table-long-rest').click();
    assert.equal(await page.evaluate(() => state.hitDiceSpent), 0);
    assert.equal(await page.evaluate(() => state.hpCurrent === state.hpMax), true);
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
    await page.locator("#battle-player-card [data-combat-help]").click();
    assert.equal(await page.locator("#combat-help-dialog").isVisible(), true);
    await page.locator("#combat-help-close").click();
    assert.equal(await page.evaluate(() => combat.p.action), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.evaluate(() => {
      combat.on=false;
      state=CHARACTER_RULES.create(DEFAULT_STATE,{name:'Bruja offline',classId:'warlock',speciesId:'orc',backgroundId:'soldier',level:1,subclass:'',method:'standard',abilities:{str:15,dex:14,con:13,int:12,wis:10,cha:8},boosts:{dex:2,con:1},skills:['arcana','deception'],languages:['Común','Élfico','Enano']});
      state.spellSlotsSpent={pact:1};state.resources={r:{name:'Uso de prueba',max:2,spent:1,recharge:'short'}};
      state.spellbook=[{id:'s',name:'Descarga sobrenatural',rulesSpellId:'eldritchBlast',level:0,details:'Guardado sin red',prepared:true}];saveState();renderAll();
    });
    await page.reload();
    assert.equal(await page.evaluate(()=>state.identity.charClass),'Brujo');
    assert.equal(await page.evaluate(()=>state.spellbook[0].details),'Guardado sin red');
    assert.equal(await page.evaluate(()=>state.spellSlotsSpent.pact),1);
    await page.locator('.tab-btn[data-tab="table"]').click();await page.locator('#table-short-rest').click();await page.locator('#short-rest-close').click();
    assert.equal(await page.evaluate(()=>Object.keys(state.spellSlotsSpent).length),0);
    assert.equal(await page.evaluate(()=>state.resources.r.spent),0);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
