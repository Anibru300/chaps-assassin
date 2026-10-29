/* Personajes, cuenta, historial, mesa y notas. Datos de juego siguen en state. */
(function () {
  "use strict";
  const el = (id) => document.getElementById(id);
  const profiles = CHAPS_PROFILE_STORE({ storage: localStorage, store: window.CHAPS_STORE });
  let renderedCharacter = "";
  let savingVersion = false;
  const key = () => JSON.stringify(profiles.current);
  const message = (id, text) => { if (el(id)) el(id).textContent = text; };
  const error = (value) => window.CHAPS_CLOUD?.errorText(value) || value.message;
  const setValue = (node, value) => { if (node && node.value !== String(value ?? "")) node.value = value ?? ""; };
  const localDate = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  function renderPickers() {
    const current = profiles.current;
    const entries = profiles.catalog(current.uid);
    const active = { id: current.id, name: state.name, level: state.level };
    const list = [active, ...entries.filter((entry) => entry.id !== current.id)];
    document.querySelectorAll("[data-character-picker]").forEach((select) => {
      const signature = JSON.stringify(list);
      if (select.dataset.options !== signature) {
        select.replaceChildren();
        for (const entry of list) {
          const option = document.createElement("option");
          option.value = entry.id; option.textContent = `${entry.name || "Sin nombre"} · N${entry.level}`;
          select.appendChild(option);
        }
        select.dataset.options = signature;
      }
      select.value = current.id;
      select.disabled = !window.CHAPS_CLOUD?.userInfo();
    });
  }
  function renderAccount() {
    const user = window.CHAPS_CLOUD?.userInfo();
    message("account-summary", user ? `${user.email} · accesos: ${user.providers.join(", ")}` : "Inicia sesión para administrar acceso.");
    if (el("account-password-form")) {
      for (const input of el("account-password-form").elements) input.disabled = !user;
      el("account-link-google").hidden = !user || user.providers.includes("google.com");
      el("account-verify").hidden = !user || !user.providers.includes("google.com");
    }
    if (el("character-create")) el("character-create").disabled = !user;
    if (el("character-copy")) el("character-copy").disabled = !user;
    if (el("save-day-version")) el("save-day-version").disabled = !user || savingVersion;
  }
  function renderMesa() {
    if (!el("table-name")) return;
    message("table-name", state.name);
    const stats = [["CA", state.ac], ["PG máximos", state.hpMax], ["Iniciativa", fmtMod(state.initiative)], ["Dados de golpe", `${Math.max(0, state.level - state.hitDiceSpent)}/${state.level}d8`]];
    el("table-stats").replaceChildren();
    for (const [label, value] of stats) {
      const box = document.createElement("div");
      const small = document.createElement("span"); small.textContent = label;
      const strong = document.createElement("strong"); strong.textContent = value;
      box.append(small, strong); el("table-stats").appendChild(box);
    }
    setValue(el("table-hp"), state.hpCurrent);
    setValue(el("table-temp"), state.hpTemp);
    el("table-inspiration").checked = state.inspiration;
    for (const input of el("table-conditions").querySelectorAll("input")) input.checked = !!state.tableConditions?.[input.value];
    const entry = state.journal?.[0];
    message("table-session-summary", entry ? [entry.date, entry.title, entry.text].filter(Boolean).join("\n\n") : "Añade entradas en Diario de aventuras.");
  }
  function showSection(id) {
    document.querySelector('.tab-btn[data-tab="sheet"]').click();
    const target = el(id); target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); target.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  async function createCharacter(copy) {
    try {
      const name = el("character-name").value.trim();
      if (!name) throw new Error("Escribe nombre de personaje.");
      await window.CHAPS_CLOUD.createCharacter(name, copy);
      el("character-name").value = ""; message("character-status", "Personaje listo. Datos separados de otras fichas.");
    } catch (value) { message("character-status", error(value)); }
  }
  async function loadHistory() {
    const selected = key();
    message("history-status", "Cargando historial…");
    try {
      const versions = await window.CHAPS_CLOUD.history();
      if (selected !== key()) return;
      el("history-list").replaceChildren();
      const groups = new Map();
      for (const version of versions) {
        const data = JSON.parse(version.payload);
        const date = version.timestamp ? new Date(version.timestamp) : null;
        const day = date ? date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : "Fecha no disponible";
        if (!groups.has(day)) {
          const group = document.createElement("section"); group.className = "version-day";
          const heading = document.createElement("h3"); heading.textContent = "Versiones del " + day;
          group.appendChild(heading); el("history-list").appendChild(group); groups.set(day, group);
        }
        const row = document.createElement("div"); row.className = "version-row";
        const label = document.createElement("span");
        label.textContent = `${version.manual ? "Guardada" : "Automática"} · ${date ? date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : ""} · ${data.name} · N${data.level} · PG ${data.hpCurrent}/${data.hpMax}`;
        const button = document.createElement("button"); button.type = "button"; button.className = "btn btn-small"; button.textContent = "Restaurar";
        button.addEventListener("click", async () => {
          if (selected !== key() || !confirm(`¿Restaurar versión ${version.revision} de ${data.name}? Estado actual quedará en historial al sincronizar.`)) return;
          button.disabled = true;
          try { await window.CHAPS_CLOUD.restore(version.id); message("history-status", "Versión recuperada; sincronización conserva historial anterior."); }
          catch (value) { message("history-status", error(value)); }
          finally { button.disabled = false; }
        });
        row.append(label, button); groups.get(day).appendChild(row);
      }
      message("history-status", versions.length ? `${versions.length} versiones disponibles.` : "Historial comenzará con próximo cambio sincronizado.");
    } catch (value) { if (selected === key()) message("history-status", error(value)); }
  }
  function roll(count, sides, label, advantage = false) {
    const dice = rollDice(count, sides);
    const result = advantage ? Math.max(...dice) : sum(dice);
    const text = `${label}: [${dice.join(", ")}] = ${result}${advantage ? " (ventaja)" : ""}`;
    message("table-roll", text);
    const row = document.createElement("li"); row.textContent = text; el("table-roll-log").prepend(row);
    while (el("table-roll-log").children.length > 20) el("table-roll-log").lastChild.remove();
  }
  window.CHAPS_FEATURES = {
    profiles,
    saved() { profiles.save(); renderPickers(); renderMesa(); },
    render() {
      if (!el("section-characters")) return;
      if (renderedCharacter !== key()) {
        renderedCharacter = key();
        el("history-list").replaceChildren(); message("save-version-status", "Conserva ficha de hoy en Historial de versiones.");
        el("table-roll-log").replaceChildren(); message("table-roll", "Prepara tu primera tirada.");
        message("history-status", "");
      }
      renderPickers(); renderAccount(); renderMesa();
    },
    showSection
  };
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-character-picker]").forEach((select) => select.addEventListener("change", async () => {
      try { await window.CHAPS_CLOUD.selectCharacter(select.value); }
      catch (value) { message("character-status", error(value)); renderPickers(); }
    }));
    el("character-create").addEventListener("click", () => createCharacter(false));
    el("character-copy").addEventListener("click", () => createCharacter(true));
    el("account-password-form").addEventListener("submit", async (event) => {
      event.preventDefault(); const button = event.submitter; button.disabled = true;
      try {
        await window.CHAPS_CLOUD.setPassword(el("account-password").value, el("account-confirm").value, el("account-old-password").value);
        el("account-password-form").reset(); renderAccount(); message("account-status", "Contraseña lista. Puedes entrar con mismo correo y conservar personajes de Google.");
      } catch (value) { message("account-status", error(value)); }
      finally { button.disabled = false; }
    });
    for (const [id, method] of [["account-verify", "verifyGoogle"], ["account-link-google", "linkGoogle"]]) el(id).addEventListener("click", async () => {
      try { await window.CHAPS_CLOUD[method](); renderAccount(); message("account-status", "Cuenta verificada y vinculada."); }
      catch (value) { message("account-status", error(value)); }
    });
    el("history-load").addEventListener("click", loadHistory);
    el("save-day-version").addEventListener("click", async () => {
      const selected = key(), button = el("save-day-version");
      savingVersion = true; button.disabled = true; message("save-version-status", "Guardando versión…");
      try {
        const result = await window.CHAPS_CLOUD.saveVersion();
        if (selected !== key()) return;
        message("save-version-status", "Versión guardada del " + new Date(result.savedAt).toLocaleString("es-MX") + ". Disponible en Historial de versiones.");
        await loadHistory();
      } catch (value) { if (selected === key()) message("save-version-status", error(value)); }
      finally { savingVersion = false; renderAccount(); }
    });
    for (const [id, field] of [["table-hp", "hpCurrent"], ["table-temp", "hpTemp"]]) el(id).addEventListener("input", () => {
      if (el(id).value === "" || !el(id).validity.valid) return;
      state[field] = Math.max(0, Math.floor(Number(el(id).value))); saveState(); renderIdentity();
    });
    el("table-inspiration").addEventListener("change", () => { state.inspiration = el("table-inspiration").checked; saveState(); renderIdentity(); });
    for (const condition of CONDITIONS) {
      const label = document.createElement("label"), input = document.createElement("input"), text = document.createElement("span");
      input.type = "checkbox"; input.value = condition.id; text.textContent = condition.nameEs;
      input.addEventListener("change", () => { state.tableConditions ||= {}; state.tableConditions[condition.id] = input.checked; saveState(); });
      label.append(input, text); el("table-conditions").appendChild(label);
    }
    el("table-damage").addEventListener("click", () => {
      const amount = Math.floor(Number(el("table-amount").value)); if (!Number.isFinite(amount) || amount < 1) return;
      const absorbed = Math.min(state.hpTemp, amount); state.hpTemp -= absorbed; state.hpCurrent = Math.max(0, state.hpCurrent - amount + absorbed); saveState(); renderIdentity();
    });
    el("table-heal").addEventListener("click", () => {
      const amount = Math.floor(Number(el("table-amount").value)); if (!Number.isFinite(amount) || amount < 1) return;
      state.hpCurrent = Math.min(state.hpMax, state.hpCurrent + amount); saveState(); renderIdentity();
    });
    el("table-short-rest").addEventListener("click", () => { shortRest(); renderMesa(); });
    el("table-long-rest").addEventListener("click", () => { longRest(); renderMesa(); });
    document.querySelectorAll("[data-table-die]").forEach((button) => button.addEventListener("click", () => {
      const sides = Number(button.dataset.tableDie), advantage = sides === 20 && el("table-advantage").checked;
      roll(advantage ? 2 : 1, sides, "d" + sides, advantage);
    }));
    el("table-sneak").addEventListener("click", () => roll(sneakDiceCount(state.level), 6, "Furtivo"));
    el("table-note-add").addEventListener("click", () => {
      const text = el("table-observation").value.trim(); if (!text) return;
      state.journal.unshift({ date: localDate(), title: "Observación de partida", text });
      saveState(); renderJournal(); el("table-observation").value = ""; message("table-note-status", "Observación guardada en Diario de aventuras.");
    });
    el("table-open-notes").addEventListener("click", () => showSection("section-journal"));
    window.CHAPS_FEATURES.render();
  });
})();
