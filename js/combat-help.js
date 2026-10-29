/* Ayuda contextual y navegación de consola; no consume recursos ni cambia tiradas. */
(function () {
  "use strict";
  const el = id => document.getElementById(id);
  const descriptions = () => ({
    "c-btn-attack": ["Atacar · acción", "Abre tirada. Elige arma y enemigo; acción se gasta al resolver ataque, incluso si falla."],
    "c-atk-roll": ["Tirar dados", "Muestra d20 real, bono, total contra CA y daño. Revisa ventaja, alcance y Golpes Astutos antes de tirar."],
    "c-atk-cancel": ["Cancelar", "Cierra preparación sin gastar acción. Puedes cambiar objetivo o mover primero."],
    "c-btn-extra": ["Extra · arma ligera", "Aparece tras ataque ligero. Normalmente usa acción adicional; Nick dominado permite ataque extra sin gastarla."],
    "c-btn-steady": ["Puntería · Pícaro N3 · acción adicional", isAssassinCharacter() && state.level >= 9 ? "Da ventaja al próximo ataque de este turno sin reducir velocidad. Requiere no haber movido antes de usarla." : "Pícaro N3: da ventaja al próximo ataque; requiere no haber movido y deja movimiento en cero."],
    "c-btn-hide": [isRogueCharacter() && state.level >= 2 ? "Ocultar · acción adicional" : "Ocultar · acción", "Motor tira Sigilo contra Percepción enemiga. Éxito ayuda al próximo ataque; revisa resultado en registro."],
    "c-btn-dash": [isRogueCharacter() && state.level >= 2 ? "Dash · acción adicional" : "Dash · acción", "Añade movimiento igual a velocidad. Acción Astuta desde Pícaro N2 permite usar adicional."],
    "c-btn-disengage": [isRogueCharacter() && state.level >= 2 ? "Retirar · acción adicional" : "Retirar · acción", "Evita ataques de oportunidad durante movimiento de este turno. No equivale a Golpe Astuto Retirada."],
    "c-btn-move": ["Mover · movimiento", "Activa Mover y toca casilla: movimiento inmediato, sin confirmación. Casilla normal cuesta 5 ft, difícil 10 ft; ruta, peligros y oportunidades se calculan automáticamente."],
    "c-btn-end": ["Fin turno", "Entrega turno a enemigos. Recursos se recuperan al empezar siguiente turno propio; enemigos respetan pausa y velocidad."],
    "bt-heal": ["Curación recibida", "Registra PG recibidos de aliado u objeto hasta máximo. No descuenta pociones ni acciones automáticamente."],
    "bt-pause": ["Pausar enemigos", "Detiene ejecución automática. Continuar reanuda enemigo pendiente; no reinicia turno."],
    "bt-step": ["Avanzar enemigo", "Ejecuta un turno enemigo completo y vuelve a esperar. Útil para leer cada resultado."],
    "bt-save": ["Guardar combate", "Conserva mapa, turno y recursos en este dispositivo para cuenta/personaje actuales."],
    "bt-resume": ["Retomar combate", "Recupera guardado sin devolver acciones gastadas. Enemigos empiezan pausados."],
    "c-atk-weapon": ["Arma", "Elige arma para tirada. Alcance y maestría dependen de arma equipada y dominio registrado en ficha."],
    "c-atk-target": ["Objetivo", "Puedes elegir enemigo aquí o tocando su ficha en mapa. Ficha táctica muestra vida, condiciones y cobertura."],
    "c-atk-ally": ["Aliado cerca", "Marca solo si aliado capaz de actuar está a 5 ft del enemigo. Puede habilitar Furtivo sin ventaja cuando no hay desventaja."]
  });
  let topic = "c-btn-attack", resumeAfterHelp = false, helpActor = null, helpScope = null;
  const scope = () => JSON.stringify(window.CHAPS_FEATURES?.profiles.current);
  const append = (parent, tag, value) => { const node = document.createElement(tag); node.textContent = value; parent.appendChild(node); return node; };
  function dockHeight() {
    const dock = document.querySelector(".battle-console .combat-actions"), height = dock?.getBoundingClientRect().height;
    if (height > 0) document.documentElement.style.setProperty("--combat-dock-height", Math.ceil(height) + "px");
  }
  function contextual(id) {
    topic = id || topic;
    const entry = descriptions()[topic]; if (!entry) return;
    let reason = "";
    if (combat.on && el(topic)?.disabled && ["c-btn-attack", "c-btn-extra", "c-btn-steady", "c-btn-hide", "c-btn-dash", "c-btn-disengage", "c-btn-end"].includes(topic)) reason = !isPlayerTurn() ? "Espera turno propio. " : topic === "c-btn-attack" ? "Acción ya gastada. " : "Recurso requerido no disponible. ";
    el("battle-context-help").textContent = reason + entry[1];
  }
  function resources() {
    const container = el("combat-help-resources"); if (!container) return;
    container.replaceChildren();
    const p = combat.p, ownTurn = !!p && isPlayerTurn();
    const usable = flag => !p ? "Sin combate activo" : flag ? ownTurn ? "Disponible" : "Espera turno propio" : "Gastada";
    const values = [
      ["Acción", usable(p?.action)], ["Acción adicional", usable(p?.ba)],
      ["Reacción", !p ? "Sin combate activo" : p.react ? "Disponible, también fuera de turno propio" : "Gastada"],
      ["Movimiento", p ? `${p.move + p.withdraw} ft restantes` : `${state.speed} ft de velocidad`],
      ["Furtivo", isRogueCharacter() ? `${sneakDiceCount(state.level)}d6 · ${p?.sneak ? "usado este turno" : "se aplica si cumples condiciones"}` : 'Rasgo de Pícaro; no disponible para esta clase'],
      ["Golpes Astutos", !isRogueCharacter() ? 'Rasgo de Pícaro' : state.level < 5 ? "Se desbloquean en nivel 5" : `CD ${saveDC()} · hasta ${maxCunningStrikes(state.level)} efecto(s) por Furtivo`]
    ];
    for (const [label, value] of values) { const group = document.createElement("div"); append(group, "dt", label); append(group, "dd", value); container.appendChild(group); }
  }
  function fillGuide() {
    const buttons = el("combat-help-buttons"); buttons.replaceChildren();
    for (const [title, detail] of Object.values(descriptions())) { append(buttons, "dt", title); append(buttons, "dd", detail); }
    const rules = el("combat-help-rules"); rules.replaceChildren();
    const list = document.createElement("ul");
    for (const value of [
      "Turno: acción, acción adicional si rasgo la permite y movimiento. Reacción puede gastarse fuera de turno propio y se recupera al empezar turno propio.",
      "Ataque: total de tirada debe alcanzar CA. Natural 1 falla y natural 20 es crítico. Crítico duplica dados de daño, no bonos fijos.",
      "Ventaja usa mejor de dos d20; desventaja usa peor. Si coinciden ambas, se cancelan. Vista previa explica motivos.",
      `Furtivo: ${sneakDiceCount(state.level)}d6 en tu nivel, una vez por turno, con arma apropiada y ventaja; aliado junto a objetivo también puede habilitarlo sin desventaja. Motor lo aplica automáticamente.`,
      `Golpes Astutos sustituyen dados de Furtivo por efectos; no son reserva diaria. Selector limita coste y cantidad. CD actual: ${saveDC()}.`,
      "Retirar evita oportunidades durante turno. Golpe Astuto Retirada concede desplazamiento específico y cuesta dados de Furtivo.",
      "En este tablero, diagonal normal también cuesta 5 ft. Cobertura y obstáculos pueden cambiar ataque; revisa alcance y visión antes de tirar.",
      "PG del combate se guardan por separado: al terminar, Guardar PG en ficha aplica resultado a personaje. Curación externa solo registra ayuda recibida."
    ]) append(list, "li", value);
    rules.appendChild(list); resources();
  }
  function render() {
    if (!el("battle-console")) return;
    el("battle-hero-title").textContent = state.name;
    el("battle-console-status").textContent = combat.p ? `Ronda ${combat.round} · ${combat.on ? isPlayerTurn() ? "Tu turno" : "Turno enemigo" : "Combate terminado"}` : "Prepara combate para comenzar";
    const panel = el("c-attack-panel");
    if (!combat.on && !panel.hidden) panel.hidden = true;
    el("c-arena").classList.toggle("combat-aiming", !panel.hidden || !el("combat-roll-result").hidden);
    dockHeight(); contextual(); if (el("combat-help-dialog").open) resources();
  }
  function showBattle() {
    if (!combat.p || el("c-arena").hidden) return;
    const header = document.querySelector(".app-header")?.getBoundingClientRect().height || 110;
    const top = el("battle-workspace").getBoundingClientRect().top + window.scrollY - header - 8;
    window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  }
  function attackOpened() {
    render();
    requestAnimationFrame(() => {
      if (el("c-attack-panel").hidden) return;
      if (window.matchMedia("(min-width: 900px)").matches) {
        const consoleNode = el("battle-console"), bounds = consoleNode.getBoundingClientRect(), roll = el("c-atk-roll").getBoundingClientRect();
        if (roll.bottom > bounds.bottom - 8) consoleNode.scrollTop += roll.bottom - bounds.bottom + 12;
        el("c-atk-weapon").focus({ preventScroll: true });
      } else showBattle();
    });
  }
  function openHelp() {
    if (el("combat-help-dialog").open) return;
    fillGuide(); helpActor = combat.p; helpScope = scope();
    resumeAfterHelp = combat.on && el("bt-pause").getAttribute("aria-pressed") !== "true";
    if (resumeAfterHelp) el("bt-pause").click();
    el("combat-help-dialog").showModal();
  }
  function resultShown() {
    render();
    requestAnimationFrame(() => {
      if (el("combat-roll-result").hidden) return;
      if (window.matchMedia("(min-width: 900px)").matches) {
        const consoleNode = el("battle-console"), bounds = consoleNode.getBoundingClientRect(), verdict = el("combat-roll-result").querySelector(".roll-verdict").getBoundingClientRect();
        const bottom = Math.min(bounds.bottom, innerHeight - 8);
        if (verdict.bottom > bottom - 8) consoleNode.scrollTop += verdict.bottom - bottom + 12;
      } else showBattle();
    });
  }
  window.CHAPS_COMBAT_HELP = { render, attackOpened, resultShown };
  document.addEventListener("DOMContentLoaded", () => {
    for (const [id, [, detail]] of Object.entries(descriptions())) {
      const button = el(id); if (!button) continue;
      button.title = detail; button.setAttribute("aria-describedby", "battle-context-help");
      button.addEventListener("pointerenter", () => contextual(id)); button.addEventListener("focus", () => contextual(id));
    }
    document.querySelectorAll("[data-combat-help]").forEach(button => button.addEventListener("click", openHelp));
    el("combat-help-close").onclick = () => el("combat-help-dialog").close();
    el("combat-help-dialog").addEventListener("close", () => {
      if (resumeAfterHelp && combat.on && helpActor === combat.p && helpScope === scope() && el("bt-pause").getAttribute("aria-pressed") === "true") el("bt-pause").click();
      resumeAfterHelp = false;
    });
    el("c-btn-start").addEventListener("click", () => requestAnimationFrame(showBattle));
    el("bt-resume").addEventListener("click", () => requestAnimationFrame(showBattle));
    new MutationObserver(render).observe(el("c-attack-panel"), { attributes: true, attributeFilter: ["hidden"] });
    new MutationObserver(render).observe(el("combat-roll-result"), { attributes: true, attributeFilter: ["hidden"] });
    if (window.ResizeObserver) new ResizeObserver(dockHeight).observe(document.querySelector(".battle-console .combat-actions"));
    window.addEventListener("resize", dockHeight); render();
  });
})();
