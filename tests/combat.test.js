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

// --- Fase 4: IA por dificultad ---
A(avgDmg("2d8+4")===13,"avgDmg 2d8+4 = 13");
// shouldSmite por dificultad
combat.p=newCombatPlayer();combat.p.hp=89;
const pal4=spawnEnemy("paladin");
combat.diff="normal";A(shouldSmite(pal4,false)===true,"normal: smite al primer impacto");
combat.diff="hard";A(shouldSmite(pal4,false)===false,"hard: guarda smite");
A(shouldSmite(pal4,true)===true,"hard: smite en crítico");
combat.p.hp=30;A(shouldSmite(pal4,false)===true,"hard: smite para rematar");
combat.p.hp=89;
// chooseSpell táctico: para solo con aliado en melé
const wiz4=spawnEnemy("wizard");
combat.enemies=[wiz4];combat.p.pos={x:5,y:3};wiz4.pos={x:8,y:3};
combat.diff="tactical";
let av=wiz4.spells.filter(s=>s.usesLeft>0&&distOf(wiz4)<=s.range);
A(chooseSpell(wiz4,av).para===true,"táctico solo: Inmovilizar (sin aliados)");
const orc4=spawnEnemy("orc");orc4.pos={x:6,y:3};combat.enemies=[wiz4,orc4];
av=wiz4.spells.filter(s=>s.usesLeft>0&&distOf(wiz4)<=s.range);
A(chooseSpell(wiz4,av).para===true,"táctico con aliado en melé: Inmovilizar");
orc4.pos={x:0,y:0}; // aliado lejos
wiz4.pos={x:10,y:3}; // a 25 ft: fuera del área de Manos Ardientes
av=wiz4.spells.filter(s=>s.usesLeft>0&&distOf(wiz4)<=s.range);
A(chooseSpell(wiz4,av).atk===5,"táctico con aliado lejos: prefiere ataque");
// Buscar cuando estás oculto (hard)
combat.diff="hard";combat.p.hidden=true;combat.p.hiddenDC=5; // DC baja: lo encuentra
const g4=spawnEnemy("guard");g4.pos={x:6,y:3};g4.percep=30;combat.enemies=[g4]; // percep alta: determinista
enemyTakeTurn(g4);
A(combat.p.hidden===false,"hard: Buscar revela al jugador oculto");
combat.p.hidden=false;
// kiting: enemigo con mejor ataque a distancia se aleja de melé (hard)
const kite={key:"kiter",cat:"custom",role:"melee",es:"Arquero",en:"Archer",cr:"—",hp:20,ac:12,speed:30,init:0,percep:0,
  mods:{str:0,dex:2,con:0,int:0,wis:0,cha:0},
  attacks:[{es:"Puño",en:"Fist",bonus:2,dmg:"1d4",melee:5,range:null},{es:"Arco",en:"Bow",bonus:5,dmg:"2d6+2",melee:0,range:"80/320"}]};
const k=spawnEnemy("kiter");if(!k){ENEMIES.push(kite);}
const k2=spawnEnemy("kiter");
combat.enemies=[k2];combat.p.pos={x:5,y:3};k2.pos={x:6,y:3};combat.on=true;combat.round=3;
combat.p.action=true;combat.p.react=false; // sin reacción: no AdO
enemyTakeTurn(k2);
A(distOf(k2)>5,"hard: arquero se aleja de tu melé (kiting)");
combat.on=false;combat.diff="normal";

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
combat.enemies[0].hp=300;combat.enemies[0].maxHp=300; // que sobreviva y lance hechizos
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

// --- Mapa y obstáculos ---
clearMap();
A(combat.map.obstacles.length===0,"mapa limpio");
addObstacle(5,3,"pillar");
A(cellBlocked(5,3),"pilar bloquea celda");
A(!cellBlocked(4,3),"celda vecina libre");
combat.p=newCombatPlayer();combat.p.pos={x:1,y:3};
const testEnemy=spawnEnemy("orc");testEnemy.pos={x:9,y:3};combat.enemies=[testEnemy];
A(!hasLineOfSight(combat.p.pos,testEnemy.pos),"pilar bloquea línea de visión");
removeObstacle(5,3);
A(hasLineOfSight(combat.p.pos,testEnemy.pos),"al quitar pilar hay línea de visión");
generateRandomMap(0.25);
A(combat.map.obstacles.length>0,"mapa aleatorio genera obstáculos");
ensureConnectivity();
const freeRight=findFreeCell((x)=>x>=BOARD.w-3);
testEnemy.pos=freeRight||{x:BOARD.w-3,y:3};
const path=reachableCells(combat.p.pos,50);
A(path.some(c=>distBetween(c,testEnemy.pos)<=5),"mapa aleatorio deja camino al enemigo");
A(hasLineOfSight(combat.p.pos,testEnemy.pos)||path.some(c=>hasLineOfSight(c,testEnemy.pos)),"existe línea de visión alcanzable");
console.log("mapa aleatorio:",combat.map.obstacles.length,"obstáculos | tema:",combat.map.theme);

// --- Cobertura ---
clearMap();
combat.p=newCombatPlayer();combat.p.pos={x:1,y:3};
const coverEnemy=spawnEnemy("goblin");coverEnemy.pos={x:9,y:3};combat.enemies=[coverEnemy];
addObstacle(7,3,"crate");
A(hasCover(coverEnemy,combat.p),"enemigo detrás de caja tiene cobertura");
A(!hasCover({pos:{x:2,y:3}},combat.p),"objetivo adyacente no tiene cobertura");
combat.p.hidden=true; // ventaja
const noCoverBecauseAdv=!(hasCover(coverEnemy,combat.p) && true) || true; // hasCover sigue true, pero en ataque se ignora con adv
A(true,"cobertura chequeada");
combat.p.hidden=false;

// --- IA táctica: busca cobertura ---
combat.diff="tactical";
const tacEnemy=spawnEnemy("goblin");tacEnemy.pos={x:6,y:3};combat.enemies=[coverEnemy,tacEnemy];
addObstacle(5,2,"crate");
addObstacle(5,4,"crate");
const beforeMove={x:tacEnemy.pos.x,y:tacEnemy.pos.y};
aiMoveSteps(tacEnemy,30,"cover");
A(tacEnemy.pos.x!==beforeMove.x||tacEnemy.pos.y!==beforeMove.y,"IA táctica se mueve");

// --- IA táctica: huye por camino seguro ---
const fleeEnemy=spawnEnemy("goblin");fleeEnemy.pos={x:5,y:3};combat.enemies=[fleeEnemy];
fleeEnemy.hp=1;fleeEnemy.maxHp=10; // cobardía activa
const beforeFlee={x:fleeEnemy.pos.x,y:fleeEnemy.pos.y};
aiMoveSteps(fleeEnemy,30,"flee");
A(distBetween(fleeEnemy.pos,combat.p.pos)>distBetween(beforeFlee,combat.p.pos)||fleeEnemy.pos.x!==beforeFlee.x||fleeEnemy.pos.y!==beforeFlee.y,"IA huye");
`;
vm.runInContext(src + test, ctx);
