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

/** Formatea un número con comas de miles: 100,000 */
function fmtNum(n) { return Number(n).toLocaleString("en-US"); }

/** Extrae solo los dígitos de un texto y los convierte en número. */
function parseNum(s) { return parseInt(String(s).replace(/\D/g, ""), 10) || 0; }

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
    merged.tools     = Object.assign(structuredClone(DEFAULT_STATE.tools),     loaded.tools     || {});
    merged.identity  = Object.assign(structuredClone(DEFAULT_STATE.identity),  loaded.identity  || {});
    // Migraciones:
    // v1/v2 -> v3: Thieves' Tools pasa a la lista de Habilidades con Pericia (ficha de papel).
    if ((loaded.v || 1) < 3) merged.tools.thievesTools = { p: true, e: true };
    merged.v = STATE_VERSION;
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
  $$("[data-i18n-alt]").forEach((el) => { el.alt = t(el.dataset.i18nAlt); });
  $$("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
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
  $("#f-charClass").value = state.identity.charClass;
  $("#f-subclass").value = state.identity.subclass;
  $("#f-species").value = state.identity.species;
  $("#f-background").value = state.identity.background;
  $("#f-alignment").value = state.identity.alignment;
  $("#f-playerName").value = state.identity.playerName;
  $("#f-campaign").value = state.identity.campaign;
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
      renderTools();
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
  // Thieves' Tools: una fila más al final, como en la ficha oficial (debajo de Survival).
  const tt = TOOLS.find((x) => x.skillRow);
  if (tt) {
    const s = state.tools[tt.key] || { p: false, e: false };
    const mod = abilityMod(state.abilities[tt.ability]) + (s.e ? pb * 2 : s.p ? pb : 0);
    const row = document.createElement("div");
    row.className = "skill-row";
    row.innerHTML = `
      <span>${t("tool_" + tt.key)} <span class="skill-ab">(${t("ability_" + tt.ability)})</span></span>
      <input type="checkbox" data-tool="${tt.key}" data-kind="p" ${s.p ? "checked" : ""}>
      <input type="checkbox" data-tool="${tt.key}" data-kind="e" ${s.e ? "checked" : ""}>
      <span class="skill-mod">${fmtMod(mod)}</span>`;
    list.appendChild(row);
  }
  list.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const store = cb.dataset.tool ? state.tools : state.skills;
      const key = cb.dataset.tool || cb.dataset.skill;
      store[key][cb.dataset.kind] = cb.checked;
      if (cb.dataset.kind === "e" && cb.checked) store[key].p = true; // pericia implica competencia
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
  // Recordatorio: tras un descanso largo puedes cambiar las armas de Maestría.
  $("#mastery-card").classList.remove("mastery-remind");
  void $("#mastery-card").offsetWidth; // reinicia la animación
  $("#mastery-card").classList.add("mastery-remind");
}

/* ---------- Maestría de armas ---------- */
function renderMastery() {
  [1, 2].forEach((n) => {
    const sel = $("#mastery-" + n);
    sel.innerHTML = "";
    WEAPON_MASTERY.forEach((w) => {
      const prop = MASTERY_PROPERTIES.find((p) => p.id === w.mastery);
      const opt = document.createElement("option");
      opt.value = w.id;
      opt.textContent = `${LANG === "es" ? w.es : w.en} — ${w.dmg} — ${prop.name}`;
      sel.appendChild(opt);
    });
    if (state.masteryChoices[n - 1]) sel.value = state.masteryChoices[n - 1];
  });
  const gl = $("#mastery-glossary-list");
  gl.innerHTML = "";
  MASTERY_PROPERTIES.forEach((p) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${p.name}</strong>: ${LANG === "es" ? p.es : p.en}`;
    gl.appendChild(li);
  });
}

function initMasteryEvents() {
  [1, 2].forEach((n) => {
    $("#mastery-" + n).addEventListener("change", (e) => {
      state.masteryChoices[n - 1] = e.target.value;
      saveState();
      $("#mastery-card").classList.remove("mastery-remind"); // ya hiciste el cambio
    });
  });
}

/* ---------- Condiciones (referencia rápida) ---------- */
function renderConditions() {
  const list = $("#conditions-list");
  list.innerHTML = "";
  CONDITIONS.forEach((c) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${LANG === "es" ? c.nameEs : c.nameEn}</strong>: ${LANG === "es" ? c.es : c.en}`;
    list.appendChild(li);
  });
}

/** Lista de herramientas con toggles de competencia/pericia (igual que habilidades). */
function renderTools() {
  const list = $("#tools-list");
  list.innerHTML = "";
  const pb = profBonus(state.level);
  TOOLS.filter((tl) => !tl.skillRow).forEach((tl) => {
    const s = state.tools[tl.key] || { p: false, e: false };
    const mod = abilityMod(state.abilities[tl.ability]) + (s.e ? pb * 2 : s.p ? pb : 0);
    const row = document.createElement("div");
    row.className = "skill-row";
    row.innerHTML = `
      <span>${t("tool_" + tl.key)} <span class="skill-ab">(${t("ability_" + tl.ability)})</span></span>
      <input type="checkbox" data-tool="${tl.key}" data-kind="p" ${s.p ? "checked" : ""}>
      <input type="checkbox" data-tool="${tl.key}" data-kind="e" ${s.e ? "checked" : ""}>
      <span class="skill-mod">${fmtMod(mod)}</span>`;
    list.appendChild(row);
  });
  list.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const tl = state.tools[cb.dataset.tool];
      tl[cb.dataset.kind] = cb.checked;
      if (cb.dataset.kind === "e" && cb.checked) tl.p = true; // pericia implica competencia
      saveState();
      renderTools();
    });
  });
}

/* ---------- Experiencia (PX) ---------- */

/** Nivel correspondiente a una cantidad de PX según la tabla 2024. */
function levelForXp(xp) {
  let lv = 1;
  for (let i = 0; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i]) lv = i + 1;
  }
  return lv;
}

function renderXp() {
  $("#f-xp").value = fmtNum(state.xp);
  const lv = levelForXp(state.xp);
  $("#f-xp-level").value = lv;
  const fill = $("#xp-bar-fill");
  const label = $("#xp-bar-label");
  if (lv >= 20) {
    $("#f-xp-tonext").value = t("xpMax");
    fill.style.width = "100%";
    label.textContent = fmtNum(state.xp) + " PX";
  } else {
    const cur = XP_TABLE[lv - 1];
    const next = XP_TABLE[lv];
    $("#f-xp-tonext").value = fmtNum(next - state.xp);
    fill.style.width = Math.min(100, Math.round(((state.xp - cur) / (next - cur)) * 100)) + "%";
    label.textContent = t("xpBarLabel").replace("{xp}", fmtNum(state.xp)).replace("{next}", fmtNum(next));
  }
}

function addXp(n) {
  if (!n) return;
  state.xp = Math.max(0, state.xp + n);
  saveState();
  renderXp();
}

/* ---------- Dotes ---------- */
function renderFeats() {
  const list = $("#feats-list");
  list.innerHTML = "";
  state.feats.forEach((f, i) => {
    const row = document.createElement("div");
    row.className = "feat-row";
    row.innerHTML = `
      <div class="feat-head">
        <input type="text" value="${escapeHtml(f.name)}" placeholder="${t("featNamePh")}" data-fi="${i}" data-ff="name">
        <button class="btn btn-small btn-danger" data-fdel="${i}" title="${t("remove")}">✕</button>
      </div>
      <textarea rows="2" placeholder="${t("featDescPh")}" data-fi="${i}" data-ff="desc">${escapeHtml(f.desc)}</textarea>`;
    list.appendChild(row);
  });
  list.querySelectorAll("[data-ff]").forEach((inp) => {
    inp.addEventListener("input", () => {
      state.feats[+inp.dataset.fi][inp.dataset.ff] = inp.value;
      saveState();
    });
  });
  list.querySelectorAll("[data-fdel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.feats.splice(+btn.dataset.fdel, 1);
      saveState();
      renderFeats();
    });
  });
}

/* ---------- Diario de aventuras ---------- */
function renderJournal() {
  const list = $("#journal-list");
  list.innerHTML = "";
  state.journal.forEach((en, i) => {
    const div = document.createElement("div");
    div.className = "journal-entry";
    div.innerHTML = `
      <div class="journal-head">
        <input type="date" value="${en.date}" data-ji="${i}" data-jf="date">
        <input type="text" value="${escapeHtml(en.title)}" placeholder="${t("journalTitlePh")}" data-ji="${i}" data-jf="title">
        <button class="btn btn-small btn-danger" data-jdel="${i}" title="${t("remove")}">✕</button>
      </div>
      <textarea rows="3" placeholder="${t("journalTextPh")}" data-ji="${i}" data-jf="text">${escapeHtml(en.text)}</textarea>`;
    list.appendChild(div);
  });
  list.querySelectorAll("[data-jf]").forEach((inp) => {
    inp.addEventListener("input", () => {
      state.journal[+inp.dataset.ji][inp.dataset.jf] = inp.value;
      saveState();
    });
  });
  list.querySelectorAll("[data-jdel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.journal.splice(+btn.dataset.jdel, 1);
      saveState();
      renderJournal();
    });
  });
}

/* ---------- Progresión por nivel ---------- */
function renderProgression() {
  const body = $("#progression-body");
  body.innerHTML = "";
  LEVEL_PROGRESSION.forEach((f) => {
    // Auto-marcado por nivel actual, salvo que exista un toggle manual.
    const auto = state.level >= f.lv;
    const checked = state.progressionOverrides[f.lv] !== undefined
      ? state.progressionOverrides[f.lv] : auto;
    const tr = document.createElement("tr");
    tr.className = (checked ? "prog-done " : "") + (state.level === f.lv ? "prog-current" : "");
    // Campo de nota en niveles de Mejora/Dote (asi) y en la Dote Épica (boon, N19)
    const asiCell = (f.asi || f.boon)
      ? `<input type="text" class="asi-input" data-asi="${f.lv}" value="${escapeHtml(state.asiNotes[f.lv] || "")}" placeholder="${t("asiNotePh")}">`
      : "";
    tr.innerHTML = `
      <td><input type="checkbox" data-prog="${f.lv}" ${checked ? "checked" : ""}></td>
      <td class="lv-cell">${f.lv}</td>
      <td>${escapeHtml(LANG === "es" ? f.es : f.en)}</td>
      <td>${asiCell}</td>`;
    body.appendChild(tr);
  });
  body.querySelectorAll("[data-prog]").forEach((cb) => {
    cb.addEventListener("change", () => {
      state.progressionOverrides[cb.dataset.prog] = cb.checked;
      saveState();
      renderProgression();
    });
  });
  body.querySelectorAll("[data-asi]").forEach((inp) => {
    inp.addEventListener("input", () => {
      state.asiNotes[inp.dataset.asi] = inp.value;
      saveState();
    });
  });
}

/* ============================================================
   IMPORTACIÓN DESDE PCGEN (XML — csheet_fantasy_generic_export)
   ============================================================ */

// Nombres de habilidades de PCGen (5e SRD, en inglés) → claves internas.
const PCGEN_SKILL_MAP = {
  "acrobatics": "acrobatics", "animal handling": "animalHandling", "arcana": "arcana",
  "athletics": "athletics", "deception": "deception", "history": "history",
  "insight": "insight", "intimidation": "intimidation", "investigation": "investigation",
  "medicine": "medicine", "nature": "nature", "perception": "perception",
  "performance": "performance", "persuasion": "persuasion", "religion": "religion",
  "sleight of hand": "sleightOfHand", "stealth": "stealth", "survival": "survival"
};

// Cambios pendientes de confirmación por el usuario.
let pcgenPending = null;

/** Texto recortado del primer elemento que coincide, o "" si no existe. */
function xtext(scope, selector) {
  const el = scope.querySelector(selector);
  return el ? el.textContent.trim() : "";
}

/** Parsea el XML y valida que sea una exportación genérica de PCGen (<character>). */
function parsePcgenXml(text) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(text, "text/xml");
  } catch (e) { return null; }
  if (doc.getElementsByTagName("parsererror").length > 0) return null;
  if (!doc.documentElement || doc.documentElement.nodeName !== "character") return null;
  return doc;
}

/**
 * Construye la lista de cambios {label, from, to, apply} a partir del XML.
 * Solo se incluyen campos presentes en el XML y distintos del valor actual:
 * nunca se sobrescribe nada sin que aparezca en la vista previa.
 */
function buildPcgenChanges(doc) {
  const changes = [];
  const add = (label, from, to, apply) => {
    if (to === undefined || to === null || to === "" || String(to) === String(from)) return;
    changes.push({ label, from: String(from), to: String(to), apply });
  };

  // --- Datos básicos ---
  const nm = xtext(doc, "basics > name");
  add(t("name"), state.name, nm, () => { state.name = nm; });
  const player = xtext(doc, "basics > playername");
  add(t("playerName"), state.identity.playerName, player, () => { state.identity.playerName = player; });
  const align = xtext(doc, "basics > alignment > long") || xtext(doc, "basics > alignment > short");
  add(t("alignment"), state.identity.alignment, align, () => { state.identity.alignment = align; });
  const race = xtext(doc, "basics > race");
  add(t("species"), state.identity.species, race, () => { state.identity.species = race; });

  // --- Clases y nivel ---
  let levelSum = 0;
  const classNames = [];
  doc.querySelectorAll("basics > classes > class").forEach((c) => {
    const cn = xtext(c, "name");
    if (cn) classNames.push(cn);
    levelSum += parseInt(xtext(c, "level"), 10) || 0;
  });
  if (!levelSum) levelSum = parseInt(xtext(doc, "basics > classes > levels_total"), 10) || 0;
  const mainClass = classNames[0] || "";
  const cleanClass = mainClass.replace(/\(.*\)/, "").trim();
  add(t("charClass"), state.identity.charClass, cleanClass, () => { state.identity.charClass = cleanClass; });
  if (levelSum) add(t("level"), state.level, levelSum, () => { state.level = levelSum; });

  // Subclase: "Rogue (Assassin)" en el nombre de clase o un arquetipo declarado.
  let subclass = "";
  const mSub = mainClass.match(/\(([^)]+)\)/);
  if (mSub) subclass = mSub[1].trim();
  if (!subclass) subclass = xtext(doc, "basics > archetypes > archetype > name");
  add(t("subclass"), state.identity.subclass, subclass, () => { state.identity.subclass = subclass; });

  // --- Experiencia ---
  const xp = parseInt(xtext(doc, "basics > experience > current"), 10);
  if (!isNaN(xp)) add(t("xpCurrent"), state.xp, xp, () => { state.xp = xp; });

  // --- Características ---
  doc.querySelectorAll("abilities > ability").forEach((ab) => {
    const short = xtext(ab, "name > short").toLowerCase();
    const score = parseInt(xtext(ab, "score"), 10);
    if (ABILITIES.includes(short) && !isNaN(score)) {
      add(t("ability_" + short), state.abilities[short], score, () => { state.abilities[short] = score; });
    }
  });

  // --- PG, CA, iniciativa ---
  const hp = parseInt(xtext(doc, "hit_points > points"), 10);
  if (!isNaN(hp)) add(t("hpMax"), state.hpMax, hp, () => { state.hpMax = hp; state.hpCurrent = hp; });
  const ac = parseInt(xtext(doc, "armor_class > total"), 10);
  if (!isNaN(ac)) add(t("ac"), state.ac, ac, () => { state.ac = ac; });
  const init = parseInt(xtext(doc, "initiative > total"), 10);
  if (!isNaN(init)) add(t("initiative"), state.initiative, init, () => { state.initiative = init; });

  // --- Habilidades: solo marca competencia cuando es inequívoca ---
  const pbRef = profBonus(levelSum || state.level);
  doc.querySelectorAll("skills > skill").forEach((sk) => {
    const key = PCGEN_SKILL_MAP[xtext(sk, "name").toLowerCase()];
    if (!key) return;
    const ranks = parseFloat(xtext(sk, "ranks")) || 0;
    const total = parseFloat(xtext(sk, "skill_mod"));
    const abmod = parseFloat(xtext(sk, "ability_mod")) || 0;
    const proficient = ranks > 0 || (!isNaN(total) && (total - abmod) >= pbRef);
    if (proficient && !state.skills[key].p) {
      add(`${t("skill_" + key)} (${t("pcgenSkillProf")})`, "—", "✓", () => { state.skills[key].p = true; });
    }
  });

  // --- Armas ---
  const importedWeapons = [];
  doc.querySelectorAll("weapons > weapon").forEach((w) => {
    const wname = xtext(w, "common > name > long") || xtext(w, "common > name > short");
    if (!wname) return;
    const m = xtext(w, "common > damage").match(/(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?/);
    const dice = m ? +m[1] : 1;
    const sides = m ? +m[2] : 6;
    const bonus = m && m[3] ? parseInt(m[3].replace(/\s/g, ""), 10) : dexMod();
    const props = [xtext(w, "common > type"), xtext(w, "common > special_properties")]
      .filter(Boolean).join(", ");
    importedWeapons.push({ name: wname, dice, sides, bonus, props, mastery: "" });
  });
  if (importedWeapons.length) {
    const desc = importedWeapons.map((w) => `${w.name} (${w.dice}d${w.sides}${w.bonus >= 0 ? "+" : ""}${w.bonus})`).join(", ");
    add(t("weapons"), `${state.weapons.length}`, desc, () => { state.weapons = importedWeapons; });
  }

  // --- Monedas (PCGen exporta el total en oro) ---
  const gold = parseFloat(xtext(doc, "misc > gold") || xtext(doc, "basics > gold"));
  if (!isNaN(gold)) add("GP", state.currency.gp, Math.floor(gold), () => { state.currency.gp = Math.floor(gold); });

  return changes;
}

/* ---------- Vista previa y confirmación ---------- */
function showPcgenPreview(changes) {
  const body = $("#pcgen-preview-body");
  body.innerHTML = "";
  changes.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(c.label)}</td><td>${escapeHtml(c.from)}</td><td class="pcgen-new">${escapeHtml(c.to)}</td>`;
    body.appendChild(tr);
  });
  $("#pcgen-preview").hidden = false;
}

function hidePcgenPreview() {
  $("#pcgen-preview").hidden = true;
  pcgenPending = null;
}

function handlePcgenFile(file) {
  const msg = $("#pcgen-msg");
  const reader = new FileReader();
  reader.onload = () => {
    const doc = parsePcgenXml(reader.result);
    if (!doc) {
      msg.textContent = t("pcgenError");
      msg.className = "pcgen-msg pcgen-error";
      hidePcgenPreview();
      return;
    }
    const changes = buildPcgenChanges(doc);
    if (!changes.length) {
      msg.textContent = t("pcgenNone");
      msg.className = "pcgen-msg";
      hidePcgenPreview();
      return;
    }
    msg.textContent = "";
    msg.className = "pcgen-msg";
    pcgenPending = changes;
    showPcgenPreview(changes);
  };
  reader.readAsText(file);
}

function initPcgen() {
  $("#btn-pcgen").addEventListener("click", () => $("#pcgen-file").click());
  $("#pcgen-file").addEventListener("change", (e) => {
    if (e.target.files[0]) handlePcgenFile(e.target.files[0]);
    e.target.value = "";
  });
  $("#btn-pcgen-confirm").addEventListener("click", () => {
    if (!pcgenPending) return;
    pcgenPending.forEach((c) => c.apply());
    saveState();
    hidePcgenPreview();
    renderAll();
    const msg = $("#pcgen-msg");
    msg.textContent = t("pcgenSuccess");
    msg.className = "pcgen-msg pcgen-ok";
  });
  $("#btn-pcgen-cancel").addEventListener("click", hidePcgenPreview);
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
      if (key === "level") { renderAbilities(); renderSkills(); renderTools(); renderWeapons(); renderSimAll(); renderCombos(); renderProgression(); }
    });
  };
  bind("#f-name", "name", false);
  // Campos de identidad (objeto anidado state.identity)
  [["#f-charClass", "charClass"], ["#f-subclass", "subclass"], ["#f-species", "species"],
   ["#f-background", "background"], ["#f-alignment", "alignment"], ["#f-playerName", "playerName"],
   ["#f-campaign", "campaign"]].forEach(([id, key]) => {
    $(id).addEventListener("change", (e) => { state.identity[key] = e.target.value; saveState(); });
  });
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

  // --- Experiencia ---
  $("#f-xp").addEventListener("change", (e) => {
    state.xp = parseNum(e.target.value);
    saveState();
    renderXp();
  });
  $$(".xp-add").forEach((btn) => btn.addEventListener("click", () => addXp(+btn.dataset.amt)));
  $("#btn-xp-custom").addEventListener("click", () => {
    addXp(parseNum($("#xp-custom").value));
    $("#xp-custom").value = "";
  });
  $("#btn-apply-level").addEventListener("click", () => {
    state.level = levelForXp(state.xp);
    saveState();
    renderAll();
  });

  // --- Dotes ---
  $("#btn-add-feat").addEventListener("click", () => {
    state.feats.push({ name: "", desc: "" });
    saveState();
    renderFeats();
  });

  // --- Diario ---
  $("#btn-add-journal").addEventListener("click", () => {
    state.journal.unshift({ date: new Date().toISOString().slice(0, 10), title: "", text: "" });
    saveState();
    renderJournal();
  });

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
    // Los dados se quitan ANTES de rolar el daño; cada opción cuesta lo suyo.
    const strikes = $$(".cs-check:checked")
      .map((c) => ({ id: c.value, cost: +c.dataset.cost || 1 }))
      .slice(0, maxCunningStrikes(state.level));
    const costTotal = strikes.reduce((a, s) => a + s.cost, 0);
    const baseSneak = sneakDiceCount(state.level);
    const sneakCount = Math.max(0, baseSneak - costTotal);
    if (sneakCount > 0) {
      const sDiceCount = crit ? sneakCount * 2 : sneakCount;
      const sRolls = rollDice(sDiceCount, 6);
      const label = costTotal ? `${sDiceCount}d6 (base ${baseSneak}d6 − ${costTotal})` : `${sDiceCount}d6`;
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
      if (s.id === "poison") return t("lPoisonSave").replace("{dc}", dc);
      if (s.id === "trip") return t("lTripSave").replace("{dc}", dc);
      if (s.id === "daze") return t("lDazeSave").replace("{dc}", dc);
      if (s.id === "knockout") return t("lKnockOutSave").replace("{dc}", dc);
      if (s.id === "obscure") return t("lObscureSave").replace("{dc}", dc);
      return t("lWithdrawNote");
    });
    logHtml += `<br>⚔ ${notes.join(" · ")}`;
    // Armas Envenenadas (N13): +2d6 veneno que ignora resistencia si falla la salvación.
    if (strikesApplied.some((s) => s.id === "poison") && state.level >= 13) {
      const eRolls = rollDice(2, 6);
      logHtml += `<br>🧪 ${t("envenomNote").replace("{rolls}", eRolls.join(",")).replace("{n}", sum(eRolls))}`;
    }
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

  // Nº de efectos simultáneos según nivel (1 desde N5; 2 con Golpe Astuto
  // Mejorado, N11) y el coste total no puede superar los dados de furtivo.
  $$(".cs-check").forEach((cb) => {
    cb.addEventListener("change", () => {
      const checked = $$(".cs-check:checked");
      const cost = checked.reduce((a, c) => a + (+c.dataset.cost || 1), 0);
      if (checked.length > maxCunningStrikes(state.level) || cost > sneakDiceCount(state.level)) cb.checked = false;
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
  renderStrikeLocks();
}

/** Nº máximo de efectos de Golpe Astuto por ataque según el nivel (2024). */
function maxCunningStrikes(level) { return level >= 11 ? 2 : level >= 5 ? 1 : 0; }

/** Bloquea las opciones de Golpe Astuto por nivel y actualiza la leyenda (máx.). */
function renderStrikeLocks() {
  $$(".cs-check").forEach((cb) => {
    const req = cb.dataset.lock ? +cb.dataset.lock : 0;
    const lockSpan = cb.parentElement.querySelector(".cs-lock");
    if (req && state.level < req) {
      cb.disabled = true;
      cb.checked = false;
      if (lockSpan) lockSpan.textContent = " 🔒 N" + req;
    } else {
      cb.disabled = false;
      if (lockSpan) lockSpan.textContent = "";
    }
  });
  $("#cs-legend").textContent = t("cunningStrikes").replace("{max}", maxCunningStrikes(state.level));
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

/** Tabla de rasgos por nivel (1-20, misma fuente que la ficha: LEVEL_PROGRESSION). */
function renderFeatures() {
  const body = $("#features-body");
  body.innerHTML = "";
  LEVEL_PROGRESSION.forEach((f) => {
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
  renderXp();
  renderFeats();
  renderJournal();
  renderProgression();
  renderMastery();
  renderConditions();
  renderAbilities();
  renderSkills();
  renderTools();
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
  initPcgen();
  initMasteryEvents();
  $("#lang-toggle").addEventListener("click", toggleLang);
  // Estado inicial del simulador: enemigo no ha actuado → ventaja marcada.
  $("#sim-adv").checked = true;
  syncEnemyFromInput();
  renderAll();
});
