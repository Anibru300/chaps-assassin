/* ============================================================
   CHAPS — Biblioteca D&D 2024 (Open5e API)
   ------------------------------------------------------------
   Descarga el System Reference Document 5.2 (reglas 2024) bajo
   demanda, recorta cada entrada a los campos que se muestran y
   la guarda en localStorage durante 7 días para filtrado
   instantáneo (y consulta offline una vez descargada).
   Fuente: https://api.open5e.com — SRD 5.2 © WotC, CC-BY-4.0.
   ============================================================ */

"use strict";

(function () {

  const API2 = "https://api.open5e.com/v2/";
  const API1 = "https://api.open5e.com/v1/";
  const PAGE = 100;
  const CACHE_TTL = 7 * 24 * 3600 * 1000; // 7 días

  const CATS = {
    spells:     { label: "Hechizos",        url: API2 + "spells/?document__key=srd-2024&limit=" + PAGE },
    weapons:    { label: "Armas",           url: API2 + "weapons/?document__key=srd-2024&limit=" + PAGE },
    armor:      { label: "Armaduras",       url: API2 + "armor/?document__key=srd-2024&limit=" + PAGE },
    creatures:  { label: "Monstruos",       url: API2 + "creatures/?document__key=srd-2024&limit=" + PAGE },
    classes:    { label: "Clases",          url: API2 + "classes/?document__key=srd-2024&limit=" + PAGE },
    conditions: { label: "Condiciones",     url: API1 + "conditions/?limit=" + PAGE },
    magicitems: { label: "Objetos mágicos", url: API1 + "magicitems/?document__slug=wotc-srd&limit=" + PAGE }
  };

  const LIB = {}; // datos recortados en memoria, por categoría
  let currentCat = "spells";

  /* ---------- Utilidades ---------- */

  function esc(s) { return escapeHtml(String(s == null ? "" : s)); }

  /** Mini-markdown: **negrita**, listas con "* " y saltos de línea. */
  function mdLite(s) {
    const lines = String(s || "").split(/\r?\n/);
    let html = "";
    let inList = false;
    const inline = (t) => esc(t)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\|([^|]+)\|/g, "<code>$1</code>");
    for (const raw of lines) {
      const line = raw.trim();
      const m = line.match(/^[*\-]\s+(.*)$/);
      if (m) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += "<li>" + inline(m[1]) + "</li>";
      } else {
        if (inList) { html += "</ul>"; inList = false; }
        if (line) html += "<p>" + inline(line) + "</p>";
      }
    }
    if (inList) html += "</ul>";
    return html;
  }

  function fmtCr(cr) {
    if (cr === 0.125) return "1/8";
    if (cr === 0.25) return "1/4";
    if (cr === 0.5) return "1/2";
    return String(cr);
  }

  function speedStr(sp) {
    if (!sp) return "";
    const parts = [];
    if (sp.walk) parts.push(sp.walk + " ft.");
    if (sp.fly) parts.push("vuelo " + sp.fly + " ft." + (sp.hover ? " (planea)" : ""));
    if (sp.swim) parts.push("natación " + sp.swim + " ft.");
    if (sp.climb) parts.push("trepar " + sp.climb + " ft.");
    if (sp.burrow) parts.push("excavar " + sp.burrow + " ft.");
    return parts.join(", ") || "—";
  }

  const RARITY_ES = {
    "common": "Común", "uncommon": "Poco común", "rare": "Raro",
    "very rare": "Muy raro", "legendary": "Legendario", "artifact": "Artefacto",
    "varies": "Varía"
  };

  /* ---------- Recorte de datos (reduce lo que se cachea) ---------- */

  function trimEntry(cat, r) {
    switch (cat) {
      case "spells": return {
        name: r.name, level: r.level, school: r.school && r.school.name,
        time: r.casting_time, range: r.range_text, duration: r.duration,
        conc: !!r.concentration, ritual: !!r.ritual,
        comp: [r.verbal && "V", r.somatic && "S", r.material && "M"].filter(Boolean).join(", "),
        mat: r.material_specified || "",
        save: r.saving_throw_ability || "", atk: !!r.attack_roll,
        classes: (r.classes || []).map((c) => c.name || c),
        desc: r.desc, higher: r.higher_level || ""
      };
      case "weapons": return {
        name: r.name, dice: r.damage_dice, dtype: r.damage_type && r.damage_type.name,
        simple: !!r.is_simple, range: r.range, long: r.long_range,
        props: (r.properties || []).map((p) => ({
          n: p.property.name, t: p.property.type, d: p.detail, desc: p.property.desc
        }))
      };
      case "armor": return {
        name: r.name,
        cat: (r.category && r.category.name) || r.category || "",
        ac: r.ac_display,
        stealth: !!r.grants_stealth_disadvantage,
        str: r.strength_score_required || 0
      };
      case "creatures": return {
        name: r.name, type: r.type && r.type.name, size: r.size && r.size.name,
        cr: r.challenge_rating, xp: r.experience_points,
        ac: r.armor_class, acd: r.armor_detail || "",
        hp: r.hit_points, hd: r.hit_dice, align: r.alignment,
        pp: r.passive_perception, speed: speedStr(r.speed_all),
        ab: r.ability_scores,
        traits: (r.traits || []).map((x) => ({ n: x.name, d: x.desc })),
        actions: (r.actions || []).map((x) => ({ n: x.name, d: x.desc }))
      };
      case "classes": return {
        name: r.name, hd: r.hit_dice, desc: r.desc || "",
        prim: (r.primary_abilities || []).map((a) => (a && a.name) || a),
        saves: (r.saving_throws || []).map((a) => (a && a.name) || a),
        sub: !!r.subclass_of
      };
      case "conditions": return { name: r.name, desc: r.desc };
      case "magicitems": return {
        name: r.name, type: r.type, rarity: r.rarity,
        att: r.requires_attunement || "", desc: r.desc
      };
    }
    return r;
  }

  /* ---------- Caché en localStorage ---------- */

  function cacheKey(cat) { return "chaps-lib-" + cat + "-v1"; }

  function readCache(cat) {
    try {
      const o = JSON.parse(localStorage.getItem(cacheKey(cat)));
      if (o && o.ts && Date.now() - o.ts < CACHE_TTL && Array.isArray(o.data)) return o;
    } catch (e) { /* caché ilegible: se ignora */ }
    return null;
  }

  function writeCache(cat, data) {
    try {
      localStorage.setItem(cacheKey(cat), JSON.stringify({ ts: Date.now(), data }));
    } catch (e) { /* sin espacio disponible: se trabaja solo en memoria */ }
  }

  /* ---------- Descarga paginada ---------- */

  async function fetchAll(cat, onProgress) {
    let url = CATS[cat].url;
    const out = [];
    while (url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      (json.results || []).forEach((r) => out.push(trimEntry(cat, r)));
      if (onProgress) onProgress(out.length, json.count);
      url = json.next;
    }
    return out;
  }

  /** Garantiza que la categoría está cargada (caché → red). */
  async function ensureCat(cat, force) {
    if (!force && LIB[cat]) return LIB[cat];
    if (!force) {
      const cached = readCache(cat);
      if (cached) {
        LIB[cat] = cached.data;
        setStatus(cached.data.length + " entradas · datos guardados el " +
          new Date(cached.ts).toLocaleDateString("es-ES") + " (pulsa ↻ para actualizar)");
        return LIB[cat];
      }
    }
    setStatus("Descargando " + CATS[cat].label.toLowerCase() + "…");
    const data = await fetchAll(cat, (n, total) =>
      setStatus("Descargando " + CATS[cat].label.toLowerCase() + "… " + n + "/" + total));
    if (cat === "classes") {
      // Solo las 12 clases base del SRD (sin subclases).
      LIB[cat] = data.filter((c) => !c.sub);
    } else {
      LIB[cat] = data;
    }
    writeCache(cat, LIB[cat]);
    setStatus(LIB[cat].length + " entradas · SRD 5.2 (2024) vía Open5e");
    return LIB[cat];
  }

  /* ---------- Filtros por categoría ---------- */

  function filterOptions(cat) {
    switch (cat) {
      case "spells":
        return [["all", "Todos los niveles"], ["0", "Trucos (nivel 0)"]]
          .concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [String(n), "Nivel " + n]));
      case "weapons":
        return [["all", "Todas"], ["simple", "Sencillas"], ["martial", "Marciales"]];
      case "creatures":
        return [["all", "Todos los CR"], ["0-1", "CR 0–1"], ["2-4", "CR 2–4"],
                ["5-9", "CR 5–9"], ["10-14", "CR 10–14"], ["15-30", "CR 15+"]];
      case "magicitems":
        return [["all", "Todas las rarezas"], ["common", "Común"], ["uncommon", "Poco común"],
                ["rare", "Raro"], ["very rare", "Muy raro"], ["legendary", "Legendario"],
                ["artifact", "Artefacto"]];
      default:
        return null; // sin filtro extra
    }
  }

  function applyFilter(cat, list, f) {
    if (!f || f === "all") return list;
    if (cat === "spells") return list.filter((s) => String(s.level) === f);
    if (cat === "weapons") return list.filter((w) => (f === "simple") === w.simple);
    if (cat === "creatures") {
      const [lo, hi] = f.split("-").map(Number);
      return list.filter((c) => c.cr >= lo && c.cr <= hi);
    }
    if (cat === "magicitems") {
      return list.filter((m) => String(m.rarity).toLowerCase() === f);
    }
    return list;
  }

  /* ---------- Badges de cada fila ---------- */

  function rowBadges(cat, it) {
    const b = [];
    if (cat === "spells") {
      b.push(it.level === 0 ? "Truco" : "Nivel " + it.level);
      if (it.school) b.push(it.school);
      if (it.ritual) b.push("Ritual");
      if (it.conc) b.push("Conc.");
    } else if (cat === "weapons") {
      b.push(it.dice + " " + (it.dtype || ""));
      b.push(it.simple ? "Sencilla" : "Marcial");
    } else if (cat === "armor") {
      b.push(it.ac);
      if (it.cat) b.push(it.cat);
    } else if (cat === "creatures") {
      b.push("CR " + fmtCr(it.cr));
      if (it.type) b.push(it.type);
    } else if (cat === "classes") {
      b.push(it.hd);
    } else if (cat === "magicitems") {
      b.push(RARITY_ES[String(it.rarity).toLowerCase()] || it.rarity);
    }
    return b;
  }

  /* ---------- Detalle de cada entrada ---------- */

  function metaGrid(pairs) {
    return '<div class="lib-meta-grid">' + pairs
      .filter((p) => p[1] !== undefined && p[1] !== "" && p[1] !== null)
      .map((p) => '<div class="m"><b>' + esc(p[0]) + "</b>" + esc(p[1]) + "</div>")
      .join("") + "</div>";
  }

  function detailHtml(cat, it) {
    if (cat === "spells") {
      return metaGrid([
        ["Tiempo", it.time], ["Alcance", it.range], ["Duración", it.duration],
        ["Componentes", it.comp + (it.mat ? " (" + it.mat + ")" : "")],
        ["Salvación", it.save ? it.save.toUpperCase() : ""],
        ["Tirada de ataque", it.atk ? "Sí" : ""],
        ["Clases", (it.classes || []).join(", ")]
      ]) + mdLite(it.desc) +
        (it.higher ? '<p class="lib-higher"><strong>A niveles superiores:</strong> ' + mdLite(it.higher) + "</p>" : "");
    }
    if (cat === "weapons") {
      const mastery = (it.props || []).filter((p) => p.t === "Mastery");
      const others = (it.props || []).filter((p) => p.t !== "Mastery");
      let html = metaGrid([
        ["Daño", it.dice + " " + (it.dtype || "")],
        ["Tipo", it.simple ? "Sencilla" : "Marcial"],
        ["Alcance", it.range ? it.range + "/" + it.long + " ft." : "Cuerpo a cuerpo"]
      ]);
      if (mastery.length) {
        html += '<p class="lib-sub">Maestría</p><ul>' + mastery.map((p) =>
          "<li><strong>" + esc(p.n) + (p.d ? " (" + esc(p.d) + ")" : "") + ".</strong> " + mdLite(p.desc) + "</li>").join("") + "</ul>";
      }
      if (others.length) {
        html += '<p class="lib-sub">Propiedades</p><ul>' + others.map((p) =>
          "<li><strong>" + esc(p.n) + (p.d ? " (" + esc(p.d) + ")" : "") + ".</strong> " + mdLite(p.desc) + "</li>").join("") + "</ul>";
      }
      return html;
    }
    if (cat === "armor") {
      return metaGrid([
        ["Clase de armadura", it.ac], ["Categoría", it.cat],
        ["FUE mínima", it.str || ""],
        ["Desventaja en Sigilo", it.stealth ? "Sí" : "No"]
      ]);
    }
    if (cat === "creatures") {
      const abs = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
      const names = ["FUE", "DES", "CON", "INT", "SAB", "CAR"];
      let html = metaGrid([
        ["CA", it.ac + (it.acd ? " (" + it.acd + ")" : "")],
        ["PG", it.hp + (it.hd ? " (" + it.hd + ")" : "")],
        ["Velocidad", it.speed],
        ["CR", fmtCr(it.cr) + (it.xp ? " · " + fmtNum(it.xp) + " PX" : "")],
        ["Tamaño / Tipo", [it.size, it.type].filter(Boolean).join(" · ")],
        ["Alineamiento", it.align],
        ["Percepción pasiva", it.pp]
      ]);
      if (it.ab) {
        html += '<div class="lib-stats">' + abs.map((a, i) =>
          '<div class="lib-stat"><b>' + names[i] + "</b>" + esc(it.ab[a]) +
          " <span>(" + fmtMod(abilityMod(it.ab[a])) + ")</span></div>").join("") + "</div>";
      }
      if (it.traits && it.traits.length) {
        html += '<p class="lib-sub">Rasgos</p>' + it.traits.map((x) =>
          "<p><strong>" + esc(x.n) + ".</strong> " + mdLite(x.d) + "</p>").join("");
      }
      if (it.actions && it.actions.length) {
        html += '<p class="lib-sub">Acciones</p>' + it.actions.map((x) =>
          "<p><strong>" + esc(x.n) + ".</strong> " + mdLite(x.d) + "</p>").join("");
      }
      return html;
    }
    if (cat === "classes") {
      return metaGrid([
        ["Dado de golpe", it.hd],
        ["Características clave", (it.prim || []).join(", ")],
        ["Salvaciones", (it.saves || []).join(", ")]
      ]) + mdLite(it.desc);
    }
    if (cat === "magicitems") {
      return metaGrid([
        ["Tipo", it.type],
        ["Rareza", RARITY_ES[String(it.rarity).toLowerCase()] || it.rarity],
        ["Sintonía", it.att]
      ]) + mdLite(it.desc);
    }
    // conditions
    return mdLite(it.desc);
  }

  /* ---------- Render ---------- */

  function setStatus(msg) {
    const el = document.getElementById("lib-status");
    if (el) el.textContent = msg || "";
  }

  function renderFilterSelect(cat) {
    const sel = document.getElementById("lib-filter");
    const opts = filterOptions(cat);
    sel.innerHTML = "";
    if (!opts) { sel.hidden = true; return; }
    sel.hidden = false;
    opts.forEach(([v, label]) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = label;
      sel.appendChild(o);
    });
  }

  function renderList() {
    const box = document.getElementById("lib-results");
    const list = LIB[currentCat] || [];
    const q = (document.getElementById("lib-search").value || "").trim().toLowerCase();
    const f = document.getElementById("lib-filter").value;
    let out = applyFilter(currentCat, list, f);
    if (q) out = out.filter((it) => it.name.toLowerCase().includes(q));

    box.innerHTML = "";
    if (!out.length) {
      box.innerHTML = '<p class="hint">Sin resultados para esa búsqueda.</p>';
      return;
    }
    out.forEach((it, i) => {
      const row = document.createElement("div");
      row.className = "lib-row";
      row.innerHTML =
        '<div class="lib-row-head"><span class="lib-name">' + esc(it.name) + '</span>' +
        '<span class="lib-badges">' + rowBadges(currentCat, it)
          .map((b) => '<span class="lib-badge">' + esc(b) + "</span>").join("") +
        "</span></div>" +
        '<div class="lib-detail-inline" hidden>' + detailHtml(currentCat, it) + "</div>";
      row.querySelector(".lib-row-head").addEventListener("click", () => {
        const det = row.querySelector(".lib-detail-inline");
        const open = det.hidden;
        // Solo una entrada abierta a la vez.
        box.querySelectorAll(".lib-detail-inline").forEach((d) => { d.hidden = true; });
        box.querySelectorAll(".lib-row").forEach((r) => r.classList.remove("lib-open"));
        det.hidden = !open;
        row.classList.toggle("lib-open", open);
      });
      box.appendChild(row);
      if (i >= 399) { // seguridad: nunca más de 400 filas renderizadas
        const more = document.createElement("p");
        more.className = "hint";
        more.textContent = "…y " + (out.length - 400) + " más. Refina la búsqueda.";
        box.appendChild(more);
        return;
      }
    });
  }

  async function selectCat(cat, force) {
    currentCat = cat;
    document.querySelectorAll(".lib-cat").forEach((b) =>
      b.classList.toggle("active", b.dataset.cat === cat));
    document.getElementById("lib-results").innerHTML = "";
    renderFilterSelect(cat);
    try {
      await ensureCat(cat, force);
      renderList();
    } catch (e) {
      console.warn("Biblioteca:", e);
      setStatus("No se pudo descargar (¿sin conexión?). Si ya habías cargado esta sección antes, se usará la copia guardada.");
      const cached = readCache(cat);
      if (cached) { LIB[cat] = cached.data; renderList(); }
    }
  }

  /* ---------- Arranque ---------- */

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById("lib-nav");
    if (!nav) return;
    nav.querySelectorAll(".lib-cat").forEach((btn) =>
      btn.addEventListener("click", () => selectCat(btn.dataset.cat)));
    let debounce = null;
    document.getElementById("lib-search").addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(renderList, 150);
    });
    document.getElementById("lib-filter").addEventListener("change", renderList);
    document.getElementById("lib-reload").addEventListener("click", () => selectCat(currentCat, true));
    // Carga perezosa: la primera categoría solo se descarga al abrir la pestaña.
    let firstOpen = true;
    document.querySelector('.tab-btn[data-tab="library"]').addEventListener("click", () => {
      if (firstOpen) { firstOpen = false; selectCat("spells"); }
    });
  });

})();
