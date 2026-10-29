// Ejecutar con emulador Firestore y dependencias de pruebas externas al sitio.
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

test("reglas Firestore: acceso privado, formato y revisiones", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST
}, async (t) => {
  const dependency = (name) => require(process.env.CHAPS_TEST_MODULES
    ? path.join(process.env.CHAPS_TEST_MODULES, name) : name);
  const { initializeTestEnvironment, assertSucceeds, assertFails } = dependency("@firebase/rules-unit-testing");
  const { doc, setDoc, getDoc, getDocs, collection, deleteDoc, serverTimestamp, writeBatch, setLogLevel } = dependency("firebase/firestore");
  setLogLevel("silent");
  const env = await initializeTestEnvironment({
    projectId: "demo-chaps",
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8") }
  });
  try {
    await env.clearFirestore();
    const owner = env.authenticatedContext("carlos").firestore();
    const other = env.authenticatedContext("otro").firestore();
    const guest = env.unauthenticatedContext().firestore();
    const target = (db) => doc(db, "users/carlos/characters/chaps");
    const value = (revision = 1) => ({ schema: 1, revision, payload: '{"name":"CHAPS"}', updatedAt: serverTimestamp() });
    await t.test("propietario crea y lee ficha", async () => {
      await assertSucceeds(setDoc(target(owner), value()));
      await assertSucceeds(getDoc(target(owner)));
    });
    await t.test("visitante y otra cuenta no pueden leer ni escribir", async () => {
      for (const db of [other, guest]) {
        await assertFails(getDoc(target(db)));
        await assertFails(setDoc(target(db), value(2)));
      }
    });
    await t.test("actualización exige revisión consecutiva", async () => {
      await assertFails(setDoc(target(owner), value(1)));
      await assertFails(setDoc(target(owner), value(3)));
      await assertSucceeds(setDoc(target(owner), value(2)));
    });
    await t.test("rechaza esquema, timestamp, campos adicionales y tamaño inválidos", async () => {
      await assertFails(setDoc(target(owner), { ...value(3), schema: 2 }));
      await assertFails(setDoc(target(owner), { ...value(3), updatedAt: new Date(0) }));
      await assertFails(setDoc(target(owner), { ...value(3), extra: true }));
      await assertFails(setDoc(target(owner), { ...value(3), payload: "x".repeat(700000) }));
    });
    await t.test("varios personajes privados; no admite rutas públicas ni borrar ficha", async () => {
      await assertSucceeds(setDoc(doc(owner, "users/carlos/characters/otro"), value()));
      await assertSucceeds(getDocs(collection(owner, "users/carlos/characters")));
      await assertFails(getDocs(collection(other, "users/carlos/characters")));
      await assertFails(setDoc(doc(owner, "public/chaps"), value()));
      await assertFails(deleteDoc(target(owner)));
    });
    await t.test("historial guarda versión previa en mismo cambio atómico", async () => {
      const batch = writeBatch(owner);
      const previous = doc(owner, "users/carlos/characters/chaps/versions/r2");
      batch.set(previous, { schema: 1, revision: 2, payload: value().payload, createdAt: serverTimestamp() });
      batch.set(target(owner), value(3));
      await assertSucceeds(batch.commit());
      await assertSucceeds(getDoc(previous));
      await assertFails(getDoc(doc(other, "users/carlos/characters/chaps/versions/r2")));
      await assertFails(setDoc(previous, { schema: 1, revision: 2, payload: "alterado", createdAt: serverTimestamp() }));
      await assertFails(setDoc(doc(owner, "users/carlos/characters/chaps/versions/r3"), { schema: 1, revision: 3, payload: value().payload, createdAt: serverTimestamp() }));
    });
  } finally {
    await env.cleanup();
  }
});
