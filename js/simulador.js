/* ============================================================
   CHAPS — Simulador: dados rápidos + calculadora DPR (2024)
   ------------------------------------------------------------
   Se integra en la pestaña Combate:
   · Dados rápidos: d4–d100, cantidad, modificador, ventaja y
     desventaja (d20), con registro de tiradas.
   · Calculadora DPR: probabilidad de impacto/crítico y daño
     medio por turno, con Furtivo y ventaja. Se precarga con
     los stats de la ficha (DES + bono de competencia + nivel).
   Matemáticas inspiradas en calculadoras DPR abiertas (p. ej.
   el DPR Calculator 2024, MIT) adaptadas al Asesino 2024.
   ============================================================ */

"use strict";

(function () {

  /* ================= DADOS RÁPIDOS ================= */

  const DICE = [4, 6, 8, 10, 12, 20, 100];

  function rollQuick(sides) {
    const count = Math.max(1, Math.min(20, parseInt(document.getElementById("dice-count").value, 10) || 1));
    const mod = parseInt(document.getElementById("dice-mod").value, 10) || 0;
    const adv = document.getElementById("dice-adv").checked;
    const dis = document.getElementById("dice-dis").checked;

    let rolls = [];
    let total;
    let note = "";

    if (sides === 20 && count === 1 && (adv || dis)) {
      // Ventaja/desventaja: dos d20, se queda el mayor/menor.
      const a = rollDie(20);
      const b = rollDie(20);
      const keep = adv ? Math.max(a, b) : Math.min(a, b);
      rolls = [keep];
      total = keep + mod;
      note = " (" + (adv ? "ventaja" : "desventaja") + ": " + a + " y " + b + ")";
    } else {
      rolls = rollDice(count, sides);
      total = sum(rolls) + mod;
    }

    const expr = count + "d" + sides + (mod ? (mod > 0 ? "+" : "") + mod : "");
    const text = expr + " → [" + rolls.join(", ") + "]" + (mod ? " " + (mod > 0 ? "+" : "") + mod : "") +
      note + " = " + total;

    const res = document.getElementById("dice-result");
    res.textContent = text;
    res.classList.toggle("dice-crit", sides === 20 && rolls[0] === 20);
    res.classList.toggle("dice-pifia", sides === 20 && rolls[0] === 1);

    const log = document.getElementById("dice-log");
    const li = document.createElement("li");
    li.className = sides === 20 && rolls[0] === 20 ? "log-crit" : (sides === 20 && rolls[0] === 1 ? "log-dead" : "log-info");
    li.textContent = text;
    log.prepend(li);
    while (log.children.length > 30) log.removeChild(log.lastChild);
  }

  function initDice() {
    const box = document.getElementById("dice-buttons");
    if (!box) return;
    DICE.forEach((s) => {
      const b = document.createElement("button");
      b.className = "btn die-btn" + (s === 20 ? " btn-crimson" : "");
      b.textContent = "d" + s;
      b.addEventListener("click", () => rollQuick(s));
      box.appendChild(b);
    });
    // Ventaja y desventaja se excluyen entre sí.
    const adv = document.getElementById("dice-adv");
    const dis = document.getElementById("dice-dis");
    adv.addEventListener("change", () => { if (adv.checked) dis.checked = false; });
    dis.addEventListener("change", () => { if (dis.checked) adv.checked = false; });
  }

  /* ================= CALCULADORA DPR ================= */

  /** Parsea "2d6" / "1d8+3" y devuelve {n, s, flat}; null si no se entiende. */
  function parseDice(str) {
    const m = String(str || "").trim().match(/^(\d*)\s*d\s*(\d+)\s*([+-]\s*\d+)?$/i);
    if (!m) return null;
    return {
      n: m[1] ? parseInt(m[1], 10) : 1,
      s: parseInt(m[2], 10),
      flat: m[3] ? parseInt(m[3].replace(/\s/g, ""), 10) : 0
    };
  }

  /** Precarga los campos con los stats actuales de la ficha. */
  function prefillFromSheet() {
    const dex = abilityMod(state.abilities.dex);
    document.getElementById("dpr-atk").value = profBonus(state.level) + dex;
    document.getElementById("dpr-dmg").value = dex;
    document.getElementById("dpr-sneak").value = sneakDiceCount(state.level) + "d6";
  }

  function calcDpr() {
    const out = document.getElementById("dpr-out");
    const atk = parseInt(document.getElementById("dpr-atk").value, 10) || 0;
    const ac = parseInt(document.getElementById("dpr-ac").value, 10) || 10;
    const dice = parseDice(document.getElementById("dpr-dice").value);
    const flat = parseInt(document.getElementById("dpr-dmg").value, 10) || 0;
    const nAtk = Math.max(1, Math.min(6, parseInt(document.getElementById("dpr-attacks").value, 10) || 1));
    const useSneak = document.getElementById("dpr-use-sneak").checked;
    const adv = document.getElementById("dpr-adv").checked;
    const sneak = parseDice(document.getElementById("dpr-sneak").value) || { n: 0, s: 6, flat: 0 };

    if (!dice) {
      out.innerHTML = '<p class="hint">Dados de daño no válidos. Usa el formato «1d8» o «2d6+2».</p>';
      return;
    }

    // Probabilidad de impacto: 1 siempre falla, 20 siempre impacta (y critica).
    const need = ac - atk;
    let pHit = Math.min(0.95, Math.max(0.05, (21 - need) / 20));
    let pCrit = 0.05;
    if (adv) { // con ventaja: 1 - (fallar con ambos dados)
      pHit = 1 - Math.pow(1 - pHit, 2);
      pCrit = 1 - Math.pow(1 - pCrit, 2);
    }
    const pNorm = Math.max(0, pHit - pCrit);

    // Daño del arma: el crítico duplica los dados, no el bono fijo.
    const wAvg = dice.n * (dice.s + 1) / 2 + dice.flat;
    const perAttack = pNorm * (wAvg + flat) + pCrit * (2 * wAvg + flat);

    // Furtivo (1/turno): entra si impacta al menos un ataque; si el golpe que
    // lo lleva es crítico, sus dados también se duplican (aproximación).
    const pAnyHit = 1 - Math.pow(1 - pHit, nAtk);
    const pAnyCrit = 1 - Math.pow(1 - pCrit, nAtk);
    const sneakAvg = sneak.n * (sneak.s + 1) / 2;
    const sneakExp = useSneak ? pAnyHit * sneakAvg + pAnyCrit * sneakAvg : 0;

    const dpr = nAtk * perAttack + sneakExp;
    const pct = (x) => (x * 100).toFixed(1) + "%";
    const num = (x) => x.toFixed(1);

    out.innerHTML =
      '<div class="dpr-box"><div class="v">' + pct(pHit) + '</div><div class="l">Impacto / ataque</div></div>' +
      '<div class="dpr-box"><div class="v">' + pct(pCrit) + '</div><div class="l">Crítico / ataque</div></div>' +
      '<div class="dpr-box"><div class="v">' + num(perAttack) + '</div><div class="l">Daño medio / ataque</div></div>' +
      '<div class="dpr-box hero"><div class="v">' + num(dpr) + '</div><div class="l">DPR total (' + nAtk + " ataque" + (nAtk > 1 ? "s" : "") + ")</div></div>" +
      (useSneak
        ? '<div class="dpr-box"><div class="v">' + pct(pAnyHit) + '</div><div class="l">Furtivo en el turno</div></div>' +
          '<div class="dpr-box"><div class="v">+' + num(sneakExp) + '</div><div class="l">Daño Furtivo medio</div></div>'
        : "");
  }

  function initDpr() {
    const card = document.getElementById("dpr-card");
    if (!card) return;
    prefillFromSheet();
    document.getElementById("dpr-calc").addEventListener("click", calcDpr);
    document.getElementById("dpr-refresh").addEventListener("click", () => { prefillFromSheet(); calcDpr(); });
    card.querySelectorAll("input").forEach((inp) => inp.addEventListener("change", calcDpr));
    calcDpr();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initDice();
    initDpr();
  });

})();
