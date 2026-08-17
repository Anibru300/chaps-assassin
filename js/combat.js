/* ============================================================
   CHAPS — Motor de combate D&D 2024 (FASE 1)
   combat.js — Motor puro (turnos, condiciones, salvaciones, IA
   básica) + UI de la pestaña Combate.
   Sin módulos: reutiliza utilidades globales de app.js.
   ============================================================ */

"use strict";

/** Textos del motor según idioma. */
function ct(key) { return (CT[LANG] && CT[LANG][key]) || CT.es[key] || key; }

/** Parsea "2d8+4" → {dice, sides, bonus}. */
function parseDice(str) {
  const m = String(str).match(/(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?/);
  if (m) return { dice: +m[1], sides: +m[2], bonus: m[3] ? parseInt(m[3].replace(/\s/g, ""), 10) : 0 };
  const flat = parseInt(str, 10);
  return { dice: 1, sides: 1, bonus: isNaN(flat) ? 0 : flat - 1 }; // "1" → 1d1 = 1
}

/** Tira una expresión de dados; devuelve {total, rolls, bonus}. */
function rollDiceExpr(str, doubleDice) {
  const d = parseDice(str);
  const n = doubleDice ? d.dice * 2 : d.dice;
  const rolls = rollDice(n, d.sides);
  return { total: sum(rolls) + d.bonus, rolls, bonus: d.bonus, dice: n, sides: d.sides };
}

/* ================= ESTADO DEL COMBATE ================= */
const combat = {
  on: false,
  round: 1,
  order: [],      // [{ who: "p" } | { who: "e", idx }]
  turn: 0,
  enemies: [],    // instancias
  p: null,        // combatiente jugador
  log: [],        // [{cls, html}]
  diff: "normal", // easy | normal | hard | tactical (Fase 4)
  confirm: null,  // inyectable (UI: window.confirm); tests lo sustituyen
  map: { theme: "stone", obstacles: [] } // terreno del tablero
};

/** Golpes Astutos: coste, nivel y característica de salvación. */
const STRIKES = [
  { id: "poison",   cost: 1, lock: 5,  save: "con" },
  { id: "trip",     cost: 1, lock: 5,  save: "dex" },
  { id: "withdraw", cost: 1, lock: 5,  save: null  },
  { id: "daze",     cost: 2, lock: 14, save: "con" },
  { id: "knockout", cost: 6, lock: 14, save: "con" },
  { id: "obscure",  cost: 3, lock: 14, save: "dex" }
];

function newCombatPlayer() {
  return {
    hp: state.hpCurrent, move: state.speed,
    action: true, ba: true, react: true,
    sneak: false, hidden: false, diseng: false, steady: false, withdraw: 0,
    conds: [],        // [{id, save, dc}] condiciones del jugador (Fase 3)
    vexTarget: null,  // Vex: próximo ataque contra este enemigo con ventaja (Fase 5)
    nickReady: false, // Ligera: ataque extra disponible (Fase 5)
    nickFree: false,  // Nick dominado: el ataque extra no gasta acción adicional
    ac: state.ac,
    pos: { x: 1, y: 3 } // posición en el tablero (Fase 2)
  };
}

function hasPCond(id) { return combat.p && combat.p.conds.some((c) => c.id === id); }
function getPCond(id) { return combat.p.conds.find((c) => c.id === id); }
function removePCond(id) { combat.p.conds = combat.p.conds.filter((c) => c.id !== id); }

/** Daño medio de una expresión (para decisiones de la IA). */
function avgDmg(str) { const d = parseDice(str); return d.dice * (d.sides + 1) / 2 + d.bonus; }

/** ¿El paladín usa Castigo? Según dificultad: normal = al primer impacto;
 *  hard/táctico = solo en crítico o para rematar (jugador < 40% PG). */
function shouldSmite(e, crit) {
  if (!e.smite || e.smiteUsed) return false;
  if (combat.diff === "easy" || combat.diff === "normal") return true;
  return crit || combat.p.hp <= state.hpMax * 0.4;
}

/** Elección de hechizo del caster según dificultad (IA explicable). */
function chooseSpell(e, avail) {
  const para = avail.find((s) => s.para && !hasPCond("paralyzed"));
  const area = avail.find((s) => s.save && s.range <= 15 && distOf(e) <= s.range);
  const bolt = avail.find((s) => s.atk != null);
  const anySave = avail.find((s) => s.save);
  if (combat.diff === "easy") return bolt || area || anySave || para; // simple: daño primero
  if (combat.diff === "normal") return para || area || bolt || anySave;
  // hard/táctico: Inmovilizar solo si un aliado está en melé contigo (autocríticos),
  // si está solo, o (hard) a partir de la 2ª ronda
  const allies = combat.enemies.filter((x) => x !== e && x.hp > 0);
  const allyClose = allies.some((a) => distBetween(a.pos, combat.p.pos) <= 5);
  const wantPara = para && (allyClose || !allies.length || (combat.diff === "hard" && combat.round >= 2));
  if (wantPara) {
    cLog(`🧠 ${eName(e)}: ${allyClose ? "aliado en melé → Inmovilizar para autocríticos" : "sin aliados → control"}`, "log-info");
    return para;
  }
  return area || bolt || anySave || para;
}

/** Salvación de un objetivo del jugador: el jugador real usa su ficha; un proxy (IA vs IA) usa sus mods. */
function targetSave(tc, ability, dc) {
  if (tc.proxy) {
    const mod = tc.mods ? (tc.mods[ability] || 0) : 0;
    const r = rollDie(20);
    return r + mod >= dc;
  }
  return playerSave(ability, dc);
}

/** Salvación del jugador (competencia en DES/INT; SAB/CAR desde N15). */
function playerSave(ability, dc) {
  const prof = ability === "dex" || ability === "int" ||
    (state.level >= 15 && (ability === "wis" || ability === "cha"));
  const mod = abilityMod(state.abilities[ability]) + (prof ? profBonus(state.level) : 0);
  const r = rollDie(20);
  const ok = r + mod >= dc;
  cLog(`🎲 ${ct("saveYou")} ${ability.toUpperCase()}: ${r} ${fmtMod(mod)} = ${r + mod} vs CD ${dc} → <strong>${ok ? ct("savePass") : ct("saveFail")}</strong>`, ok ? "log-info" : "log-miss");
  return ok;
}

function spawnEnemy(key) {
  const tpl = ENEMIES.find((x) => x.key === key);
  if (!tpl) return null;
  const e = structuredClone(tpl);
  e.maxHp = tpl.hp;
  e.smiteUsed = false;                        // paladín: 1 castigo por turno
  if (e.breath) e.breath.ready = true;        // dragón: aliento listo
  if (e.spells) e.spells.forEach((s) => { s.usesLeft = s.uses; });
  e.pos = { x: 0, y: 0 }; // se coloca al iniciar el combate
  e.conds = [];       // [{id, expire}] expire: nº de SUS turnos restantes (condiciones con duración)
  e.acted = false;    // para Asesinar (1ª ronda)
  e.react = true;
  e.strategy = e.strategy || "closest";
  return e;
}

/** Crea un enemigo "custom" a partir de los datos de la Biblioteca (SRD 2024). */
function addEnemyFromLibrary(data) {
  const name = data.name || "Enemigo";
  const key = "lib" + Date.now();
  const attacks = Array.isArray(data.attacks) && data.attacks.length
    ? data.attacks
    : [{ es: "Ataque", en: "Attack", bonus: data.bonus || 0, dmg: data.dmg || "1d6", melee: 5, range: null }];
  const tpl = {
    key, cat: "custom", role: "melee",
    es: name, en: name, cr: data.cr || "—",
    hp: Math.max(1, parseInt(data.hp, 10) || 10),
    ac: parseInt(data.ac, 10) || 12,
    speed: parseInt(data.speed, 10) || 30,
    init: typeof data.init === "number" ? data.init : (data.dex ? Math.floor((data.dex - 10) / 2) : 0),
    percep: data.pp || 0,
    mods: { str: 0, dex: data.dex || 0, con: 0, int: 0, wis: 0, cha: 0 },
    attacks
  };
  ENEMIES.push(tpl);
  const e = spawnEnemy(key);
  if (e) {
    combat.enemies.push(e);
    renderSetup();
    renderCombat();
  }
  return e;
}

/* ---------- Tablero (Fase 2): rejilla 12×8, casilla = 5 ft ---------- */
const BOARD = { w: 12, h: 8 };

/** Distancia en ft entre dos celdas (Chebyshev × 5, diagonales = 5 ft). */
function distBetween(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * 5; }

/** Distancia actual jugador-enemigo en ft. */
function distOf(e) { return distBetween(combat.p.pos, e.pos); }

/** ¿Hay un obstáculo en esta celda? */
function getObstacle(x, y) {
  return combat.map.obstacles.find((o) => o.x === x && o.y === y) || null;
}

/** ¿Celda bloqueada por obstáculo o borde? */
function cellBlocked(x, y) {
  if (x < 0 || y < 0 || x >= BOARD.w || y >= BOARD.h) return true;
  return !!getObstacle(x, y);
}

/** ¿Celda ocupada por jugador, enemigo vivo u obstáculo? */
function cellOccupied(x, y) {
  if (cellBlocked(x, y)) return true;
  if (combat.p && combat.p.pos.x === x && combat.p.pos.y === y) return true;
  return combat.enemies.some((e) => e.hp > 0 && e.pos.x === x && e.pos.y === y);
}

/** Celdas alcanzables en N pasos (5 ft c/u) sin atravesar ocupadas (BFS 8 direcciones). */
function reachableCells(from, steps) {
  const seen = new Set([from.x + "," + from.y]);
  const out = [];
  let frontier = [from];
  for (let s = 0; s < steps; s++) {
    const next = [];
    frontier.forEach((c) => {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const nx = c.x + dx, ny = c.y + dy, k = nx + "," + ny;
        if (nx < 0 || ny < 0 || nx >= BOARD.w || ny >= BOARD.h || seen.has(k)) continue;
        if (cellOccupied(nx, ny)) continue;
        seen.add(k);
        out.push({ x: nx, y: ny });
        next.push({ x: nx, y: ny });
      }
    });
    frontier = next;
  }
  return out;
}

/** Línea de visión digital: recorre celdas entre a y b; un obstáculo intermedio bloquea. */
function hasLineOfSight(a, b) {
  if (cellBlocked(a.x, a.y) || cellBlocked(b.x, b.y)) return false;
  let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    if (cellBlocked(x0, y0)) return false;
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

/** Encuentra la primera celda libre que cumpla un predicado. */
function findFreeCell(predicate) {
  for (let y = 0; y < BOARD.h; y++) for (let x = 0; x < BOARD.w; x++) {
    if (!cellOccupied(x, y) && predicate(x, y)) return { x, y };
  }
  return null;
}

/** Coloca jugador y enemigos en celdas libres al inicio del combate. */
function placeCombatants() {
  // Zona izquierda para el jugador (columnas 0–2); si no hay, cualquier celda libre
  const pPos = findFreeCell((x) => x <= 2) || findFreeCell(() => true) || { x: 1, y: Math.floor(BOARD.h / 2) };
  combat.p.pos = pPos;
  // Zona derecha para enemigos (columnas BOARD.w-3 en adelante), separados
  combat.enemies.forEach((e, i) => {
    const pos = findFreeCell((x, y) => x >= BOARD.w - 3 && !combat.enemies.some((other, j) =>
      j < i && other.pos.x === x && other.pos.y === y
    )) || findFreeCell(() => true);
    e.pos = pos || { x: BOARD.w - 3, y: Math.min(BOARD.h - 1, 1 + i * 2) };
  });
}

/** Limpia todos los obstáculos del mapa actual. */
function clearMap() { combat.map.obstacles = []; }

/** Añade un obstáculo si la celda está libre. */
function addObstacle(x, y, type) {
  if (cellBlocked(x, y)) return false;
  removeObstacle(x, y);
  combat.map.obstacles.push({ x, y, type });
  return true;
}

/** Quita un obstáculo de una celda. */
function removeObstacle(x, y) {
  combat.map.obstacles = combat.map.obstacles.filter((o) => o.x !== x || o.y !== y);
}

/** Genera obstáculos aleatorios respetando zonas de aparición. */
function generateRandomMap(density) {
  density = Math.max(0, Math.min(0.4, density == null ? 0.2 : density));
  clearMap();
  const themes = ["stone", "wood", "grass", "mosaic"];
  combat.map.theme = themes[Math.floor(Math.random() * themes.length)];
  const types = ["pillar", "crate", "barrel", "wall"];
  for (let y = 0; y < BOARD.h; y++) for (let x = 3; x < BOARD.w - 3; x++) {
    if (Math.random() < density) addObstacle(x, y, types[Math.floor(Math.random() * types.length)]);
  }
  ensureConnectivity();
}

/** BFS de camino más corto entre dos celdas libres. */
function bfsPath(from, to) {
  const start = from.x + "," + from.y, target = to.x + "," + to.y;
  if (start === target) return [from];
  const queue = [[from]];
  const seen = new Set([start]);
  while (queue.length) {
    const cur = queue.shift();
    const last = cur[cur.length - 1];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const nx = last.x + dx, ny = last.y + dy, k = nx + "," + ny;
      if (nx < 0 || ny < 0 || nx >= BOARD.w || ny >= BOARD.h || seen.has(k)) continue;
      if (nx === to.x && ny === to.y) return cur.concat([{ x: nx, y: ny }]);
      if (cellBlocked(nx, ny)) continue;
      seen.add(k);
      queue.push(cur.concat([{ x: nx, y: ny }]));
    }
  }
  return null;
}

/** Quita obstáculos a lo largo de una línea aproximada entre dos puntos. */
function openPath(from, to) {
  let x0 = from.x, y0 = from.y, x1 = to.x, y1 = to.y;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    removeObstacle(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

/** Asegura que el jugador pueda llegar a cada enemigo (o al lado derecho). */
function ensureConnectivity() {
  if (!combat.p) return;
  const targets = combat.enemies.filter((e) => e.hp > 0).map((e) => e.pos);
  if (!targets.length) targets.push({ x: BOARD.w - 2, y: Math.floor(BOARD.h / 2) });
  targets.forEach((t) => { if (!bfsPath(combat.p.pos, t)) openPath(combat.p.pos, t); });
}

/** Persistencia de mapas en localStorage. */
function saveMapSlot(name) {
  const maps = JSON.parse(localStorage.getItem("chaps-maps-v1") || "[]");
  const data = { theme: combat.map.theme, obstacles: combat.map.obstacles.slice() };
  const idx = maps.findIndex((m) => m.name === name);
  if (idx >= 0) maps[idx].data = data; else maps.push({ name, data });
  localStorage.setItem("chaps-maps-v1", JSON.stringify(maps));
}
function loadMapSlot(name) {
  const maps = JSON.parse(localStorage.getItem("chaps-maps-v1") || "[]");
  const m = maps.find((x) => x.name === name);
  if (m && m.data) {
    combat.map.theme = m.data.theme || "stone";
    combat.map.obstacles = (m.data.obstacles || []).slice();
  }
}
function listMapSlots() {
  return JSON.parse(localStorage.getItem("chaps-maps-v1") || "[]").map((m) => m.name);
}

function eName(e) { return LANG === "es" ? e.es : e.en; }

/** Emoji/SVG visual para un enemigo según categoría. */
function enemyToken(e) {
  if (e.cat === "dragon") return "🐉";
  if (e.cat === "creature") return e.key.includes("wolf") ? "🐺" : (e.key.includes("bear") ? "🐻" : "🦂");
  if (e.role === "caster") return e.cat === "paladin" ? "🛡" : "🧙";
  if (e.cat === "humanoid") return e.coward ? "🧟" : "🗡";
  return "👤";
}

/** Emoji/SVG visual para el jugador. */
function playerToken() { return "🗡"; }

function cLog(html, cls) {
  if (combat.quiet) return; // simulación masiva: sin registro (Fase 6)
  combat.log.unshift({ cls: cls || "log-info", html });
  if (typeof renderCombatLog === "function") renderCombatLog();
}

function hasCond(e, id) { return e.conds.some((c) => c.id === id); }

function addCond(e, id, expire) {
  if (!hasCond(e, id)) {
    e.conds.push({ id, expire: expire || 0 });
    const cdef = CONDITIONS.find((c) => c.id === id);
    cLog(`💠 ${eName(e)}: ${ct("condApplied")} — <strong>${cdef ? (LANG === "es" ? cdef.nameEs : cdef.nameEn) : id}</strong>`, "log-info");
  }
}

function removeCond(e, id) {
  e.conds = e.conds.filter((c) => c.id !== id);
}

/** Modificadores de tirar contra este enemigo por sus condiciones. */
function condModsVs(e, dist) {
  let adv = false, dis = false, autocrit = false;
  if (hasCond(e, "blinded") || hasCond(e, "unconscious")) adv = true;
  if (hasCond(e, "prone")) { if (dist <= 5) adv = true; else dis = true; }
  if (hasCond(e, "unconscious") && dist <= 5) autocrit = true;
  return { adv, dis, autocrit };
}

/** Salvación de un enemigo: tira d20 + mod y devuelve el resultado. */
function enemySave(e, ability, dc) {
  const r = rollDie(20);
  const mod = e.mods[ability] || 0;
  const total = r + mod;
  const ok = total >= dc;
  const abName = ability.toUpperCase();
  cLog(`🎲 ${eName(e)} ${ct("saveLog")} ${abName}: ${r} ${fmtMod(mod)} = ${total} vs CD ${dc} → <strong>${ok ? ct("savePass") : ct("saveFail")}</strong>`, ok ? "log-info" : "log-hit");
  return ok;
}

/* ================= INICIO / INICIATIVA ================= */
function startCombat() {
  if (!combat.enemies.length) return;
  combat.on = true;
  // dificultad de la IA (selector del setup; "normal" si no existe, p. ej. tests)
  const dSel = typeof document !== "undefined" && document.getElementById && document.getElementById("c-diff");
  combat.diff = (dSel && dSel.value) || combat.diff || "normal";
  combat.round = 1;
  combat.turn = 0;
  combat.p = newCombatPlayer();
  combat.log = [];
  combat.stats = { dmg: 0, taken: 0, crits: 0, hits: 0, rounds: 0 };
  combat.enemies.forEach((e) => { e.acted = false; e.conds = []; e.hp = e.maxHp; e.react = true; });
  // Colocación inicial respetando obstáculos
  placeCombatants();

  const r1 = rollDie(20), r2 = rollDie(20);
  const pInit = Math.max(r1, r2) + state.initiative; // Asesinar: ventaja
  cLog(`🎯 ${ct("initLog")} ${state.name}: d20(${r1}, ${r2}) ${fmtMod(state.initiative)} = <strong>${pInit}</strong>`, "log-info");
  combat.enemies.forEach((e) => {
    e.initRoll = rollDie(20) + e.init;
    cLog(`🎯 ${ct("initLog")} ${eName(e)}: d20 ${fmtMod(e.init)} = <strong>${e.initRoll}</strong>`, "log-info");
  });
  combat.order = [{ who: "p", init: pInit }]
    .concat(combat.enemies.map((e, i) => ({ who: "e", idx: i, init: e.initRoll })))
    .sort((a, b) => b.init - a.init);
  cLog(`📋 ${ct("orderLog")}: ` + combat.order.map((o) => (o.who === "p" ? state.name : eName(combat.enemies[o.idx])) + ` (${o.init})`).join(" → "), "log-info");
  beginTurn();
}

function currentCombatant() { return combat.order[combat.turn]; }
function isPlayerTurn() { return combat.on && currentCombatant().who === "p"; }

function beginTurn() {
  const cur = currentCombatant();
  if (cur.who === "p") {
    const p = combat.p;
    p.action = true; p.ba = true; p.react = true;
    p.move = state.speed; p.sneak = false; p.diseng = false; p.steady = false; p.withdraw = 0;
    p.vexTarget = null; p.nickReady = false; p.nickFree = false;
    combat.enemies.forEach((x) => { x.slow = false; }); // Slow dura hasta el inicio de tu próximo turno
    cLog(`— ${ct("round")} ${combat.round} · ${ct("turnStart")} <strong>${state.name}</strong> —`, "log-info");
    // Paralizado: pierde el turno y repite la salvación al final
    const para = getPCond("paralyzed");
    if (para) {
      cLog(`😵 ${ct("paraYou")}`, "log-miss");
      if (playerSave(para.save, para.dc)) { removePCond("paralyzed"); cLog(`✨ ${ct("paraEnd")}`, "log-hit"); }
      nextTurn();
      return;
    }
  } else {
    const e = combat.enemies[cur.idx];
    cLog(`— ${ct("round")} ${combat.round} · ${ct("turnStart")} <strong>${eName(e)}</strong> —`, "log-info");
    enemyTakeTurn(e);
    if (combat.on) nextTurn();
    return;
  }
  if (typeof renderCombat === "function") renderCombat();
}

function nextTurn() {
  if (!combat.on) return;
  checkCombatEnd();
  if (!combat.on) return;
  combat.turn++;
  if (combat.turn >= combat.order.length) { combat.turn = 0; combat.round++; }
  beginTurn();
}

function cloneCombatState() {
  return {
    on: combat.on, round: combat.round, turn: combat.turn, order: structuredClone(combat.order),
    enemies: structuredClone(combat.enemies), p: combat.p ? structuredClone(combat.p) : null,
    log: combat.log.slice(), diff: combat.diff
  };
}

function restoreCombatState(saved) {
  combat.on = saved.on; combat.round = saved.round; combat.turn = saved.turn;
  combat.order = saved.order; combat.enemies = saved.enemies; combat.p = saved.p;
  combat.log = saved.log; combat.diff = saved.diff;
}

/** Simula un único combate contra los enemigos actuales. Devuelve resultado. */
function simulateOne() {
  const saved = cloneCombatState();
  const savedHp = state.hpCurrent;
  combat.quiet = true;
  combat.enemies = saved.enemies.map((e) => spawnEnemy(e.key)).filter(Boolean);
  combat.p = null; combat.order = []; combat.log = []; combat.on = false;
  startCombat();
  let safety = 0;
  while (combat.on && safety < 500) {
    const cur = currentCombatant();
    if (cur.who === "p") {
      // IA simple del jugador: atacar al enemigo vivo más cercano
      const target = combat.enemies.filter((e) => e.hp > 0).sort((a, b) => distOf(a) - distOf(b))[0];
      if (target) {
        const w = state.weapons[0];
        const canSneak = !combat.p.sneak;
        playerAttack(w, target, { ally: false, strikes: [] });
      }
      nextTurn();
    }
    safety++;
  }
  const result = {
    victory: combat.enemies.every((e) => e.hp <= 0),
    rounds: combat.round,
    hpLeft: combat.p ? combat.p.hp : 0,
    hpMax: state.hpMax
  };
  combat.quiet = false;
  restoreCombatState(saved);
  state.hpCurrent = savedHp;
  return result;
}

function runMonteCarlo(runs) {
  runs = runs || 100;
  const results = [];
  for (let i = 0; i < runs; i++) results.push(simulateOne());
  const wins = results.filter((r) => r.victory).length;
  const avgRounds = results.reduce((a, r) => a + r.rounds, 0) / runs;
  const avgHp = results.reduce((a, r) => a + r.hpLeft, 0) / runs;
  return { runs, wins, losses: runs - wins, winPct: Math.round(wins / runs * 100), avgRounds: avgRounds.toFixed(1), avgHp: Math.round(avgHp) };
}

function renderSummary() {
  const card = ctEl("c-summary");
  const body = ctEl("c-summary-body");
  if (!card || !body) return;
  if (combat.on) { card.hidden = true; return; }
  card.hidden = false;
  const s = combat.stats || { dmg: 0, taken: 0, crits: 0, hits: 0 };
  const victory = combat.enemies.every((e) => e.hp <= 0);
  body.innerHTML = `
    <p class="hint">${victory ? "✅ Victoria" : "💀 Derrota"} · ${combat.round} rondas</p>
    <div class="summary-grid">
      <div class="summary-box"><div class="v">${s.dmg}</div><div class="l">Daño infligido</div></div>
      <div class="summary-box"><div class="v">${s.taken}</div><div class="l">Daño recibido</div></div>
      <div class="summary-box"><div class="v">${s.hits}</div><div class="l">Impactos</div></div>
      <div class="summary-box"><div class="v">${s.crits}</div><div class="l">Críticos</div></div>
    </div>`;
}

function checkCombatEnd() {
  if (!combat.on) return;
  if (combat.enemies.every((e) => e.hp <= 0)) {
    combat.on = false;
    cLog(ct("victory"), "log-crit");
  } else if (combat.p && combat.p.hp <= 0) {
    combat.on = false;
    cLog(ct("defeat"), "log-dead");
  }
  if (!combat.on) {
    if (typeof renderCombat === "function") renderCombat();
    renderSummary();
  }
}

/* ================= ATAQUE DEL JUGADOR ================= */
/**
 * Resuelve un ataque del jugador contra un enemigo.
 * opts: { strikes: [ids], ally: bool }
 * Devuelve true si el ataque se realizó.
 */
function playerAttack(w, e, opts) {
  const p = combat.p;
  opts = opts || {};
  if (opts.extra) {
    // Ataque extra (Ligera/Nick): no gasta acción; sin Nick dominado gasta la acción adicional
    if (p.nickFree) { /* gratis */ } else if (p.ba) { p.ba = false; } else { cLog("⛔ " + ct("noBA"), "log-miss"); return false; }
    p.nickReady = false;
  } else if (!p.action) { cLog("⛔ " + ct("noAction"), "log-miss"); return false; }

  // --- Alcance ---
  const cat = w.weaponId ? WEAPON_MASTERY.find((x) => x.id === w.weaponId) : null;
  const melee = cat ? cat.melee : 5;
  const range = cat ? cat.range : null;
  const fin = cat ? cat.fin : true; // armas manuales: se asume Sutil
  const dist = distOf(e);
  let mode = null;
  if (melee && dist <= melee) mode = "melee";
  else if (range) {
    const [rn, rl] = range.split("/").map(Number);
    if (dist <= rl) mode = "ranged";
  }
  if (!mode) { cLog(`⛔ ${eName(e)} ${ct("noRange")} (${dist} ft)`, "log-miss"); return false; }

  // --- Línea de visión ---
  if (mode === "ranged" && !hasLineOfSight(combat.p.pos, e.pos)) {
    cLog(`⛔ ${eName(e)}: ${ct("noLoS") || "sin línea de visión"}`, "log-miss");
    return false;
  }

  // --- Ventaja / desventaja ---
  const reasons = [];
  let adv = false, dis = false;
  const mastActive = cat && state.masteryChoices.includes(cat.id) ? cat.mastery : null;
  const cm = condModsVs(e, dist);
  if (cm.adv) { adv = true; if (hasCond(e, "prone")) reasons.push(ct("proneAdv")); else if (hasCond(e, "blinded")) reasons.push(ct("blindAdv")); }
  if (cm.dis) { dis = true; }
  if (p.steady) { adv = true; reasons.push(ct("steadyOn")); }
  if (p.hidden) { adv = true; reasons.push("🫥 " + ct("hiddenNow")); }
  if (p.vexTarget === e) { adv = true; reasons.push("Vex"); p.vexTarget = null; } // Vex: se consume
  if (combat.round === 1 && !e.acted) { adv = true; reasons.push("🗡 " + ct("firstRound")); }
  if (mode === "ranged") {
    const [rn] = range.split("/").map(Number);
    if (dist > rn) { dis = true; reasons.push(ct("longRangeDis")); }
    const meleeFoe = combat.enemies.find((x) => x.hp > 0 && distOf(x) <= 5);
    if (meleeFoe) { dis = true; reasons.push(ct("rangedInMelee")); }
  }
  const flat = adv && dis;

  // --- Tirada ---
  let rolls, chosen;
  if (flat || (!adv && !dis)) { rolls = [rollDie(20)]; chosen = rolls[0]; }
  else { rolls = [rollDie(20), rollDie(20)]; chosen = adv ? Math.max(...rolls) : Math.min(...rolls); }
  const atkBonus = profBonus(state.level) + dexMod();
  const total = chosen + atkBonus;
  const natCrit = chosen === 20, natMiss = chosen === 1;
  const crit = natCrit || (cm.autocrit && !natMiss && total >= e.ac);
  const isHit = natCrit || crit || (!natMiss && total >= e.ac);
  const rollStr = rolls.length > 1 ? `d20(${rolls.join(", ")})→${chosen}` : `d20(${chosen})`;

  if (!opts.extra) p.action = false;
  p.steady = false;
  p.hidden = false; // atacar revela tu posición

  fxLine(p.pos, e.pos);
  if (!isHit) {
    fxMiss(e);
    flashCell(e.pos.x, e.pos.y, "flash-miss");
    // Graze: al FALLAR, daño = modificador de la característica
    if (mastActive === "graze") {
      const g = Math.max(0, dexMod());
      if (g > 0) {
        e.hp = Math.max(0, e.hp - g);
        cLog(`🎯 Graze: ${ct("missWord")} pero ${eName(e)} recibe ${g} ${ct("dmgWord")} [${e.hp}/${e.maxHp}]`, "log-hit");
        if (e.hp <= 0) { cLog(`💀 ${eName(e)} ${ct("enemyDead")}`, "log-dead"); checkCombatEnd(); }
      }
    }
    cLog(`${w.name}: ${rollStr} ${fmtMod(atkBonus)} = ${total} ${ct("vsAc")} ${e.ac} → <em>${ct("missWord")}</em>`, "log-miss");
    if (typeof renderCombat === "function") renderCombat();
    return true;
  }

  // --- Daño ---
  const parts = [];
  let dmg = 0;
  const wExpr = `${w.dice}d${w.sides}+${w.bonus}`;
  const wRes = rollDiceExpr(wExpr, crit);
  parts.push(`${wRes.dice}d${wRes.sides}(${wRes.rolls.join(",")})${fmtMod(wRes.bonus)}`);
  dmg += wRes.total;

  // Furtivo
  const canSneak = fin && !p.sneak && (adv || (opts.ally && !dis)) && !flat;
  let strikeIds = [];
  if (!fin) reasons.push(ct("sneakNoFinesse"));
  if (canSneak) {
    const maxFx = maxCunningStrikes(state.level);
    strikeIds = (opts.strikes || []).slice(0, maxFx);
    const cost = strikeIds.reduce((a, id) => a + STRIKES.find((s) => s.id === id).cost, 0);
    const base = sneakDiceCount(state.level);
    const sn = Math.max(0, base - cost);
    if (sn > 0) {
      const sRolls = rollDice(crit ? sn * 2 : sn, 6);
      parts.push(`${t("lSneak")} ${crit ? sn * 2 : sn}d6(${sRolls.join(",")})`);
      dmg += sum(sRolls);
    }
    p.sneak = true;
    // Asesinar: 1ª ronda y no ha actuado
    if (combat.round === 1 && !e.acted) {
      parts.push(`${t("lAssassinate")} +${state.level}`);
      dmg += state.level;
      reasons.push(ct("assasNote").replace("{lv}", state.level));
    }
  }

  e.hp = Math.max(0, e.hp - dmg);
  fxHit(e, dmg, crit);
  flashCell(e.pos.x, e.pos.y, crit ? "flash-crit" : "shake");
  let html = `⚔ ${w.name} → ${eName(e)}: ${rollStr} ${fmtMod(atkBonus)} = ${total} ${ct("vsAc")} ${e.ac} → <strong>${crit ? ct("critWord") : ct("hitWord")}</strong><br>` +
    `${parts.join(" + ")} = <strong>${dmg} ${ct("dmgWord")}</strong> [${eName(e)}: ${e.hp}/${e.maxHp} PG]`;
  if (reasons.length) html += `<br><em>${reasons.join(" · ")}</em>`;
  cLog(html, crit ? "log-crit" : "log-hit");

  // --- Efectos de Golpes Astutos (salvaciones reales) ---
  const dc = saveDC();
  strikeIds.forEach((id) => {
    const st = STRIKES.find((s) => s.id === id);
    if (id === "withdraw") {
      p.withdraw = Math.floor(state.speed / 2);
      cLog(`🌀 ${t("lWithdrawNote")}`, "log-info");
      return;
    }
    const ok = enemySave(e, st.save, dc);
    if (!ok) {
      if (id === "poison") {
        addCond(e, "poisoned");
        if (state.level >= 13) { // Armas Envenenadas
          const eRolls = rollDice(2, 6);
          const en = sum(eRolls);
          e.hp = Math.max(0, e.hp - en);
          cLog(`🧪 ${ct("envenom2d6")}: 2d6(${eRolls.join(",")}) = <strong>${en}</strong> [${eName(e)}: ${e.hp}/${e.maxHp}]`, "log-hit");
        }
      }
      if (id === "trip") addCond(e, "prone");
      if (id === "daze") addCond(e, "dazed", 1);
      if (id === "knockout") addCond(e, "unconscious");
      if (id === "obscure") addCond(e, "blinded", 1);
    }
  });

  // --- Maestría de arma (si la tienes dominada) ---
  if (mastActive === "vex") { p.vexTarget = e; cLog(`🌀 Vex: ${ct("mVex")}`, "log-info"); }
  if (mastActive === "slow") { e.slow = true; cLog(`🐌 Slow: ${eName(e)} −10 ft ${ct("mSlow")}`, "log-info"); }
  if (mastActive === "sap") { e.sap = true; cLog(`🥊 Sap: ${eName(e)} ${ct("mSap")}`, "log-info"); }
  if (mastActive === "push") pushEnemy(e, 10);
  if (mastActive === "topple") {
    const dcT = 8 + dexMod() + profBonus(state.level);
    if (!enemySave(e, "con", dcT)) addCond(e, "prone");
  }
  if (mastActive === "cleave" && mode === "melee") {
    const o = combat.enemies.find((x) => x !== e && x.hp > 0 && distBetween(x.pos, e.pos) <= 5 && distOf(x) <= melee);
    if (o) {
      const r2 = rollDie(20);
      const tot2 = r2 + atkBonus;
      if (r2 !== 1 && (r2 === 20 || tot2 >= o.ac)) {
        const d2 = rollDiceExpr(`${w.dice}d${w.sides}+0`, r2 === 20).total; // sin modificador
        o.hp = Math.max(0, o.hp - d2);
        cLog(`⚔ Cleave → ${eName(o)}: ${r2} ${fmtMod(atkBonus)} = ${tot2} ${ct("vsAc")} ${o.ac} → <strong>${d2} ${ct("dmgWord")}</strong> [${o.hp}/${o.maxHp}]`, "log-hit");
        if (o.hp <= 0) cLog(`💀 ${eName(o)} ${ct("enemyDead")}`, "log-dead");
      } else {
        cLog(`⚔ Cleave → ${eName(o)}: ${tot2} ${ct("vsAc")} ${o.ac} → <em>${ct("missWord")}</em>`, "log-miss");
      }
    }
  }
  // Ligera: habilita el ataque extra (1/turno)
  if (!opts.extra && cat && cat.light && e.hp >= 0) {
    p.nickReady = true;
    p.nickFree = mastActive === "nick";
    cLog(`🗡 ${ct("mNick")}${p.nickFree ? " (Nick: " + ct("mNickFree") + ")" : ""}`, "log-info");
  }

  if (combat.stats) { combat.stats.dmg += dmg; combat.stats.hits++; if (crit) combat.stats.crits++; }
  if (e.hp <= 0) cLog(`💀 ${eName(e)} ${ct("enemyDead")}`, "log-dead");
  checkCombatEnd();
  if (typeof renderCombat === "function") renderCombat();
  return true;
}

/** Push: empuja al enemigo en línea recta alejándolo del jugador. */
function pushEnemy(e, ft) {
  const steps = Math.floor(ft / 5);
  const dx = Math.sign(e.pos.x - combat.p.pos.x), dy = Math.sign(e.pos.y - combat.p.pos.y);
  let moved = 0;
  for (let i = 0; i < steps; i++) {
    const nx = e.pos.x + dx, ny = e.pos.y + dy;
    if (nx < 0 || ny < 0 || nx >= BOARD.w || ny >= BOARD.h || cellOccupied(nx, ny)) break;
    e.pos = { x: nx, y: ny };
    moved += 5;
  }
  if (moved) cLog(`💨 Push: ${eName(e)} ${ct("mPush")} ${moved} ft`, "log-info");
}

/* ================= MOVIMIENTO DEL JUGADOR ================= */
/**
 * Mueve al jugador a una celda del tablero.
 * Gestiona presupuesto de movimiento, Retirada y ataques de oportunidad.
 */
function playerMoveTo(x, y) {
  const p = combat.p;
  if (!combat.on || !isPlayerTurn()) return false;
  if (x < 0 || y < 0 || x >= BOARD.w || y >= BOARD.h || cellOccupied(x, y)) return false;
  const budget = p.move + p.withdraw;
  const from = { x: p.pos.x, y: p.pos.y };
  const ft = distBetween(from, { x, y });
  if (ft === 0) return false;
  if (ft > budget) { cLog("⛔ " + ct("noMove"), "log-miss"); return false; }

  // AdO: salir del alcance de melé de un enemigo sin Retirarse/Retirada
  const freeMove = p.diseng || p.withdraw >= ft;
  combat.enemies.forEach((x) => {
    if (x.hp <= 0 || !x.react || hasCond(x, "unconscious")) return;
    const reach = Math.max(...x.attacks.filter((a) => a.melee).map((a) => a.melee), 0);
    if (!reach) return;
    if (distBetween(from, x.pos) <= reach && distBetween({ x, y }, x.pos) > reach && !freeMove) {
      const atk = x.attacks.find((a) => a.melee);
      x.react = false;
      cLog(`⚠ ${ct("oaLog")} ${eName(x)}!`, "log-miss");
      enemyAttackRoll(x, atk, true);
    }
  });

  // consume primero el movimiento de Retirada (libre de AdO)
  const useWithdraw = Math.min(p.withdraw, ft);
  p.withdraw -= useWithdraw;
  p.move -= (ft - useWithdraw);
  p.pos = { x, y };
  cLog(`👣 ${state.name} ${ct("aiMove")} ${ft} ft`, "log-info");
  if (typeof renderCombat === "function") renderCombat();
  return true;
}

/** Acciones adicionales del jugador. */
function playerBonus(kind) {
  const p = combat.p;
  if (!p.ba) { cLog("⛔ " + ct("noBA"), "log-miss"); return; }
  if (kind === "steady") {
    p.steady = true;
    if (state.level < 9) p.move = 0; // Puntería Itinerante (N9) conserva el movimiento
    cLog("🎯 " + ct(state.level >= 9 ? "steadyOn9" : "steadyOn"), "log-info");
  }
  if (kind === "hide") {
    const pb = profBonus(state.level);
    const st = state.skills.stealth || { p: false, e: false };
    const mod = abilityMod(state.abilities.dex) + (st.e ? pb * 2 : st.p ? pb : 0);
    const r = rollDie(20);
    const best = Math.max(...combat.enemies.filter((e) => e.hp > 0).map((e) => 10 + e.percep), 10);
    const ok = r + mod >= best;
    if (ok) { p.hidden = true; p.hiddenDC = r + mod; cLog(`🫥 Sigilo: ${r} ${fmtMod(mod)} = ${r + mod} vs Percepción pasiva ${best} → ${ct("hiddenNow")}`, "log-hit"); }
    else cLog(`🫥 Sigilo: ${r} ${fmtMod(mod)} = ${r + mod} vs ${best} → ${ct("hideFail")}`, "log-miss");
  }
  if (kind === "dash") { p.move += state.speed; cLog("💨 " + ct("dashOn"), "log-info"); }
  if (kind === "disengage") { p.diseng = true; cLog("🌀 " + ct("disengageOn"), "log-info"); }
  p.ba = false;
  if (typeof renderCombat === "function") renderCombat();
}

/* ================= TURNO DEL ENEMIGO (IA básica) ================= */
function enemyAttackRoll(e, atk, isOA) {
  const p = combat.p;
  let dis = false;
  if (hasCond(e, "poisoned") || hasCond(e, "blinded")) dis = true;
  if (e.sap) { dis = true; e.sap = false; } // Sap: desventaja en su próximo ataque
  if (p.hidden) dis = true; // sabe dónde estabas, pero no te ve bien
  let rolls, chosen;
  if (dis) { rolls = [rollDie(20), rollDie(20)]; chosen = Math.min(...rolls); }
  else { rolls = [rollDie(20)]; chosen = rolls[0]; }
  const total = chosen + atk.bonus;
  const tgtAc = p.ac != null ? p.ac : state.ac; // proxy en IA vs IA
  const isHit = chosen !== 1 && (chosen === 20 || total >= tgtAc);
  const rollStr = rolls.length > 1 ? `d20(${rolls.join(", ")})→${chosen}` : `d20(${chosen})`;
  const aName = LANG === "es" ? atk.es : atk.en;
  fxLine(e.pos, p.pos);
  if (!isHit) {
    fxMissAt(p.pos.x, p.pos.y);
    flashCell(p.pos.x, p.pos.y, "flash-miss");
    cLog(`🛡 ${eName(e)} (${aName}): ${rollStr} ${fmtMod(atk.bonus)} = ${total} ${ct("vsAc")} ${tgtAc} → <em>${ct("missWord")}</em>`, "log-miss");
    if (p.hidden) { p.hidden = false; }
    return 0;
  }
  // crítico: natural 20, o jugador Paralizado/Inconsciente a 5 ft
  const crit = chosen === 20 || (hasPCond("paralyzed") && distOf(e) <= 5);
  let res = rollDiceExpr(atk.dmg, crit);
  let dmg = res.total;
  // Castigo Divino (paladín): según dificultad (primer impacto / solo críticos o remate)
  if (shouldSmite(e, crit)) {
    e.smiteUsed = true;
    const sm = rollDiceExpr(e.smite, crit);
    dmg += sm.total;
    res.rolls = res.rolls.concat(sm.rolls);
    cLog(`✨ ${ct("smiteLog")}: ${e.smite}(${sm.rolls.join(",")})`, "log-miss");
  }
  // Esquiva Asombrosa (solo el jugador real, no proxies)
  if (p.react && !isOA && !p.proxy) {
    const ask = combat.confirm || ((q) => (typeof window !== "undefined" ? window.confirm(q) : false));
    if (ask(`${ct("uncannyQ")}\n${ct("dmgWord")}: ${dmg}`)) {
      dmg = Math.floor(dmg / 2);
      p.react = false;
      cLog(`🌀 ${ct("uncannyUsed")}: ${dmg}`, "log-info");
    }
  }
  p.hp = Math.max(0, p.hp - dmg);
  if (combat.stats) combat.stats.taken += dmg;
  fxHitAt(p.pos.x, p.pos.y, dmg, crit);
  flashCell(p.pos.x, p.pos.y, crit ? "flash-crit" : "shake");
  if (p.hidden) p.hidden = false;
  cLog(`🩸 ${eName(e)} (${aName}): ${rollStr} ${fmtMod(atk.bonus)} = ${total} ${ct("vsAc")} ${tgtAc} → <strong>${crit ? ct("critWord") : ct("hitWord")}</strong> — ${dmg} ${ct("dmgWord")} [${p.proxy ? p.name : state.name}: ${p.hp} PG]`, "log-miss");
  checkCombatEnd();
  return dmg;
}

/**
 * Movimiento de la IA: avanza paso a paso (5 ft) hacia el jugador
 * (o se aleja si flee=true), respetando obstáculos y ocupación.
 * Usa BFS para rodear muros/pilares. Devuelve los ft recorridos.
 */
/** Encuentra una celda alcanzable que tenga línea de visión al jugador. */
function findLoSMove(e, ft) {
  const start = e.pos;
  const maxSteps = Math.floor(ft / 5);
  if (maxSteps <= 0) return null;
  const seen = new Set([start.x + "," + start.y]);
  const queue = [{ pos: start, steps: 0 }];
  const reachable = [];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    if (cur.steps >= maxSteps) continue;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const nx = cur.pos.x + dx, ny = cur.pos.y + dy, k = nx + "," + ny;
      if (nx < 0 || ny < 0 || nx >= BOARD.w || ny >= BOARD.h || seen.has(k)) continue;
      if (cellOccupied(nx, ny)) continue;
      seen.add(k);
      const next = { pos: { x: nx, y: ny }, steps: cur.steps + 1 };
      reachable.push(next);
      queue.push(next);
    }
  }
  let best = null, bestScore = null;
  reachable.forEach((r) => {
    const hasLoS = hasLineOfSight(r.pos, combat.p.pos);
    const d = distBetween(r.pos, combat.p.pos);
    const score = (hasLoS ? 0 : 1000) + d;
    if (bestScore === null || score < bestScore) { bestScore = score; best = r; }
  });
  return best;
}

function aiMoveSteps(e, ft, flee, stopAt) {
  stopAt = stopAt || 5;
  const maxSteps = Math.floor(ft / 5);
  if (maxSteps <= 0) return 0;
  const start = e.pos;
  const seen = new Set([start.x + "," + start.y]);
  const queue = [{ pos: start, steps: 0 }];
  const reachable = [{ pos: start, steps: 0 }];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    if (cur.steps >= maxSteps) continue;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const nx = cur.pos.x + dx, ny = cur.pos.y + dy, k = nx + "," + ny;
      if (nx < 0 || ny < 0 || nx >= BOARD.w || ny >= BOARD.h || seen.has(k)) continue;
      if (cellOccupied(nx, ny)) continue;
      seen.add(k);
      const next = { pos: { x: nx, y: ny }, steps: cur.steps + 1 };
      reachable.push(next);
      queue.push(next);
    }
  }
  const target = combat.p.pos;
  let best = null, bestScore = null;
  reachable.forEach((r) => {
    if (r.pos.x === start.x && r.pos.y === start.y) return;
    const d = distBetween(r.pos, target);
    let score = flee ? -d : d;
    if (!flee && d <= stopAt) score = -1000 + d;
    if (bestScore === null || score < bestScore) { bestScore = score; best = r; }
  });
  if (!best) return 0;
  e.pos = best.pos;
  return best.steps * 5;
}

/** Fin de turno del enemigo: salvaciones repetidas y expiración de condiciones. */
function enemyEndTurn(e) {
  if (hasCond(e, "poisoned") && e.hp > 0) {
    cLog(`🧪 ${eName(e)}: ${ct("poisonTick")}`, "log-info");
    if (enemySave(e, "con", saveDC())) { removeCond(e, "poisoned"); cLog(`✨ ${eName(e)} ${ct("condEnd")}: Envenenado`, "log-info"); }
  }
  if (hasCond(e, "unconscious") && e.hp > 0) {
    if (enemySave(e, "con", saveDC())) { removeCond(e, "unconscious"); cLog(`✨ ${eName(e)} ${ct("condEnd")}: Inconsciente`, "log-info"); }
  }
  // Condiciones con duración (dazed/blinded): expiran al final de SU próximo turno.
  e.conds.forEach((c) => { if (c.expire > 0) c.expire--; });
  e.conds = e.conds.filter((c) => !((c.id === "dazed" || c.id === "blinded") && c.expire <= 0));
  e.react = true;
  e.acted = true;
}

/** IA básica: acercarse y atacar; cobardes huyen con PG bajos. */
/** Ataque de oportunidad DEL jugador cuando un enemigo sale de su melé. */
function tryPlayerOA(e, wasClose) {
  const p = combat.p;
  if (!p.react || !wasClose || distOf(e) <= 5 || e.hp <= 0) return;
  const w = state.weapons.find((wp) => {
    const c = wp.weaponId ? WEAPON_MASTERY.find((x) => x.id === wp.weaponId) : null;
    return (c ? c.melee : 5) > 0;
  });
  if (!w) return;
  const ask = combat.confirm || (() => false);
  if (!ask(ct("oaPrompt"))) return;
  p.react = false;
  cLog(`⚔ ${ct("oaYou")}`, "log-info");
  const cat = w.weaponId ? WEAPON_MASTERY.find((x) => x.id === w.weaponId) : null;
  const fin = cat ? cat.fin : true;
  const adv = p.hidden; // oculto → ventaja
  const rolls = adv ? [rollDie(20), rollDie(20)] : [rollDie(20)];
  const chosen = adv ? Math.max(...rolls) : rolls[0];
  const atkBonus = profBonus(state.level) + dexMod();
  const total = chosen + atkBonus;
  const rollStr = rolls.length > 1 ? `d20(${rolls.join(", ")})→${chosen}` : `d20(${chosen})`;
  if (chosen !== 1 && (chosen === 20 || total >= e.ac)) {
    const crit = chosen === 20;
    let dmg = rollDiceExpr(`${w.dice}d${w.sides}+${w.bonus}`, crit).total;
    // furtivo en AdO: permitido si hay ventaja (reacción, 1/turno ya controlado por p.sneak)
    if (fin && adv && !p.sneak) {
      const sn = sneakDiceCount(state.level);
      dmg += sum(rollDice(crit ? sn * 2 : sn, 6));
      p.sneak = true;
    }
    e.hp = Math.max(0, e.hp - dmg);
    cLog(`⚔ ${w.name} → ${eName(e)}: ${rollStr} ${fmtMod(atkBonus)} = ${total} ${ct("vsAc")} ${e.ac} → <strong>${dmg} ${ct("dmgWord")}</strong> [${eName(e)}: ${e.hp}/${e.maxHp}]`, crit ? "log-crit" : "log-hit");
    if (e.hp <= 0) cLog(`💀 ${eName(e)} ${ct("enemyDead")}`, "log-dead");
    checkCombatEnd();
  } else {
    cLog(`⚔ ${w.name} → ${eName(e)}: ${rollStr} ${fmtMod(atkBonus)} = ${total} ${ct("vsAc")} ${e.ac} → <em>${ct("missWord")}</em>`, "log-miss");
  }
}

/** El enemigo lanza un hechizo sobre el jugador. */
function enemyCast(e, sp) {
  sp.usesLeft--;
  const sName = LANG === "es" ? sp.es : sp.en;
  cLog(`🔮 ${eName(e)} ${ct("castLog")} <strong>${sName}</strong>`, "log-info");
  if (sp.para) { // Inmovilizar Persona y similares
    if (!targetSave(combat.p, sp.save, sp.dc)) {
      combat.p.conds.push({ id: "paralyzed", save: sp.save, dc: sp.dc });
      cLog(`😵 ${ct("paraYou")}`, "log-miss");
    }
    return;
  }
  if (sp.atk != null) { // ataque de conjuro
    enemyAttackRoll(e, { es: sp.es, en: sp.en, bonus: sp.atk, dmg: sp.dmg, melee: 0, range: String(sp.range) }, false);
    return;
  }
  // salvación del jugador
  const ok = targetSave(combat.p, sp.save, sp.dc);
  let res = rollDiceExpr(sp.dmg, false);
  let dmg = res.total;
  if (ok) {
    if (!sp.half) { cLog(`✨ ${sName}: ${ct("savePass")} → 0 ${ct("dmgWord")}`, "log-info"); return; }
    dmg = Math.floor(dmg / 2);
  }
  // Evasión (N7): salvaciones de DES de medio daño → éxito 0 / fallo mitad
  if (sp.save === "dex" && sp.half && state.level >= 7) {
    if (ok) { cLog(`🌀 ${ct("evasionOk")}`, "log-hit"); dmg = 0; }
    else { cLog(`🌀 ${ct("evasionHalf")}`, "log-info"); dmg = Math.floor(res.total / 2); }
  }
  if (dmg > 0) {
    combat.p.hp = Math.max(0, combat.p.hp - dmg);
    cLog(`🔥 ${sName}: ${sp.dmg}(${res.rolls.join(",")}) = <strong>${dmg} ${ct("dmgWord")}</strong> [${state.name}: ${combat.p.hp} PG]`, "log-miss");
  }
  checkCombatEnd();
}

/** Aliento de dragón: salvación de DES, se recarga con 5-6 al inicio de su turno. */
function dragonBreath(e) {
  const b = e.breath;
  b.ready = false;
  const bName = LANG === "es" ? b.es : b.en;
  cLog(`🐉 ${eName(e)}: <strong>${bName}</strong>!`, "log-info");
  const ok = targetSave(combat.p, b.save, b.dc);
  let res = rollDiceExpr(b.dmg, false);
  let dmg = ok ? Math.floor(res.total / 2) : res.total;
  if (b.save === "dex" && b.half && state.level >= 7) {
    if (ok) { cLog(`🌀 ${ct("evasionOk")}`, "log-hit"); dmg = 0; }
    else dmg = Math.floor(res.total / 2);
  }
  if (dmg > 0) {
    combat.p.hp = Math.max(0, combat.p.hp - dmg);
    cLog(`❄ ${bName}: ${b.dmg}(${res.rolls.join(",")}) = <strong>${dmg} ${ct("dmgWord")}</strong> [${state.name}: ${combat.p.hp} PG]`, "log-miss");
  }
  checkCombatEnd();
}

function enemyIntent(e) {
  if (e.hp <= 0) return "";
  if (e.coward && e.hp < e.maxHp / 4 && combat.diff !== "easy") return `🏃 ${eName(e)} intenta huir`;
  if (e.role === "caster" && e.spells && e.spells.some((s) => s.usesLeft > 0)) return `🔮 ${eName(e)} prepara un hechizo`;
  if (e.breath && e.breath.ready && distOf(e) <= 15) return `🐉 ${eName(e)} va a usar aliento`;
  const inMelee = distOf(e) <= 5;
  const hasRanged = e.attacks.some((a) => a.range);
  if (inMelee && hasRanged) return `🏹 ${eName(e)} se aleja y dispara`;
  if (inMelee) return `⚔ ${eName(e)} ataca cuerpo a cuerpo`;
  return `⚔ ${eName(e)} se acerca para atacar`;
}

function enemyTakeTurn(e) {
  if (e.hp <= 0) { enemyEndTurn(e); return; }
  const intent = enemyIntent(e);
  if (intent) cLog(intent, "log-info");
  cLog(`🤖 ${eName(e)} ${ct("aiThink")}`, "log-info");
  e.smiteUsed = false;
  // Dragón: recarga de aliento (5-6 en d6)
  if (e.breath && !e.breath.ready) {
    const r = rollDie(6);
    if (r >= e.breath.recharge) { e.breath.ready = true; cLog(`🐉 ${eName(e)} ${ct("breathRecharge")} (d6: ${r})`, "log-info"); }
    else cLog(`🐉 ${eName(e)} ${ct("breathNo")} (d6: ${r})`, "log-info");
  }

  if (hasCond(e, "unconscious")) {
    cLog(`😵 ${eName(e)}: ${ct("uncSkip")}`, "log-info");
    enemyEndTurn(e);
    return;
  }
  const dazed = hasCond(e, "dazed");
  let move = Math.max(0, e.speed - (e.slow ? 10 : 0)); // Slow (maestría)
  let canAct = true;

  if (hasCond(e, "prone")) {
    cLog(`🧍 ${eName(e)} ${ct("aiStand")}`, "log-info");
    removeCond(e, "prone");
    move = Math.floor(move / 2);
  }

  // Cobardía: PG < 25% → se aleja del jugador (provoca tu AdO si estaba en melé)
  // (en Fácil los enemigos no huyen: pelean hasta el final)
  if (e.coward && e.hp < e.maxHp / 4 && combat.diff !== "easy") {
    const wasClose = distOf(e) <= 5;
    aiMoveSteps(e, move, true);
    cLog(`🏃 ${eName(e)} ${ct("aiFlee")}`, "log-info");
    tryPlayerOA(e, wasClose);
    enemyEndTurn(e);
    return;
  }

  // Difícil/Táctico: si estás Oculto, gasta su acción en Buscar en vez de atacar con desventaja
  if (combat.p.hidden && (combat.diff === "hard" || combat.diff === "tactical")) {
    const r = rollDie(20);
    const tot = r + e.percep;
    const dcT = combat.p.hiddenDC || 15;
    if (tot >= dcT) {
      combat.p.hidden = false;
      cLog(`👁 ${eName(e)} Busca: Percepción ${r} ${fmtMod(e.percep)} = ${tot} vs CD ${dcT} → ¡te encuentra!`, "log-miss");
    } else {
      cLog(`👁 ${eName(e)} Busca: ${tot} vs CD ${dcT} → ${ct("seekYou")}`, "log-info");
    }
    enemyEndTurn(e);
    return;
  }

  // Casters: mantener distancia y lanzar hechizos
  if (e.role === "caster" && e.spells && e.spells.length) {
    if (distOf(e) <= 5 && combat.diff !== "easy") { // jugador en melé → se aleja (provoca tu AdO)
      const moved = aiMoveSteps(e, move, true);
      if (moved) cLog(`👣 ${eName(e)} ${ct("aiMove")} ${moved} ft (mantiene distancia para lanzar)`, "log-info");
      tryPlayerOA(e, true);
      if (!combat.on) return;
      if (dazed) { cLog(`😵 ${ct("dazedNote")}`, "log-info"); enemyEndTurn(e); return; }
    }
    // Sin línea de visión: moverse para obtenerla
    if (!hasLineOfSight(e.pos, combat.p.pos)) {
      const best = findLoSMove(e, move);
      if (best) {
        const wasClose = distOf(e) <= 5;
        e.pos = best.pos;
        cLog(`👣 ${eName(e)} ${ct("aiMove")} ${best.steps * 5} ft (busca línea de visión)`, "log-info");
        tryPlayerOA(e, wasClose);
        if (!combat.on) return;
      }
    }
    const avail = e.spells.filter((s) => s.usesLeft > 0 && distOf(e) <= s.range && hasLineOfSight(e.pos, combat.p.pos));
    const sp = chooseSpell(e, avail);
    if (sp) { enemyCast(e, sp); enemyEndTurn(e); return; }
    // sin hechizos disponibles: cae a la lógica de melé
  }

  // Dragón táctico: si el aliento está listo, se coloca a 15 ft (no a melé) para soltarlo
  if (e.breath && e.breath.ready && distOf(e) > 15 && (combat.diff === "hard" || combat.diff === "tactical")) {
    const moved = aiMoveSteps(e, move, false, 15);
    if (moved) cLog(`🐉 ${eName(e)} ${ct("aiMove")} ${moved} ft (se posiciona para el aliento)`, "log-info");
  }
  if (e.breath && e.breath.ready && distOf(e) <= 15) {
    dragonBreath(e);
    enemyEndTurn(e);
    return;
  }

  // Difícil/Táctico: tiradores con mejor arma a distancia se alejan de tu melé (kiting)
  if ((combat.diff === "hard" || combat.diff === "tactical") && e.role !== "caster" && distOf(e) <= 5) {
    const meleeAtk = e.attacks.find((a) => a.melee);
    const rangedAtk = e.attacks.find((a) => a.range);
    if (rangedAtk && (!meleeAtk || avgDmg(rangedAtk.dmg) >= avgDmg(meleeAtk.dmg))) {
      const moved = aiMoveSteps(e, move, true);
      if (moved) {
        cLog(`🏹 ${eName(e)} ${ct("aiMove")} ${moved} ft (kiting: mejor ataque a distancia)`, "log-info");
        tryPlayerOA(e, true);
        if (!combat.on) return;
      }
    }
  }

  // Elegir ataque disponible
  const distNow = () => distOf(e);
  const inRange = (a) => (a.melee && distNow() <= a.melee) ||
    (a.range && distNow() <= +a.range.split("/")[1]);
  let atk = e.attacks.find((a) => a.melee && distNow() <= a.melee) ||
            e.attacks.find((a) => a.range && distNow() <= +a.range.split("/")[0] && distNow() > 5) ||
            e.attacks.find(inRange);

  // Acercarse si nada alcanza
  if (!atk) {
    const moved = aiMoveSteps(e, move, false);
    if (moved > 0) cLog(`👣 ${eName(e)} ${ct("aiMove")} ${moved} ft (${ct("aiTarget")})`, "log-info");
    if (dazed) { cLog(`😵 ${ct("dazedNote")}`, "log-info"); enemyEndTurn(e); return; }
    atk = e.attacks.find((a) => a.melee && distNow() <= a.melee) || e.attacks.find(inRange);
    if (!atk) {
      // Dash: corre el doble
      const moved2 = aiMoveSteps(e, e.speed, false);
      if (moved2 > 0) cLog(`💨 ${eName(e)} ${ct("aiDash")} (${moved2} ft más)`, "log-info");
      atk = e.attacks.find((a) => a.melee && distNow() <= a.melee);
      if (!atk) { cLog(`⛔ ${eName(e)}: ${ct("aiNoReach")}`, "log-info"); enemyEndTurn(e); return; }
      canAct = false; // gastó su acción en Dash
    }
  }

  if (canAct && combat.on && combat.p.hp > 0) enemyAttackRoll(e, atk, false);
  else if (dazed) cLog(`😵 ${ct("dazedNote")}`, "log-info");
  enemyEndTurn(e);
}

/* ============================================================
   UI — pestaña Combate (solo navegador)
   ============================================================ */
function ctEl(id) { return document.getElementById(id); }

function renderCombatLog() {
  const ul = ctEl("c-log");
  if (!ul) return;
  ul.innerHTML = "";
  combat.log.forEach((l) => {
    const li = document.createElement("li");
    li.className = l.cls;
    li.innerHTML = l.html;
    ul.appendChild(li);
  });
}

function renderSetup() {
  const sel = ctEl("c-catalog");
  if (!sel) return;
  const catFilter = (ctEl("c-cat-filter") || {}).value || "all";
  const q = ((ctEl("c-search") || {}).value || "").trim().toLowerCase();
  sel.innerHTML = "";
  const filtered = ENEMIES
    .filter((e) => catFilter === "all" || e.cat === catFilter)
    .filter((e) => !q || e.es.toLowerCase().includes(q) || e.en.toLowerCase().includes(q));
  filtered.forEach((e) => {
    const opt = document.createElement("option");
    opt.value = e.key;
    opt.textContent = `${eName(e)} (CR ${e.cr} · ${e.hp} PG · CA ${e.ac})`;
    sel.appendChild(opt);
  });
  const count = ctEl("c-catalog-count");
  if (count) count.textContent = filtered.length ? `${filtered.length} enemigo(s)` : "Sin coincidencias";
  const list = ctEl("c-queue");
  list.innerHTML = "";
  combat.enemies.forEach((e, i) => {
    const div = document.createElement("div");
    div.className = "enemy-row";
    div.innerHTML = `<span><strong>${eName(e)}</strong> — ${e.hp} PG · CA ${e.ac} · ${e.speed} ft</span>
      <select class="enemy-strategy" data-sq="${i}" title="Estrategia de IA">
        <option value="closest" ${e.strategy === "closest" ? "selected" : ""}>Cercano</option>
        <option value="weakest" ${e.strategy === "weakest" ? "selected" : ""}>Más débil</option>
        <option value="damaged" ${e.strategy === "damaged" ? "selected" : ""}>Más dañado</option>
        <option value="random" ${e.strategy === "random" ? "selected" : ""}>Aleatorio</option>
      </select>
      <button class="btn btn-small btn-danger" data-eq="${i}">✕</button>`;
    list.appendChild(div);
  });
  list.querySelectorAll("[data-eq]").forEach((b) =>
    b.addEventListener("click", () => { combat.enemies.splice(+b.dataset.eq, 1); renderSetup(); }));
  list.querySelectorAll("[data-sq]").forEach((s) =>
    s.addEventListener("change", () => { combat.enemies[+s.dataset.sq].strategy = s.value; }));
}

function condBadges(e) {
  return e.conds.map((c) => {
    const def = CONDITIONS.find((x) => x.id === c.id);
    const nm = def ? (LANG === "es" ? def.nameEs : def.nameEn) : c.id;
    return `<span class="cond-badge">${nm}</span>`;
  }).join(" ");
}

/* ---------- Tablero visual ---------- */
let moveMode = false;
let mapEditMode = false;
let mapEditBrush = "pillar";

const OBSTACLE_ICON = { pillar: "⬛", crate: "📦", barrel: "🛢", wall: "🧱" };

function renderBoard() {
  const bd = ctEl("c-board");
  if (!bd) return;
  const p = combat.p;
  bd.className = "board theme-" + (combat.map.theme || "stone");
  const reach = new Set();
  if (moveMode && isPlayerTurn() && p) {
    const steps = Math.floor((p.move + p.withdraw) / 5);
    reachableCells(p.pos, steps).forEach((c) => reach.add(c.x + "," + c.y));
  }
  bd.innerHTML = "";
  bd.style.gridTemplateColumns = `repeat(${BOARD.w}, 1fr)`;
  for (let y = 0; y < BOARD.h; y++) for (let x = 0; x < BOARD.w; x++) {
    const cell = document.createElement("div");
    cell.id = `cell-${x}-${y}`;
    cell.className = "cell" + ((x + y) % 2 ? " alt" : "");
    const obs = getObstacle(x, y);
    if (obs) {
      cell.classList.add("obs", "obs-" + obs.type);
      cell.innerHTML = `<span class="obs-icon" title="${obs.type}">${OBSTACLE_ICON[obs.type]}</span>`;
    }
    if (reach.has(x + "," + y)) cell.classList.add("reach");
    if (p && p.pos.x === x && p.pos.y === y) {
      cell.innerHTML = `<span class="tok tok-p" title="${state.name}">${playerToken()}</span>`;
      if (isPlayerTurn()) cell.classList.add("cur");
    } else {
      const e = combat.enemies.find((en) => en.hp > 0 && en.pos.x === x && en.pos.y === y);
      if (e) {
        const isCur = combat.on && !isPlayerTurn() && currentCombatant().who === "e" && combat.enemies[currentCombatant().idx] === e;
        cell.innerHTML = `<span class="tok tok-e" title="${eName(e)} — ${e.hp}/${e.maxHp} PG · CA ${e.ac}">${enemyToken(e)}</span>`;
        if (isCur) cell.classList.add("cur");
        if (e.conds.length) cell.classList.add("has-cond");
      }
    }
    if (reach.has(x + "," + y)) {
      cell.addEventListener("click", () => { moveMode = false; playerMoveTo(x, y); });
    }
    if (mapEditMode) {
      cell.addEventListener("click", () => {
        if (mapEditBrush === "erase") removeObstacle(x, y); else addObstacle(x, y, mapEditBrush);
        renderBoard();
      });
      cell.addEventListener("mouseenter", (ev) => {
        if (ev.buttons === 1) {
          if (mapEditBrush === "erase") removeObstacle(x, y); else addObstacle(x, y, mapEditBrush);
          renderBoard();
        }
      });
    }
    bd.appendChild(cell);
  }
  const mv = ctEl("c-btn-move");
  if (mv) {
    mv.disabled = !isPlayerTurn() || (p.move + p.withdraw) < 5;
    mv.classList.toggle("btn-crimson", moveMode);
  }
}

/* ---------- Efectos visuales del tablero ---------- */
function cellCenter(x, y) {
  const cell = ctEl(`cell-${x}-${y}`);
  if (!cell) return null;
  const bd = ctEl("c-board").getBoundingClientRect();
  const r = cell.getBoundingClientRect();
  return { x: r.left - bd.left + r.width / 2, y: r.top - bd.top + r.height / 2 };
}

function boardFx(type, x, y, text) {
  const bd = ctEl("c-board");
  if (!bd) return;
  const pos = cellCenter(x, y);
  if (!pos) return;
  const el = document.createElement("div");
  el.className = "board-fx " + type;
  if (text) el.textContent = text;
  el.style.left = pos.x + "px";
  el.style.top = pos.y + "px";
  bd.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function fxHitAt(x, y, dmg, crit) {
  boardFx(crit ? "crit" : "hit", x, y, dmg ? "−" + dmg : "");
}

function fxHit(e, dmg, crit) {
  fxHitAt(e.pos.x, e.pos.y, dmg, crit);
}

function fxMissAt(x, y) {
  boardFx("miss", x, y, "×");
}

function fxMiss(e) {
  fxMissAt(e.pos.x, e.pos.y);
}

function flashCell(x, y, cls) {
  const cell = ctEl(`cell-${x}-${y}`);
  if (!cell) return;
  cell.classList.add(cls);
  setTimeout(() => cell.classList.remove(cls), 500);
}

function fxLine(from, to) {
  const bd = ctEl("c-board");
  if (!bd) return;
  const a = cellCenter(from.x, from.y), b = cellCenter(to.x, to.y);
  if (!a || !b) return;
  const line = document.createElement("div");
  line.className = "fx-line";
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  line.style.width = len + "px";
  line.style.left = a.x + "px";
  line.style.top = a.y + "px";
  line.style.transform = `rotate(${ang}rad)`;
  bd.appendChild(line);
  setTimeout(() => line.remove(), 500);
}

function renderSuggestions() {
  if (!combat.on || !isPlayerTurn() || !combat.p) return "";
  const p = combat.p;
  const tips = [];
  if (combat.round === 1) tips.push("🗡 1ª ronda: <strong>Asesinar</strong> da ventaja y +" + state.level + " daño si el enemigo no ha actuado.");
  const meleeFoes = combat.enemies.filter((e) => e.hp > 0 && distOf(e) <= 5);
  if (meleeFoes.length && !p.diseng && !p.withdraw) tips.push("⚠ Enemigo a 5 ft. <strong>Retirarse</strong> evita ataques de oportunidad.");
  if (!p.hidden && !p.steady && p.ba && meleeFoes.length === 0) tips.push("🌑 <strong>Esconderse</strong> → ataque con ventaja → Furtivo.");
  if (!p.steady && p.ba && p.move > 0 && meleeFoes.length === 0) tips.push("🎯 <strong>Puntería Firme</strong> da ventaja en tu próximo ataque.");
  if (p.nickReady && p.ba) tips.push("🗡 Arma ligera: puedes hacer un <strong>ataque extra</strong>.");
  return tips.length ? "💡 " + tips[0] : "";
}

function renderCombat() {
  const area = ctEl("c-arena");
  if (!area) return;
  ctEl("c-setup").hidden = combat.on || combat.log.length > 0 ? true : false;
  area.hidden = combat.log.length === 0;

  // Cabecera: ronda y orden
  ctEl("c-round").textContent = combat.on ? `${ct("round")} ${combat.round}` : "—";
  const ord = ctEl("c-order");
  ord.innerHTML = "";
  combat.order.forEach((o, i) => {
    const isCur = combat.on && i === combat.turn;
    const dead = o.who === "e" && combat.enemies[o.idx].hp <= 0;
    const div = document.createElement("div");
    div.className = "init-chip" + (isCur ? " cur" : "") + (dead ? " dead" : "");
    const name = o.who === "p" ? state.name : eName(combat.enemies[o.idx]);
    const hpPct = o.who === "p" ? (combat.p.hp / state.hpMax * 100) : (combat.enemies[o.idx].hp / combat.enemies[o.idx].maxHp * 100);
    const conds = o.who === "e" ? condBadges(combat.enemies[o.idx]) : "";
    div.innerHTML = `<span><strong>${name}</strong> · ${o.init}${conds ? " " + conds : ""}</span>
      <span class="init-hp-bar" aria-hidden="true"><span class="init-hp-fill" style="width:${Math.max(0, hpPct)}%"></span></span>`;
    ord.appendChild(div);
  });

  if (!combat.p) return;
  const p = combat.p;

  // Estado del jugador
  ctEl("c-banner").textContent = combat.on ? (isPlayerTurn() ? ct("yourTurn") : ct("enemyTurn")) : "";
  ctEl("c-php").textContent = `${p.hp} / ${state.hpMax}`;
  ctEl("c-pac").textContent = state.ac;
  const pips = [
    [ct("moveLeft"), `${p.move + p.withdraw} ft`, p.move + p.withdraw > 0],
    [ct("actionFree"), null, p.action],
    [ct("baFree"), null, p.ba],
    [ct("reactionFree"), null, p.react]
  ];
  ctEl("c-pips").innerHTML = pips.map(([lbl, val, ok]) =>
    `<span class="turn-pip ${ok ? "on" : "off"}">${lbl}${val ? ": " + val : ""} ${val === null ? (ok ? "✓" : "✗") : ""}</span>`).join("");
  ctEl("c-pconds").innerHTML = (p.hidden ? `<span class="cond-badge">🫥 Hidden</span>` : "") +
    (p.diseng ? `<span class="cond-badge">Disengage</span>` : "") +
    (p.steady ? `<span class="cond-badge">🎯 Steady</span>` : "") +
    p.conds.map((c) => `<span class="cond-badge">😵 ${c.id}</span>`).join("");

  // Sugerencias contextuales
  const sug = ctEl("c-suggestions");
  if (sug) sug.innerHTML = renderSuggestions();

  // Enemigos
  const eList = ctEl("c-enemies");
  eList.innerHTML = "";
  combat.enemies.forEach((e, i) => {
    const div = document.createElement("div");
    div.className = "enemy-row" + (e.hp <= 0 ? " dead" : "");
    const pct = Math.max(0, (e.hp / e.maxHp) * 100);
    div.innerHTML = `
      <div class="enemy-info">
        <strong>${eName(e)}</strong> ${condBadges(e)}
        <div class="enemy-bar"><div class="enemy-bar-fill" style="width:${pct}%"></div></div>
        <span class="hint-inline">${e.hp}/${e.maxHp} PG · CA ${e.ac} · ${ct("distFt")}: ${distOf(e)} ft</span>
      </div>`;
    eList.appendChild(div);
  });

  // Botones de acción
  ctEl("c-btn-steady").disabled = !isPlayerTurn() || !p.ba;
  ctEl("c-btn-hide").disabled = !isPlayerTurn() || !p.ba;
  ctEl("c-btn-dash").disabled = !isPlayerTurn() || !p.ba;
  ctEl("c-btn-disengage").disabled = !isPlayerTurn() || !p.ba;
  ctEl("c-btn-attack").disabled = !isPlayerTurn() || !p.action;
  ctEl("c-btn-end").disabled = !isPlayerTurn();
  ctEl("c-apply-hp").hidden = combat.on;
  renderBoard();
  renderCombatLog();
}

/* ---------- Panel de ataque ---------- */
function openAttackPanel() {
  const panel = ctEl("c-attack-panel");
  panel.hidden = false;
  const wSel = ctEl("c-atk-weapon");
  wSel.innerHTML = "";
  state.weapons.forEach((w, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${weaponView(w).name} (${w.dice}d${w.sides}+${w.bonus})`;
    wSel.appendChild(opt);
  });
  const tSel = ctEl("c-atk-target");
  tSel.innerHTML = "";
  combat.enemies.forEach((e, i) => {
    if (e.hp <= 0) return;
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${eName(e)} (${distOf(e)} ft · CA ${e.ac})`;
    tSel.appendChild(opt);
  });
  // Golpes Astutos
  const box = ctEl("c-atk-strikes");
  box.innerHTML = "";
  const strikeLabel = { poison: "csPoison", trip: "csTrip", withdraw: "csWithdraw", daze: "csDaze", knockout: "csKnockOut", obscure: "csObscure" };
  STRIKES.forEach((s) => {
    const lab = document.createElement("label");
    lab.className = "cs-option";
    const locked = state.level < s.lock;
    lab.innerHTML = `<input type="checkbox" value="${s.id}" data-cost="${s.cost}" ${locked ? "disabled" : ""}>
      <span>${t(strikeLabel[s.id])}${locked ? " 🔒 N" + s.lock : ""}</span>`;
    box.appendChild(lab);
  });
  box.querySelectorAll("input").forEach((cb) => {
    cb.addEventListener("change", () => {
      const checked = Array.from(box.querySelectorAll("input:checked"));
      const cost = checked.reduce((a, c) => a + (+c.dataset.cost), 0);
      if (checked.length > maxCunningStrikes(state.level) || cost > sneakDiceCount(state.level)) cb.checked = false;
    });
  });
}

function confirmAttack() {
  const w = state.weapons[+ctEl("c-atk-weapon").value];
  const e = combat.enemies[+ctEl("c-atk-target").value];
  if (!w || !e) return;
  const strikes = Array.from(ctEl("c-atk-strikes").querySelectorAll("input:checked")).map((c) => c.value);
  const ally = ctEl("c-atk-ally").checked;
  ctEl("c-attack-panel").hidden = true;
  playerAttack(w, e, { strikes, ally });
}

/* ---------- Editor de mapa ---------- */
function renderEditorBoard() {
  const bd = ctEl("me-board");
  if (!bd) return;
  bd.className = "board theme-" + (combat.map.theme || "stone");
  bd.innerHTML = "";
  bd.style.gridTemplateColumns = `repeat(${BOARD.w}, 1fr)`;
  for (let y = 0; y < BOARD.h; y++) for (let x = 0; x < BOARD.w; x++) {
    const cell = document.createElement("div");
    cell.id = `me-cell-${x}-${y}`;
    cell.className = "cell" + ((x + y) % 2 ? " alt" : "");
    const obs = getObstacle(x, y);
    if (obs) {
      cell.classList.add("obs", "obs-" + obs.type);
      cell.innerHTML = `<span class="obs-icon" title="${obs.type}">${OBSTACLE_ICON[obs.type]}</span>`;
    }
    cell.addEventListener("click", () => {
      if (mapEditBrush === "erase") removeObstacle(x, y); else addObstacle(x, y, mapEditBrush);
      renderEditorBoard(); renderBoard();
    });
    cell.addEventListener("mouseenter", (ev) => {
      if (ev.buttons === 1) {
        if (mapEditBrush === "erase") removeObstacle(x, y); else addObstacle(x, y, mapEditBrush);
        renderEditorBoard(); renderBoard();
      }
    });
    bd.appendChild(cell);
  }
}

function initMapEditor() {
  const theme = ctEl("me-theme"), brush = ctEl("me-brush"), density = ctEl("me-density");
  const random = ctEl("me-random"), clear = ctEl("me-clear");
  const save = ctEl("me-save"), load = ctEl("me-load"), toggle = ctEl("me-toggle");
  const slotName = ctEl("me-slot-name"), slotList = ctEl("me-slot-list");
  if (!theme || !brush) return;
  const details = ctEl("map-editor");
  if (details) details.addEventListener("toggle", () => { if (details.open) renderEditorBoard(); });
  theme.value = combat.map.theme || "stone";
  theme.addEventListener("change", () => { combat.map.theme = theme.value; renderEditorBoard(); renderBoard(); });
  brush.addEventListener("change", () => { mapEditBrush = brush.value; });
  if (random) random.addEventListener("click", () => {
    generateRandomMap((parseInt(density.value, 10) || 20) / 100);
    theme.value = combat.map.theme;
    renderEditorBoard(); renderBoard();
  });
  if (clear) clear.addEventListener("click", () => { clearMap(); renderEditorBoard(); renderBoard(); });
  if (toggle) toggle.addEventListener("click", () => {
    mapEditMode = !mapEditMode;
    toggle.textContent = mapEditMode ? "✏ Desactivar editor" : "✏ Activar editor";
    toggle.classList.toggle("btn-crimson", mapEditMode);
    renderEditorBoard();
  });
  function refreshSlots() {
    if (!slotList) return;
    slotList.innerHTML = "";
    listMapSlots().forEach((n) => {
      const opt = document.createElement("option");
      opt.value = n; opt.textContent = n;
      slotList.appendChild(opt);
    });
  }
  if (save) save.addEventListener("click", () => {
    const name = (slotName.value || "Mapa").trim();
    if (!name) return;
    saveMapSlot(name);
    slotName.value = "";
    refreshSlots();
  });
  if (load) load.addEventListener("click", () => {
    if (!slotList || !slotList.value) return;
    loadMapSlot(slotList.value);
    theme.value = combat.map.theme;
    renderEditorBoard(); renderBoard();
  });
  refreshSlots();
}

/* ---------- Arranque de la pestaña ---------- */
function initCombat() {
  combat.confirm = (q) => window.confirm(q);
  ctEl("c-btn-add").addEventListener("click", () => {
    const e = spawnEnemy(ctEl("c-catalog").value);
    if (e) { combat.enemies.push(e); renderSetup(); }
  });
  ctEl("c-cat-filter").addEventListener("change", renderSetup);
  ctEl("c-search").addEventListener("input", renderSetup);
  // Enemigo personalizado
  ctEl("c-btn-custom").addEventListener("click", () => {
    const cf = (id) => document.getElementById(id.replace(/^#/, ""));
    const v = (id) => cf(id).value.trim();
    const name = v("#cf-name");
    if (!name) return;
    const custom = {
      key: "custom" + Date.now(), cat: "custom", role: "melee",
      es: name, en: name, cr: "—",
      hp: Math.max(1, parseInt(v("#cf-hp"), 10) || 10),
      ac: parseInt(v("#cf-ac"), 10) || 12,
      speed: parseInt(v("#cf-speed"), 10) || 30,
      init: parseInt(v("#cf-init"), 10) || 0, percep: 0,
      mods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      attacks: [{ es: "Ataque", en: "Attack", bonus: parseInt(v("#cf-bonus"), 10) || 3, dmg: v("#cf-dmg") || "1d6+1", melee: 5, range: null }]
    };
    ENEMIES.push(custom);
    combat.enemies.push(spawnEnemy(custom.key));
    ["#cf-name", "#cf-hp", "#cf-ac", "#cf-bonus", "#cf-dmg", "#cf-speed", "#cf-init"].forEach((id) => { cf(id).value = ""; });
    renderSetup();
  });
  ctEl("c-btn-start").addEventListener("click", () => {
    if (!combat.enemies.length) { alert(ct("needEnemies")); return; }
    const auto = ctEl("me-auto");
    if (auto && auto.checked && combat.map.obstacles.length === 0) {
      const density = (parseInt(ctEl("me-density").value, 10) || 20) / 100;
      generateRandomMap(density);
    }
    startCombat();
    renderSetup();
    renderCombat();
  });
  ctEl("c-btn-end-combat").addEventListener("click", () => {
    combat.on = false; combat.log = []; combat.enemies = []; combat.p = null;
    renderSetup(); renderCombat();
  });
  const logToggle = ctEl("c-log-toggle");
  if (logToggle) {
    logToggle.addEventListener("click", () => {
      const log = ctEl("c-log");
      const collapsed = log.classList.toggle("collapsed");
      logToggle.textContent = collapsed ? "Mostrar" : "Ocultar";
      logToggle.setAttribute("aria-expanded", String(!collapsed));
    });
  }
  ctEl("c-btn-attack").addEventListener("click", openAttackPanel);
  ctEl("c-atk-roll").addEventListener("click", confirmAttack);
  ctEl("c-atk-cancel").addEventListener("click", () => { ctEl("c-attack-panel").hidden = true; });
  ctEl("c-btn-move").addEventListener("click", () => { moveMode = !moveMode; renderBoard(); });
  ctEl("c-btn-steady").addEventListener("click", () => playerBonus("steady"));
  ctEl("c-btn-hide").addEventListener("click", () => playerBonus("hide"));
  ctEl("c-btn-dash").addEventListener("click", () => playerBonus("dash"));
  ctEl("c-btn-disengage").addEventListener("click", () => playerBonus("disengage"));
  ctEl("c-btn-end").addEventListener("click", () => { ctEl("c-attack-panel").hidden = true; nextTurn(); renderCombat(); });
  ctEl("c-apply-hp").addEventListener("click", () => {
    state.hpCurrent = combat.p.hp;
    saveState();
    renderIdentity();
    alert(t("saved"));
  });
  const saveSummary = ctEl("c-summary-save");
  const resetSummary = ctEl("c-summary-reset");
  if (saveSummary) saveSummary.addEventListener("click", () => {
    if (combat.p) { state.hpCurrent = combat.p.hp; saveState(); renderIdentity(); alert(t("saved")); }
  });
  if (resetSummary) resetSummary.addEventListener("click", () => {
    combat.on = false; combat.log = []; combat.enemies = []; combat.p = null;
    renderSetup(); renderCombat();
  });
  initMapEditor();
  const simBtn = ctEl("c-btn-sim");
  if (simBtn) {
    simBtn.addEventListener("click", () => {
      simBtn.disabled = true;
      simBtn.textContent = "Simulando…";
      setTimeout(() => {
        const r = runMonteCarlo(100);
        const box = ctEl("sim-result");
        box.innerHTML = `
          <div class="sim-box"><div class="v">${r.winPct}%</div><div class="l">Victorias</div></div>
          <div class="sim-box"><div class="v">${r.avgRounds}</div><div class="l">Rondas medias</div></div>
          <div class="sim-box"><div class="v">${r.avgHp}</div><div class="l">PG restantes (media)</div></div>
          <div class="sim-box"><div class="v">${r.losses}</div><div class="l">Derrotas</div></div>`;
        simBtn.disabled = false;
        simBtn.textContent = "Simular 100 combates";
      }, 50);
    });
  }
  renderSetup();
}
