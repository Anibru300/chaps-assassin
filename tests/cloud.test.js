const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, "js/cloud-core.js"), "utf8"), context);
const create = context.CHAPS_CLOUD_CORE;
const sheet = (name) => ({ name, level: 12 });
const cloudDoc = (name, revision = 1) => ({ schema: 1, revision, payload: JSON.stringify(sheet(name)) });
function setup({ doc = null, local = sheet("LOCAL"), hasLocal = true, saved, read, write } = {}) {
  let current = structuredClone(local), remoteDoc = doc;
  const memory = new Map();
  const backups = [], writes = [];
  if (saved) memory.set("chaps-cloud-meta-v1", JSON.stringify(saved));
  const remote = {
    read: read || (async () => remoteDoc),
    write: write || (async (uid, expected, payload) => {
      if ((remoteDoc?.revision || 0) !== expected) {
        throw Object.assign(new Error("conflict"), { code: "chaps/conflict" });
      }
      remoteDoc = { schema: 1, revision: expected + 1, payload };
      writes.push({ uid, ...remoteDoc });
      return remoteDoc;
    })
  };
  const store = {
    hasLocal: () => hasLocal,
    snapshot: () => structuredClone(current),
    validate: (data) => { if (!data || typeof data.name !== "string") throw new Error("Invalid sheet"); },
    replace: (data) => { backups.push(current); current = structuredClone(data); hasLocal = true; }
  };
  const api = create({ store, storage: { getItem: (k) => memory.get(k), setItem: (k, v) => memory.set(k, v) }, remote, onStatus() {} });
  return {
    api, writes, backups, remote, store,
    edit(name) { current = sheet(name); hasLocal = true; api.changed(); },
    editData(data) { current = structuredClone(data); hasLocal = true; api.changed(); },
    changeRemote(doc) { remoteDoc = doc; },
    get local() { return current; },
    get doc() { return remoteDoc; },
    get meta() { return JSON.parse(memory.get("chaps-cloud-meta-v1") || "{}"); }
  };
}
test("primera conexión migra automáticamente ficha guardada", async () => {
  const s = setup();
  await s.api.connect("carlos");
  assert.equal(s.api.status.mode, "synced");
  assert.equal(s.writes.length, 1);
  assert.equal(s.writes[0].uid, "carlos");
  assert.equal(s.doc.revision, 1);
  assert.equal(s.meta.dirty, false);
});
test("checkpoint guarda estado sincronizado con marcador de revisión", async () => {
  const s = setup();
  await s.api.connect("carlos");
  s.edit("DIA GUARDADO");
  await s.api.checkpoint((data, revision) => ({ ...data, savedVersions: { ["r" + revision]: { savedAt: 1234 } } }));
  assert.equal(s.api.status.mode, "synced");
  assert.equal(s.local.name, "DIA GUARDADO");
  assert.equal(s.local.savedVersions.r2.savedAt, 1234);
  assert.equal(s.doc.revision, 3);
});

test("checkpoint con conflicto no marca versión guardada", async () => {
  const s = setup();
  await s.api.connect("carlos");
  s.edit("CAMBIO LOCAL");
  s.changeRemote(cloudDoc("OTRO", 5));
  await s.api.refresh();
  let prepared = false;
  await s.api.checkpoint(data => { prepared = true; return data; });
  assert.equal(prepared, false);
});

test("otro dispositivo sin ficha local descarga nube sin sobrescribirla", async () => {
  const s = setup({ hasLocal: false, doc: cloudDoc("REMOTO", 3) });
  await s.api.connect("carlos");
  assert.equal(s.local.name, "REMOTO");
  assert.equal(s.meta.revision, 3);
  assert.equal(s.writes.length, 0);
});
test("teléfono con ficha local previa se vincula automáticamente y conserva respaldo", async () => {
  const s = setup({ doc: cloudDoc("REMOTO") });
  await s.api.connect("carlos");
  assert.equal(s.api.status.mode, "synced");
  assert.equal(s.local.name, "REMOTO");
  assert.equal(s.backups[0].name, "LOCAL");
});
test("dispositivo nuevo no sube ficha por defecto; primer cambio crea nube", async () => {
  const s = setup({ hasLocal: false });
  await s.api.connect("carlos");
  assert.equal(s.api.status.mode, "empty");
  assert.equal(s.writes.length, 0);
  s.edit("PERSONAJE NUEVO");
  await s.api.flush();
  assert.equal(s.writes.length, 1);
});
test("ediciones posteriores se suben con revisión y sin bucle de guardado", async () => {
  const s = setup({ doc: cloudDoc("LOCAL"), saved: { uid: "carlos", revision: 1, dirty: false } });
  await s.api.connect("carlos");
  s.edit("ACTUALIZADO");
  await s.api.flush();
  await s.api.receive(s.doc);
  await s.api.flush();
  assert.equal(s.writes.length, 1);
  assert.equal(JSON.parse(s.doc.payload).name, "ACTUALIZADO");
  assert.equal(s.doc.revision, 2);
  assert.equal(s.api.status.mode, "synced");
});
test("sin conexión conserva cambios y los sube tras reconectar", async () => {
  const s = setup({ doc: cloudDoc("LOCAL"), saved: { uid: "carlos", revision: 1, dirty: false } });
  await s.api.connect("carlos");
  const write = s.remote.write;
  s.remote.write = async () => { throw new Error("offline"); };
  s.edit("SIN RED");
  await s.api.flush();
  assert.equal(s.api.status.mode, "error");
  assert.equal(s.meta.dirty, true);
  assert.equal(s.local.name, "SIN RED");
  s.remote.write = write;
  await s.api.refresh();
  assert.equal(JSON.parse(s.doc.payload).name, "SIN RED");
  assert.equal(s.meta.dirty, false);
});
test("cambios offline sobreviven recarga y no se reemplazan al iniciar", async () => {
  const s = setup({ local: sheet("PENDIENTE"), doc: cloudDoc("ANTERIOR"), saved: { uid: "carlos", revision: 1, dirty: true } });
  await s.api.connect("carlos");
  assert.equal(s.local.name, "PENDIENTE");
  assert.equal(JSON.parse(s.doc.payload).name, "PENDIENTE");
});
test("cambios concurrentes no sobrescriben nube ni copia local", async () => {
  const s = setup({ doc: cloudDoc("LOCAL"), saved: { uid: "carlos", revision: 1, dirty: false } });
  await s.api.connect("carlos");
  s.edit("EDICION LOCAL");
  s.changeRemote(cloudDoc("OTRO DISPOSITIVO", 2));
  await s.api.flush();
  assert.equal(s.api.status.mode, "choose");
  assert.equal(s.local.name, "EDICION LOCAL");
  assert.equal(s.doc.revision, 2);
  assert.equal(s.writes.length, 0);
  await s.api.useLocal();
  assert.equal(s.doc.revision, 3);
});
test("novedades remotas se descargan automáticamente cuando no hay cambios locales", async () => {
  const s = setup({ doc: cloudDoc("LOCAL"), saved: { uid: "carlos", revision: 1, dirty: false } });
  await s.api.connect("carlos");
  await s.api.receive(cloudDoc("TELEFONO", 2));
  assert.equal(s.local.name, "TELEFONO");
  assert.equal(s.meta.revision, 2);
});
test("campos distintos editados simultáneamente se combinan y siguen sincronizando", async () => {
  const base = { name: "CHAPS", level: 12, hp: 80, notes: "" };
  const first = { schema: 1, revision: 1, payload: JSON.stringify(base) };
  const s = setup({ local: base, doc: first, saved: { uid: "carlos", revision: 1, dirty: false } });
  await s.api.connect("carlos");
  s.editData({ ...base, hp: 70 });
  s.changeRemote({ ...first, revision: 2, payload: JSON.stringify({ ...base, notes: "desde celular" }) });
  await s.api.flush(); // Transacción detecta versión nueva y combina con base confirmada.
  assert.equal(s.api.status.mode, "pending");
  assert.equal(s.local.hp, 70);
  assert.equal(s.local.notes, "desde celular");
  await s.api.flush();
  assert.equal(s.api.status.mode, "synced");
  assert.equal(s.doc.revision, 3);
  assert.equal(JSON.parse(s.doc.payload).hp, 70);
});
test("escucha combina remoto con cambios pendientes sin perder datos anidados", async () => {
  const base = { name: "CHAPS", level: 12, currency: { gp: 100, sp: 10 } };
  const doc = { schema: 1, revision: 1, payload: JSON.stringify(base) };
  const s = setup({ local: base, doc, saved: { uid: "carlos", revision: 1, dirty: false } });
  await s.api.connect("carlos");
  s.editData({ ...base, currency: { gp: 90, sp: 10 } });
  await s.api.receive({ ...doc, revision: 2, payload: JSON.stringify({ ...base, currency: { gp: 100, sp: 20 } }) });
  assert.equal(s.local.currency.gp, 90);
  assert.equal(s.local.currency.sp, 20);
  assert.equal(s.api.status.mode, "pending");
});
test("evento remoto antiguo no revierte escritura ya confirmada", async () => {
  const s = setup({ doc: cloudDoc("LOCAL"), saved: { uid: "carlos", revision: 1, dirty: false } });
  await s.api.connect("carlos");
  s.edit("NUEVO");
  await s.api.flush();
  await s.api.receive(cloudDoc("ANTIGUO", 1));
  assert.equal(s.local.name, "NUEVO");
  assert.equal(s.meta.revision, 2);
});
test("cambiar cuenta no sube personaje previo automáticamente", async () => {
  const s = setup({ doc: cloudDoc("LOCAL"), saved: { uid: "carlos", revision: 1, dirty: false } });
  await s.api.connect("otra-cuenta");
  assert.equal(s.api.status.mode, "choose");
  assert.equal(s.writes.length, 0);
});
test("respuesta tardía tras desconectar no modifica ficha", async () => {
  let finish;
  const s = setup({ hasLocal: false, read: () => new Promise((resolve) => { finish = resolve; }) });
  const pending = s.api.connect("carlos");
  await Promise.resolve();
  s.api.disconnect();
  finish(cloudDoc("TARDIO"));
  await pending;
  assert.equal(s.local.name, "LOCAL");
  assert.equal(s.api.status.mode, "local");
});
test("editar durante lectura impide que respuesta reemplace edición", async () => {
  let finish;
  const s = setup({ hasLocal: false, read: () => new Promise((resolve) => { finish = resolve; }) });
  const pending = s.api.connect("carlos");
  await Promise.resolve();
  s.edit("NUEVA EDICION");
  finish(cloudDoc("ANTERIOR"));
  await pending;
  assert.equal(s.local.name, "NUEVA EDICION");
  assert.equal(s.api.status.mode, "choose");
});
test("edición mientras sube permanece pendiente para siguiente guardado", async () => {
  let finish;
  const s = setup({ doc: cloudDoc("LOCAL"), saved: { uid: "carlos", revision: 1, dirty: false } });
  await s.api.connect("carlos");
  s.remote.write = async (uid, revision, payload) => {
    await new Promise((resolve) => { finish = resolve; });
    return { schema: 1, revision: revision + 1, payload };
  };
  s.edit("PRIMER CAMBIO");
  const pending = s.api.flush();
  await Promise.resolve();
  s.edit("SEGUNDO CAMBIO");
  finish();
  await pending;
  assert.equal(s.meta.dirty, true);
  assert.equal(s.api.status.mode, "pending");
});
test("documento inválido o permisos denegados dejan ficha intacta", async () => {
  const s = setup({ doc: { schema: 99, revision: 1, payload: "{}" } });
  await s.api.connect("carlos");
  assert.equal(s.api.status.mode, "error");
  assert.equal(s.local.name, "LOCAL");
  s.remote.read = async () => { throw Object.assign(new Error("denied"), { code: "permission-denied" }); };
  await s.api.refresh();
  assert.equal(s.local.name, "LOCAL");
  assert.equal(s.writes.length, 0);
});
test("puente valida ficha real, guarda respaldo y notifica guardado local", () => {
  const memory = new Map();
  let notifications = 0;
  const ctx = vm.createContext({ structuredClone, console,
    window: { CHAPS_CLOUD: { changed: () => notifications++ } },
    document: { addEventListener() {}, querySelector: () => ({ textContent: "", classList: { add() {} } }) },
    localStorage: { getItem: (k) => memory.get(k) || null, setItem: (k, v) => memory.set(k, v) },
    setTimeout: () => 0, clearTimeout() {}
  });
  for (const file of ["data", "app"]) vm.runInContext(fs.readFileSync(path.join(root, `js/${file}.js`), "utf8"), ctx);
  vm.runInContext("renderAll = () => {}; saveState();", ctx);
  assert.equal(notifications, 1);
  const store = ctx.window.CHAPS_STORE;
  const data = store.snapshot();
  delete data.passiveManual; // Acción legítima de volver a percepción automática.
  delete data.weapons[0].weaponId; // Armas manuales o importadas desde PCGen.
  store.validate(data);
  data.name = "NUBE";
  store.replace(data);
  assert.equal(store.snapshot().name, "NUBE");
  assert.equal(JSON.stringify(store.snapshot()), JSON.stringify(data));
  assert.equal(JSON.parse(memory.get("chaps-state-before-cloud-v1")).name, "CHAPS");
  store.replace({ ...data, name: "OTRA ACTUALIZACION" });
  assert.equal(JSON.parse(memory.get("chaps-state-before-cloud-v1")).name, "CHAPS");
  assert.equal(notifications, 1); // Descargar no vuelve a subir.
  const original = structuredClone(data);
  delete original.session; delete original.sessionNotes; delete original.tableConditions;
  store.validate(original); // Fichas publicadas antes de añadir Mesa y notas.
  for (const field of ["sessionNotes", "tableConditions"]) {
    assert.throws(() => store.validate({ ...original, [field]: [] }));
    assert.throws(() => store.validate({ ...original, [field]: null }));
  }
  data.weapons = [null];
  assert.throws(() => store.replace(data));
  assert.equal(store.snapshot().name, "OTRA ACTUALIZACION");
});

test("inicialización funciona cuando sesión local ya retiró puerta de acceso", async () => {
  for (const protocol of ["file:", "http:"]) {
    let init;
    const nodes = new Map();
    const ctx = vm.createContext({
      console, location: { protocol }, navigator: { onLine: true },
      localStorage: { getItem: () => null, setItem() {} },
      setTimeout, clearTimeout, setInterval: () => 0,
      document: {
        addEventListener: (event, callback) => { init = callback; },
        getElementById: (id) => {
          if (id === "login-google") return null;
          if (!nodes.has(id)) nodes.set(id, { addEventListener() {} });
          return nodes.get(id);
        }
      }
    });
    ctx.window = ctx;
    ctx.addEventListener = () => {};
    ctx.CHAPS_STORE = {};
    for (const file of ["cloud-core", "firebase-sync"]) {
      vm.runInContext(fs.readFileSync(path.join(root, `js/${file}.js`), "utf8"), ctx);
    }
    assert.doesNotThrow(init);
    await new Promise(setImmediate); // Fallo de red/import se gestiona sin romper ficha.
    assert.equal(typeof nodes.get("cloud-status").textContent, "string");
  }
});
