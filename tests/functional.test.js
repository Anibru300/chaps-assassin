const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

class Element {
  constructor() {
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    this.value = "all";
    this.style = {};
    this.classes = new Set();
    this.classList = {
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
      toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name)
    };
  }
  set innerHTML(value) { this.html = value; this.children = []; }
  get innerHTML() { return this.html || ""; }
  appendChild(child) { this.children.push(child); }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  click() { return this.listeners.click?.(); }
  querySelector(selector) {
    this.nodes ||= {};
    return this.nodes[selector] ||= new Element();
  }
  querySelectorAll() { return []; }
}

function setup() {
  const html = read("index.html");
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)]
    .map((match) => [match[1], new Element()]));
  const categories = ["creatures", "weapons"].map((cat) => {
    const button = new Element();
    button.dataset.cat = cat;
    return button;
  });
  elements.get("lib-nav").querySelectorAll = () => categories;
  elements.get("lib-search").value = "";
  const callbacks = [];
  const storage = new Map();
  const document = {
    body: new Element(),
    addEventListener: (type, callback) => callbacks.push(callback),
    getElementById: (id) => elements.get(id) || null,
    querySelector: (selector) => selector.startsWith("#")
      ? elements.get(selector.slice(1)) || null : new Element(),
    querySelectorAll: () => [],
    createElement: () => new Element()
  };
  const context = vm.createContext({
    structuredClone, document, console,
    localStorage: { getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value) },
    setTimeout: () => 0, clearTimeout() {},
    fetch: () => { throw new Error("Las pruebas no deben usar red"); }
  });
  const run = (code) => vm.runInContext(code, context);
  run("window = globalThis;");
  for (const file of ["data", "app", "combat-data", "combat", "biblioteca"]) {
    vm.runInContext(read(`js/${file}.js`), context, { filename: `${file}.js` });
  }
  // Sustituir renderizadores ajenos al flujo probado; conservar acciones reales.
  run(`renderIdentity = renderWeapons = renderCombos = renderSetup = renderCombat = () => {};
    LIB_MODAL.init();`);
  callbacks.at(-1)(); // Arranque de biblioteca; no ejecutar arranque general.
  async function open(cat, entry) {
    storage.set(`chaps-lib-${cat}-v1`, JSON.stringify({ ts: Date.now(), data: [entry] }));
    await categories.find((button) => button.dataset.cat === cat).click();
    elements.get("lib-results").children[0].querySelector(".lib-row-head").click();
  }
  return { run, elements, storage, open };
}

test("descanso largo conserva recuperación, guardado y recordatorio de maestría", () => {
  const { run, elements, storage } = setup();
  run("state.hpCurrent = 1; state.hpTemp = 5; state.hitDiceSpent = 8; state.deathSuccess = 2; state.deathFail = 1; longRest();");
  const saved = JSON.parse(storage.get("chaps-state-v1"));
  assert.equal(saved.hpCurrent, saved.hpMax);
  assert.equal(saved.hpTemp, 0);
  assert.equal(saved.hitDiceSpent, 0);
  assert.equal(saved.deathSuccess, 0);
  assert.equal(saved.deathFail, 0);
  assert.equal(saved.inspiration, true);
  assert.ok(elements.get("section-mastery").classes.has("mastery-remind"));
  assert.match(read("css/style.css"), /#section-mastery\.mastery-remind\s*\{/);
});

test("biblioteca abre modal y añade arma usando constantes de ámbito global", async () => {
  const { run, elements, open } = setup();
  assert.equal(run("typeof window.LIB_MODAL"), "undefined");
  assert.equal(run("typeof window.WEAPON_MASTERY"), "undefined");
  const before = run("state.weapons.length");
  await open("weapons", { name: "Dagger", dice: "1d4", props: [] });
  assert.equal(elements.get("lib-modal").hidden, false);
  assert.equal(elements.get("lib-modal-title").textContent, "Dagger");
  elements.get("lib-modal").querySelector(".lib-add-weapon").click();
  assert.equal(run("state.weapons.length"), before + 1);
  assert.equal(run("state.weapons.at(-1).weaponId"), "dagger");
  assert.equal(elements.get("lib-modal").hidden, true);
});

test("biblioteca añade criatura y convierte velocidades textuales, numéricas o ausentes", async () => {
  for (const [speed, expected] of [["30 ft., vuelo 60 ft.", 30], [40, 40], [undefined, 30], ["—", 30]]) {
    const { run, elements, open } = setup();
    await open("creatures", {
      name: "Criatura de prueba", hp: 20, ac: 13, speed,
      ab: { dexterity: 14 },
      actions: [{ n: "Ataque", d: "Melee Attack Roll: +4 (1d6 + 2)" }]
    });
    assert.equal(elements.get("lib-modal").hidden, false);
    elements.get("lib-modal").querySelector(".lib-add-enemy").click();
    assert.equal(run("combat.enemies.length"), 1);
    assert.equal(run("combat.enemies[0].speed"), expected);
    assert.equal(run("combat.enemies[0].hp"), 20);
    assert.equal(run("combat.enemies[0].attacks[0].bonus"), 4);
    assert.equal(run("combat.enemies[0].attacks[0].dmg"), "1d6+2");
    assert.equal(elements.get("lib-modal").hidden, true);
  }
});
