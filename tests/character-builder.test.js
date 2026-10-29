const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
test('asistente móvil/escritorio crea doce clases; compra equipo y lanza conjuro preparado',{
 skip:!process.env.CHAPS_PLAYWRIGHT,timeout:90000
},async t=>{
 const {chromium}=require(process.env.CHAPS_PLAYWRIGHT);
 const server=http.createServer((req,res)=>{
  const file=path.join(root,new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);});
 }).listen(0,'127.0.0.1');await new Promise(resolve=>server.on('listening',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  for(const width of [360,1440])await t.test(`${width}px`,async()=>{
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>sessionStorage.setItem('chaps-auth-v1','1'));
   await page.route('https://www.gstatic.com/firebasejs/**',r=>r.abort());await page.goto(`http://127.0.0.1:${server.address().port}`);
   assert.equal(await page.locator('#character-welcome').isVisible(),true);assert.equal(await page.evaluate(()=>state.backstory),'');
   await page.evaluate(()=>{
    window.CHAPS_CLOUD={userInfo:()=>({uid:'builder-owner',email:'test@example.com',providers:['google.com']}),changed(){},errorText:e=>e.message,async createCharacter(name,copy,spec){const data=CHARACTER_RULES.create(DEFAULT_STATE,{...spec,name});CHAPS_FEATURES.profiles.activate('builder-owner','c_'+crypto.randomUUID(),data);return{synced:true};}};
    CHAPS_FEATURES.render();
   });
   await page.locator('#welcome-create').click();await page.locator('#builder-name').fill('Borrador privado');await page.locator('#builder-cancel').click();await page.locator('#welcome-create').click();assert.equal(await page.locator('#builder-name').inputValue(),'Borrador privado');await page.locator('#builder-cancel').click();
   const classes=await page.evaluate(()=>CHARACTER_RULES.classes.map(c=>({id:c.id,es:c.es,die:c.die,gold:c.gold})));
   for(const c of classes){
    await page.locator('#character-create').click();await page.locator('#builder-name').fill(`Persona ${c.id}`);
    await page.locator('#builder-class').selectOption(c.id);await page.locator('#builder-species').selectOption('orc');await page.locator('#builder-background').selectOption('soldier');
    await page.locator('#builder-next').click();
    const eligible=await page.evaluate(id=>{const c=CHARACTER_RULES.classes.find(c=>c.id===id);return c.skills.filter(k=>!['athletics','intimidation'].includes(k)).slice(0,c.count);},c.id);
    for(const k of eligible)await page.locator(`input[name="builder-skill"][value="${k}"]`).check();
    if(c.id==='rogue')for(const k of eligible.slice(0,2))await page.locator(`input[name="builder-expertise"][value="${k}"]`).check();
    await page.locator('#builder-next').click();assert.equal(await page.locator('#builder-submit').isEnabled(),true,c.id);
    const box=await page.locator('#character-builder').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);
    if(c.id==='wizard'&&process.env.CHAPS_SCREENSHOTS)await page.screenshot({path:path.join(process.env.CHAPS_SCREENSHOTS,`builder-${width}.png`)});
    await page.locator('#builder-submit').click();await page.waitForFunction(id=>state.name===`Persona ${id}`,c.id);
    assert.equal(await page.evaluate(()=>state.identity.charClass),c.es);assert.equal(await page.evaluate(()=>state.currency.gp),c.gold+50);
    assert.match(await page.locator('#f-hitdice').textContent(),new RegExp('d'+c.die));
    assert.equal(await page.evaluate(()=>state.backstory),'');assert.equal(await page.evaluate(()=>state.masteryChoices.length),0);
    if(c.id==='fighter'){
      await page.locator('#section-class details').first().locator('summary').click();await page.locator('#character-shop-item').selectOption('longsword');await page.locator('#character-shop-buy').click();
      assert.equal(await page.evaluate(()=>state.currency.gp),190);assert.equal(await page.evaluate(()=>state.weapons[0].weaponId),'longsword');
      assert.equal(await page.locator('#mastery-3').count(),1);
    }
   }
   await page.locator('#section-class details').nth(1).locator('summary').click();await page.locator('#character-spell-quick').selectOption('magicMissile');await page.locator('#character-spell-form button').click();
   assert.equal(await page.evaluate(()=>state.spellbook[0].rulesSpellId),'magicMissile');
   await page.locator('.tab-btn[data-tab="combat"]').click();
   await page.evaluate(()=>{combat.enemies=[spawnEnemy('orc')];combat.enemies[0].maxHp=1000;const old=rollDie;rollDie=()=>10;try{startCombat();}finally{rollDie=old;}});
   await page.locator('#character-magic-panel summary').click();await page.locator('#character-cast').click();
   assert.equal(await page.evaluate(()=>state.spellSlotsSpent['1']),1);assert.equal(await page.evaluate(()=>combat.p.action),false);assert.equal(await page.evaluate(()=>combat.enemies[0].hp<1000),true);
   assert.match(await page.locator('#character-cast-status').textContent(),/resuelto/);
   assert.deepEqual(errors,[]);await context.close();
  });
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
