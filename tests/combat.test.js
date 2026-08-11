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
const victoria=combat.enemies.every(x=>x.hp<=0);
console.log("resultado:",victoria?"victoria CHAPS":"derrota","| PG jugador:",combat.p.hp);
console.log(combat.log.slice(-6).map(l=>l.html.replace(/<[^>]+>/g,"")).join(" || "));
`;
vm.runInContext(src + test, ctx);
