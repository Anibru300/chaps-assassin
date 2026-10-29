const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({structuredClone});
for(const name of ['data','character-rules'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+name+'.js'),'utf8'),context);
const rules=context.CHARACTER_RULES,base=vm.runInContext('structuredClone(DEFAULT_STATE)',context);
function spec(id,level=1){const c=rules.classes.find(c=>c.id===id),bg=rules.backgrounds.find(b=>b.id==='soldier');const skills=c.skills.filter(s=>!bg.skills.includes(s)).slice(0,c.count);return {name:'Aventura',classId:id,speciesId:'orc',backgroundId:'soldier',level,subclass:level>=3?'Subclase elegida':'',method:'standard',abilities:{str:15,dex:14,con:13,int:12,wis:10,cha:8},boosts:{str:2,dex:1},skills,expertise:id==='rogue'?[...skills,...bg.skills].slice(0,level>=6?4:2):[],rogueLanguage:'Draconic',languages:['Común','Élfico','Enano']};}
test('doce clases crean ficha independiente con PG, salvaciones y oro correctos',()=>{
 for(const c of rules.classes)for(const level of [1,5,20]){
  const input=spec(c.id,level);assert.equal(rules.validate(input).length,0,c.id);
  const data=rules.create(base,input);rules.validateState(data);
  assert.equal(data.hpMax,c.die+1+(level-1)*(c.die/2+2));
  assert.equal(data.currency.gp,c.gold+50);assert.equal(data.identity.charClass,c.es);
  assert.deepEqual(Object.keys(data.saveProfs).filter(k=>data.saveProfs[k]),[...c.saves].sort((a,b)=>rules.abilities.indexOf(a)-rules.abilities.indexOf(b)));
  assert.equal(data.backstory,'');assert.equal(data.masteryChoices.length,0);assert.equal(data.weapons.length,1);assert.equal(data.weapons[0].weaponId,'unarmed');assert.equal(data.languages.includes('Jerga de ladrones'),c.id==='rogue');
 }
 assert.equal(base.name,'CHAPS');assert.equal(base.level,12);
});
test('vacío neutral no contiene retrato, inventario, competencias ni texto de CHAPS',()=>{
 const data=rules.blank(base);assert.equal(data.identity.charClass,'');assert.equal(data.name,'Nuevo personaje');assert.equal(data.currency.gp,0);assert.equal(data.weapons.length,0);assert.equal(data.backstory,'');assert.equal(Object.values(data.skills).some(s=>s.p||s.e),false);
});
test('Humano aplica dote adicional; Pícaro conoce idioma adicional y Jerga',()=>{
 const input=spec('rogue');input.speciesId='human';input.speciesSkill='perception';input.originFeat='tough';
 const data=rules.create(base,input);assert.equal(data.hpMax,11);assert.equal(data.languages.length,5);assert.equal(data.feats.length,2);assert.equal(data.skills.perception.p,true);
 input.speciesSkill=input.skills[0];assert.ok(rules.validate(input).some(s=>s.includes('sin repetir')));
});
test('especie y trasfondo personalizados requieren elecciones explícitas',()=>{
 const input=spec('wizard');Object.assign(input,{speciesId:'custom',speciesName:'Aasimar de campaña',backgroundId:'custom',backgroundName:'Ermitaño',backgroundSkills:['insight','religion'],backgroundFeat:'healer'});
 const data=rules.create(base,input);assert.equal(data.identity.species,'Aasimar de campaña');assert.equal(data.skills.religion.p,true);assert.equal(data.feats[0].featId,'healer');
 input.backgroundSkills=['insight','insight'];assert.ok(rules.validate(input).some(s=>s.includes('Trasfondo personalizado')));
});
test('creación rechaza repartos, aumentos y habilidades inválidos',()=>{
 const input=spec('fighter');input.abilities.str=20;assert.ok(rules.validate(input).some(s=>s.includes('Reparte')));
 input.method='points';assert.ok(rules.validate(input).some(s=>s.includes('Compra')));
 input.method='manual';input.boosts={cha:2,int:1};assert.ok(rules.validate(input).some(s=>s.includes('Trasfondo')));
 input.boosts={str:2,dex:1};input.skills=['athletics','athletics'];assert.ok(rules.validate(input).some(s=>s.includes('habilidades')));
 assert.throws(()=>rules.create(base,input));
});
test('espacios por clase, pacto y recuperación de descansos',()=>{
 const wizard=rules.create(base,spec('wizard',5));assert.equal(JSON.stringify(rules.spellSlots(wizard)),JSON.stringify([{level:1,max:4,pact:false},{level:2,max:3,pact:false},{level:3,max:2,pact:false}]));
 const ranger=rules.create(base,spec('ranger'));assert.equal(rules.spellSlots(ranger)[0].max,2);
 const warlock=rules.create(base,spec('warlock',5));assert.equal(rules.spellSlots(warlock)[0].level,3);assert.equal(rules.spellSlots(warlock)[0].max,2);
 wizard.spellSlotsSpent={1:2};rules.recharge(wizard,'short');assert.equal(wizard.spellSlotsSpent[1],2);rules.recharge(wizard,'long');assert.equal(Object.keys(wizard.spellSlotsSpent).length,0);
 warlock.spellSlotsSpent={pact:1};rules.recharge(warlock,'short');assert.equal(Object.keys(warlock.spellSlotsSpent).length,0);
});
test('arma usa característica, competencia y ajuste manual propios',()=>{
 const data=rules.create(base,spec('rogue'));data.abilities.str=18;data.abilities.dex=14;
 assert.equal(rules.weapon(data,{weaponId:'rapier',bonus:5}).attack,6);
 assert.equal(rules.weapon(data,{weaponId:'longbow',bonus:5}).attack,2);
 assert.equal(rules.weapon(data,{weaponId:'longbow',bonus:5,proficient:true}).attack,4);
 assert.equal(rules.weapon(data,{weaponId:'dagger',bonus:7}).damage,7);
 assert.equal(rules.weapon(data,{weaponId:'dagger',bonus:7,autoBonus:true}).damage,4);
 const monk=rules.create(base,spec('monk'));monk.abilities.dex=18;assert.equal(rules.weapon(monk,monk.weapons[0]).ability,'dex');
});
test('ataque extra y Asesino dependen de clase y nivel, no de nombre',()=>{
 const fighter=rules.create(base,spec('fighter',20));assert.equal(rules.attacks(fighter),4);assert.equal(rules.isAssassin(fighter),false);fighter.identity.subclass='Asesino';assert.equal(rules.isAssassin(fighter),false);
 const rogue=rules.create(base,spec('rogue',3));rogue.identity.subclass='Asesino';assert.equal(rules.isAssassin(rogue),true);assert.equal(rules.attacks(rogue),1);
});
test('datos nuevos inválidos se rechazan antes de subir a nube',()=>{
 const data=rules.create(base,spec('wizard'));data.spellbook=[{name:'inválido',level:99}];assert.throws(()=>rules.validateState(data));data.spellbook=[];data.resources={r:{name:'Recurso',max:2,spent:3,recharge:'long'}};assert.throws(()=>rules.validateState(data));
});
module.exports={rules,base,spec};
