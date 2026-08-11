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
  { lv: 3,  asi: false, es: "Asesinar, Herramientas de Asesino (ganas Disguise Kit + Poisoner's Kit y competencia con ambos), Puntería Firme", en: "Assassinate, Assassin's Tools (you gain a Disguise Kit + a Poisoner's Kit and proficiency with both), Steady Aim" },
  { lv: 4,  asi: true,  es: "Mejora de característica / Dote", en: "Ability Score Improvement / Feat" },
  { lv: 5,  asi: false, es: "Golpe Astuto, Esquiva Asombrosa, Furtivo 3d6", en: "Cunning Strike, Uncanny Dodge, Sneak 3d6" },
  { lv: 6,  asi: false, es: "Pericia (2 habilidades más)", en: "Expertise (2 more skills)" },
  { lv: 7,  asi: false, es: "Evasión, Talento Confiable (habilidades y herramientas), Furtivo 4d6", en: "Evasion, Reliable Talent (skills and tools), Sneak 4d6" },
  { lv: 8,  asi: true,  es: "Mejora de característica / Dote", en: "Ability Score Improvement / Feat" },
  { lv: 9,  asi: false, es: "Experto en Infiltración (Mimetismo Magistral, Puntería Itinerante), Furtivo 5d6", en: "Infiltration Expertise (Masterful Mimicry, Roving Aim), Sneak 5d6" },
  { lv: 10, asi: true,  es: "Mejora de característica / Dote", en: "Ability Score Improvement / Feat" },
  { lv: 11, asi: false, es: "Golpe Astuto Mejorado (2 efectos), Furtivo 6d6", en: "Improved Cunning Strike (2 effects), Sneak 6d6" },
  { lv: 12, asi: true,  es: "Mejora de característica / Dote", en: "Ability Score Improvement / Feat" },
  { lv: 13, asi: false, es: "Armas Envenenadas (+2d6 veneno, ignora resistencia), Furtivo 7d6", en: "Envenom Weapons (+2d6 poison, ignores resistance), Sneak 7d6" },
  { lv: 14, asi: false, es: "Golpes Tortuosos (Aturdir 2d6, Noquear 6d6, Obnubilar 3d6)", en: "Devious Strikes (Daze 2d6, Knock Out 6d6, Obscure 3d6)" },
  { lv: 15, asi: false, es: "Mente Escurridiza: competencia en salvaciones de SAB y CAR, Furtivo 8d6", en: "Slippery Mind: proficiency in WIS and CHA saves, Sneak 8d6" },
  { lv: 16, asi: true,  es: "Mejora de característica / Dote", en: "Ability Score Improvement / Feat" },
  { lv: 17, asi: false, es: "Golpe Mortal (salv. CON o daño duplicado), Furtivo 9d6", en: "Death Strike (CON save or double damage), Sneak 9d6" },
  { lv: 18, asi: false, es: "Elusivo (ningún ataque tiene ventaja contra ti salvo que estés Incapacitado)", en: "Elusive (no attack has advantage against you unless you are Incapacitated)" },
  { lv: 19, boon: true, es: "Dote Épica (Epic Boon), Furtivo 10d6", en: "Epic Boon, Sneak 10d6" },
  { lv: 20, asi: false, es: "Golpe de Suerte: convierte un D20 Test fallido en un 20 (recarga con descanso corto o largo), Furtivo 10d6", en: "Stroke of Luck: turn a failed D20 Test into a 20 (recharges on a Short or Long Rest), Sneak 10d6" }
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
  hpCurrent: 89,          // valor actual de la ficha del jugador (nivel 12)
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
  masteryChoices: ["dagger", "rapier"], // 2 armas elegidas para Maestría (N1)
  notes: ""
};

/* ---------- Armas con maestría (tabla 2024 relevante para Pícaro) ---------- */
const WEAPON_MASTERY = [
  { id: "dagger",        es: "Daga",             en: "Dagger",         dmg: "1d4", mastery: "nick"   },
  { id: "rapier",        es: "Estoque",          en: "Rapier",         dmg: "1d8", mastery: "vex"    },
  { id: "shortsword",    es: "Espada corta",     en: "Shortsword",     dmg: "1d6", mastery: "vex"    },
  { id: "scimitar",      es: "Cimitarra",        en: "Scimitar",       dmg: "1d6", mastery: "nick"   },
  { id: "shortbow",      es: "Arco corto",       en: "Shortbow",       dmg: "1d6", mastery: "vex"    },
  { id: "handCrossbow",  es: "Ballesta de mano", en: "Hand Crossbow",  dmg: "1d6", mastery: "vex"    },
  { id: "lightCrossbow", es: "Ballesta ligera",  en: "Light Crossbow", dmg: "1d8", mastery: "slow"   },
  { id: "longbow",       es: "Arco largo",       en: "Longbow",        dmg: "1d8", mastery: "slow"   },
  { id: "dart",          es: "Dardo",            en: "Dart",           dmg: "1d4", mastery: "vex"    },
  { id: "sling",         es: "Honda",            en: "Sling",          dmg: "1d4", mastery: "slow"   },
  { id: "whip",          es: "Látigo",           en: "Whip",           dmg: "1d4", mastery: "slow"   },
  { id: "club",          es: "Garrote",          en: "Club",           dmg: "1d4", mastery: "slow"   },
  { id: "lightHammer",   es: "Martillo ligero",  en: "Light Hammer",   dmg: "1d4", mastery: "nick"   },
  { id: "sickle",        es: "Hoz",              en: "Sickle",         dmg: "1d4", mastery: "nick"   },
  { id: "handaxe",       es: "Hacha de mano",    en: "Handaxe",        dmg: "1d6", mastery: "vex"    },
  { id: "javelin",       es: "Jabalina",         en: "Javelin",        dmg: "1d6", mastery: "slow"   },
  { id: "spear",         es: "Lanza",            en: "Spear",          dmg: "1d6", mastery: "sap"    },
  { id: "quarterstaff",  es: "Bastón",           en: "Quarterstaff",   dmg: "1d6", mastery: "topple" },
  { id: "mace",          es: "Maza",             en: "Mace",           dmg: "1d6", mastery: "sap"    },
  { id: "blowgun",       es: "Cerbatana",        en: "Blowgun",        dmg: "1",   mastery: "vex"    }
];

/* ---------- Las 8 propiedades de maestría (2024) ---------- */
const MASTERY_PROPERTIES = [
  { id: "vex",    name: "Vex",
    es: "Si impactas y haces daño, tienes ventaja en tu próxima tirada de ataque antes del final de tu próximo turno.",
    en: "If you hit and deal damage, you have Advantage on your next attack roll before the end of your next turn." },
  { id: "nick",   name: "Nick",
    es: "El ataque extra de la propiedad Ligera puedes hacerlo como parte de la acción de Atacar en vez de acción adicional (1/turno).",
    en: "You can make the extra attack of the Light property as part of the Attack action instead of a Bonus Action (1/turn)." },
  { id: "slow",   name: "Slow",
    es: "Al impactar y hacer daño, la velocidad del objetivo se reduce 10 ft hasta el inicio de tu próximo turno (no acumulable).",
    en: "On a hit that deals damage, the target's Speed is reduced by 10 ft until the start of your next turn (not cumulative)." },
  { id: "sap",    name: "Sap",
    es: "Al impactar y hacer daño, el objetivo tiene desventaja en su próxima tirada de ataque antes del inicio de tu próximo turno.",
    en: "On a hit that deals damage, the target has Disadvantage on its next attack roll before the start of your next turn." },
  { id: "topple", name: "Topple",
    es: "Al impactar, el objetivo hace una salvación de CON (CD 8 + mod. de característica + comp.) o queda Derribado.",
    en: "On a hit, the target makes a CON save (DC 8 + ability mod + prof.) or has the Prone condition." },
  { id: "push",   name: "Push",
    es: "Al impactar, empujas 10 ft a un objetivo Grande o menor.",
    en: "On a hit, you push a Large or smaller target 10 feet away." },
  { id: "graze",  name: "Graze",
    es: "Si FALLAS, el objetivo recibe daño igual al modificador de la característica usada.",
    en: "If you MISS, the target takes damage equal to the ability modifier used." },
  { id: "cleave", name: "Cleave",
    es: "Al impactar, segundo ataque contra otra criatura a 5 ft del objetivo y a tu alcance, sin sumar el modificador al daño.",
    en: "On a hit, a second attack against another creature within 5 ft of the target and your reach, without adding the ability modifier to damage." }
];

/* ---------- Condiciones que inflige el Asesino (2024) ---------- */
const CONDITIONS = [
  { id: "poisoned", nameEs: "Envenenado", nameEn: "Poisoned",
    es: "Desventaja en tiradas de ataque y pruebas de característica.",
    en: "Disadvantage on attack rolls and ability checks." },
  { id: "prone", nameEs: "Derribado", nameEn: "Prone",
    es: "Sus ataques tienen desventaja; los ataques contra ella tienen ventaja a 5 ft y desventaja desde más lejos; levantarse cuesta la mitad de la velocidad.",
    en: "Its attacks have Disadvantage; attacks against it have Advantage within 5 ft and Disadvantage from farther away; standing up costs half its Speed." },
  { id: "blinded", nameEs: "Cegado", nameEn: "Blinded",
    es: "Falla las pruebas basadas en la vista; sus ataques tienen desventaja; los ataques contra ella tienen ventaja.",
    en: "Fails sight-based checks; its attacks have Disadvantage; attacks against it have Advantage." },
  { id: "unconscious", nameEs: "Inconsciente", nameEn: "Unconscious",
    es: "Incapacitado + Derribado, suelta lo que sostiene; los ataques contra ella tienen ventaja y los impactos a 5 ft son críticos.",
    en: "Incapacitated + Prone, drops whatever it holds; attacks against it have Advantage and hits within 5 ft are critical hits." },
  { id: "incapacitated", nameEs: "Incapacitado", nameEn: "Incapacitated",
    es: "Sin acciones, acciones adicionales ni reacciones; no puede concentrarse.",
    en: "No actions, Bonus Actions or reactions; can't concentrate." },
  { id: "invisible", nameEs: "Invisible", nameEn: "Invisible",
    es: "No puede verse; los ataques contra ella tienen desventaja; sus ataques tienen ventaja.",
    en: "Can't be seen; attacks against it have Disadvantage; its attacks have Advantage." }
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
      "1ª ronda: si el enemigo aún no ha actuado, tu ataque tiene VENTAJA.",
      "Ataca: el impacto activa Ataque Furtivo (6d6).",
      "Si el furtivo impacta, suma +12 de daño (tu nivel de pícaro, por Asesinar)."
    ],
    stepsEn: [
      "Roll initiative WITH ADVANTAGE (Assassinate).",
      "1st round: if the enemy hasn't taken a turn yet, your attack has ADVANTAGE.",
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
      "Acción adicional: Puntería Firme → VENTAJA en tu próximo ataque de ESTE turno (solo si aún no te has movido).",
      "Tras usarla, tu velocidad es 0 hasta el final del turno. Puntería Itinerante (nivel 9) elimina solo esa reducción.",
      "Ataca con ventaja: el impacto activa Ataque Furtivo (6d6)."
    ],
    stepsEn: [
      "Bonus Action: Steady Aim → ADVANTAGE on your next attack THIS turn (only if you haven't moved yet).",
      "After using it, your Speed is 0 until the end of the turn. Roving Aim (level 9) removes only that reduction.",
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
      "Nivel 13 — Armas Envenenadas: al usar Veneno (Golpe Astuto), si el objetivo falla la salvación recibe +2d6 de daño de veneno que IGNORA la resistencia.",
      "Nivel 14 — Golpes Tortuosos: nuevas opciones de Golpe Astuto (Aturdir 2d6, Obnubilar 3d6, Noquear 6d6).",
      "Nivel 17 — Golpe Mortal: al impactar con Asesinar, salv. CON (CD 8+comp+DES) o el daño del ataque se DUPLICA."
    ],
    stepsEn: [
      "Level 13 — Envenom Weapons: when you use Poison (Cunning Strike), if the target fails the save it takes +2d6 poison damage that IGNORES resistance.",
      "Level 14 — Devious Strikes: new Cunning Strike options (Daze 2d6, Obscure 3d6, Knock Out 6d6).",
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
    identity: "Identidad", name: "Nombre", level: "Nivel", profBonus: "Bono extra (Competencia)",
    hpCurrent: "Vida actual (PG)", hpMax: "Vida máxima (PG)", hpTemp: "Vida extra (PG temp.)",
    ac: "Armadura (CA)", initiative: "Orden de turno (Iniciativa)", speed: "Movimiento (Velocidad)",
    hitDice: "Dados de curación (Dados de golpe)", hitDiceSpent: "usados",
    deathSaves: "Salvaciones de muerte (a 0 PG)", successes: "Éxitos", failures: "Fallos",
    inspiration: "Inspiración (repites 1 tirada)",
    shortRest: "Descanso corto (1 hora)", longRest: "Descanso largo (recupera todo)",
    abilities: "Atributos (Características)", score: "Valor", modifier: "Extra (Mod.)",
    skills: "Habilidades (lo que sabes hacer)", skill: "Habilidad", prof: "La sé (Comp.)", expertise: "Experto (Pericia)",
    weapons: "Armas y ataques", weapon: "Arma", damage: "Daño (dados)", properties: "Propiedades", mastery: "Maestría (truco)",
    addWeapon: "+ Añadir arma", remove: "Quitar",
    currency: "Dinero (Monedas)", notes: "Inventario y notas",
    exportJson: "Exportar JSON", importJson: "Importar JSON", resetSheet: "Restablecer ficha",
    saved: "Guardado ✓", imported: "¡Ficha importada!", importError: "Archivo JSON no válido.",
    resetConfirm: "¿Restablecer la ficha a los valores por defecto?",
    // Simulador
    simTitle: "Simulador de combate",
    newRound: "Nueva ronda de combate",
    initiativeRoll: "Iniciativa (con ventaja)",
    rollInitiative: "Tirar iniciativa",
    enemySetup: "Enemigo", enemyName: "Nombre", enemyHp: "Vida (PG)", enemyAc: "Armadura (CA)",
    enemyHasActed: "El enemigo YA actuó este combate",
    assassinateHint: "1ª ronda: si NO ha actuado, ventaja en el ataque y +{lv} daño del tipo del arma (Asesinar)",
    attackPanel: "Ataque", attackBonus: "Para pegar (Bono de ataque)",
    advantage: "Ventaja (mejor de 2 dados)", disadvantage: "Desventaja (peor de 2 dados)",
    rollAttack: "Tirar ataque", crit: "¡CRÍTICO!", miss: "Fallo", hit: "Impacto",
    nat1: "¡Pifia (1 natural)!", sneakUsed: "Furtivo ya usado este turno",
    cunningStrikes: "Golpes Astutos (máx. {max})",
    csPoison: "Veneno (-1d6, CON o Envenenado 1 min; requiere Poisoner's Kit)",
    csTrip: "Derribo (-1d6, Grande o menor, DES o Derribado)",
    csWithdraw: "Retirada (-1d6, mover mitad sin AdO)",
    csDaze: "Aturdir (-2d6, CON)", csKnockOut: "Noquear (-6d6, CON o Inconsciente)",
    csObscure: "Obnubilar (-3d6, DES o Cegado)",
    saveDC: "Dificultad (CD)",
    bonusActions: "Acciones extra (adicionales)",
    caDash: "Acción Astuta: Dash", caDisengage: "Acción Astuta: Retirarse", caHide: "Acción Astuta: Esconderse",
    steadyAim: "Puntería Firme",
    steadyAimRules: "Puntería Firme: acción adicional → ventaja en tu próximo ataque de ESTE turno. Solo si aún no te has movido; tras usarla tu velocidad es 0 hasta el final del turno (Puntería Itinerante, N9, elimina solo la reducción de velocidad).",
    sneakHint: "Ataque Furtivo: 1/turno, con arma Sutil o a distancia, si tienes ventaja (o un aliado NO incapacitado está a 5 ft del objetivo y tú no tienes desventaja). El daño extra es del tipo del arma.",
    reactions: "Reacciones (fuera de tu turno)",
    uncannyDodge: "Esquiva Asombrosa: cuando un atacante que puedes ver te impacta, reacción → el daño se divide entre 2 (redondeando hacia abajo)",
    evasion: "Evasión: efecto con salv. DES de medio daño → éxito 0, fallo mitad. No usable si estás Incapacitado",
    damageLog: "Registro de daño (historial)", enemyTracker: "Rastreador del enemigo",
    newTurn: "Nuevo turno", newCombat: "Nuevo combate", dead: "¡Enemigo derrotado!",
    applyDamage: "Aplicar daño", heal: "Curar",
    logInitiative: "Iniciativa",
    logBonus: "Acción adicional",
    selectWeapon: "Elige arma",
    // Términos del registro / desgloses
    lSneak: "Furtivo", lAssassinate: "Asesinar", lDamageWord: "Daño", lVsAc: "vs CA", lEnemyHp: "PG enemigo",
    lPoisonSave: "Veneno (CD {dc} CON): Envenenado 1 min; repite la salvación al final de cada turno (requiere Poisoner's Kit)",
    lTripSave: "Derribo (CD {dc} DES): si es Grande o menor, queda Derribado",
    lWithdrawNote: "Retirada: te mueves hasta la mitad de tu velocidad sin provocar AdO",
    lDazeSave: "Aturdir (CD {dc} CON): en su próximo turno solo puede moverse, hacer una acción O una acción adicional",
    lKnockOutSave: "Noquear (CD {dc} CON): Inconsciente 1 min o hasta recibir daño; repite la salvación al final de cada turno",
    lObscureSave: "Obnubilar (CD {dc} DES): Cegado hasta el final de su próximo turno",
    envenomNote: "Armas Envenenadas: si falla la salvación, +2d6({rolls}) = {n} de daño de veneno que IGNORA la resistencia",
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
    xpSection: "Experiencia y nivel", xpCurrent: "Puntos de experiencia (PX)", xpToNext: "PX que faltan (siguiente nivel)",
    xpLevelByXp: "Nivel según PX", xpApply: "Aplicar nivel según PX", xpAdd: "Añadir PX",
    xpMax: "¡Nivel máximo!", xpBarLabel: "{xp} / {next} PX",
    // Dotes
    featsSection: "Dotes (talentos especiales)", featDesc: "Descripción", addFeat: "+ Añadir dote",
    featNamePh: "p. ej. Alerta, Pungidor, Observador…",
    featDescPh: "p. ej. +5 a iniciativa; no te pueden sorprender…",
    // Diario
    journalSection: "Diario de aventuras", journalAdd: "+ Nueva entrada",
    journalTitlePh: "Título de la sesión…", journalTextPh: "¿Qué pasó en la sesión?",
    // Progresión
    progressionSection: "Progresión por nivel (Pícaro Asesino, 2024)",
    asiNote: "Elección (dote/mejora)", asiNotePh: "p. ej. Dote: Pungidor, +2 DES, Dote Épica…",
    // Maestría de armas y condiciones
    masterySection: "Maestría de armas (trucos de arma)", masteryWeapon: "Arma",
    masteryNote: "Elige 2 armas con las que tengas competencia. Puedes cambiar la elección al terminar un descanso largo.",
    masteryGlossaryTitle: "📖 Glosario de propiedades de maestría",
    conditionsSection: "📖 Condiciones clave del Asesino (referencia rápida)",
    // PCGen
    pcgenStep1: "Abre tu personaje en PCGen.",
    pcgenStep2: "Menú Character → Export → Standard…",
    pcgenStep3: "Elige la plantilla csheet_fantasy_generic_export.xml.ftl (en outputsheets/d20/fantasy/htmlxml).",
    pcgenStep4: "Guarda el archivo XML en tu equipo.",
    pcgenStep5: "Pulsa el botón de abajo y selecciona ese archivo.",
    pcgenNote: "⚠ PCGen usa las reglas de D&D 5e (SRD 2014); esta plataforma sigue las reglas de 2024. La importación es una base para revisar: nada se sobrescribe sin tu confirmación.",
    pcgenChoose: "📂 Elegir XML de PCGen…",
    pcgenPreviewTitle: "Vista previa de la importación",
    pcgenField: "Campo", pcgenCurrent: "Actual", pcgenNew: "Importado",
    pcgenConfirm: "✓ Confirmar importación", pcgenCancel: "Cancelar",
    pcgenError: "El archivo no es una exportación XML válida de PCGen (falta el elemento <character>).",
    pcgenSuccess: "Importación de PCGen completada ✓",
    pcgenNone: "El XML es válido pero no hay datos nuevos que importar.",
    pcgenSkillProf: "competencia",
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
    assassinateHint: "1st round: if it has NOT acted, advantage on the attack and +{lv} damage of the weapon's type (Assassinate)",
    attackPanel: "Attack", attackBonus: "Attack bonus",
    advantage: "Advantage", disadvantage: "Disadvantage",
    rollAttack: "Roll attack", crit: "CRITICAL!", miss: "Miss", hit: "Hit",
    nat1: "Natural 1 — critical miss!", sneakUsed: "Sneak attack already used this turn",
    cunningStrikes: "Cunning Strikes (max {max})",
    csPoison: "Poison (-1d6, CON save or Poisoned 1 min; requires Poisoner's Kit)",
    csTrip: "Trip (-1d6, Large or smaller, DEX save or Prone)",
    csWithdraw: "Withdraw (-1d6, move half speed, no OAs)",
    csDaze: "Daze (-2d6, CON save)", csKnockOut: "Knock Out (-6d6, CON save or Unconscious)",
    csObscure: "Obscure (-3d6, DEX save or Blinded)",
    saveDC: "Save DC",
    bonusActions: "Bonus actions",
    caDash: "Cunning Action: Dash", caDisengage: "Cunning Action: Disengage", caHide: "Cunning Action: Hide",
    steadyAim: "Steady Aim",
    steadyAimRules: "Steady Aim: Bonus Action → advantage on your next attack THIS turn. Only if you haven't moved yet; after using it your Speed is 0 until the end of the turn (Roving Aim, L9, removes only the Speed reduction).",
    sneakHint: "Sneak Attack: 1/turn, with a Finesse or Ranged weapon, if you have Advantage (or an ally that is NOT Incapacitated is within 5 ft of the target and you don't have Disadvantage). The extra damage is the weapon's damage type.",
    reactions: "Reactions",
    uncannyDodge: "Uncanny Dodge: when an attacker you can see hits you, reaction → the damage is halved (round down)",
    evasion: "Evasion: effect with a DEX save for half damage → 0 on success, half on failure. Can't be used while Incapacitated",
    damageLog: "Damage log", enemyTracker: "Enemy tracker",
    newTurn: "New turn", newCombat: "New combat", dead: "Enemy defeated!",
    applyDamage: "Apply damage", heal: "Heal",
    logInitiative: "Initiative",
    logBonus: "Bonus action",
    selectWeapon: "Choose weapon",
    lSneak: "Sneak", lAssassinate: "Assassinate", lDamageWord: "Damage", lVsAc: "vs AC", lEnemyHp: "Enemy HP",
    lPoisonSave: "Poison (DC {dc} CON): Poisoned 1 min; repeats the save at the end of each turn (requires Poisoner's Kit)",
    lTripSave: "Trip (DC {dc} DEX): if Large or smaller, it has the Prone condition",
    lWithdrawNote: "Withdraw: you move up to half your Speed without provoking OAs",
    lDazeSave: "Daze (DC {dc} CON): on its next turn it can only move, take an action OR a Bonus Action",
    lKnockOutSave: "Knock Out (DC {dc} CON): Unconscious 1 min or until it takes damage; repeats the save at the end of each turn",
    lObscureSave: "Obscure (DC {dc} DEX): Blinded until the end of its next turn",
    envenomNote: "Envenom Weapons: on a failed save, +2d6({rolls}) = {n} poison damage that IGNORES resistance",
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
    asiNote: "Choice (feat/boon)", asiNotePh: "e.g. Feat: Piercer, +2 DEX, Epic Boon…",
    // Weapon mastery & conditions
    masterySection: "Weapon Mastery", masteryWeapon: "Weapon",
    masteryNote: "Choose 2 weapons you have proficiency with. You can change the selection when you finish a Long Rest.",
    masteryGlossaryTitle: "📖 Mastery properties glossary",
    conditionsSection: "📖 Assassin key conditions (quick reference)",
    // PCGen
    pcgenStep1: "Open your character in PCGen.",
    pcgenStep2: "Menu Character → Export → Standard…",
    pcgenStep3: "Choose the template csheet_fantasy_generic_export.xml.ftl (in outputsheets/d20/fantasy/htmlxml).",
    pcgenStep4: "Save the XML file to your computer.",
    pcgenStep5: "Click the button below and select that file.",
    pcgenNote: "⚠ PCGen uses D&D 5e rules (SRD 2014); this platform follows the 2024 rules. The import is a base to review: nothing is overwritten without your confirmation.",
    pcgenChoose: "📂 Choose PCGen XML file…",
    pcgenPreviewTitle: "Import preview",
    pcgenField: "Field", pcgenCurrent: "Current", pcgenNew: "Imported",
    pcgenConfirm: "✓ Confirm import", pcgenCancel: "Cancel",
    pcgenError: "The file is not a valid PCGen XML export (missing <character> element).",
    pcgenSuccess: "PCGen import complete ✓",
    pcgenNone: "The XML is valid but there is no new data to import.",
    pcgenSkillProf: "proficiency",
    footer: "Unofficial fan tool, not affiliated with Wizards of the Coast. D&D 2024."
  }
};
