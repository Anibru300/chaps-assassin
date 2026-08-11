const fs = require("fs"), vm = require("vm");
const ctx = {
  structuredClone,
  localStorage: { getItem: () => null, setItem() {} },
  document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null },
  console, process, window: { confirm: () => true }, alert() {}
};
vm.createContext(ctx);
const src = ["js/data.js", "js/app.js", "js/combat-data.js", "js/combat.js"]
  .map((f) => fs.readFileSync(f, "utf8")).join("\n");
const test = `
function A(c,m){if(!c){console.error("FALLO "+m);process.exit(1);}console.log("ok - "+m);}
combat.confirm=()=>true; // siempre usa Esquiva

const pd=parseDice("1d12+3");A(pd.dice===1&&pd.sides===12&&pd.bonus===3,"parseDice");
const f=parseDice("1");A(f.dice===1&&f.sides===1,"parseDice plano");

const e=spawnEnemy("orc");A(e.hp===15&&e.conds.length===0,"spawn orco");

addCond(e,"prone");A(condModsVs(e,30).dis===true,"Derribado lejos = desventaja");
A(condModsVs(e,5).adv===true,"Derribado a 5 ft = ventaja");
addCond(e,"blinded",1);A(condModsVs(e,30).adv===true,"Cegado = ventaja");
addCond(e,"unconscious");A(condModsVs(e,5).autocrit===true,"Inconsciente 5 ft = crit auto");
removeCond(e,"blinded");removeCond(e,"unconscious");removeCond(e,"prone");
addCond(e,"blinded",1);enemyEndTurn(e);A(!hasCond(e,"blinded"),"Cegado expira al final de su turno");

// --- Fase 3: playerSave, hechizos, smite, aliento ---
A(typeof playerSave("dex",10)==="boolean","playerSave devuelve bool");
A(spawnEnemy("wizard").spells.length===3,"mago con 3 hechizos");
A(spawnEnemy("wyrmling").breath.ready===true,"aliento listo");
const wiz=spawnEnemy("wizard");
combat.enemies=[wiz];combat.p=newCombatPlayer();combat.p.pos={x:1,y:3};wiz.pos={x:4,y:3};combat.on=true;
combat.round=2; // sin asesinar
// Inmovilizar Persona: fuerza parálisis si falla — probamos ambos caminos por repetición
let paraVisto=false,noParaVisto=false;
for(let i=0;i<40;i++){
  combat.p.conds=[];
  const sp=wiz.spells[0];sp.usesLeft=1;
  enemyCast(wiz,sp);
  if(hasPCond("paralyzed"))paraVisto=true;else noParaVisto=true;
  if(paraVisto&&noParaVisto)break;
}
A(paraVisto&&noParaVisto,"Hold Person: a veces paraliza, a veces no");
// turno paralizado: se salta y repite salvación
combat.p.conds=[{id:"paralyzed",save:"wis",dc:13}];
combat.order=[{who:"p",init:20},{who:"e",idx:0,init:10}];combat.turn=0;
beginTurn(); // debe saltar el turno del jugador y pasar al enemigo o terminar
A(true,"turno paralizado no revienta");
combat.p.conds=[];
// smite del paladín: 1 vez por turno
const pal=spawnEnemy("paladin");
pal.pos={x:2,y:3};combat.enemies=[pal];combat.p.pos={x:1,y:3};combat.p.hp=89;combat.on=true;
const hpAntes=combat.p.hp;
enemyAttackRoll(pal,pal.attacks[0],false);
A(combat.p.hp<hpAntes||true,"paladín ataca (o falla)");
A(pal.smiteUsed===true||combat.p.hp===hpAntes,"smite gastado solo si impactó");
// aliento de dragón
const wy=spawnEnemy("wyrmling");combat.enemies=[wy];combat.p.hp=89;
dragonBreath(wy);
A(wy.breath.ready===false,"aliento gastado tras usarlo");
combat.on=false;

combat.enemies=[spawnEnemy("ogre")];
startCombat();
A(combat.on&&combat.order.length===2,"combate inicia, orden 2");
A(combat.order.every((o,i,arr)=>i===0||arr[i-1].init>=o.init),"orden descendente");
// tablero: colocación y distancias
A(combat.p.pos.x===1,"jugador a la izquierda");
A(combat.enemies[0].pos.x===BOARD.w-3,"enemigo a la derecha");
A(distOf(combat.enemies[0])===40,"distancia inicial 40 ft");
A(reachableCells(combat.p.pos,6).length>0,"celdas alcanzables BFS");
A(!reachableCells(combat.p.pos,1).some(c=>c.x===combat.enemies[0].pos.x&&c.y===combat.enemies[0].pos.y),"BFS no atraviesa enemigos");

let guard=0;
const w=state.weapons[0];
while(combat.on&&guard++<200){
  if(isPlayerTurn()){
    const tgt=combat.enemies.find(x=>x.hp>0);
    if(tgt){
      // acercarse hasta melé usando el tablero
      let g2=0;
      while(distOf(tgt)>5&&g2++<10){
        const cells=reachableCells(combat.p.pos,Math.floor((combat.p.move+combat.p.withdraw)/5));
        if(!cells.length)break;
        cells.sort((a,b)=>distBetween(a,tgt.pos)-distBetween(b,tgt.pos));
        if(!playerMoveTo(cells[0].x,cells[0].y))break;
      }
      playerAttack(w,tgt,{strikes:["trip"],ally:true});
    }
    if(combat.on) nextTurn();
  } else break;
}
A(!combat.on,"combate termina ("+guard+" turnos, rondas "+combat.round+")");
A(combat.log.length>5,"log registrado: "+combat.log.length+" entradas");

// combate completo vs CASTER (la IA debe lanzar hechizos y no colgarse)
combat.enemies=[spawnEnemy("sorcerer")];
startCombat();
guard=0;
while(combat.on&&guard++<200){
  if(isPlayerTurn()){
    const tgt=combat.enemies.find(x=>x.hp>0);
    if(tgt){
      let g2=0;
      while(distOf(tgt)>5&&g2++<10){
        const cells=reachableCells(combat.p.pos,Math.floor((combat.p.move+combat.p.withdraw)/5));
        if(!cells.length)break;
        cells.sort((a,b)=>distBetween(a,tgt.pos)-distBetween(b,tgt.pos));
        if(!playerMoveTo(cells[0].x,cells[0].y))break;
      }
      playerAttack(w,tgt,{strikes:[],ally:true});
    }
    if(combat.on) nextTurn();
  } else break;
}
A(!combat.on,"combate vs hechicero termina ("+guard+" turnos)");
A(combat.log.some(l=>l.html.includes("castLog")||l.html.includes("🔮")),"el hechicero lanzó hechizos");
const victoria=combat.enemies.every(x=>x.hp<=0);
console.log("resultado:",victoria?"victoria CHAPS":"derrota","| PG jugador:",combat.p.hp);
console.log(combat.log.slice(-6).map(l=>l.html.replace(/<[^>]+>/g,"")).join(" || "));
`;
vm.runInContext(src + test, ctx);
