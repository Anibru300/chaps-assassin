/* ============================================================
   CHAPS — combat-extra.js
   Puente Biblioteca → Combate: busca un monstruo del SRD 2024
   (Open5e) y autocompleta el formulario de enemigo personalizado.
   Solo RELLENA los campos cf-*; el usuario revisa y pulsa
   "+ Crear y añadir" (botón original de combat.js, intacto).
   ============================================================ */

(function () {
  "use strict";

  const API2 = "https://api.open5e.com/v2/";
  const CACHE_KEY = "chaps-lib-creatures-v1"; // misma caché que biblioteca.js

  let creatures = null;   // lista normalizada en memoria
  let loading = false;
  let matches = [];

  function qs(s) { return document.querySelector(s); }

  function status(msg, cls) {
    const el = qs("#mx-status");
    if (!el) return;
    el.textContent = msg;
    el.className = "hint" + (cls ? " " + cls : "");
  }

  /* ---------- Normalización ---------- */

  function firstNum(v) {
    if (v == null) return "";
    if (typeof v === "number") return v;
    const m = String(v).match(/\d+/);
    return m ? parseInt(m[0], 10) : "";
  }

  function normAc(ac) {
    if (Array.isArray(ac)) return ac[0] && ac[0].value != null ? ac[0].value : "";
    if (ac && typeof ac === "object") return ac.value != null ? ac.value : "";
    return ac != null ? ac : "";
  }

  // Criatura desde la caché de biblioteca.js (formato "trim") o desde la API.
  function normalize(list) {
    return list.map((c) => ({
      name: c.name,
      ac: normAc(c.ac != null ? c.ac : c.armor_class),
      hp: firstNum(c.hp != null ? c.hp : c.hit_points),
      dex: c.ab ? c.ab.dexterity : (c.ability_scores ? c.ability_scores.dexterity : null),
      speed: firstNum(c.speed_all ? c.speed_all.walk : c.speed),
      actions: (c.actions || []).map((x) => ({
        n: x.n || x.name, d: x.d != null ? x.d : x.desc, atk: x.atk || x.attacks || []
      }))
    }));
  }

  function fromCache() {
    try {
      const o = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (o && Array.isArray(o.data) && o.data.length) return o.data;
    } catch (e) { /* caché ilegible: se descarga */ }
    return null;
  }

  async function fetchAll() {
    let url = API2 + "creatures/?document__key=srd-2024&limit=100";
    const out = [];
    while (url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      (j.results || []).forEach((c) => out.push(c));
      url = j.next;
    }
    return out;
  }

  async function ensureCreatures() {
    if (creatures) return creatures;
    if (loading) return null;
    loading = true;
    status("Descargando monstruos del SRD 2024…");
    try {
      const raw = fromCache() || (await fetchAll());
      creatures = normalize(raw);
      status(creatures.length + " monstruos listos. Escribe para buscar.", "ok");
    } catch (e) {
      status("No se pudieron cargar los monstruos: " + e.message, "err");
    }
    loading = false;
    return creatures;
  }

  /* ---------- Búsqueda y autocompletado ---------- */

  function search(q) {
    q = q.trim().toLowerCase();
    if (!q || !creatures) return [];
    const exact = [], starts = [], contains = [];
    creatures.forEach((c) => {
      const n = c.name.toLowerCase();
      if (n === q) exact.push(c);
      else if (n.startsWith(q)) starts.push(c);
      else if (n.includes(q)) contains.push(c);
    });
    starts.sort((a, b) => a.name.length - b.name.length);
    return exact.concat(starts, contains).slice(0, 30);
  }

  function renderPick() {
    const pick = qs("#mx-pick");
    pick.innerHTML = "";
    matches.forEach((c, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = c.name + (c.hp ? " · PG " + c.hp : "");
      pick.appendChild(o);
    });
  }

  function parseAttack(c) {
    // 1) Datos estructurados de la API v2 (SRD 2024): attacks[].to_hit_mod + dados
    for (const a of c.actions || []) {
      const w = (a.atk || []).find((x) => x && x.to_hit_mod != null);
      if (w) {
        const die = String(w.damage_die_type || "").replace(/\D/g, "");
        const dmg = (w.damage_die_count && die)
          ? w.damage_die_count + "d" + die + (w.damage_bonus ? "+" + w.damage_bonus : "")
          : "";
        return { bonus: String(w.to_hit_mod), dmg: dmg };
      }
    }
    // 2) Texto (caché de biblioteca): "Melee Attack Roll: +4, … (1d6 + 2)" o "+4 to hit"
    const atk = (c.actions || []).find((a) => /attack roll|to hit/i.test(a.d || ""));
    const text = atk ? (atk.d || "") : "";
    const bm = text.match(/attack roll:\s*([+-]\s?\d+)/i) || text.match(/([+-]\s?\d+)\s*to hit/i);
    const dm = text.match(/(\d+d\d+(?:\s*\+\s*\d+)?)/);
    return {
      // los <input type="number"> no aceptan el signo "+": se quita
      bonus: bm ? bm[1].replace(/[\s+]/g, "") : "",
      dmg: dm ? dm[1].replace(/\s/g, "") : ""
    };
  }

  function fillForm(c) {
    const atk = parseAttack(c);
    const init = typeof c.dex === "number" ? Math.floor((c.dex - 10) / 2) : "";
    const set = (id, val) => {
      const el = qs(id);
      if (el && val !== "" && val != null) el.value = val;
    };
    set("#cf-name", c.name);
    set("#cf-hp", c.hp);
    set("#cf-ac", c.ac);
    set("#cf-speed", c.speed);
    set("#cf-init", init);
    set("#cf-bonus", atk.bonus);
    set("#cf-dmg", atk.dmg);
    status("✔ " + c.name + " cargado. Revisa los campos y pulsa «+ Crear y añadir».", "ok");
  }

  /* ---------- Init ---------- */

  function init() {
    const btn = qs("#mx-fill"), inp = qs("#mx-search");
    if (!btn || !inp) return;

    inp.addEventListener("input", async () => {
      const list = await ensureCreatures();
      if (!list) return;
      matches = search(inp.value);
      renderPick();
      if (inp.value.trim()) {
        status(matches.length
          ? matches.length + " resultado(s). Elige y pulsa Autocompletar."
          : "Sin resultados para «" + inp.value.trim() + "».", matches.length ? "ok" : "err");
      }
    });

    btn.addEventListener("click", async () => {
      const list = await ensureCreatures();
      if (!list) return;
      if (!matches.length) { matches = search(inp.value); renderPick(); }
      const pick = qs("#mx-pick");
      const c = matches[parseInt(pick.value, 10) || 0];
      if (c) fillForm(c);
      else status("Escribe un nombre de monstruo primero (p. ej. goblin).", "err");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
