const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(id,level=5){
  const storage=new Map();
  const ctx=vm.createContext({structuredClone,console,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null},setTimeout:()=>0,clearTimeout(){}});
  const run=code=>vm.runInContext(code,ctx);run('window=globalThis;');
  for(const name of ['data','character-rules','character-equipment','app','combat-data','combat','character-magic'])run(fs.readFileSync(path.join(__dirname,'../js/'+name+'.js'),'utf8'));
  run(`const c=CHARACTER_RULES.classes.find(c=>c.id===${JSON.stringify(id)});
    state=CHARACTER_RULES.create(DEFAULT_STATE,{name:'Prueba',classId:c.id,speciesId:'orc',backgroundId:'soldier',level:${level},subclass:'Elegida',method:'standard',abilities:{str:15,dex:14,con:13,int:12,wis:10,cha:8},boosts:{str:2,dex:1},skills:c.skills.filter(k=>!['athletics','intimidation'].includes(k)).slice(0,c.count),expertise:c.id==='rogue'?c.skills.filter(k=>!['athletics','intimidation'].includes(k)).slice(0,${level}>=6?4:2):[],rogueLanguage:'Draconic',languages:['Común','Élfico','Enano']});
    renderCombat=flashSaved=()=>{};window.CHARACTER_UI={render(){}};
    combat.quiet=true;combat.on=true;combat.round=1;combat.turn=0;combat.order=[{who:'p'}];combat.p=newCombatPlayer();combat.p.pos={x:1,y:1};combat.enemies=[spawnEnemy('orc')];combat.enemies[0].pos={x:2,y:1};combat.enemies[0].hp=combat.enemies[0].maxHp=1000;combat.stats={dmg:0,taken:0,hits:0,crits:0};
    rollDie=sides=>sides===20?20:3;`);
  return {run,ctx,storage};
}
test('Guerrero N5 hace dos ataques sin Furtivo ni Asesinar; no recibe Esquiva gratuita',()=>{
  const {run}=setup('fighter');
  run(`const w={name:'Espada larga',weaponId:'longsword',dice:1,sides:8,bonus:0,autoBonus:true,props:'',mastery:''};`);
  assert.equal(run('playerAttack(w,combat.enemies[0],{ally:true,strikes:[]})'),true);
  assert.equal(run('combat.p.action'),true);assert.equal(run('combat.enemies[0].hp'),991);
  assert.equal(run('playerAttack(w,combat.enemies[0],{ally:true,strikes:[]})'),true);
  assert.equal(run('combat.p.action'),false);assert.equal(run('combat.enemies[0].hp'),982);
  assert.equal(run('playerAttack(w,combat.enemies[0],{})'),false);assert.equal(run('combat.p.ba'),true);
  assert.equal(run('combat.log.some(row=>/Furtivo|Asesinar/.test(row.html))'),false);
  assert.equal(run('playerBonus("steady")'),false);
});
test('Ocultar de Mago gasta acción; Pícaro N2 gasta adicional',()=>{
  const mage=setup('wizard');mage.run('playerBonus("hide")');assert.equal(mage.run('combat.p.action'),false);assert.equal(mage.run('combat.p.ba'),true);
  const rogue=setup('rogue',2);rogue.run('playerBonus("hide")');assert.equal(rogue.run('combat.p.action'),true);assert.equal(rogue.run('combat.p.ba'),false);
});
test('Mago no gana ventaja de primera ronda ni competencias de salvación de Pícaro',()=>{
  const {run}=setup('wizard');run('let dice20=0;rollDie=sides=>sides===20?(++dice20===1?3:20):1;combat.enemies[0].ac=50;');
  assert.equal(run('playerAttack(state.weapons[0],combat.enemies[0],{})'),true);assert.equal(run('dice20'),1);assert.equal(run('combat.enemies[0].hp'),1000);
  run('rollDie=()=>10;');assert.equal(run('playerSave("dex",14)'),false);assert.equal(run('playerSave("int",14)'),true);
});
test('truco de Mago escala y duplica dados por crítico sin gastar espacio',()=>{
  const {run}=setup('wizard');run(`state.spellbook=[{id:'a',rulesSpellId:'fireBolt',name:'Descarga de fuego',level:0,details:'',prepared:true}];combat.enemies[0].pos={x:5,y:1};`);
  assert.equal(run('CHARACTER_MAGIC.cast("fireBolt",combat.enemies[0],0)'),true);
  assert.equal(run('combat.enemies[0].hp'),988);assert.equal(run('combat.p.action'),false);assert.equal(run('Object.keys(state.spellSlotsSpent).length'),0);
});
test('conjuro con espacio valida alcance antes de consumir; no permite segundo espacio en turno',()=>{
  const {run,storage}=setup('wizard',3);run(`state.spellbook=[{id:'a',rulesSpellId:'magicMissile',name:'Proyectil mágico',level:1,details:'',prepared:true}];combat.enemies[0].pos={x:999,y:1};`);
  assert.equal(run('CHARACTER_MAGIC.cast("magicMissile",combat.enemies[0],2)'),false);assert.equal(run('combat.p.action'),true);assert.equal(run('Object.keys(state.spellSlotsSpent).length'),0);
  run('combat.enemies[0].pos={x:5,y:1};');assert.equal(run('CHARACTER_MAGIC.cast("magicMissile",combat.enemies[0],2)'),true);assert.equal(run('combat.enemies[0].hp'),984);
  assert.equal(JSON.parse(storage.get('chaps-state-v1')).spellSlotsSpent['2'],1);
  run('combat.p.action=true;');assert.equal(run('CHARACTER_MAGIC.cast("magicMissile",combat.enemies[0],1)'),false);
});
test('curación adicional de Bardo conserva acción y respeta límite de un espacio',()=>{
  const {run}=setup('bard',3);run(`combat.p.hp=1;state.spellbook=[{id:'a',rulesSpellId:'healingWord',name:'Palabra',level:1,details:'',prepared:true},{id:'b',rulesSpellId:'cureWounds',name:'Curar',level:1,details:'',prepared:true}];`);
  assert.equal(run('CHARACTER_MAGIC.cast("healingWord",null,1)'),true);assert.equal(run('combat.p.hp'),6);assert.equal(run('combat.p.action'),true);assert.equal(run('combat.p.ba'),false);assert.equal(run('CHARACTER_MAGIC.cast("cureWounds",null,1)'),false);
});
test('compra descuenta monedas; equipar armadura y escudo calcula CA',()=>{
  const {run}=setup('fighter',1);
  run(`CHARACTER_EQUIPMENT.purchase(state,'chainMail');CHARACTER_EQUIPMENT.purchase(state,'shield');CHARACTER_EQUIPMENT.purchase(state,'longsword');CHARACTER_EQUIPMENT.equip(state,0,true);CHARACTER_EQUIPMENT.equip(state,1,true);`);
  assert.equal(run('state.currency.gp'),105);assert.equal(run('state.ac'),18);assert.equal(run('state.weapons[0].weaponId'),'longsword');assert.equal(run('weaponStats(state.weapons[0]).attack'),5);
  assert.throws(()=>run(`CHARACTER_EQUIPMENT.purchase(state,'plate')`));assert.equal(run('state.currency.gp'),105);
});
test('Mago con armadura sin entrenamiento no lanza conjuros ni gasta recursos',()=>{
  const {run}=setup('wizard');run(`CHARACTER_EQUIPMENT.purchase(state,'leather');CHARACTER_EQUIPMENT.equip(state,0,true);state.spellbook=[{id:'a',rulesSpellId:'magicMissile',name:'Proyectil',level:1,details:'',prepared:true}];`);
  assert.equal(run('CHARACTER_MAGIC.cast("magicMissile",combat.enemies[0],1)'),false);assert.equal(run('combat.p.action'),true);assert.equal(run('Object.keys(state.spellSlotsSpent).length'),0);
});
test('subir nivel actualiza PG fijos; ajustes manuales quedan intactos',()=>{
  const {run}=setup('fighter',1);run('state.hpCurrent=5;state.level=5;CHARACTER_RULES.recalculate(state,CHARACTER_EQUIPMENT.armorClass);');assert.equal(run('state.hpMax'),39);assert.equal(run('state.hpCurrent'),33);
  run('state.creation.autoHp=false;state.hpMax=99;state.level=6;CHARACTER_RULES.recalculate(state,CHARACTER_EQUIPMENT.armorClass);');assert.equal(run('state.hpMax'),99);
});
test('registro de combate conserva formato permitido y neutraliza etiquetas activas',()=>{
 const {run}=setup('wizard');assert.equal(run(`safeCombatMarkup('<strong>ok</strong><img src=x onerror=alert(1)>').includes('<img')`),false);assert.equal(run(`safeCombatMarkup('<strong>ok</strong>')`),'<strong>ok</strong>');
});
