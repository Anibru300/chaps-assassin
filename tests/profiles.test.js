const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const context = vm.createContext({});
for (const file of ["profile-store", "account-auth"]) vm.runInContext(fs.readFileSync(path.resolve(__dirname, `../js/${file}.js`), "utf8"), context);

function setup(owner = null) {
  const memory = new Map();
  if (owner) memory.set("chaps-cloud-meta-v1", JSON.stringify({ uid: owner, revision: 4, dirty: true }));
  let data = { name: "CHAPS", level: 12 };
  const storage = { getItem: (k) => memory.get(k) || null, setItem: (k, v) => memory.set(k, v) };
  const store = { hasLocal: () => data !== null, snapshot: () => structuredClone(data), validate: (value) => assert.equal(typeof value.name, "string"), activate: (value) => { data = value && structuredClone(value); } };
  const profiles = context.CHAPS_PROFILE_STORE({ storage, store });
  return { profiles, memory, get data() { return data; }, edit(name) { data.name = name; profiles.save(); } };
}
test("migra CHAPS original y metadatos pendientes sin duplicar cuenta", () => {
  const s = setup("carlos");
  s.profiles.activate("carlos", "chaps");
  assert.equal(s.data.name, "CHAPS");
  assert.equal(JSON.parse(s.memory.get(s.profiles.metadataKey("carlos", "chaps"))).dirty, true);
});
test("cambiar personajes conserva datos pendientes y vuelve a ficha correcta", () => {
  const s = setup("carlos");
  s.profiles.activate("carlos", "chaps");
  s.edit("CHAPS EDITADO");
  s.profiles.activate("carlos", "segundo", { name: "SEGUNDO", level: 1 });
  s.edit("SEGUNDO EDITADO");
  s.profiles.activate("carlos", "chaps");
  assert.equal(s.data.name, "CHAPS EDITADO");
  s.profiles.activate("carlos", "segundo");
  assert.equal(s.data.name, "SEGUNDO EDITADO");
  assert.equal(s.profiles.catalog("carlos").length, 2);
});
test("otra cuenta no hereda personaje privado de cuenta anterior", () => {
  const s = setup("carlos");
  s.profiles.activate("carlos", "chaps");
  s.profiles.activate("otra-cuenta", "chaps");
  assert.equal(s.data, null);
  s.profiles.activate("carlos", "chaps");
  assert.equal(s.data.name, "CHAPS");
});

test("cuenta nueva no adopta ficha sin dueño; conserva respaldo local", () => {
  const s=setup();s.profiles.activate('nuevo','chaps');assert.equal(s.data,null);
  assert.equal(JSON.parse(s.memory.get('chaps-unassigned-backup-v1')).name,'CHAPS');
});
test("personajes utilizan claves de sincronización independientes", () => {
  const s = setup("carlos");
  assert.notEqual(s.profiles.metadataKey("carlos", "chaps"), s.profiles.metadataKey("carlos", "segundo"));
  assert.notEqual(s.profiles.metadataKey("carlos", "chaps"), s.profiles.metadataKey("otra", "chaps"));
});
test("vincula contraseña a usuario Google existente sin crear usuario nuevo", async () => {
  let created = false, linked;
  const user = { uid: "uid-google", email: "test@example.com", providerData: [{ providerId: "google.com" }] };
  const api = context.CHAPS_ACCOUNT_AUTH({ auth: { currentUser: user }, sdk: {
    EmailAuthProvider: { credential: (email, secret) => ({ email, secret }) },
    createUserWithEmailAndPassword: () => { created = true; },
    linkWithCredential: async (existing, credential) => { linked = { existing, credential }; }
  } });
  await api.setPassword("secret-123", "secret-123");
  assert.equal(created, false);
  assert.equal(linked.existing.uid, "uid-google");
  assert.equal(linked.credential.email, "test@example.com");
});
test("contraseñas no coincidentes se rechazan antes de enviar credenciales", async () => {
  const api = context.CHAPS_ACCOUNT_AUTH({ auth: {}, sdk: {} });
  await assert.rejects(api.register("test@example.com", "secret-123", "diferente"));
});

test("correo ya asociado recupera acceso sobre mismo usuario sin crear cuenta", async () => {
  const user = { uid: "google-original", email: "test@example.com", providerData: [{ providerId: "google.com" }] };
  let updated;
  const api = context.CHAPS_ACCOUNT_AUTH({ auth: { currentUser: user }, sdk: {
    EmailAuthProvider: { credential: () => ({}) },
    linkWithCredential: async () => { throw Object.assign(new Error("email exists"), { code: "auth/email-already-in-use" }); },
    updatePassword: async (existing) => { updated = existing.uid; },
    reload: async (existing) => existing.providerData.push({ providerId: "password" })
  } });
  await api.setPassword("secret-123", "secret-123");
  assert.equal(updated, "google-original");
  assert.equal(user.providerData.length, 2);
});

test("cambio de cuenta durante vinculación no cambia contraseña de otra sesión", async () => {
  const user = { uid: "original", email: "test@example.com", providerData: [] };
  const auth = { currentUser: user };
  let updated = false;
  const api = context.CHAPS_ACCOUNT_AUTH({ auth, sdk: {
    EmailAuthProvider: { credential: () => ({}) },
    linkWithCredential: async () => {
      auth.currentUser = { uid: "otra" };
      throw Object.assign(new Error("email exists"), { code: "auth/email-already-in-use" });
    },
    updatePassword: async () => { updated = true; }
  } });
  await assert.rejects(api.setPassword("secret-123", "secret-123"));
  assert.equal(updated, false);
});
