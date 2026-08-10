/* ============================================================
   CHAPS — Asesino D&D 2024
   data.js — Datos del personaje, combos, rasgos y diccionario i18n
   (Archivo plano, sin módulos: funciona con file:// y GitHub Pages)
   ============================================================ */

"use strict";

/* ---------- Habilidades y habilidades (skills) ---------- */
// Lista oficial de habilidades D&D 2024 con su característica asociada.
const SKILLS = [
  { key: "acrobatics",     ability: "dex" },
  { key: "animalHandling", ability: "wis" },
  { key: "arcana",         ability: "int" },
  { key: "athletics",      ability: "str" },
  { key: "deception",      ability: "cha" },
  { key: "history",        ability: "int" },
  { key: "insight",        ability: "wis" },
  { key: "intimidation",   ability: "cha" },
  { key: "investigation",  ability: "int" },
  { key: "medicine",       ability: "wis" },
  { key: "nature",         ability: "int" },
  { key: "perception",     ability: "wis" },
  { key: "performance",    ability: "cha" },
  { key: "persuasion",     ability: "cha" },
  { key: "religion",       ability: "int" },
  { key: "sleightOfHand",  ability: "dex" },
  { key: "stealth",        ability: "dex" },
  { key: "survival",       ability: "wis" }
];

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

/* ---------- Tabla de PX por nivel (2024) ---------- */
const XP_TABLE = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

/* ---------- Progresión del Pícaro (Asesino) niveles 1-20, reglas 2024 ---------- */
const LEVEL_PROGRESSION = [
  { lv: 1,  asi: false, es: "Pericia, Ataque Furtivo (1d6), Jerga de Ladrones, Maestría de Armas", en: "Expertise, Sneak Attack (1d6), Thieves' Cant, Weapon Mastery" },
  { lv: 2,  asi: false, es: "Acción Astuta", en: "Cunning Action" },
  { lv: 3,  asi: false, es: "Asesinar, Herramientas de Asesino, Puntería Firme", en: "Assassinate, Assassin's Tools, Steady Aim" },
  { lv: 4,  asi: true,  es: "Mejora de característica / Dote", en: "Ability Score Improvement / Feat" },
  { lv: 5,  asi: false, es: "Golpe Astuto, Esquiva Asombrosa, Furtivo 3d6", en: "Cunning Strike, Uncanny Dodge, Sneak 3d6" },
  { lv: 6,  asi: false, es: "Pericia (2 habilidades más)", en: "Expertise (2 more skills)" },
  { lv: 7,  asi: false, es: "Evasión, Talento Confiable, Furtivo 4d6", en: "Evasion, Reliable Talent, Sneak 4d6" },
  { lv: 8,  asi: true,  es: "Mejora de característica / Dote", en: "Ability Score Improvement / Feat" },
  { lv: 9,  asi: false, es: "Experto en Infiltración (Mimetismo Magistral, Puntería Itinerante), Furtivo 5d6", en: "Infiltration Expertise (Masterful Mimicry, Roving Aim), Sneak 5d6" },
  { lv: 10, asi: true,  es: "Mejora de característica / Dote", en: "Ability Score Improvement / Feat" },
  { lv: 11, asi: false, es: "Golpe Astuto Mejorado (2 efectos), Furtivo 6d6", en: "Improved Cunning Strike (2 effects), Sneak 6d6" },
  { lv: 12, asi: true,  es: "Mejora de característica / Dote", en: "Ability Score Improvement / Feat" },
  { lv: 13, asi: false, es: "Armas Envenenadas (+2d6 veneno, ignora resistencia), Furtivo 7d6", en: "Envenom Weapons (+2d6 poison, ignores resistance), Sneak 7d6" },
  { lv: 14, asi: false, es: "Golpes Tortuosos (Aturdir, Cegar, Obnubilar)", en: "Devious Strikes (Daze, Blind, Obfuscate)" },
  { lv: 15, asi: false, es: "Mente Escurridiza (comp. salv. SAB/CAR), Furtivo 8d6", en: "Slippery Mind (prof. WIS/CHA saves), Sneak 8d6" },
  { lv: 16, asi: true,  es: "Mejora de característica / Dote", en: "Ability Score Improvement / Feat" },
  { lv: 17, asi: false, es: "Golpe Mortal (salv. CON o daño duplicado), Furtivo 9d6", en: "Death Strike (CON save or double damage), Sneak 9d6" },
  { lv: 18, asi: false, es: "Elusivo (ningún ataque tiene ventaja contra ti)", en: "Elusive (no attack has advantage against you)" },
  { lv: 19, asi: true,  es: "Mejora de característica / Dote (épica)", en: "Ability Score Improvement / Feat (epic)" },
  { lv: 20, asi: false, es: "Golpe de Suerte (convierte un fallo en un 20), Furtivo 10d6", en: "Stroke of Luck (turn a miss into a 20), Sneak 10d6" }
];

/* ---------- Estado por defecto de la ficha ---------- */
const STATE_VERSION = 2;
const DEFAULT_STATE = {
  v: STATE_VERSION,
  name: "CHAPS",
  level: 12,
  xp: 100000,
  identity: {
    charClass: "Pícaro", subclass: "Asesino", species: "Humano",
    background: "Criminal", alignment: "", playerName: "", campaign: ""
  },
  feats: [],               // [{name, desc}]
  journal: [],             // [{date, title, text}] — más reciente primero
  progressionOverrides: {},// {nivel: true/false} — toggle manual sobre el auto-check
  asiNotes: {},            // {nivel: "texto"} — elección en niveles de mejora
  hpCurrent: 89,          // 8 + 11*5 + 12*2 (CON +2) = 89 aprox.
  hpMax: 89,
  hpTemp: 0,
  ac: 16,
  initiative: 5,          // DEX +5
  speed: 30,
  hitDiceSpent: 0,        // de 12d8
  deathSuccess: 0,
  deathFail: 0,
  inspiration: false,
  abilities: { str: 10, dex: 20, con: 14, int: 12, wis: 14, cha: 12 },
  // p = competencia, e = pericia (expertise, dobla el bono)
  skills: {
    acrobatics:     { p: true,  e: false },
    animalHandling: { p: false, e: false },
    arcana:         { p: false, e: false },
    athletics:      { p: false, e: false },
    deception:      { p: true,  e: false },
    history:        { p: false, e: false },
    insight:        { p: true,  e: false },
    intimidation:   { p: true,  e: false },
    investigation:  { p: true,  e: false },
    medicine:       { p: false, e: false },
    nature:         { p: false, e: false },
    perception:     { p: true,  e: true  },
    performance:    { p: false, e: false },
    persuasion:     { p: true,  e: false },
    religion:       { p: false, e: false },
    sleightOfHand:  { p: true,  e: false },
    stealth:        { p: true,  e: true  },
    survival:       { p: false, e: false }
  },
  weapons: [
    { name: "Daga",       dice: 1, sides: 4, bonus: 5, props: "finesse, light, thrown", mastery: "Nick" },
    { name: "Estoque",    dice: 1, sides: 8, bonus: 5, props: "finesse",                  mastery: "Vex"  },
    { name: "Arco corto", dice: 1, sides: 6, bonus: 5, props: "ranged (80/320)",          mastery: "Vex"  }
  ],
  currency: { pp: 0, gp: 120, ep: 0, sp: 45, cp: 10 },
  notes: ""
};

// Niveles que conceden Mejora de característica / Dote
const ASI_LEVELS = LEVEL_PROGRESSION.filter((f) => f.asi).map((f) => f.lv);

/* ---------- Rasgos por nivel (reglas 2024) ---------- */
const FEATURES = [
  { lv: 1,  es: "Pericia, Ataque Furtivo (1d6), Jerga de Ladrones, Maestría de Armas",
            en: "Expertise, Sneak Attack (1d6), Thieves' Cant, Weapon Mastery" },
  { lv: 2,  es: "Acción Astuta (Dash, Disengage, Hide como acción adicional)",
            en: "Cunning Action (Dash, Disengage, Hide as a Bonus Action)" },
  { lv: 3,  es: "Asesinar (ventaja iniciativa y vs. criaturas que no han actuado, +nivel de daño), Herramientas de Asesino, Puntería Firme",
            en: "Assassinate (advantage on initiative and vs. creatures that haven't acted, +level damage), Assassin's Tools, Steady Aim" },
  { lv: 5,  es: "Golpe Astuto (Veneno, Derribo, Retirada — 1/turno, -1d6 furtivo), Esquiva Asombrosa",
            en: "Cunning Strike (Poison, Trip, Withdraw — 1/turn, -1d6 sneak), Uncanny Dodge" },
  { lv: 6,  es: "Pericia (2 habilidades más)", en: "Expertise (2 more skills)" },
  { lv: 7,  es: "Evasión, Talento Confiable", en: "Evasion, Reliable Talent" },
  { lv: 9,  es: "Experto en Infiltración: Mimetismo Magistral, Puntería Itinerante (la velocidad no se reduce a 0 con Puntería Firme)",
            en: "Infiltration Expertise: Masterful Mimicry, Roving Aim (speed not reduced to 0 with Steady Aim)" },
  { lv: 11, es: "Golpe Astuto Mejorado (2 efectos a la vez; nuevas opciones)", en: "Improved Cunning Strike (2 effects at once; new options)" },
  { lv: 12, es: "Dote / Mejora de característica", en: "Feat / Ability Score Improvement" }
];

/* ---------- Combos (guía interactiva) ---------- */
// type: "roller" (con calculadora de daño) o "info" (solo informativo)
const COMBOS = [
  {
    id: "opener",
    icon: "🗡",
    titleEs: "Apertura de Asesino",
    titleEn: "Assassin Opener",
    type: "roller",
    sneak: true, assassinate: true,
    stepsEs: [
      "Tira iniciativa CON VENTAJA (Asesinar).",
      "Actúa antes que el enemigo: si aún no ha tenido su turno, tu ataque tiene VENTAJA.",
      "Ataca: el impacto activa Ataque Furtivo (6d6).",
      "Si el furtivo impacta, suma +12 de daño (tu nivel de pícaro, por Asesinar)."
    ],
    stepsEn: [
      "Roll initiative WITH ADVANTAGE (Assassinate).",
      "Act before the enemy: if it hasn't taken a turn yet, your attack has ADVANTAGE.",
      "Attack: a hit triggers Sneak Attack (6d6).",
      "If the sneak attack hits, add +12 damage (your rogue level, from Assassinate)."
    ]
  },
  {
    id: "hide",
    icon: "🌑",
    titleEs: "Ocultar y Golpear",
    titleEn: "Hide & Strike",
    type: "roller",
    sneak: true, assassinate: false,
    stepsEs: [
      "Acción adicional: Acción Astuta → Esconderse (tirada de Sigilo).",
      "Si te ocultas con éxito, tu siguiente ataque tiene VENTAJA.",
      "Ataca con ventaja: el impacto activa Ataque Furtivo (6d6)."
    ],
    stepsEn: [
      "Bonus Action: Cunning Action → Hide (Stealth check).",
      "If you hide successfully, your next attack has ADVANTAGE.",
      "Attack with advantage: a hit triggers Sneak Attack (6d6)."
    ]
  },
  {
    id: "steady",
    icon: "🎯",
    titleEs: "Puntería Firme",
    titleEn: "Steady Aim",
    type: "roller",
    sneak: true, assassinate: false,
    stepsEs: [
      "Acción adicional: Puntería Firme → VENTAJA en tu próximo ataque de este turno.",
      "Puntería Itinerante (nivel 9): tu velocidad NO se reduce a 0, puedes seguir moviéndote.",
      "Ataca con ventaja: el impacto activa Ataque Furtivo (6d6)."
    ],
    stepsEn: [
      "Bonus Action: Steady Aim → ADVANTAGE on your next attack this turn.",
      "Roving Aim (level 9): your speed is NOT reduced to 0 — you can keep moving.",
      "Attack with advantage: a hit triggers Sneak Attack (6d6)."
    ]
  },
  {
    id: "hitrun",
    icon: "💨",
    titleEs: "Golpe y Fuga",
    titleEn: "Hit & Run",
    type: "roller",
    sneak: true, assassinate: false,
    stepsEs: [
      "Ataca (con aliado adyacente al objetivo, el furtivo aplica sin ventaja).",
      "Acción adicional: Acción Astuta → Retirarse (sin ataques de oportunidad).",
      "Muévete lejos del enemigo con tu velocidad restante."
    ],
    stepsEn: [
      "Attack (with an ally adjacent to the target, sneak applies without advantage).",
      "Bonus Action: Cunning Action → Disengage (no opportunity attacks).",
      "Move away from the enemy with your remaining speed."
    ]
  },
  {
    id: "control",
    icon: "☠",
    titleEs: "Control Doble",
    titleEn: "Double Control",
    type: "roller",
    sneak: true, assassinate: false, cunningStrikes: 2,
    stepsEs: [
      "Ataca y activa Ataque Furtivo.",
      "Aplica 2 Golpes Astutos (nivel 11): Veneno + Derribo.",
      "Cada efecto cuesta -1d6 del furtivo: tiras 4d6 en vez de 6d6.",
      "Veneno: salv. CON o Envenenado. Derribo: salv. DES o Derribado (CD 8 + comp + DES)."
    ],
    stepsEn: [
      "Attack and trigger Sneak Attack.",
      "Apply 2 Cunning Strikes (level 11): Poison + Trip.",
      "Each effect costs -1d6 of sneak damage: roll 4d6 instead of 6d6.",
      "Poison: CON save or Poisoned. Trip: DEX save or Prone (DC 8 + prof + DEX)."
    ]
  },
  {
    id: "future",
    icon: "🔮",
    titleEs: "Futuras Mejoras",
    titleEn: "Future Unlocks",
    type: "info",
    stepsEs: [
      "Nivel 13 — Armas Envenenadas: +2d6 de daño de veneno que ignora resistencia al veneno (1 min, concentración).",
      "Nivel 14 — Golpes Tortuosos: nuevas opciones de Golpe Astuto (Aturdir, Cegar, Obnubilar).",
      "Nivel 17 — Golpe Mortal: al impactar con Asesinar, salv. CON (CD 8+comp+DES) o el daño del ataque se DUPLICA."
    ],
    stepsEn: [
      "Level 13 — Envenom Weapons: +2d6 poison damage ignoring poison resistance (1 min, concentration).",
      "Level 14 — Devious Strikes: new Cunning Strike options (Daze, Blind, Obfuscate).",
      "Level 17 — Death Strike: on an Assassinate hit, CON save (DC 8+prof+DEX) or the attack's damage is DOUBLED."
    ]
  }
];

/* ---------- Diccionario i18n ---------- */
const I18N = {
  es: {
    appTitle: "CHAPS — Asesino D&D 2024",
    appSubtitle: "Plataforma de entrenamiento y gestión de personaje",
    tabSheet: "Ficha",
    tabSim: "Simulador",
    tabCombos: "Combos",
    // Ficha
    identity: "Identidad", name: "Nombre", level: "Nivel", profBonus: "Bono de competencia",
    hpCurrent: "PG actuales", hpMax: "PG máximos", hpTemp: "PG temporales",
    ac: "CA", initiative: "Iniciativa", speed: "Velocidad",
    hitDice: "Dados de golpe", hitDiceSpent: "gastados",
    deathSaves: "Salvaciones de muerte", successes: "Éxitos", failures: "Fallos",
    inspiration: "Inspiración Heroica",
    shortRest: "Descanso corto", longRest: "Descanso largo",
    abilities: "Características", score: "Valor", modifier: "Mod.",
    skills: "Habilidades", skill: "Habilidad", prof: "Comp.", expertise: "Pericia",
    weapons: "Armas y ataques", weapon: "Arma", damage: "Daño", properties: "Propiedades", mastery: "Maestría",
    addWeapon: "+ Añadir arma", remove: "Quitar",
    currency: "Monedas", notes: "Inventario y notas",
    exportJson: "Exportar JSON", importJson: "Importar JSON", resetSheet: "Restablecer ficha",
    saved: "Guardado ✓", imported: "¡Ficha importada!", importError: "Archivo JSON no válido.",
    resetConfirm: "¿Restablecer la ficha a los valores por defecto?",
    // Simulador
    simTitle: "Simulador de combate",
    newRound: "Nueva ronda de combate",
    initiativeRoll: "Iniciativa (con ventaja)",
    rollInitiative: "Tirar iniciativa",
    enemySetup: "Enemigo", enemyName: "Nombre", enemyHp: "PG", enemyAc: "CA",
    enemyHasActed: "El enemigo YA ha actuado este combate",
    assassinateHint: "Si NO ha actuado: ventaja en el ataque y +{lv} daño (Asesinar)",
    attackPanel: "Ataque", attackBonus: "Bono de ataque",
    advantage: "Ventaja", disadvantage: "Desventaja",
    rollAttack: "Tirar ataque", crit: "¡CRÍTICO!", miss: "Fallo", hit: "Impacto",
    nat1: "¡Pifia (1 natural)!", sneakUsed: "Furtivo ya usado este turno",
    cunningStrikes: "Golpes Astutos (máx. 2)",
    csPoison: "Veneno (-1d6, salv. CON)", csTrip: "Derribo (-1d6, salv. DES)", csWithdraw: "Retirada (-1d6, mover mitad sin AdO)",
    saveDC: "CD de salvación",
    bonusActions: "Acciones adicionales",
    caDash: "Acción Astuta: Dash", caDisengage: "Acción Astuta: Retirarse", caHide: "Acción Astuta: Esconderse",
    steadyAim: "Puntería Firme (ventaja; Puntería Itinerante: no pierdes movimiento)",
    reactions: "Reacciones",
    uncannyDodge: "Esquiva Asombrosa: reduce a la mitad el daño de un ataque que te impacte",
    evasion: "Evasión: salv. DES → 0 daño si éxito, mitad si fallo",
    damageLog: "Registro de daño", enemyTracker: "Rastreador del enemigo",
    newTurn: "Nuevo turno", newCombat: "Nuevo combate", dead: "¡Enemigo derrotado!",
    applyDamage: "Aplicar daño", heal: "Curar",
    logInitiative: "Iniciativa",
    logBonus: "Acción adicional",
    selectWeapon: "Elige arma",
    // Términos del registro / desgloses
    lSneak: "Furtivo", lAssassinate: "Asesinar", lDamageWord: "Daño", lVsAc: "vs CA", lEnemyHp: "PG enemigo",
    lPoisonSave: "Veneno (CD {dc} CON)", lTripSave: "Derribo (CD {dc} DES)",
    lWithdrawNote: "Retirada: mueves la mitad sin provocar AdO",
    // Combos
    combosTitle: "Guía de combos",
    combosIntro: "Tarjetas paso a paso con calculadora de daño integrada. Los dados se tiran de verdad.",
    rollCombo: "Tirar daño del combo",
    weaponUsed: "Arma usada",
    featuresTable: "Rasgos por nivel (reglas 2024)",
    levelCol: "Nivel", featureCol: "Rasgos",
    sneakDiceLabel: "Dados de furtivo",
    // Nombres de habilidades
    skill_acrobatics: "Acrobacias", skill_animalHandling: "Trato con Animales", skill_arcana: "Arcanos",
    skill_athletics: "Atletismo", skill_deception: "Engaño", skill_history: "Historia",
    skill_insight: "Perspicacia", skill_intimidation: "Intimidación", skill_investigation: "Investigación",
    skill_medicine: "Medicina", skill_nature: "Naturaleza", skill_perception: "Percepción",
    skill_performance: "Interpretación", skill_persuasion: "Persuasión", skill_religion: "Religión",
    skill_sleightOfHand: "Juego de Manos", skill_stealth: "Sigilo", skill_survival: "Supervivencia",
    ability_str: "FUE", ability_dex: "DES", ability_con: "CON",
    ability_int: "INT", ability_wis: "SAB", ability_cha: "CAR",
    // Retrato e identidad
    portraitAlt: "Retrato de CHAPS, asesino enmascarado",
    charClass: "Clase", subclass: "Subclase", species: "Especie", background: "Trasfondo",
    alignment: "Alineamiento", playerName: "Jugador/a", campaign: "Campaña",
    // Experiencia
    xpSection: "Experiencia y nivel", xpCurrent: "PX actuales", xpToNext: "PX para el siguiente nivel",
    xpLevelByXp: "Nivel según PX", xpApply: "Aplicar nivel según PX", xpAdd: "Añadir PX",
    xpMax: "¡Nivel máximo!", xpBarLabel: "{xp} / {next} PX",
    // Dotes
    featsSection: "Dotes", featDesc: "Descripción", addFeat: "+ Añadir dote",
    featNamePh: "p. ej. Alerta, Pungidor, Observador…",
    featDescPh: "p. ej. +5 a iniciativa; no te pueden sorprender…",
    // Diario
    journalSection: "Diario de aventuras", journalAdd: "+ Nueva entrada",
    journalTitlePh: "Título de la sesión…", journalTextPh: "¿Qué pasó en la sesión?",
    // Progresión
    progressionSection: "Progresión por nivel (Pícaro Asesino, 2024)",
    asiNote: "Elección en mejora", asiNotePh: "p. ej. Dote: Pungidor, o +2 DES",
    footer: "Herramienta de fans sin afiliación con Wizards of the Coast. D&D 2024."
  },
  en: {
    appTitle: "CHAPS — Assassin D&D 2024",
    appSubtitle: "Training & character management platform",
    tabSheet: "Character Sheet", tabSim: "Combat Simulator", tabCombos: "Combo Guide",
    identity: "Identity", name: "Name", level: "Level", profBonus: "Proficiency bonus",
    hpCurrent: "Current HP", hpMax: "Max HP", hpTemp: "Temp HP",
    ac: "AC", initiative: "Initiative", speed: "Speed",
    hitDice: "Hit dice", hitDiceSpent: "spent",
    deathSaves: "Death saves", successes: "Successes", failures: "Failures",
    inspiration: "Heroic Inspiration",
    shortRest: "Short rest", longRest: "Long rest",
    abilities: "Ability Scores", score: "Score", modifier: "Mod.",
    skills: "Skills", skill: "Skill", prof: "Prof.", expertise: "Expertise",
    weapons: "Weapons & Attacks", weapon: "Weapon", damage: "Damage", properties: "Properties", mastery: "Mastery",
    addWeapon: "+ Add weapon", remove: "Remove",
    currency: "Currency", notes: "Inventory & notes",
    exportJson: "Export JSON", importJson: "Import JSON", resetSheet: "Reset sheet",
    saved: "Saved ✓", imported: "Sheet imported!", importError: "Invalid JSON file.",
    resetConfirm: "Reset the sheet to default values?",
    simTitle: "Combat Simulator",
    newRound: "New combat round",
    initiativeRoll: "Initiative (with advantage)",
    rollInitiative: "Roll initiative",
    enemySetup: "Enemy", enemyName: "Name", enemyHp: "HP", enemyAc: "AC",
    enemyHasActed: "Enemy has ALREADY acted this combat",
    assassinateHint: "If it has NOT acted: advantage on the attack and +{lv} damage (Assassinate)",
    attackPanel: "Attack", attackBonus: "Attack bonus",
    advantage: "Advantage", disadvantage: "Disadvantage",
    rollAttack: "Roll attack", crit: "CRITICAL!", miss: "Miss", hit: "Hit",
    nat1: "Natural 1 — critical miss!", sneakUsed: "Sneak attack already used this turn",
    cunningStrikes: "Cunning Strikes (max 2)",
    csPoison: "Poison (-1d6, CON save)", csTrip: "Trip (-1d6, DEX save)", csWithdraw: "Withdraw (-1d6, move half speed, no OAs)",
    saveDC: "Save DC",
    bonusActions: "Bonus actions",
    caDash: "Cunning Action: Dash", caDisengage: "Cunning Action: Disengage", caHide: "Cunning Action: Hide",
    steadyAim: "Steady Aim (advantage; Roving Aim: you keep your movement)",
    reactions: "Reactions",
    uncannyDodge: "Uncanny Dodge: halve the damage of an attack that hits you",
    evasion: "Evasion: DEX save → 0 damage on success, half on failure",
    damageLog: "Damage log", enemyTracker: "Enemy tracker",
    newTurn: "New turn", newCombat: "New combat", dead: "Enemy defeated!",
    applyDamage: "Apply damage", heal: "Heal",
    logInitiative: "Initiative",
    logBonus: "Bonus action",
    selectWeapon: "Choose weapon",
    lSneak: "Sneak", lAssassinate: "Assassinate", lDamageWord: "Damage", lVsAc: "vs AC", lEnemyHp: "Enemy HP",
    lPoisonSave: "Poison (DC {dc} CON)", lTripSave: "Trip (DC {dc} DEX)",
    lWithdrawNote: "Withdraw: move half speed without provoking OAs",
    combosTitle: "Combo Guide",
    combosIntro: "Step-by-step cards with a built-in damage calculator. Dice are rolled for real.",
    rollCombo: "Roll combo damage",
    weaponUsed: "Weapon used",
    featuresTable: "Features by level (2024 rules)",
    levelCol: "Level", featureCol: "Features",
    sneakDiceLabel: "Sneak attack dice",
    skill_acrobatics: "Acrobatics", skill_animalHandling: "Animal Handling", skill_arcana: "Arcana",
    skill_athletics: "Athletics", skill_deception: "Deception", skill_history: "History",
    skill_insight: "Insight", skill_intimidation: "Intimidation", skill_investigation: "Investigation",
    skill_medicine: "Medicine", skill_nature: "Nature", skill_perception: "Perception",
    skill_performance: "Performance", skill_persuasion: "Persuasion", skill_religion: "Religion",
    skill_sleightOfHand: "Sleight of Hand", skill_stealth: "Stealth", skill_survival: "Survival",
    ability_str: "STR", ability_dex: "DEX", ability_con: "CON",
    ability_int: "INT", ability_wis: "WIS", ability_cha: "CHA",
    // Portrait & identity
    portraitAlt: "Portrait of CHAPS, masked assassin",
    charClass: "Class", subclass: "Subclass", species: "Species", background: "Background",
    alignment: "Alignment", playerName: "Player", campaign: "Campaign",
    // Experience
    xpSection: "Experience & Level", xpCurrent: "Current XP", xpToNext: "XP to next level",
    xpLevelByXp: "Level by XP", xpApply: "Apply level from XP", xpAdd: "Add XP",
    xpMax: "Max level!", xpBarLabel: "{xp} / {next} XP",
    // Feats
    featsSection: "Feats", featDesc: "Description", addFeat: "+ Add feat",
    featNamePh: "e.g. Alert, Piercer, Observant…",
    featDescPh: "e.g. +5 to initiative; you can't be surprised…",
    // Journal
    journalSection: "Adventure Journal", journalAdd: "+ New entry",
    journalTitlePh: "Session title…", journalTextPh: "What happened this session?",
    // Progression
    progressionSection: "Level Progression (Assassin Rogue, 2024)",
    asiNote: "ASI choice", asiNotePh: "e.g. Feat: Piercer, or +2 DEX",
    footer: "Unofficial fan tool, not affiliated with Wizards of the Coast. D&D 2024."
  }
};
