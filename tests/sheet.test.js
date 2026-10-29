const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.resolve(__dirname, '..');

test('ficha: descansos 2024, cálculos actualizados y atributos válidos', {
  skip: !process.env.CHAPS_PLAYWRIGHT, timeout: 90000
}, async t => {
  const { chromium } = require(process.env.CHAPS_PLAYWRIGHT);
  const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); res.end(); return; }
      res.setHeader('Content-Type', ({'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json'})[path.extname(file)] || 'application/octet-stream');
      res.end(data);
    });
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true});
    for (const width of [360, 1440]) await t.test(`${width}px`, async () => {
      const context = await browser.newContext({viewport:{width, height:900}, serviceWorkers:'block'});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(() => sessionStorage.setItem('chaps-auth-v1', '1'));
      await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort());
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate(() => {
        window.auditReset = () => {
          state = structuredClone(DEFAULT_STATE);
          state.xp = 108600; state.hpMax = 112; state.hpCurrent = 40;
          state.abilities.con = 19; state.skills.perception = {p:true, e:false};
          state.hitDiceSpent = 8; state.deathSuccess = 2; state.deathFail = 1;
          saveState(); renderAll();
        };
        window.auditReset();
      });
      await page.locator('#btn-short-rest').click();
      assert.equal(await page.locator('#short-rest-dialog').isVisible(), true);
      assert.deepEqual(await page.evaluate(() => [state.hitDiceSpent,state.hpCurrent,state.deathSuccess,state.deathFail]), [8,40,2,1]);
      const box = await page.locator('#short-rest-dialog').boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width);
      await page.evaluate(() => { window.auditRoll = rollDie; rollDie = () => 3; });
      await page.locator('#short-rest-spend').click();
      assert.deepEqual(await page.evaluate(() => [state.hitDiceSpent,state.hpCurrent,state.deathSuccess,state.deathFail]), [9,47,0,0]);
      assert.match(await page.locator('#short-rest-result').textContent(), /d8\(3\).*\+4.*\+7/);
      await page.locator('#short-rest-spend').click();
      assert.deepEqual(await page.evaluate(() => [state.hitDiceSpent,state.hpCurrent]), [10,54]);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#short-rest-dialog').isVisible(), false);
      await page.evaluate(() => { state.hpCurrent = 111; renderIdentity(); });
      await page.locator('#btn-short-rest').click();
      await page.locator('#short-rest-spend').click();
      assert.deepEqual(await page.evaluate(() => [state.hitDiceSpent,state.hpCurrent]), [11,112]);
      assert.equal(await page.locator('#short-rest-spend').isDisabled(), true);
      await page.locator('#short-rest-close').click();
      await page.evaluate(() => { state.hpCurrent = 40; state.hitDiceSpent = 12; });
      await page.locator('#btn-short-rest').click();
      assert.equal(await page.locator('#short-rest-spend').isDisabled(), true);
      await page.locator('#short-rest-close').click();
      await page.evaluate(() => { state.hitDiceSpent = 0; state.abilities.con = 1; rollDie = () => 1; });
      await page.locator('#btn-short-rest').click();
      await page.locator('#short-rest-spend').click();
      assert.equal(await page.evaluate(() => state.hpCurrent), 41, 'mínimo 1 PG incluso con CON negativa');
      await page.locator('#short-rest-close').click();
      await page.evaluate(() => { rollDie = window.auditRoll; window.auditReset(); });
      await page.locator('#btn-long-rest').click();
      assert.deepEqual(await page.evaluate(() => [state.hitDiceSpent,state.hpCurrent,state.deathSuccess,state.deathFail]), [0,112,0,0]);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(STORAGE_KEY)).hitDiceSpent), 0);
      await page.evaluate(() => { window.auditReset(); state.hpCurrent = 0; });
      await page.locator('#btn-short-rest').click();
      assert.equal(await page.locator('#short-rest-spend').isDisabled(), true);
      assert.match(await page.locator('#short-rest-warning').textContent(), /1 PG/);
      await page.locator('#short-rest-close').click();
      page.once('dialog', dialog => dialog.accept());
      await page.locator('#btn-long-rest').click();
      assert.equal(await page.evaluate(() => state.hpCurrent), 0);
      await page.evaluate(() => window.auditReset());
      const dex = page.locator('#ability-grid input[data-ab="dex"]');
      await dex.fill('18'); await dex.dispatchEvent('change');
      assert.equal(await page.locator('#weapons-body tr').first().locator('td').nth(2).textContent(), '+8');
      assert.equal(await page.evaluate(() => state.weapons[0].bonus), 5, 'conserva daño manual');
      for (const invalid of ['99', '0', '18.5', '']) {
        await dex.fill(invalid); await dex.dispatchEvent('change');
        assert.equal(await page.evaluate(() => state.abilities.dex), 18);
        assert.equal(await dex.inputValue(), '18');
      }
      await page.evaluate(() => window.auditReset());
      await page.locator('#skills-list input[data-skill="perception"][data-kind="p"]').uncheck();
      assert.equal(await page.locator('#f-passive').inputValue(), '12');
      await page.locator('#skills-list input[data-skill="perception"][data-kind="e"]').check();
      assert.equal(await page.locator('#f-passive').inputValue(), '20');
      await page.locator('#f-passive').fill('25'); await page.locator('#f-passive').dispatchEvent('change');
      await page.locator('#skills-list input[data-skill="perception"][data-kind="e"]').uncheck();
      assert.equal(await page.locator('#f-passive').inputValue(), '25', 'conserva ajuste manual');
      await page.evaluate(() => window.auditReset());
      await page.locator('#f-xp').fill('120000'); await page.locator('#f-xp').dispatchEvent('change');
      assert.equal(await page.locator('#f-level').inputValue(), '13');
      assert.equal(await page.locator('#f-prof').inputValue(), '+5');
      assert.equal(await page.locator('#f-passive').inputValue(), '17');
      assert.equal(await page.locator('#weapons-body tr').first().locator('td').nth(2).textContent(), '+10');
      await page.reload();
      assert.equal(await page.locator('#f-level').inputValue(), '13');
      assert.equal(await page.locator('#f-passive').inputValue(), '17');
      assert.deepEqual(errors, []);
      await context.close();
    });
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
