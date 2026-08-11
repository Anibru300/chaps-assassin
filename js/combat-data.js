/* ============================================================
   CHAPS — Motor de combate D&D 2024
   combat-data.js — Catálogo de enemigos y textos del motor
   (Archivo plano, sin módulos)
   ============================================================ */

"use strict";

/* ---------- Catálogo de enemigos (stats aproximados SRD) ----------
   mods: modificadores de característica (para salvaciones)
   attacks: melee (alcance ft) o range ("normal/largo"); dmg "XdY+Z"
   coward: huye/retirada si PG < 25%                                    */
const ENEMIES = [
  { key: "goblin", es: "Goblin", en: "Goblin", cr: "1/4",
    hp: 7, ac: 15, speed: 30, init: 2, percep: -1,
    mods: { str: -1, dex: 2, con: 0, int: 0, wis: -1, cha: -1 },
    attacks: [
      { es: "Cimitarra", en: "Scimitar", bonus: 4, dmg: "1d6+2", melee: 5, range: null },
      { es: "Arco corto", en: "Shortbow", bonus: 4, dmg: "1d6+2", melee: 0, range: "80/320" }
    ],
    coward: true },
  { key: "bandit", es: "Bandido", en: "Bandit", cr: "1/8",
    hp: 11, ac: 12, speed: 30, init: 1, percep: 0,
    mods: { str: 1, dex: 1, con: 1, int: 0, wis: 0, cha: 0 },
    attacks: [
      { es: "Cimitarra", en: "Scimitar", bonus: 3, dmg: "1d6+1", melee: 5, range: null },
      { es: "Ballesta ligera", en: "Light Crossbow", bonus: 3, dmg: "1d8+1", melee: 0, range: "80/320" }
    ],
    coward: true },
  { key: "orc", es: "Orco", en: "Orc", cr: "1/2",
    hp: 15, ac: 13, speed: 30, init: 1, percep: 0,
    mods: { str: 3, dex: 1, con: 3, int: -2, wis: 0, cha: 0 },
    attacks: [
      { es: "Hacha grande", en: "Greataxe", bonus: 5, dmg: "1d12+3", melee: 5, range: null },
      { es: "Jabalina", en: "Javelin", bonus: 5, dmg: "1d6+3", melee: 5, range: "30/120" }
    ] },
  { key: "guard", es: "Guardia", en: "Guard", cr: "1/8",
    hp: 11, ac: 16, speed: 30, init: 1, percep: 1,
    mods: { str: 1, dex: 1, con: 1, int: 0, wis: 1, cha: 0 },
    attacks: [
      { es: "Lanza", en: "Spear", bonus: 3, dmg: "1d6+1", melee: 5, range: "20/60" }
    ] },
  { key: "wolf", es: "Lobo", en: "Wolf", cr: "1/4",
    hp: 11, ac: 13, speed: 40, init: 2, percep: 3,
    mods: { str: 1, dex: 2, con: 1, int: -4, wis: 1, cha: -2 },
    attacks: [
      { es: "Mordisco", en: "Bite", bonus: 4, dmg: "2d4+2", melee: 5, range: null }
    ] },
  { key: "direwolf", es: "Lobo terrible", en: "Dire Wolf", cr: "1",
    hp: 37, ac: 14, speed: 50, init: 2, percep: 3,
    mods: { str: 3, dex: 2, con: 2, int: -4, wis: 1, cha: -2 },
    attacks: [
      { es: "Mordisco", en: "Bite", bonus: 5, dmg: "2d6+3", melee: 5, range: null }
    ] },
  { key: "veteran", es: "Veterano", en: "Veteran", cr: "3",
    hp: 58, ac: 17, speed: 30, init: 1, percep: 1,
    mods: { str: 3, dex: 1, con: 2, int: 0, wis: 1, cha: 0 },
    attacks: [
      { es: "Espada larga", en: "Longsword", bonus: 5, dmg: "1d10+3", melee: 5, range: null },
      { es: "Ballesta pesada", en: "Heavy Crossbow", bonus: 3, dmg: "1d10+1", melee: 0, range: "100/400" }
    ] },
  { key: "assassin", es: "Asesino", en: "Assassin", cr: "8",
    hp: 78, ac: 15, speed: 30, init: 3, percep: 2,
    mods: { str: 1, dex: 3, con: 1, int: 1, wis: 2, cha: 0 },
    attacks: [
      { es: "Espada corta", en: "Shortsword", bonus: 7, dmg: "1d6+4", melee: 5, range: null },
      { es: "Ballesta ligera", en: "Light Crossbow", bonus: 7, dmg: "1d8+4", melee: 0, range: "80/320" }
    ] },
  { key: "ogre", es: "Ogro", en: "Ogre", cr: "2",
    hp: 59, ac: 11, speed: 40, init: -1, percep: -2,
    mods: { str: 4, dex: -1, con: 4, int: -3, wis: -2, cha: -2 },
    attacks: [
      { es: "Garrote grande", en: "Greatclub", bonus: 6, dmg: "2d8+4", melee: 5, range: null },
      { es: "Jabalina", en: "Javelin", bonus: 6, dmg: "2d6+4", melee: 5, range: "30/120" }
    ] }
];

/* ---------- Textos del motor de combate (ES/EN) ---------- */
const CT = {
  es: {
    tabCombat: "Combate", setupTitle: "Nuevo combate", pickEnemy: "Elige enemigo del catálogo",
    addEnemy: "+ Añadir enemigo", startCombat: "⚔ Iniciar combate", endCombat: "Terminar combate",
    needEnemies: "Añade al menos un enemigo.",
    round: "RONDA", yourTurn: "TU TURNO", enemyTurn: "TURNO DEL ENEMIGO",
    moveLeft: "Movimiento", actionFree: "Acción", baFree: "Acción adicional", reactionFree: "Reacción",
    available: "libre", usedUp: "usada",
    actAttack: "Atacar", actSteady: "Puntería Firme", actHide: "Esconderse",
    actDash: "Dash", actDisengage: "Retirarse", actEndTurn: "Finalizar turno",
    closer: "◀ Acercar", farther: "Alejar ▶", toMelee: "A melé",
    distFt: "distancia", hpOf: "PG", applyHp: "Guardar PG en la ficha",
    victory: "🏆 ¡Victoria! Todos los enemigos derrotados.", defeat: "💀 Has caído… combate perdido.",
    initLog: "Iniciativa", orderLog: "Orden de turnos",
    // motor
    atkRoll: "Ataque", vsAc: "vs CA", hitWord: "Impacto", missWord: "Fallo", critWord: "¡CRÍTICO!",
    dmgWord: "Daño", sneakNoFinesse: "arma sin Sutil/distancia: no hay Ataque Furtivo",
    noRange: "fuera de alcance", longRangeDis: "largo alcance: desventaja",
    rangedInMelee: "a distancia con enemigo a 5 ft: desventaja",
    saveLog: "salvación", savePass: "SUPERA", saveFail: "FALLA",
    condApplied: "Estado aplicado", condEnd: "supera el estado",
    oaLog: "¡Ataque de oportunidad de", enemyDead: "derrotado",
    uncannyQ: "¿Usar Esquiva Asombrosa (reacción) para reducir el daño a la mitad?",
    uncannyUsed: "Esquiva Asombrosa: daño reducido a la mitad",
    hiddenNow: "estás Oculto: próximo ataque con ventaja",
    hideFail: "no logras ocultarte", seekYou: "te busca pero no te encuentra",
    steadyOn: "Puntería Firme: ventaja en tu próximo ataque (velocidad 0 este turno)",
    steadyOn9: "Puntería Firme: ventaja en tu próximo ataque (Puntería Itinerante: conservas el movimiento)",
    dashOn: "Dash: movimiento duplicado este turno",
    disengageOn: "Retirarse: no provocas AdO este turno",
    noAction: "acción ya usada", noBA: "acción adicional ya usada", noMove: "sin movimiento",
    aiThink: "evalúa…", aiTarget: "objetivo: tú", aiMove: "se mueve", aiDash: "usa Dash",
    aiFlee: "huye (PG bajos)", aiStand: "se levanta de Derribado",
    aiNoReach: "fuera de alcance", dazedNote: "Aturdido: solo una cosa este turno",
    uncSkip: "Inconsciente: pierde el turno", poisonTick: "repite salvación de veneno",
    turnStart: "Turno de", sneakAllyQ: "Aliado a 5 ft del objetivo",
    advAuto: "ventaja", disAuto: "desventaja", normalFlat: "normal",
    attackTitle: "Tirada de ataque", chooseTarget: "Objetivo", strikesTitle: "Golpes Astutos",
    rollBtn: "¡Tirar!", cancelBtn: "Cancelar",
    firstRound: "1ª ronda", assasNote: "Asesinar: +{lv} daño (aún no actuaba)",
    envenom2d6: "Armas Envenenadas: +2d6 veneno (ignora resistencia)",
    proneAdv: "Derribado a 5 ft: ventaja", blindAdv: "Cegado: ventaja", uncCrit: "Inconsciente a 5 ft: crítico automático",
    noStrikesLevel: "requiere nivel 5+"
  },
  en: {
    tabCombat: "Combat", setupTitle: "New combat", pickEnemy: "Choose enemy from catalog",
    addEnemy: "+ Add enemy", startCombat: "⚔ Start combat", endCombat: "End combat",
    needEnemies: "Add at least one enemy.",
    round: "ROUND", yourTurn: "YOUR TURN", enemyTurn: "ENEMY TURN",
    moveLeft: "Movement", actionFree: "Action", baFree: "Bonus Action", reactionFree: "Reaction",
    available: "free", usedUp: "used",
    actAttack: "Attack", actSteady: "Steady Aim", actHide: "Hide",
    actDash: "Dash", actDisengage: "Disengage", actEndTurn: "End turn",
    closer: "◀ Move closer", farther: "Move away ▶", toMelee: "To melee",
    distFt: "distance", hpOf: "HP", applyHp: "Save HP to sheet",
    victory: "🏆 Victory! All enemies defeated.", defeat: "💀 You fell… combat lost.",
    initLog: "Initiative", orderLog: "Turn order",
    atkRoll: "Attack", vsAc: "vs AC", hitWord: "Hit", missWord: "Miss", critWord: "CRITICAL!",
    dmgWord: "Damage", sneakNoFinesse: "weapon lacks Finesse/Ranged: no Sneak Attack",
    noRange: "out of range", longRangeDis: "long range: Disadvantage",
    rangedInMelee: "ranged attack with an enemy within 5 ft: Disadvantage",
    saveLog: "save", savePass: "SUCCEEDS", saveFail: "FAILS",
    condApplied: "Condition applied", condEnd: "shakes off the condition",
    oaLog: "Opportunity Attack from", enemyDead: "defeated",
    uncannyQ: "Use Uncanny Dodge (reaction) to halve the damage?",
    uncannyUsed: "Uncanny Dodge: damage halved",
    hiddenNow: "you are Hidden: next attack with Advantage",
    hideFail: "you fail to hide", seekYou: "searches for you but fails",
    steadyOn: "Steady Aim: Advantage on your next attack (Speed 0 this turn)",
    steadyOn9: "Steady Aim: Advantage on your next attack (Roving Aim: you keep your movement)",
    dashOn: "Dash: movement doubled this turn",
    disengageOn: "Disengage: no Opportunity Attacks against you this turn",
    noAction: "action already used", noBA: "Bonus Action already used", noMove: "no movement left",
    aiThink: "is thinking…", aiTarget: "target: you", aiMove: "moves", aiDash: "uses Dash",
    aiFlee: "flees (low HP)", aiStand: "stands up from Prone",
    aiNoReach: "out of reach", dazedNote: "Dazed: only one thing this turn",
    uncSkip: "Unconscious: loses the turn", poisonTick: "repeats the poison save",
    turnStart: "Turn of", sneakAllyQ: "Ally within 5 ft of the target",
    advAuto: "advantage", disAuto: "disadvantage", normalFlat: "normal",
    attackTitle: "Attack roll", chooseTarget: "Target", strikesTitle: "Cunning Strikes",
    rollBtn: "Roll!", cancelBtn: "Cancel",
    firstRound: "1st round", assasNote: "Assassinate: +{lv} damage (it hadn't acted)",
    envenom2d6: "Envenom Weapons: +2d6 poison (ignores resistance)",
    proneAdv: "Prone within 5 ft: Advantage", blindAdv: "Blinded: Advantage", uncCrit: "Unconscious within 5 ft: automatic critical",
    noStrikesLevel: "requires level 5+"
  }
};
