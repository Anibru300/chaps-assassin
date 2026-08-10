/* ============================================================
   CHAPS — Asesino D&D 2024
   app.js — Lógica principal: ficha viva, simulador, combos, i18n
   ============================================================ */

"use strict";

/* ================= Utilidades ================= */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/** Idioma actual (persistido). Por defecto español. */
let LANG = localStorage.getItem("chaps-lang") || "es";

/** Traducción de una clave del diccionario I18N. */
function t(key) {
  return (I18N[LANG] && I18N[LANG][key]) || I18N.es[key] || key;
}

/** Modificador de característica según reglas D&D. */
function abilityMod(score) { return Math.floor((score - 10) / 2); }

/** Bono de competencia según nivel (2024). */
function profBonus(level) { return Math.ceil(level / 4) + 1; }

/** Dados de Ataque Furtivo según nivel de pícaro (1d6 cada 2 niveles). */
function sneakDiceCount(level) { return Math.ceil(level / 2); }

/** Formatea un modificador con signo: +5 / -1 */
function fmtMod(n) { return (n >= 0 ? "+" : "") + n; }

/** Tira un dado de N caras (1..N inclusive). */
function rollDie(sides) { return Math.floor(Math.random() * sides) + 1; }

/** Tira varios dados y devuelve el array de resultados individuales. */
function rollDice(count, sides) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(rollDie(sides));
  return out;
}

const sum = (arr) => arr.reduce((a, b) => a + b, 0);

/* ================= Estado persistente ================= */
const STORAGE_KEY = "chaps-state-v1";
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    // Mezcla superficial profunda: los valores por defecto rellenan claves nuevas.
    const loaded = JSON.parse(raw);
    const merged = structuredClone(DEFAULT_STATE);
    for (const k of Object.keys(merged)) {
      if (loaded[k] !== undefined) merged[k] = loaded[k];
    }
    merged.abilities = Object.assign(structuredClone(DEFAULT_STATE.abilities), loaded.abilities || {});
    merged.currency  = Object.assign(structuredClone(DEFAULT_STATE.currency),  loaded.currency  || {});
    merged.skills    = Object.assign(structuredClone(DEFAULT_STATE.skills),    loaded.skills    || {});
    return merged;
  } catch (e) {
    console.warn("Estado corrupto, se usan valores por defecto.", e);
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  flashSaved();
}

let saveTimer = null;
function flashSaved() {
  const el = $("#save-indicator");
  el.textContent = t("saved");
  el.classList.add("visible");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => el.classList.remove("visible"), 1200);
}

/* ================= i18n ================= */
function applyI18n() {
  document.documentElement.lang = LANG;
  document.title = t("appTitle");
  $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $("#lang-toggle").textContent = LANG === "es" ? "EN" : "ES";
}

function toggleLang() {
  LANG = LANG === "es" ? "en" : "es";
  localStorage.setItem("chaps-lang", LANG);
  renderAll();
}

/* ================= Pestañas ================= */
function initTabs() {
  $$(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
      $$(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + btn.dataset.tab));
    });
  });
}

/* ============================================================
   TAB 1 — FICHA VIVA
   ============================================================ */

/** Vuelca el estado a los campos simples de identidad. */
function renderIdentity() {
  $("#f-name").value = state.name;
  $("#f-level").value = state.level;
  $("#f-prof").value = fmtMod(profBonus(state.level));
  $("#f-speed").value = state.speed;
  $("#f-hpCurrent").value = state.hpCurrent;
  $("#f-hpMax").value = state.hpMax;
  $("#f-hpTemp").value = state.hpTemp;
  $("#f-ac").value = state.ac;
  $("#f-initiative").value = state.initiative;
  $("#f-inspiration").checked = state.inspiration;
  $("#f-notes").value = state.notes;
  renderHitDice();
  renderDeathPips();
}

function renderHitDice() {
  const remaining = state.level - state.hitDiceSpent;
  $("#f-hitdice").textContent = `${remaining}/${state.level}d8 (${state.hitDiceSpent} ${t("hitDiceSpent")})`;
}

function renderDeathPips() {
  const make = (container, count, cls, onToggle) => {
    const el = $(container);
    el.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const pip = document.createElement("button");
      pip.className = "pip" + (i < count ? " " + cls : "");
      pip.type = "button";
      pip.addEventListener("click", () => onToggle(i < count ? i : i + 1));
      el.appendChild(pip);
    }
  };
  make("#death-succ", state.deathSuccess, "on-succ", (n) => { state.deathSuccess = n; saveState(); renderDeathPips(); });
  make("#death-fail", state.deathFail, "on-fail", (n) => { state.deathFail = n; saveState(); renderDeathPips(); });
}

/** Características: cajas con valor editable y modificador calculado. */
function renderAbilities() {
  const grid = $("#ability-grid");
  grid.innerHTML = "";
  ABILITIES.forEach((ab) => {
    const box = document.createElement("div");
    box.className = "ability-box";
    const mod = abilityMod(state.abilities[ab]);
    box.innerHTML = `
      <div class="ab-name">${t("ability_" + ab)}</div>
      <input type="number" min="1" max="30" value="${state.abilities[ab]}" data-ab="${ab}">
      <div class="ab-mod">${fmtMod(mod)}</div>`;
    grid.appendChild(box);
  });
  grid.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("change", () => {
      state.abilities[inp.dataset.ab] = parseInt(inp.value, 10) || 10;
      saveState();
      renderAbilities();
      renderSkills();      // los mods de habilidades dependen de las características
      renderSimWeaponBonus();
    });
  });
}

/** Lista de habilidades con toggles de competencia/pericia. */
function renderSkills() {
  const list = $("#skills-list");
  list.innerHTML = "";
  const pb = profBonus(state.level);
  SKILLS.forEach((sk) => {
    const s = state.skills[sk.key] || { p: false, e: false };
    const mod = abilityMod(state.abilities[sk.ability]) + (s.e ? pb * 2 : s.p ? pb : 0);
    const highlight = (sk.key === "stealth" || sk.key === "perception") ? " highlight" : "";
    const row = document.createElement("div");
    row.className = "skill-row" + highlight;
    row.innerHTML = `
      <span>${t("skill_" + sk.key)} <span class="skill-ab">(${t("ability_" + sk.ability)})</span></span>
      <input type="checkbox" data-skill="${sk.key}" data-kind="p" ${s.p ? "checked" : ""}>
      <input type="checkbox" data-skill="${sk.key}" data-kind="e" ${s.e ? "checked" : ""}>
      <span class="skill-mod">${fmtMod(mod)}</span>`;
    list.appendChild(row);
  });
  list.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const sk = state.skills[cb.dataset.skill];
      sk[cb.dataset.kind] = cb.checked;
      if (cb.dataset.kind === "e" && cb.checked) sk.p = true; // pericia implica competencia
      saveState();
      renderSkills();
    });
  });
}

/** Tabla de armas editable. */
function renderWeapons() {
  const body = $("#weapons-body");
  body.innerHTML = "";
  const atkBonus = profBonus(state.level) + abilityMod(state.abilities.dex);
  state.weapons.forEach((w, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" value="${escapeHtml(w.name)}" data-i="${i}" data-f="name"></td>
      <td><input type="text" value="${w.dice}d${w.sides}+${w.bonus}" readonly class="readonly" style="min-width:80px"></td>
      <td>${fmtMod(atkBonus)}</td>
      <td><input type="text" value="${escapeHtml(w.props)}" data-i="${i}" data-f="props"></td>
      <td><input type="text" value="${escapeHtml(w.mastery)}" data-i="${i}" data-f="mastery" style="min-width:70px"></td>
      <td><button class="btn btn-small btn-danger" data-del="${i}">✕</button></td>`;
    body.appendChild(tr);
  });
  body.querySelectorAll("input[data-f]").forEach((inp) => {
    inp.addEventListener("change", () => {
      state.weapons[+inp.dataset.i][inp.dataset.f] = inp.value;
      saveState();
      renderSimWeapons();
      renderCombos();
    });
  });
  body.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.weapons.splice(+btn.dataset.del, 1);
      saveState();
      renderWeapons();
      renderSimWeapons();
      renderCombos();
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Rastreador de monedas. */
function renderCurrency() {
  const grid = $("#currency-grid");
  grid.innerHTML = "";
  ["pp", "gp", "ep", "sp", "cp"].forEach((coin) => {
    const label = document.createElement("label");
    label.className = "field";
    label.innerHTML = `<span>${coin.toUpperCase()}</span>
      <input type="number" min="0" value="${state.currency[coin]}" data-coin="${coin}">`;
    grid.appendChild(label);
  });
  grid.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("change", () => {
      state.currency[inp.dataset.coin] = Math.max(0, parseInt(inp.value, 10) || 0);
      saveState();
    });
  });
}

/* ---------- Descansos ---------- */
function shortRest() {
  // Recupera 1 dado de golpe gastado por descanso (simplificación amistosa).
  if (state.hitDiceSpent > 0) state.hitDiceSpent--;
  state.deathSuccess = 0;
  state.deathFail = 0;
  saveState();
  renderHitDice();
  renderDeathPips();
}

function longRest() {
  state.hpCurrent = state.hpMax;
  state.hpTemp = 0;
  // Recupera la mitad de los dados de golpe totales (mín. 1), regla 2024.
  const recovered = Math.max(1, Math.floor(state.level / 2));
  state.hitDiceSpent = Math.max(0, state.hitDiceSpent - recovered);
  state.deathSuccess = 0;
  state.deathFail = 0;
  state.inspiration = true; // 2024: se gana Inspiración Heroica tras un descanso largo
  saveState();
  renderIdentity();
}

/* ---------- Exportar / Importar / Restablecer ---------- */
function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "chaps-ficha.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (typeof data !== "object" || data === null) throw new Error("bad json");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      state = loadState();
      renderAll();
      alert(t("imported"));
    } catch (e) {
      alert(t("importError"));
    }
  };
  reader.readAsText(file);
}

function initSheetEvents() {
  // Campos simples: estado -> input y viceversa.
  const bind = (id, key, numeric) => {
    $(id).addEventListener("change", (e) => {
      state[key] = numeric ? (parseInt(e.target.value, 10) || 0) : e.target.value;
      saveState();
      if (key === "level" || key === "hpMax") renderIdentity();
      if (key === "level") { renderAbilities(); renderSkills(); renderWeapons(); renderSimAll(); renderCombos(); }
    });
  };
  bind("#f-name", "name", false);
  bind("#f-level", "level", true);
  bind("#f-speed", "speed", true);
  bind("#f-hpCurrent", "hpCurrent", true);
  bind("#f-hpMax", "hpMax", true);
  bind("#f-hpTemp", "hpTemp", true);
  bind("#f-ac", "ac", true);
  bind("#f-initiative", "initiative", true);
  $("#f-notes").addEventListener("input", (e) => { state.notes = e.target.value; saveState(); });
  $("#f-inspiration").addEventListener("change", (e) => { state.inspiration = e.target.checked; saveState(); });

  // Dados de golpe: +/- gastados
  $("#hd-minus").addEventListener("click", () => {
    if (state.hitDiceSpent < state.level) { state.hitDiceSpent++; saveState(); renderHitDice(); }
  });
  $("#hd-plus").addEventListener("click", () => {
    if (state.hitDiceSpent > 0) { state.hitDiceSpent--; saveState(); renderHitDice(); }
  });

  $("#btn-short-rest").addEventListener("click", shortRest);
  $("#btn-long-rest").addEventListener("click", longRest);

  $("#btn-add-weapon").addEventListener("click", () => {
    state.weapons.push({ name: "—", dice: 1, sides: 6, bonus: abilityMod(state.abilities.dex), props: "", mastery: "" });
    saveState();
    renderWeapons();
    renderSimWeapons();
    renderCombos();
  });

  $("#btn-export").addEventListener("click", exportJson);
  $("#btn-import").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", (e) => {
    if (e.target.files[0]) importJson(e.target.files[0]);
    e.target.value = "";
  });
  $("#btn-reset").addEventListener("click", () => {
    if (confirm(t("resetConfirm"))) {
      state = structuredClone(DEFAULT_STATE);
      saveState();
      renderAll();
    }
  });
}

/* ============================================================
   TAB 2 — SIMULADOR DE COMBATE
   ============================================================ */

// Estado transitorio del simulador (no persiste: es una herramienta de entrenamiento).
const sim = {
  sneakUsed: false,
  enemyMax: 30,
  enemyCur: 30
};

function dexMod() { return abilityMod(state.abilities.dex); }
function saveDC() { return 8 + profBonus(state.level) + dexMod(); }

/** Rellena el selector de armas del simulador. */
function renderSimWeapons() {
  const sel = $("#sim-weapon");
  const prev = sel.value;
  sel.innerHTML = "";
  state.weapons.forEach((w, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${w.name} (${w.dice}d${w.sides}+${w.bonus})`;
    sel.appendChild(opt);
  });
  if (prev !== "" && +prev < state.weapons.length) sel.value = prev;
  renderSimWeaponBonus();
}

function renderSimWeaponBonus() {
  $("#sim-atkbonus").value = fmtMod(profBonus(state.level) + dexMod());
  $("#save-dc").textContent = `${t("saveDC")} ${saveDC()}`;
}

/** Pista de Asesinar: +nivel si el enemigo no ha actuado. */
function renderAssassinateHint() {
  $("#assassinate-hint").textContent = t("assassinateHint").replace("{lv}", state.level);
}

function renderEnemyBar() {
  const pct = sim.enemyMax > 0 ? Math.max(0, (sim.enemyCur / sim.enemyMax) * 100) : 0;
  $("#enemy-bar-fill").style.width = pct + "%";
  $("#enemy-hp-label").textContent = `${sim.enemyCur} / ${sim.enemyMax}`;
}

/** Añade una entrada al registro de combate. */
function addLog(html, cls) {
  const li = document.createElement("li");
  li.className = cls || "log-info";
  li.innerHTML = html;
  const log = $("#combat-log");
  log.prepend(li);
}

/** Sincroniza los PG del enemigo desde el input y refresca la barra. */
function syncEnemyFromInput() {
  sim.enemyMax = Math.max(1, parseInt($("#e-hp").value, 10) || 1);
  sim.enemyCur = sim.enemyMax;
  renderEnemyBar();
}

/* ---------- Iniciativa con ventaja (Asesinar 2024) ---------- */
function rollInitiative() {
  const r1 = rollDie(20), r2 = rollDie(20);
  const best = Math.max(r1, r2);
  const total = best + state.initiative;
  $("#init-result").innerHTML =
    `d20(${r1}, ${r2}) → ${best} ${fmtMod(state.initiative)} = <strong>${total}</strong>`;
  addLog(`${t("logInitiative")}: d20(${r1}, ${r2}) ${fmtMod(state.initiative)} = <strong>${total}</strong>`, "log-info");
}

/* ---------- Tirada de ataque completa ---------- */
function rollAttack() {
  const wIdx = parseInt($("#sim-weapon").value, 10) || 0;
  const w = state.weapons[wIdx];
  if (!w) return;
  const enemyAc = parseInt($("#e-ac").value, 10) || 10;
  const enemyName = $("#e-name").value || "—";
  const acted = $("#e-acted").checked;
  const adv = $("#sim-adv").checked;
  const dis = $("#sim-dis").checked;
  const flat = adv && dis; // ventaja y desventaja se anulan (2024)

  // --- Tirada para impactar ---
  let rolls, chosen;
  if (flat || (!adv && !dis)) {
    rolls = [rollDie(20)];
    chosen = rolls[0];
  } else {
    rolls = [rollDie(20), rollDie(20)];
    chosen = adv ? Math.max(...rolls) : Math.min(...rolls);
  }
  const atkBonus = profBonus(state.level) + dexMod();
  const total = chosen + atkBonus;
  const natCrit = chosen === 20;
  const natMiss = chosen === 1;
  const isHit = natCrit || (!natMiss && total >= enemyAc);

  const resultEl = $("#attack-result");
  const rollStr = rolls.length > 1 ? `d20(${rolls.join(", ")})→${chosen}` : `d20(${chosen})`;

  if (!isHit) {
    const why = natMiss ? t("nat1") : `${total} &lt; ${t("lVsAc")} ${enemyAc}`;
    resultEl.innerHTML = `<span class="miss-text">✗ ${t("miss")}</span> — ${w.name}: ${rollStr} ${fmtMod(atkBonus)} = ${total}. ${why}`;
    addLog(`${w.name}: ${rollStr} ${fmtMod(atkBonus)} = ${total} ${t("lVsAc")} ${enemyAc} → <em>${t("miss")}</em>`, "log-miss");
    return;
  }

  // --- Daño ---
  const crit = natCrit;
  const parts = [];   // fragmentos legibles del desglose
  let dmgTotal = 0;

  // Dados del arma (el crítico duplica TODOS los dados)
  const wDiceCount = crit ? w.dice * 2 : w.dice;
  const wRolls = rollDice(wDiceCount, w.sides);
  parts.push(`${wDiceCount}d${w.sides}(${wRolls.join(",")})+${w.bonus}`);
  dmgTotal += sum(wRolls) + w.bonus;

  // Ataque Furtivo (una vez por turno)
  let sneakApplied = false;
  let strikesApplied = [];
  if (!sim.sneakUsed) {
    const strikes = $$(".cs-check:checked").map((c) => c.value).slice(0, 2);
    const baseSneak = sneakDiceCount(state.level);
    const sneakCount = Math.max(0, baseSneak - strikes.length);
    if (sneakCount > 0) {
      const sDiceCount = crit ? sneakCount * 2 : sneakCount;
      const sRolls = rollDice(sDiceCount, 6);
      const label = strikes.length ? `${sDiceCount}d6 (base ${baseSneak}d6 − ${strikes.length})` : `${sDiceCount}d6`;
      parts.push(`${t("lSneak")} ${label}(${sRolls.join(",")})`);
      dmgTotal += sum(sRolls);
    }
    sneakApplied = true;
    sim.sneakUsed = true;
    strikesApplied = strikes;

    // Asesinar: +nivel si el enemigo no ha actuado y el furtivo impacta
    if (!acted) {
      parts.push(`${t("lAssassinate")} +${state.level}`);
      dmgTotal += state.level;
    }
  }

  // --- Aplicar daño al enemigo ---
  sim.enemyCur = Math.max(0, sim.enemyCur - dmgTotal);
  renderEnemyBar();

  const critTag = crit ? `<span class="crit-text"> ${t("crit")}</span>` : "";
  resultEl.innerHTML = `<span class="${crit ? "crit-text" : "hit-text"}">✓ ${crit ? t("crit") : t("hit")}</span> — ${w.name}: ${rollStr} ${fmtMod(atkBonus)} = ${total} ${t("lVsAc")} ${enemyAc}. <strong>${t("lDamageWord")}: ${dmgTotal}</strong>`;

  let logHtml = `${w.name}: ${rollStr} ${fmtMod(atkBonus)} = ${total} ${t("lVsAc")} ${enemyAc} → <strong>${t("hit")}</strong>${critTag}<br>` +
    `${parts.join(" + ")} = <strong>${dmgTotal}</strong> [${t("lEnemyHp")}: ${sim.enemyCur}/${sim.enemyMax}]`;

  // Notas de Golpes Astutos con CD
  if (strikesApplied.length) {
    const dc = saveDC();
    const notes = strikesApplied.map((s) => {
      if (s === "poison") return t("lPoisonSave").replace("{dc}", dc);
      if (s === "trip") return t("lTripSave").replace("{dc}", dc);
      return t("lWithdrawNote");
    });
    logHtml += `<br>⚔ ${notes.join(" · ")}`;
  }
  if (!sneakApplied && sim.sneakUsed) {
    logHtml += `<br><em>${t("sneakUsed")}</em>`;
  }
  addLog(logHtml, crit ? "log-crit" : "log-hit");

  if (sim.enemyCur === 0) {
    addLog(`💀 ${enemyName}: ${t("dead")}`, "log-dead");
  }
}

/* ---------- Eventos del simulador ---------- */
function initSimEvents() {
  $("#btn-init").addEventListener("click", rollInitiative);
  $("#btn-attack").addEventListener("click", rollAttack);
  $("#e-hp").addEventListener("change", syncEnemyFromInput);

  // Asesinar: si el enemigo no ha actuado, marca ventaja automáticamente.
  $("#e-acted").addEventListener("change", (e) => {
    $("#sim-adv").checked = !e.target.checked;
  });

  // Máximo 2 Golpes Astutos (Golpe Astuto Mejorado, nivel 11).
  $$(".cs-check").forEach((cb) => {
    cb.addEventListener("change", () => {
      const checked = $$(".cs-check:checked");
      if (checked.length > 2) cb.checked = false;
    });
  });

  // Acciones adicionales: solo anotan en el registro.
  $$(".ba-btn").forEach((btn) => {
    btn.addEventListener("click", () => addLog(`${t("logBonus")}: ${btn.textContent}`, "log-info"));
  });
  // Puntería Firme: concede ventaja en el próximo ataque.
  $("#btn-steady").addEventListener("click", () => {
    $("#sim-adv").checked = true;
    addLog(`${t("logBonus")}: ${t("steadyAim")}`, "log-info");
  });

  $("#btn-new-turn").addEventListener("click", () => {
    sim.sneakUsed = false;
    $$(".cs-check").forEach((c) => (c.checked = false));
    $("#sim-adv").checked = !$("#e-acted").checked;
    addLog("— " + t("newTurn") + " —", "log-info");
  });

  $("#btn-new-combat").addEventListener("click", () => {
    sim.sneakUsed = false;
    $("#combat-log").innerHTML = "";
    $("#attack-result").innerHTML = "";
    $("#init-result").innerHTML = "";
    $("#e-acted").checked = false;
    $("#sim-adv").checked = true;
    $$(".cs-check").forEach((c) => (c.checked = false));
    syncEnemyFromInput();
  });
}

function renderSimAll() {
  renderSimWeapons();
  renderAssassinateHint();
  renderEnemyBar();
}

/* ============================================================
   TAB 3 — GUÍA DE COMBOS
   ============================================================ */

function renderCombos() {
  const box = $("#combos-container");
  box.innerHTML = "";
  const pb = profBonus(state.level);
  const sneak = sneakDiceCount(state.level);

  COMBOS.forEach((combo) => {
    const card = document.createElement("div");
    card.className = "combo-card" + (combo.type === "info" ? " info-card" : "");
    const title = LANG === "es" ? combo.titleEs : combo.titleEn;
    const steps = LANG === "es" ? combo.stepsEs : combo.stepsEn;

    let html = `
      <div class="combo-head">
        <span class="combo-icon">${combo.icon}</span>
        <h3>${escapeHtml(title)}</h3>
      </div>
      <ol class="combo-steps">${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>`;

    if (combo.type === "roller") {
      const options = state.weapons
        .map((w, i) => `<option value="${i}">${escapeHtml(w.name)} (${w.dice}d${w.sides}+${w.bonus})</option>`)
        .join("");
      const sneakUsedDice = sneak - (combo.cunningStrikes || 0);
      html += `
        <div class="combo-controls">
          <label class="field"><span>${t("weaponUsed")}</span>
            <select class="combo-weapon" data-id="${combo.id}">${options}</select></label>
          <label class="field"><span>${t("sneakDiceLabel")}</span>
            <input type="text" readonly class="readonly" value="${sneakUsedDice}d6"></label>
          <button class="btn btn-crimson combo-roll" data-id="${combo.id}">${t("rollCombo")}</button>
        </div>
        <div class="combo-result" id="combo-result-${combo.id}"></div>`;
    }
    card.innerHTML = html;
    box.appendChild(card);
  });

  // Eventos de los rodillos de daño de cada combo
  box.querySelectorAll(".combo-roll").forEach((btn) => {
    btn.addEventListener("click", () => rollComboDamage(btn.dataset.id));
  });
}

/** Tira el daño de un combo y muestra el desglose completo. */
function rollComboDamage(comboId) {
  const combo = COMBOS.find((c) => c.id === comboId);
  const sel = $(`.combo-weapon[data-id="${comboId}"]`);
  const w = state.weapons[parseInt(sel.value, 10) || 0];
  if (!w) return;

  const sneak = sneakDiceCount(state.level);
  const parts = [];
  let total = 0;

  // Dados del arma
  const wRolls = rollDice(w.dice, w.sides);
  parts.push(`${escapeHtml(w.name)}: ${w.dice}d${w.sides}(${wRolls.join(",")})+${w.bonus}`);
  total += sum(wRolls) + w.bonus;

  // Furtivo (con reducción si el combo usa Golpes Astutos)
  if (combo.sneak) {
    const count = Math.max(0, sneak - (combo.cunningStrikes || 0));
    if (count > 0) {
      const sRolls = rollDice(count, 6);
      parts.push(`${t("lSneak")} ${count}d6(${sRolls.join(",")})`);
      total += sum(sRolls);
    }
  }

  // Asesinar (solo la apertura): +nivel
  if (combo.assassinate) {
    parts.push(`${t("lAssassinate")} +${state.level}`);
    total += state.level;
  }

  // Nota de salvaciones para Control Doble
  let extra = "";
  if (combo.cunningStrikes) {
    const dc = saveDC();
    extra = `<br>⚔ ${t("lPoisonSave").replace("{dc}", dc)} · ${t("lTripSave").replace("{dc}", dc)}`;
  }

  const res = $("#combo-result-" + comboId);
  res.innerHTML = `${parts.join(" + ")} = <strong>${total}</strong>${extra}`;
  res.classList.add("visible");
}

/** Tabla de rasgos por nivel. */
function renderFeatures() {
  const body = $("#features-body");
  body.innerHTML = "";
  FEATURES.forEach((f) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${f.lv}</td><td>${escapeHtml(LANG === "es" ? f.es : f.en)}</td>`;
    body.appendChild(tr);
  });
}

/* ============================================================
   ARRANQUE
   ============================================================ */
function renderAll() {
  applyI18n();
  renderIdentity();
  renderAbilities();
  renderSkills();
  renderWeapons();
  renderCurrency();
  renderSimAll();
  renderCombos();
  renderFeatures();
}

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initSheetEvents();
  initSimEvents();
  $("#lang-toggle").addEventListener("click", toggleLang);
  // Estado inicial del simulador: enemigo no ha actuado → ventaja marcada.
  $("#sim-adv").checked = true;
  syncEnemyFromInput();
  renderAll();
});
