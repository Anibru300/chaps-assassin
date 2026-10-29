/* Rutas, fichas, reproducción, escenarios, guardado y telemetría de combate. */
(function () {
  "use strict";
  const el = id => document.getElementById(id);
  const text = (id, value) => { if (el(id)) el(id).textContent = value; };
  const scope = () => JSON.stringify(window.CHAPS_FEATURES?.profiles.current || { uid: null, id: "chaps" });
  const storageKey = () => "chaps-battle-v1:" + scope();
  const signature = () => JSON.stringify([state.name, state.level, state.hpMax, state.ac, state.speed, state.abilities, state.weapons, state.skills]);
  const node = (tag, content, cls) => { const value = document.createElement(tag); if (content != null) value.textContent = content; if (cls) value.className = cls; return value; };
  const metrics = () => combat.tactical ||= { damage: 0, received: 0, allyDamage: 0, healed: 0, actions: 0, bonus: 0, reactions: 0, feet: 0, attacks: 0, misses: 0, sneaks: 0, cunningDice: 0, crits: 0, enemyCrits: 0, targets: {}, weapons: {} };
  let pending = null, timer = null, generation = 0, paused = false, speed = 900, executing = false;
  let ownerScope = null, ownerUid = null, route = null, lastMove = null, selected = null, effect = "cut", depth = 0, redirectHero = null, saveTimer = null;
  const palette = { cut: "#e8d7bd", arrow: "#e5c47d", fire: "#ff8c40", ice: "#8fe3ff", poison: "#a5e36c", radiant: "#ffe99f", force: "#d8a2ff", healing: "#79f0b7" };
  const symbols = { cut: "✦", arrow: "➶", fire: "🔥", ice: "❄", poison: "☣", radiant: "✧", force: "◉", healing: "+" };
  const kind = value => {
    const name = String(value?.en || value?.es || value?.name || "");
    if (/fire|fuego|ardiente|llama/i.test(name)) return "fire";
    if (/cold|ice|gélid|hielo/i.test(name)) return "ice";
    if (/poison|veneno/i.test(name)) return "poison";
    if (/heal|cura/i.test(name)) return "healing";
    if (/radiant|sacred|guiding|sagrad|guiad/i.test(name)) return "radiant";
    if (/eldritch|force|sobrenatural|atronador|thunder/i.test(name)) return "force";
    return /bow|arco|ballesta|flecha|javelin|jabalina/i.test(name) ? "arrow" : "cut";
  };
  function authorized() { return ownerScope === scope() && (!ownerUid || window.CHAPS_CLOUD?.userInfo()?.uid === ownerUid); }
  function cancel() { clearTimeout(timer); timer = null; pending = null; generation++; }
  function status() {
    const waiting = pending && combat.on;
    text("bt-turn-status", waiting ? `${paused ? "Pausado" : "Preparando turno"}: ${eName(pending.enemy)}. ${enemyIntent(pending.enemy)}` : combat.on ? "Tu turno: elige acción o movimiento." : "Combate finalizado.");
    text("bt-pause", paused ? "Continuar enemigos" : "Pausar enemigos");
    el("bt-pause")?.setAttribute("aria-pressed", String(paused));
    if (el("bt-step")) el("bt-step").disabled = !waiting;
    if (el("bt-save")) el("bt-save").disabled = !combat.p || !authorized();
    if (el("bt-heal")) el("bt-heal").disabled = !combat.on;
  }
  function armTimer() {
    clearTimeout(timer);
    if (!pending || paused || !combat.on) return;
    const token = generation;
    timer = setTimeout(() => { if (token === generation) executeEnemy(); }, speed);
  }
  function validTurn(value) { return value && combat.on && authorized() && combat.turn === value.turn && combat.round === value.round && currentCombatant()?.who === "e" && combat.enemies[currentCombatant().idx] === value.enemy; }
  function defendAlly(enemy) {
    const ally = combat.scenario?.ally;
    if (!ally || ally.hp <= 0 || enemy.hp <= 0 || hasCond(enemy, "unconscious") || enemy.spells || enemy.breath) return false;
    if (enemy.coward && enemy.hp < enemy.maxHp / 4 && combat.diff !== "easy") return false;
    if (distBetween(enemy.pos, ally.pos) > distOf(enemy)) return false;
    let attack = enemy.attacks.find(value => value.melee) || enemy.attacks[0];
    if (!attack) return false;
    triggerTerrain(enemy.pos.x, enemy.pos.y, enemy, "start"); enemy.smiteUsed = false;
    let moved = false, budget = Math.max(0, enemy.speed - (enemy.slow ? 10 : 0));
    if (hasCond(enemy, "prone")) { removeCond(enemy, "prone"); budget = Math.floor(budget / 2); }
    if (distBetween(enemy.pos, ally.pos) > (attack.melee || 5)) {
      const choices = reachableCells(enemy.pos, budget);
      choices.sort((a, b) => distBetween(a, ally.pos) - distBetween(b, ally.pos) || a.cost - b.cost);
      const route = choices[0] && movementPath(enemy.pos, choices[0], budget), wasClose = distOf(enemy) <= 5;
      for (const point of route?.slice(1) || []) {
        if (enemy.hp <= 0 || !combat.on) break;
        enemy.pos = { x: point.x, y: point.y }; moved = true; triggerTerrain(point.x, point.y, enemy, "enter");
      }
      if (moved) tryPlayerOA(enemy, wasClose);
    }
    cLog(`🛡 ${escapeHtml(eName(enemy))} amenaza al explorador.`, "log-info");
    if (enemy.hp > 0 && combat.on && !(moved && hasCond(enemy, "dazed")) && distBetween(enemy.pos, ally.pos) <= (attack.melee || 5)) {
      redirectHero = combat.p;
      try { combat.p = ally; enemyAttackRoll(enemy, attack, false); }
      finally { combat.p = redirectHero; redirectHero = null; }
    }
    enemyEndTurn(enemy); return true;
  }
  function executeEnemy() {
    clearTimeout(timer); timer = null;
    const value = pending; pending = null;
    if (!validTurn(value)) { paused = true; status(); return; }
    executing = true;
    try {
      if (!defendAlly(value.enemy)) enemyTakeTurn(value.enemy);
      checkCombatEnd();
      if (combat.on) nextTurn();
    } finally { executing = false; }
    renderCombat(); if (!combat.on) renderSummary();
  }
  function prepareScenario(type) {
    if (combat.on && !confirm("¿Reemplazar combate actual por escenario nuevo?")) return;
    cancel(); combat.on = false; combat.p = null; combat.order = []; combat.turn = 0; combat.round = 1; combat.log = []; combat.result = null; selected = null; clearMap();
    const advanced = state.level >= 7;
    const keys = type === "ambush" ? (advanced ? ["veteran", "assassin"] : ["goblin", "bandit"]) : type === "survive" ? (advanced ? ["knight", "wizard"] : ["orc", "goblin"]) : (advanced ? ["veteran", "berserker"] : ["bandit", "goblin"]);
    combat.enemies = keys.map(spawnEnemy).filter(Boolean);
    combat.map.theme = type === "survive" ? "grass" : "stone";
    if (type !== "free") for (const point of [[4, 1], [4, 2], [4, 5], [4, 6], [7, 2], [7, 5]]) addObstacle(point[0], point[1], "pillar");
    combat.scenario = type === "free" ? null : { type, goal: 5 };
    if (type === "free") combat.enemies = [];
    if (el("me-auto")) el("me-auto").checked = false;
    text("bt-objective", objective()); renderSetup(); renderCombat();
    text("bt-save-status", "Escenario preparado. Revisa enemigos y pulsa Iniciar combate.");
  }
  function objective() {
    const value = combat.scenario;
    if (!value) return "Combate libre: derrota enemigos.";
    return ({ ambush: "Emboscada: enemigos en flancos. Derrota a todos.", escape: "Escape: llega vivo a puerta este (columna final, filas centrales).", protect: `Protege explorador: ${value.ally ? value.ally.hp + "/" + value.ally.maxHp + " PG · " : ""}elimina amenazas o resiste ${value.goal} rondas completas.`, survive: `Resiste ${value.goal} rondas completas o elimina amenazas.` })[value.type];
  }
  function missionResult() {
    const value = combat.scenario, hero = redirectHero || combat.p;
    if (!value || !hero) return null;
    if (hero.hp <= 0 || (value.ally && value.ally.hp <= 0)) return "defeat";
    const cleared = combat.enemies.every(enemy => enemy.hp <= 0);
    if (value.type === "escape") return hero.pos.x === BOARD.w - 1 && [3, 4].includes(hero.pos.y) ? "victory" : null;
    return cleared || (value.type !== "ambush" && combat.round > value.goal) ? "victory" : null;
  }
  function weapon() { return state.weapons[Number(el("bt-weapon")?.value) || 0]; }
  function weaponRange(value) {
    const catalog = WEAPON_MASTERY.find(item => item.id === value?.weaponId);
    return { melee: catalog ? catalog.melee || 0 : 5, range: catalog?.range ? catalog.range.split("/").map(Number) : [] };
  }
  function previewRoute(x, y) {
    if (!combat.on || !isPlayerTurn() || !moveMode) return;
    route = movementPath(combat.p.pos, { x, y }, combat.p.move + combat.p.withdraw);
    if (!route) { text("bt-route", "Destino fuera de alcance o bloqueado."); return; }
    const risk = new Set(), hazards = new Set(); let free = combat.p.withdraw;
    for (let index = 1; index < route.length; index++) {
      const current = route[index], previous = route[index - 1], cost = current.cost - previous.cost;
      for (const enemy of combat.enemies.filter(value => value.hp > 0 && value.react && !hasCond(value, "unconscious"))) {
        const reach = Math.max(0, ...enemy.attacks.map(value => value.melee || 0));
        if (!combat.p.diseng && free < cost && distBetween(previous, enemy.pos) <= reach && distBetween(current, enemy.pos) > reach) risk.add(eName(enemy));
      }
      free = Math.max(0, free - cost);
      for (const terrain of getTerrain(current.x, current.y)) if (terrain.dmg) hazards.add(terrain.type);
    }
    const cost = route.at(-1).cost;
    text("bt-route", `${cost} ft de ${combat.p.move + combat.p.withdraw} ft disponibles. ${risk.size ? "⚠ Ataques de oportunidad: " + [...risk].join(", ") + ". " : "Sin ataques de oportunidad previstos. "}${hazards.size ? "⚠ Terreno peligroso: " + [...hazards].join(", ") : ""}`);
    for (const cell of el("c-board").querySelectorAll(".cell")) { cell.classList.remove("route-step"); delete cell.dataset.route; }
    route.slice(1).forEach((point, index) => { const cell = el(`cell-${point.x}-${point.y}`); cell?.classList.add("route-step"); if (cell) cell.dataset.route = index + 1; });
  }
  function moveTo(x, y) {
    if (!combat.on || !isPlayerTurn() || !moveMode) return false;
    previewRoute(x, y);
    if (!route) return false;
    moveMode = false;
    const moved = playerMoveTo(x, y);
    route = null;
    return moved;
  }
  function inspect(index) { selected = index; renderInspector(); if (el("bt-inspector")) el("bt-inspector").open = true; }
  function renderInspector() {
    const body = el("bt-inspector-body"); if (!body || selected == null || !combat.p) return;
    const hero = selected === "p", value = hero ? combat.p : combat.enemies[selected]; if (!value) return;
    body.replaceChildren();
    const portrait = node("div", null, "inspector-portrait"); portrait.innerHTML = hero ? playerToken() : enemyToken(value); body.appendChild(portrait);
    body.appendChild(node("h3", hero ? state.name : eName(value)));
    body.appendChild(node("p", `PG ${value.hp}/${hero ? state.hpMax : value.maxHp} · CA ${hero ? state.ac : value.ac} · Velocidad ${hero ? state.speed : value.speed} ft`));
    const conditions = value.conds.map(condition => CONDITIONS.find(item => item.id === condition.id)?.nameEs || condition.id);
    body.appendChild(node("p", "Condiciones: " + (conditions.join(", ") || "Ninguna")));
    if (!hero) body.appendChild(node("p", `${distOf(value)} ft · ${hasLineOfSight(combat.p.pos, value.pos) ? "Línea de visión libre" : "Visión bloqueada"} · ${hasCover(value, combat.p) ? "Cobertura +2 CA frente a ataques a distancia" : "Sin cobertura"}`));
    const attacks = hero ? state.weapons.map(item => `${item.name}: ${item.dice}d${item.sides}+${item.bonus}`) : value.attacks.map(item => `${item.es || item.en}: +${item.bonus} · ${item.dmg} · ${item.melee ? item.melee + " ft cuerpo a cuerpo" : ""}${item.range ? " · " + item.range + " ft distancia" : ""}`);
    const list = node("ul"); attacks.forEach(item => list.appendChild(node("li", item)));
    (value.spells || []).forEach(item => list.appendChild(node("li", `${item.es || item.en}: ${item.dmg || "Control"} · ${item.range} ft · ${item.usesLeft}/${item.uses} usos`)));
    if (value.breath) list.appendChild(node("li", `${value.breath.es}: ${value.breath.dmg} · ${value.breath.ready ? "Listo" : "Recargando"}`));
    body.appendChild(list);
  }
  function board(boardNode, reach) {
    if (!combat.p) return;
    if (!moveMode) route = null;
    const range = weaponRange(weapon()), ranges = el("bt-ranges")?.checked;
    for (let y = 0; y < BOARD.h; y++) for (let x = 0; x < BOARD.w; x++) {
      const cell = el(`cell-${x}-${y}`), position = { x, y }, distance = distBetween(combat.p.pos, position);
      if (ranges && distance && !getObstacle(x, y)) {
        const melee = range.melee && distance <= range.melee, ranged = range.range.length && distance <= (range.range[1] || range.range[0]);
        if (melee || ranged) cell.classList.add(melee || distance <= range.range[0] ? "range-normal" : "range-long");
        if (ranged && !melee && !hasLineOfSight(combat.p.pos, position)) cell.classList.add("range-blocked");
      }
      if (combat.scenario?.type === "escape" && x === BOARD.w - 1 && [3, 4].includes(y)) cell.classList.add("exit-cell");
      if (reach.has(x + "," + y)) {
        cell.tabIndex = 0; cell.setAttribute("role", "button"); cell.setAttribute("aria-label", `Destino ${x + 1}, ${y + 1}`);
        cell.addEventListener("pointerenter", event => { if (event.pointerType === "mouse") previewRoute(x, y); });
        cell.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); moveTo(x, y); } });
      }
    }
    const hero = boardNode.querySelector('[data-combatant="p"]');
    if (hero) { hero.tabIndex = 0; hero.setAttribute("role", "button"); hero.addEventListener("click", () => inspect("p")); hero.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); inspect("p"); } }); }
    for (const token of boardNode.querySelectorAll('.tok-e[data-combatant]')) token.addEventListener("click", () => inspect(Number(token.dataset.combatant.slice(1))));
    const ally = combat.scenario?.ally;
    if (ally?.hp > 0) { const cell = el(`cell-${ally.pos.x}-${ally.pos.y}`); cell.classList.add("ally-cell"); cell.appendChild(node("span", "🛡", "ally-token")); cell.appendChild(node("span", `${ally.hp}/${ally.maxHp}`, "token-hp")); cell.title = "Explorador protegido"; }
  }
  function moved(path, cost) { lastMove = path; route = null; metrics().feet += cost; text("bt-route", `Movimiento realizado: ${cost} ft.`); }
  function animateMove(token) {
    if (token.dataset.combatant !== "p" || !lastMove || lastMove.length < 2) return false;
    const path = lastMove; lastMove = null;
    const end = cellCenter(path.at(-1).x, path.at(-1).y);
    const frames = path.map(point => { const center = cellCenter(point.x, point.y); return { transform: `translate(${center.x - end.x}px, ${center.y - end.y}px)` }; });
    token.animate?.(frames, { duration: Math.min(900, path.length * 110), easing: "linear" }); return true;
  }
  function save(manual = false) {
    if (!combat.p || !authorized() || redirectHero || combat.quiet) return;
    try {
      const snapshot = cloneCombatState(); snapshot.log = snapshot.log.slice(0, 250);
      localStorage.setItem(storageKey(), JSON.stringify({ schema: 1, scope: scope(), signature: signature(), savedAt: Date.now(), state: snapshot }));
      if (manual) text("bt-save-status", "Combate guardado: " + new Date().toLocaleString("es-MX") + ". Puedes retomarlo en este dispositivo.");
    } catch (_) { text("bt-save-status", "No queda espacio para guardar combate. Ficha no fue modificada."); }
  }
  function validateSaved(value) {
    const validPos = point => point && Number.isInteger(point.x) && Number.isInteger(point.y) && point.x >= 0 && point.x < BOARD.w && point.y >= 0 && point.y < BOARD.h;
    const saved = value?.state;
    if (value?.schema !== 1 || value.scope !== scope() || value.signature !== signature()) throw new Error("Guardado pertenece a otra ficha o sus atributos/armas cambiaron. Recupera misma versión de ficha antes de retomarlo.");
    const actor = creature => creature && validPos(creature.pos) && Number.isFinite(creature.hp) && creature.hp >= 0 && Array.isArray(creature.conds);
    if (!saved || !actor(saved.p) || !Array.isArray(saved.enemies) || saved.enemies.length > 40 || !saved.enemies.every(enemy => actor(enemy) && Number.isFinite(enemy.maxHp) && enemy.maxHp > 0 && Array.isArray(enemy.attacks)) || !Array.isArray(saved.order) || saved.order.filter(item => item.who === "p").length !== 1 || !saved.order.every(item => item.who === "p" || item.who === "e" && Number.isInteger(item.idx) && !!saved.enemies[item.idx]) || !Number.isInteger(saved.turn) || !saved.order[saved.turn] || !Number.isInteger(saved.round) || saved.round < 1 || !Array.isArray(saved.log) || !Array.isArray(saved.map?.obstacles) || !Array.isArray(saved.map?.terrain) || ![...saved.map.obstacles, ...saved.map.terrain].every(validPos)) throw new Error("Guardado de combate incompleto; no se reemplazó combate actual.");
    if (saved.scenario && !["ambush", "escape", "protect", "survive"].includes(saved.scenario.type)) throw new Error("Escenario guardado incompatible.");
    if (saved.scenario?.ally && (!actor(saved.scenario.ally) || !Number.isFinite(saved.scenario.ally.maxHp) || saved.scenario.ally.maxHp <= 0)) throw new Error("Aliado guardado incompatible.");
    const finite = value => !value || typeof value !== "object" ? typeof value !== "number" || Number.isFinite(value) : Object.values(value).every(finite);
    const attack = value => value && Number.isFinite(value.bonus) && typeof value.dmg === "string" && (value.melee == null || Number.isFinite(value.melee)) && (value.range == null || typeof value.range === "string");
    if (!finite(saved) || ![saved.p.move, saved.p.withdraw].every(value => Number.isFinite(value) && value >= 0) || ![saved.p.action, saved.p.ba, saved.p.react].every(value => typeof value === "boolean") || saved.enemies.some(enemy => !Number.isFinite(enemy.speed) || !Number.isFinite(enemy.ac) || typeof enemy.key !== "string" || !enemy.mods || !enemy.attacks.length || !enemy.attacks.every(attack) || enemy.conds.some(value => typeof value?.id !== "string")) || saved.p.conds.some(value => typeof value?.id !== "string") || saved.order.length !== saved.enemies.length + 1 || new Set(saved.order.filter(value => value.who === "e").map(value => value.idx)).size !== saved.enemies.length || saved.map.obstacles.length > 96 || saved.map.terrain.length > 512 || saved.scenario && (!Number.isInteger(saved.scenario.goal) || saved.scenario.goal < 1 || saved.scenario.goal > 100) || saved.scenario?.type === "protect" && !saved.scenario.ally) throw new Error("Guardado de combate contiene valores incompatibles; combate actual conservado.");
    if (saved.log.some(value => !value || typeof value.html !== "string" || typeof value.cls !== "string") || typeof saved.on !== "boolean" || saved.tactical && (["damage", "received", "allyDamage", "healed", "actions", "bonus", "reactions", "feet", "attacks", "misses", "sneaks", "cunningDice"].some(key => !Number.isFinite(saved.tactical[key]) || saved.tactical[key] < 0) || !saved.tactical.targets || !saved.tactical.weapons || Object.values(saved.tactical.targets).some(value => typeof value?.name !== "string" || !Number.isFinite(value.damage)) || Object.values(saved.tactical.weapons).some(value => !Number.isFinite(value)))) throw new Error("Resumen guardado incompatible; combate actual conservado.");
    return saved;
  }
  function resume() {
    try {
      const raw = localStorage.getItem(storageKey()); if (!raw) throw new Error("No hay combate guardado para este personaje en dispositivo.");
      if (raw.length > 1500000) throw new Error("Guardado de combate demasiado grande.");
      const saved = validateSaved(JSON.parse(raw));
      if (combat.on && !confirm("¿Reemplazar combate actual por guardado?")) return;
      cancel(); clearTimeout(saveTimer); restoreCombatState(saved); paused = true; route = null; lastMove = null;
      ownerScope = scope(); ownerUid = window.CHAPS_CLOUD?.userInfo()?.uid || null;
      for (const enemy of combat.enemies) if (!ENEMIES.some(item => item.key === enemy.key)) ENEMIES.push({ ...structuredClone(enemy), hp: enemy.maxHp });
      if (combat.on && currentCombatant().who === "e") scheduleEnemy(combat.enemies[currentCombatant().idx]);
      renderSetup(); renderCombat(); if (!combat.on) renderSummary();
      text("bt-save-status", "Combate recuperado. Enemigos pausados; continúa cuando estés listo.");
    } catch (error) { text("bt-save-status", error.message); }
  }
  function scheduleEnemy(enemy) {
    if (enemy.hp <= 0) { enemyEndTurn(enemy); if (combat.on) nextTurn(); return; }
    pending = { enemy, turn: combat.turn, round: combat.round }; armTimer(); renderCombat(); status();
  }
  function started() {
    cancel(); clearTimeout(saveTimer); ownerScope = scope(); ownerUid = window.CHAPS_CLOUD?.userInfo()?.uid || null; combat.tactical = null; combat.result = null; metrics(); route = null; lastMove = null; selected = "p";
    const scenario = combat.scenario;
    if (scenario) {
      if (!cellBlocked(1, 3)) combat.p.pos = { x: 1, y: 3 };
      const used = new Set([combat.p.pos.x + "," + combat.p.pos.y]);
      const place = preferred => {
        const choices = [preferred]; for (let x = BOARD.w - 1; x >= 0; x--) for (let y = 0; y < BOARD.h; y++) choices.push({ x, y });
        const point = choices.find(value => !cellBlocked(value.x, value.y) && !used.has(value.x + "," + value.y));
        if (!point) throw new Error("Mapa sin espacio para combatientes.");
        used.add(point.x + "," + point.y); return { x: point.x, y: point.y };
      };
      if (scenario.type === "protect") scenario.ally = { ...newCombatPlayer(), proxy: true, name: "Explorador", hp: 35, maxHp: 35, ac: 13, react: false, pos: place({ x: 5, y: 3 }), mods: { str: 1, dex: 1, con: 1, int: 0, wis: 0, cha: 0 } };
      combat.enemies.forEach((enemy, index) => { enemy.pos = place(scenario.type === "ambush" && index < 2 ? { x: index ? 5 : 2, y: index ? 5 : 1 } : { x: 8 + index % 3, y: 2 + Math.floor(index / 3) }); });
      if (scenario.type === "escape") { removeObstacle(11, 3); removeObstacle(11, 4); }
    }
  }
  function render() {
    if (!el("battle-tools") || redirectHero) return;
    if (ownerScope && ownerScope !== scope()) {
      cancel(); clearTimeout(saveTimer); paused = true; ownerScope = null; ownerUid = null; selected = null; route = null; lastMove = null;
      combat.on = false; combat.p = null; combat.order = []; combat.enemies = []; combat.log = []; combat.scenario = null; combat.tactical = null;
      renderSetup(); renderCombat(); text("bt-save-status", "Personaje cambió. Retoma su propio combate guardado si existe."); return;
    }
    if (!combat.on && pending) cancel();
    if (!authorized() && combat.on && ownerScope) { cancel(); paused = true; }
    if (combat.on && authorized() && !pending && !executing && currentCombatant()?.who === "e") { pending = { enemy: combat.enemies[currentCombatant().idx], turn: combat.turn, round: combat.round }; armTimer(); }
    status(); text("bt-objective", objective()); renderInspector();
    text("bt-sim-note", combat.scenario ? "Simulación estima eliminación de enemigos; no evalúa escape, protección ni resistencia por rondas." : "Simula combate actual 100 veces para estimar dificultad de eliminar enemigos.");
    const selector = el("bt-weapon"), previous = selector.value;
    if (selector.dataset.items !== JSON.stringify(state.weapons)) {
      selector.replaceChildren(); state.weapons.forEach((value, index) => { const option = node("option", value.name); option.value = index; selector.appendChild(option); }); selector.dataset.items = JSON.stringify(state.weapons); selector.value = previous || "0";
    }
    const data = metrics(); text("bt-live", `Daño efectivo ${data.damage} · Recibido ${data.received} · Curación ${data.healed} · Movimiento ${data.feet} ft`);
    [...(el("c-enemies")?.children || [])].forEach((row, index) => { row.tabIndex = 0; row.setAttribute("role", "button"); row.onclick = () => inspect(index); row.onkeydown = event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); inspect(index); } }; });
    if (combat.p && authorized()) { clearTimeout(saveTimer); saveTimer = setTimeout(() => save(false), 180); }
  }
  function summary(body) {
    if (redirectHero || !combat.p) return;
    const data = metrics();
    const verdict = body.querySelector("p"); if (verdict) verdict.textContent = `${combat.result === "victory" || !combat.result && combat.enemies.every(enemy => enemy.hp <= 0) ? "✅ Victoria" : combat.result === "defeat" ? "💀 Derrota" : "Combate terminado"} · ${combat.round} rondas · ${objective()}`;
    const section = node("section", null, "tactical-summary"); section.appendChild(node("h3", "Resumen táctico"));
    const totals = [data.damage, data.received, data.attacks - data.misses, data.crits];
    body.querySelectorAll(".summary-box .v").forEach((value, index) => { value.textContent = totals[index]; });
    section.appendChild(node("p", `Daño efectivo ${data.damage} · Recibido ${data.received} · Aliado recibió ${data.allyDamage} · Curación ${data.healed}`));
    section.appendChild(node("p", `Ataques ${data.attacks} · Fallos ${data.misses} · Acciones ${data.actions} · Adicionales ${data.bonus} · Reacciones ${data.reactions} · Movimiento ${data.feet} ft`));
    section.appendChild(node("p", `Furtivos ${data.sneaks} · Dados destinados a Golpes Astutos ${data.cunningDice}`));
    section.appendChild(node("p", `Críticos realizados ${data.crits} · Críticos enemigos ${data.enemyCrits}`));
    const list = node("ul"); for (const target of Object.values(data.targets)) list.appendChild(node("li", `${target.name}: ${target.damage} PG efectivos`));
    for (const [name, count] of Object.entries(data.weapons)) list.appendChild(node("li", `${name}: ${count} ataques`));
    section.appendChild(list); body.appendChild(section);
  }
  function observe(name) {
    const original = window[name]; if (typeof original !== "function") return;
    window[name] = function (...args) {
      if (combat.quiet) return original.apply(this, args);
      const root = depth++ === 0, previousEffect = effect;
      if (["playerAttack", "playerAttackObstacle"].includes(name)) effect = kind(args[0]);
      if (name === "enemyAttackRoll" || name === "enemyCast") effect = args[1]?.para ? "force" : kind(args[1]);
      if (name === "dragonBreath") effect = kind(args[0].breath);
      const p = combat.p, before = p && { hp: p.hp, proxy: p.proxy, action: p.action, ba: p.ba, react: p.react, sneak: p.sneak, hits: combat.stats?.hits || 0, taken: combat.stats?.taken || 0, enemies: combat.enemies.map(enemy => enemy.hp) };
      let result;
      try { result = original.apply(this, args); }
      finally { depth--; effect = previousEffect; }
      if (root && before && p === combat.p) {
        const data = metrics();
        if (before.proxy) { data.allyDamage += Math.max(0, before.hp - p.hp); if (combat.stats) combat.stats.taken = before.taken; }
        else { data.received += Math.max(0, before.hp - p.hp); data.actions += Number(before.action && !p.action); data.bonus += Number(before.ba && !p.ba); data.reactions += Number(before.react && !p.react); }
        combat.enemies.forEach((enemy, index) => {
          const amount = Math.max(0, (before.enemies[index] ?? enemy.hp) - enemy.hp); if (!amount) return;
          data.damage += amount; const target = data.targets[index] ||= { name: eName(enemy), damage: 0 }; target.damage += amount;
        });
        if (name === "playerAttack" && result) { data.attacks++; if ((combat.stats?.hits || 0) === before.hits) data.misses++; data.weapons[args[0].name] = (data.weapons[args[0].name] || 0) + 1; }
        if (name === "tryPlayerOA" && before.react && !p.react) {
          data.attacks++; if (!combat.enemies.some((enemy, index) => enemy.hp < before.enemies[index])) data.misses++;
          data.weapons["Ataque de oportunidad"] = (data.weapons["Ataque de oportunidad"] || 0) + 1;
        }
        if (!before.proxy && !before.sneak && p.sneak) {
          data.sneaks++;
          if (name === "playerAttack") data.cunningDice += (args[2]?.strikes || []).slice(0, maxCunningStrikes(state.level)).reduce((count, id) => count + (STRIKES.find(value => value.id === id)?.cost || 0), 0);
        }
        if (!redirectHero) { render(); if (!combat.on) renderSummary(); }
      }
      return result;
    };
  }
  window.CHAPS_BATTLE = { started, scheduleEnemy, missionResult, board, render, summary, previewRoute, moveTo, moved, animateMove, inspect, save, resume, validateSaved,
    canStart() {
      let free = 0; for (let x = 0; x < BOARD.w; x++) for (let y = 0; y < BOARD.h; y++) if (!cellBlocked(x, y)) free++;
      if (state.hpCurrent <= 0 || free < combat.enemies.length + 1 + Number(combat.scenario?.type === "protect")) { text("bt-save-status", state.hpCurrent <= 0 ? "Recupera PG en ficha antes de iniciar combate." : "Mapa sin suficientes casillas libres para combatientes. Retira obstáculos."); return false; }
      return true;
    },
    critical(side) { if (!combat.quiet) metrics()[side === "p" ? "crits" : "enemyCrits"]++; },
    styleLine(line) { line.classList.add("element-" + effect); line.style.setProperty("--effect-color", palette[effect]); },
    hit(x, y) { if (!combat.quiet) boardFx("element-burst element-" + effect, x, y, symbols[effect]); },
    condition(id, position) { if (id === "poisoned") boardFx("element-burst element-poison", position.x, position.y, "☣"); },
    terrainHit(type, x, y, amount) { const old = effect; effect = palette[type] ? type : "cut"; try { fxHitAt(x, y, amount, false); } finally { effect = old; } }
  };
  for (const name of ["playerAttack", "playerAttackObstacle", "playerBonus", "playerMoveTo", "tryPlayerOA", "enemyAttackRoll", "enemyCast", "dragonBreath", "triggerTerrain"]) observe(name);
  document.addEventListener("DOMContentLoaded", () => {
    el("bt-prepare").onclick = () => prepareScenario(el("bt-scenario").value);
    el("bt-free").onclick = () => prepareScenario("free");
    el("bt-save").onclick = () => save(true); el("bt-resume").onclick = resume;
    el("bt-discard").onclick = () => { if (confirm("¿Borrar combate guardado de este personaje?")) { clearTimeout(saveTimer); localStorage.removeItem(storageKey()); text("bt-save-status", "Guardado borrado. Próximo cambio de combate volverá a guardarse automáticamente."); } };
    el("bt-pause").onclick = () => { paused = !paused; armTimer(); status(); };
    el("bt-step").onclick = () => { paused = true; executeEnemy(); status(); };
    el("bt-speed").onchange = () => { speed = Number(el("bt-speed").value); armTimer(); };
    el("bt-weapon").onchange = renderBoard; el("bt-ranges").onchange = renderBoard;
    el("bt-heal").onclick = () => {
      if (!combat.on || !combat.p) return;
      const amount = Number(el("bt-heal-amount").value); if (!Number.isInteger(amount) || amount < 1 || amount > 999) return;
      const gained = Math.min(amount, state.hpMax - combat.p.hp); if (gained <= 0) return;
      combat.p.hp += gained; metrics().healed += gained; boardFx("healing-fx", combat.p.pos.x, combat.p.pos.y, "+" + gained);
      cLog(`💚 Curación externa registrada: ${gained} PG.`, "log-hit"); renderCombat();
    };
    window.addEventListener("pagehide", () => save(false));
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { save(false); if (pending) { paused = true; armTimer(); status(); } } });
    render();
  });
})();
