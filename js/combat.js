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
  confirm: null   // inyectable (UI: window.confirm); tests lo sustituyen
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
    sneak: false, hidden: false, diseng: false, steady: false, withdraw: 0
  };
}

function spawnEnemy(key) {
  const tpl = ENEMIES.find((x) => x.key === key);
  if (!tpl) return null;
  const e = structuredClone(tpl);
  e.maxHp = tpl.hp;
  e.dist = 30;        // distancia al jugador (ft); Fase 2: tablero 2D
  e.conds = [];       // [{id, expire}] expire: nº de SUS turnos restantes (condiciones con duración)
  e.acted = false;    // para Asesinar (1ª ronda)
  e.react = true;
  return e;
}

function eName(e) { return LANG === "es" ? e.es : e.en; }

function cLog(html, cls) {
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
  combat.round = 1;
  combat.turn = 0;
  combat.p = newCombatPlayer();
  combat.log = [];
  combat.enemies.forEach((e) => { e.acted = false; e.conds = []; e.hp = e.maxHp; e.dist = 30; e.react = true; });

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
    cLog(`— ${ct("round")} ${combat.round} · ${ct("turnStart")} <strong>${state.name}</strong> —`, "log-info");
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

function checkCombatEnd() {
  if (!combat.on) return;
  if (combat.enemies.every((e) => e.hp <= 0)) {
    combat.on = false;
    cLog(ct("victory"), "log-crit");
  } else if (combat.p && combat.p.hp <= 0) {
    combat.on = false;
    cLog(ct("defeat"), "log-dead");
  }
  if (!combat.on && typeof renderCombat === "function") renderCombat();
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
  if (!p.action) { cLog("⛔ " + ct("noAction"), "log-miss"); return false; }

  // --- Alcance ---
  const cat = w.weaponId ? WEAPON_MASTERY.find((x) => x.id === w.weaponId) : null;
  const melee = cat ? cat.melee : 5;
  const range = cat ? cat.range : null;
  const fin = cat ? cat.fin : true; // armas manuales: se asume Sutil
  let mode = null;
  if (melee && e.dist <= melee) mode = "melee";
  else if (range) {
    const [rn, rl] = range.split("/").map(Number);
    if (e.dist <= rl) mode = "ranged";
  }
  if (!mode) { cLog(`⛔ ${eName(e)} ${ct("noRange")} (${e.dist} ft)`, "log-miss"); return false; }

  // --- Ventaja / desventaja ---
  const reasons = [];
  let adv = false, dis = false;
  const cm = condModsVs(e, e.dist);
  if (cm.adv) { adv = true; if (hasCond(e, "prone")) reasons.push(ct("proneAdv")); else if (hasCond(e, "blinded")) reasons.push(ct("blindAdv")); }
  if (cm.dis) { dis = true; }
  if (p.steady) { adv = true; reasons.push(ct("steadyOn")); }
  if (p.hidden) { adv = true; reasons.push("🫥 " + ct("hiddenNow")); }
  if (combat.round === 1 && !e.acted) { adv = true; reasons.push("🗡 " + ct("firstRound")); }
  if (mode === "ranged") {
    const [rn] = range.split("/").map(Number);
    if (e.dist > rn) { dis = true; reasons.push(ct("longRangeDis")); }
    const meleeFoe = combat.enemies.find((x) => x.hp > 0 && x !== e && x.dist <= 5);
    if (e.dist <= 5 || meleeFoe) { dis = true; reasons.push(ct("rangedInMelee")); }
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

  p.action = false;
  p.steady = false;
  p.hidden = false; // atacar revela tu posición

  if (!isHit) {
    cLog(`${w.name}: ${rollStr} ${fmtMod(atkBonus)} = ${total} ${ct("vsAc")} ${e.ac} → <em>${ct("missWord")}</em>`, "log-miss");
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

  if (e.hp <= 0) cLog(`💀 ${eName(e)} ${ct("enemyDead")}`, "log-dead");
  checkCombatEnd();
  if (typeof renderCombat === "function") renderCombat();
  return true;
}

/* ================= MOVIMIENTO DEL JUGADOR ================= */
/**
 * Mueve al jugador respecto a un enemigo (ft positivo = alejarse).
 * Gestiona presupuesto de movimiento, Retirada y ataques de oportunidad.
 */
function playerMove(e, delta) {
  const p = combat.p;
  if (!combat.on || !isPlayerTurn()) return false;
  const budget = p.move + p.withdraw;
  const want = Math.abs(delta);
  if (want > budget) { cLog("⛔ " + ct("noMove"), "log-miss"); return false; }

  // Enemigos en melé ANTES del movimiento
  const inMeleeBefore = combat.enemies.filter((x) => x.hp > 0 && x.dist <= 5);
  e.dist = Math.max(0, e.dist + delta);

  // ¿Salí del alcance de alguien? → AdO salvo Retirarse/Retirada
  const freeMove = p.diseng || p.withdraw >= want;
  inMeleeBefore.forEach((x) => {
    if (x.dist > 5 && !freeMove && x.react && !hasCond(x, "unconscious")) {
      const atk = x.attacks.find((a) => a.melee);
      if (atk) {
        x.react = false;
        cLog(`⚠ ${ct("oaLog")} ${eName(x)}!`, "log-miss");
        enemyAttackRoll(x, atk, true);
      }
    }
  });

  // consume primero el movimiento de Retirada (libre de AdO)
  const useWithdraw = Math.min(p.withdraw, want);
  p.withdraw -= useWithdraw;
  p.move -= (want - useWithdraw);
  cLog(`👣 ${state.name} ${ct("aiMove")} ${want} ft → ${eName(e)}: ${e.dist} ft`, "log-info");
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
    if (ok) { p.hidden = true; cLog(`🫥 Sigilo: ${r} ${fmtMod(mod)} = ${r + mod} vs Percepción pasiva ${best} → ${ct("hiddenNow")}`, "log-hit"); }
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
  if (p.hidden) dis = true; // sabe dónde estabas, pero no te ve bien
  let rolls, chosen;
  if (dis) { rolls = [rollDie(20), rollDie(20)]; chosen = Math.min(...rolls); }
  else { rolls = [rollDie(20)]; chosen = rolls[0]; }
  const total = chosen + atk.bonus;
  const isHit = chosen !== 1 && (chosen === 20 || total >= state.ac);
  const rollStr = rolls.length > 1 ? `d20(${rolls.join(", ")})→${chosen}` : `d20(${chosen})`;
  const aName = LANG === "es" ? atk.es : atk.en;
  if (!isHit) {
    cLog(`🛡 ${eName(e)} (${aName}): ${rollStr} ${fmtMod(atk.bonus)} = ${total} ${ct("vsAc")} ${state.ac} → <em>${ct("missWord")}</em>`, "log-miss");
    if (p.hidden) { p.hidden = false; }
    return 0;
  }
  const crit = chosen === 20;
  let res = rollDiceExpr(atk.dmg, crit);
  let dmg = res.total;
  // Esquiva Asombrosa
  if (p.react && !isOA) {
    const ask = combat.confirm || ((q) => (typeof window !== "undefined" ? window.confirm(q) : false));
    if (ask(`${ct("uncannyQ")}\n${ct("dmgWord")}: ${dmg}`)) {
      dmg = Math.floor(dmg / 2);
      p.react = false;
      cLog(`🌀 ${ct("uncannyUsed")}: ${dmg}`, "log-info");
    }
  }
  p.hp = Math.max(0, p.hp - dmg);
  if (p.hidden) p.hidden = false;
  cLog(`🩸 ${eName(e)} (${aName}): ${rollStr} ${fmtMod(atk.bonus)} = ${total} ${ct("vsAc")} ${state.ac} → <strong>${crit ? ct("critWord") : ct("hitWord")}</strong> — ${dmg} ${ct("dmgWord")} [${state.name}: ${p.hp} PG]`, "log-miss");
  checkCombatEnd();
  return dmg;
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
function enemyTakeTurn(e) {
  if (e.hp <= 0) { enemyEndTurn(e); return; }
  cLog(`🤖 ${eName(e)} ${ct("aiThink")}`, "log-info");

  if (hasCond(e, "unconscious")) {
    cLog(`😵 ${eName(e)}: ${ct("uncSkip")}`, "log-info");
    enemyEndTurn(e);
    return;
  }
  const dazed = hasCond(e, "dazed");
  let move = e.speed;
  let canAct = true;

  if (hasCond(e, "prone")) {
    cLog(`🧍 ${eName(e)} ${ct("aiStand")}`, "log-info");
    removeCond(e, "prone");
    move = Math.floor(move / 2);
  }

  // Cobardía: PG < 25% → retirada y huir
  if (e.coward && e.hp < e.maxHp / 4) {
    e.dist += move;
    cLog(`🏃 ${eName(e)} ${ct("aiFlee")} → ${e.dist} ft`, "log-info");
    enemyEndTurn(e);
    return;
  }

  // Elegir ataque disponible
  const inRange = (a) => (a.melee && e.dist <= a.melee) ||
    (a.range && e.dist <= +a.range.split("/")[1]);
  let atk = e.attacks.find((a) => a.melee && e.dist <= a.melee) ||
            e.attacks.find((a) => a.range && e.dist <= +a.range.split("/")[0]) ||
            e.attacks.find(inRange);

  // Acercarse si nada alcanza
  if (!atk) {
    const step = Math.min(move, e.dist - 5);
    if (step > 0) { e.dist -= step; cLog(`👣 ${eName(e)} ${ct("aiMove")} ${step} ft → ${e.dist} ft (${ct("aiTarget")})`, "log-info"); }
    if (dazed) { cLog(`😵 ${ct("dazedNote")}`, "log-info"); enemyEndTurn(e); return; }
    atk = e.attacks.find((a) => a.melee && e.dist <= a.melee) || e.attacks.find(inRange);
    if (!atk) {
      // Dash: corre el doble
      const step2 = Math.min(e.speed, e.dist - 5);
      if (step2 > 0) { e.dist -= step2; cLog(`💨 ${eName(e)} ${ct("aiDash")} → ${e.dist} ft`, "log-info"); }
      atk = e.attacks.find((a) => a.melee && e.dist <= a.melee);
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
  sel.innerHTML = "";
  ENEMIES.forEach((e) => {
    const opt = document.createElement("option");
    opt.value = e.key;
    opt.textContent = `${eName(e)} (CR ${e.cr} · ${e.hp} PG · CA ${e.ac})`;
    sel.appendChild(opt);
  });
  const list = ctEl("c-queue");
  list.innerHTML = "";
  combat.enemies.forEach((e, i) => {
    const div = document.createElement("div");
    div.className = "enemy-row";
    div.innerHTML = `<span><strong>${eName(e)}</strong> — ${e.hp} PG · CA ${e.ac} · ${e.speed} ft</span>
      <button class="btn btn-small btn-danger" data-eq="${i}">✕</button>`;
    list.appendChild(div);
  });
  list.querySelectorAll("[data-eq]").forEach((b) =>
    b.addEventListener("click", () => { combat.enemies.splice(+b.dataset.eq, 1); renderSetup(); }));
}

function condBadges(e) {
  return e.conds.map((c) => {
    const def = CONDITIONS.find((x) => x.id === c.id);
    const nm = def ? (LANG === "es" ? def.nameEs : def.nameEn) : c.id;
    return `<span class="cond-badge">${nm}</span>`;
  }).join(" ");
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
    const span = document.createElement("span");
    const isCur = combat.on && i === combat.turn;
    const dead = o.who === "e" && combat.enemies[o.idx].hp <= 0;
    span.className = "init-chip" + (isCur ? " cur" : "") + (dead ? " dead" : "");
    span.textContent = (o.who === "p" ? state.name : eName(combat.enemies[o.idx])) + ` (${o.init})`;
    ord.appendChild(span);
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
    (p.steady ? `<span class="cond-badge">🎯 Steady</span>` : "");

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
        <span class="hint-inline">${e.hp}/${e.maxHp} PG · CA ${e.ac} · ${ct("distFt")}: ${e.dist} ft</span>
      </div>
      <div class="enemy-moves">
        <button class="btn btn-small" data-melee="${i}" ${!isPlayerTurn() || e.dist <= 5 || e.hp <= 0 ? "disabled" : ""}>${ct("toMelee")}</button>
        <button class="btn btn-small" data-close="${i}" ${!isPlayerTurn() || e.hp <= 0 ? "disabled" : ""}>−15 ft</button>
        <button class="btn btn-small" data-far="${i}" ${!isPlayerTurn() || e.hp <= 0 ? "disabled" : ""}>+15 ft</button>
      </div>`;
    eList.appendChild(div);
  });
  eList.querySelectorAll("[data-melee]").forEach((b) => b.addEventListener("click", () => playerMove(combat.enemies[+b.dataset.melee], 5 - combat.enemies[+b.dataset.melee].dist)));
  eList.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => playerMove(combat.enemies[+b.dataset.close], -15)));
  eList.querySelectorAll("[data-far]").forEach((b) => b.addEventListener("click", () => playerMove(combat.enemies[+b.dataset.far], 15)));

  // Botones de acción
  ctEl("c-btn-steady").disabled = !isPlayerTurn() || !p.ba;
  ctEl("c-btn-hide").disabled = !isPlayerTurn() || !p.ba;
  ctEl("c-btn-dash").disabled = !isPlayerTurn() || !p.ba;
  ctEl("c-btn-disengage").disabled = !isPlayerTurn() || !p.ba;
  ctEl("c-btn-attack").disabled = !isPlayerTurn() || !p.action;
  ctEl("c-btn-end").disabled = !isPlayerTurn();
  ctEl("c-apply-hp").hidden = combat.on;
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
    opt.textContent = `${eName(e)} (${e.dist} ft · CA ${e.ac})`;
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

/* ---------- Arranque de la pestaña ---------- */
function initCombat() {
  combat.confirm = (q) => window.confirm(q);
  ctEl("c-btn-add").addEventListener("click", () => {
    const e = spawnEnemy(ctEl("c-catalog").value);
    if (e) { combat.enemies.push(e); renderSetup(); }
  });
  ctEl("c-btn-start").addEventListener("click", () => {
    if (!combat.enemies.length) { alert(ct("needEnemies")); return; }
    startCombat();
    renderSetup();
    renderCombat();
  });
  ctEl("c-btn-end-combat").addEventListener("click", () => {
    combat.on = false; combat.log = []; combat.enemies = []; combat.p = null;
    renderSetup(); renderCombat();
  });
  ctEl("c-btn-attack").addEventListener("click", openAttackPanel);
  ctEl("c-atk-roll").addEventListener("click", confirmAttack);
  ctEl("c-atk-cancel").addEventListener("click", () => { ctEl("c-attack-panel").hidden = true; });
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
  renderSetup();
}
