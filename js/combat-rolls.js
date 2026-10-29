/* Presenta datos reales del motor; animación nunca vuelve a tirar ni bloquea acciones. */
(function () {
  "use strict";
  const el = id => document.getElementById(id);
  const scope = () => JSON.stringify(window.CHAPS_FEATURES?.profiles.current);
  const bonusNames = { steady: "Puntería", hide: "Ocultar", dash: "Dash", disengage: "Retirar", extra: "ataque extra" };
  let actor = null, owner = null;
  const add = (parent, tag, text, cls) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (cls) node.className = cls; parent.appendChild(node); return node; };
  function resourceMessage() {
    const p = combat.p;
    if (!p) return "Prepara combate para comenzar.";
    if (!combat.on) return "Combate finalizado. No quedan acciones de turno pendientes.";
    if (!isPlayerTurn()) return "Turno enemigo. Ocultar requiere acción adicional en tu turno; no usa reacción.";
    if (p.ba) return p.action ? "Ocultar, Dash y Retirar usan acción adicional, independiente de Atacar." : "Ataque resuelto. Aún tienes acción adicional: puedes Ocultar, Dash o Retirar.";
    return `Acción adicional gastada${bonusNames[p.lastBonus] ? " en " + bonusNames[p.lastBonus] : ""}. Ocultar no usa reacción.`;
  }
  function refresh() {
    if (!el("combat-roll-result")) return;
    el("battle-action-state").textContent = combat.on && isPlayerTurn() && combat.p?.ba ? "Acción adicional disponible: Ocultar, Dash o Retirar." : resourceMessage();
    el("combat-roll-resources").textContent = resourceMessage();
    el("combat-roll-hide").disabled = !combat.on || !isPlayerTurn() || !combat.p?.ba;
    if (actor && (actor !== combat.p || owner !== scope())) {
      const visible = !el("combat-roll-result").hidden;
      el("combat-roll-result").hidden = true; actor = null; owner = null;
      if (visible) window.CHAPS_COMBAT_HELP?.render();
    }
  }
  function prepare() {
    el("combat-roll-result").hidden = true;
    el("combat-roll-followup").textContent = "";
    el("combat-roll-prep").textContent = `d20 ${fmtMod(profBonus(state.level) + dexMod())}`;
    el("combat-roll-prep").classList.remove("roll-invalid");
    window.CHAPS_COMBAT_HELP?.render();
  }
  function invalid() {
    const message = combat.log[0]?.html?.replace(/<[^>]*>/g, "") || "Revisa alcance, visión y recurso disponible.";
    el("combat-roll-prep").textContent = message;
    el("combat-roll-prep").classList.add("roll-invalid");
  }
  function result(data) {
    if (!el("combat-roll-body")) return;
    actor = combat.p; owner = scope();
    el("c-attack-panel").hidden = true;
    el("combat-roll-result").hidden = false;
    el("combat-roll-followup").textContent = "";
    const body = el("combat-roll-body"); body.replaceChildren();
    const header = add(body, "p", `${data.weapon} → ${data.target}`, "roll-target"); header.dataset.mode = data.mode;
    add(body, "p", data.mode, "roll-mode");
    const dice = add(body, "div", null, "roll-dice");
    data.rolls.forEach((value, index) => {
      const chosen = value === data.chosen && data.rolls.indexOf(value) === index;
      const die = add(dice, "div", null, "roll-die" + (chosen ? " chosen" : " discarded"));
      die.setAttribute("aria-label", `d20: ${value}${chosen ? ", usado" : ", descartado"}`);
      add(die, "span", "d20"); add(die, "strong", value);
    });
    const formula = add(body, "p", `d20(${data.chosen}) ${fmtMod(data.dex)} DES ${fmtMod(data.proficiency)} competencia = ${data.total}`, "roll-formula");
    formula.dataset.total = data.total; formula.dataset.bonus = data.bonus;
    add(body, "p", `Total ${data.total} contra CA ${data.armor}${data.cover ? " (incluye +2 por cobertura)" : ""}`, "roll-versus");
    const label = data.crit && data.hit ? "¡CRÍTICO!" : data.hit ? "¡IMPACTO!" : "FALLO";
    add(body, "strong", `${label} · ${data.damage} de daño`, "roll-verdict " + (data.hit ? "roll-hit" : "roll-miss"));
    if (data.chosen === 1) add(body, "p", "1 natural: fallo automático.", "hint");
    if (data.chosen === 20) add(body, "p", "20 natural: crítico automático.", "hint");
    if (data.crit && data.chosen !== 20) add(body, "p", "Crítico por condición del objetivo.", "hint");
    const damage = add(body, "section", null, "roll-damage");
    add(damage, "h3", `Daño: ${data.damage}`);
    if (data.damageParts.length) { const parts = add(damage, "ul"); data.damageParts.forEach(value => add(parts, "li", value)); }
    if (!data.hit && !data.damage) add(damage, "p", "No impactaste: no se aplicó daño.");
    if (!data.hit && data.damage) add(damage, "p", "Graze aplica daño aunque ataque falle.");
    add(damage, "p", `${data.target}: ${data.hpBefore} → ${data.hpAfter}/${data.maxHp} PG · ${data.effectiveDamage} PG descontados`, "roll-hp");
    if (data.reasons.length) add(body, "p", "Modificadores: " + data.reasons.join(" · "), "hint");
    refresh(); window.CHAPS_COMBAT_HELP?.resultShown();
  }
  function note(message) { if (el("combat-roll-followup")) el("combat-roll-followup").textContent = message; }
  window.CHAPS_ROLLS = { prepare, invalid, result, refresh, note };
  document.addEventListener("DOMContentLoaded", () => {
    el("combat-roll-close").onclick = () => { el("combat-roll-result").hidden = true; window.CHAPS_COMBAT_HELP?.render(); };
    el("combat-roll-hide").onclick = () => { if (combat.on && isPlayerTurn() && combat.p.ba) el("c-btn-hide").click(); };
    refresh();
  });
})();
