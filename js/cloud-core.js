/* Sincronización independiente del SDK: copia local, revisiones y conflictos. */
"use strict";

globalThis.CHAPS_CLOUD_CORE = function ({ store, storage, remote, onStatus }) {
  const KEY = "chaps-cloud-meta-v1";
  let uid = null, generation = 0, edits = 0, known = null, ready = false;
  let queue = Promise.resolve();
  let status = { mode: "local" };
  const emit = (mode, error) => {
    status = { mode, uid, error };
    onStatus(status);
  };
  const meta = () => {
    try { return JSON.parse(storage.getItem(KEY)) || {}; } catch (_) { return {}; }
  };
  const remember = (revision, dirty, base = null) => storage.setItem(KEY, JSON.stringify({ uid, revision, dirty, base }));
  const revision = (doc) => doc ? doc.revision : 0;
  // Combinar campos independientes; nunca decidir automáticamente entre dos valores del mismo campo.
  function merge(base, local, incoming) {
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    if (same(local, base) || same(local, incoming)) return incoming;
    if (same(incoming, base)) return local;
    const object = (value) => value && typeof value === "object" && !Array.isArray(value);
    if (object(base) && object(local) && object(incoming)) {
      const result = Object.create(null);
      for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(incoming)])) {
        const value = merge(base[key], local[key], incoming[key]);
        if (value !== undefined) result[key] = value;
      }
      return result;
    }
    throw Object.assign(new Error("Mismo campo editado en dos dispositivos."), { code: "chaps/conflict" });
  }
  function validate(doc) {
    if (doc === null) return;
    if (doc.schema !== 1 || !Number.isInteger(doc.revision) || doc.revision < 1 || typeof doc.payload !== "string") {
      throw new Error("Formato de nube incompatible; conserva copia local.");
    }
    store.validate(JSON.parse(doc.payload));
  }
  function task(fn) {
    const session = generation;
    queue = queue.then(async () => {
      if (session !== generation || !uid) return;
      try { await fn(session); }
      catch (error) { if (session === generation) emit("error", error); }
    });
    return queue;
  }
  function accept(doc) {
    if (JSON.stringify(store.snapshot()) !== doc.payload) store.replace(JSON.parse(doc.payload));
    remember(doc.revision, false, doc.payload);
    ready = true;
    emit("synced");
  }
  function reconcile(doc) {
    validate(doc);
    const saved = meta();
    // Un evento de escucha encolado antes de confirmar una escritura puede llegar tarde.
    if (doc && saved.uid === uid && doc.revision < saved.revision) return;
    known = doc;
    if (saved.uid !== uid) {
      if (saved.uid) { ready = false; emit("choose"); }
      else if (doc) accept(doc); // Primera vinculación: nube autoritativa, respaldo antes de reemplazar.
      else {
        ready = true;
        remember(0, store.hasLocal());
        emit(store.hasLocal() ? "pending" : "empty");
      }
    } else if (!doc && saved.revision === 0) {
      ready = true;
      emit(saved.dirty ? "pending" : "empty");
    } else if (!doc || saved.revision !== doc.revision) {
      ready = false;
      if (doc && !saved.dirty) accept(doc);
      else if (doc && saved.base) {
        let combined;
        try { combined = merge(JSON.parse(saved.base), store.snapshot(), JSON.parse(doc.payload)); }
        catch (error) { if (error.code !== "chaps/conflict") throw error; emit("choose"); return; }
        store.validate(combined);
        const payload = JSON.stringify(combined);
        if (payload !== JSON.stringify(store.snapshot())) store.replace(combined);
        const dirty = payload !== doc.payload;
        remember(doc.revision, dirty, doc.payload);
        ready = true;
        emit(dirty ? "pending" : "synced");
      } else emit("choose");
    } else {
      ready = true;
      if (saved.dirty) emit("pending");
      else {
        if (JSON.stringify(store.snapshot()) !== doc.payload) accept(doc);
        else { remember(doc.revision, false, doc.payload); emit("synced"); }
      }
    }
  }
  async function write(session, expected) {
    const payload = JSON.stringify(store.snapshot());
    store.validate(JSON.parse(payload));
    const editVersion = edits;
    emit("saving");
    try {
      const doc = await remote.write(uid, expected, payload);
      if (session !== generation) return;
      known = doc;
      const dirty = edits !== editVersion;
      remember(doc.revision, dirty, doc.payload);
      ready = true;
      emit(dirty ? "pending" : "synced");
    } catch (error) {
      if (session !== generation) return;
      if (error.code === "chaps/conflict") {
        ready = false;
        known = await remote.read(uid);
        if (session !== generation) return;
        validate(known);
        reconcile(known);
      } else throw error;
    }
  }
  const api = {
    changed() {
      edits++;
      const saved = meta();
      if (saved.uid) storage.setItem(KEY, JSON.stringify({ ...saved, dirty: true }));
      if (uid && ready) emit("pending");
    },
    connect(userId) {
      generation++;
      uid = userId;
      ready = false;
      known = null;
      emit("loading");
      return api.refresh();
    },
    disconnect() {
      generation++;
      uid = null;
      known = null;
      ready = false;
      emit("local");
    },
    refresh() {
      return task(async (session) => {
        const started = edits;
        const doc = await remote.read(uid);
        if (session !== generation) return;
        // Edición durante descarga: nunca reemplazarla automáticamente.
        if (edits !== started && meta().uid !== uid) {
          validate(doc); known = doc; ready = false; emit("choose"); return;
        }
        reconcile(doc);
        const saved = meta();
        if (ready && saved.dirty) await write(session, saved.revision);
      });
    },
    receive(doc) {
      return task(async () => { reconcile(doc); });
    },
    flush() {
      return task(async (session) => {
        const saved = meta();
        if (ready && saved.uid === uid && saved.dirty) await write(session, saved.revision);
      });
    },
    useLocal() {
      return task(async (session) => {
        // Elegir explícitamente esta copia permite migrar/reemplazar, con revisión atómica.
        await write(session, revision(known));
      });
    },
    useCloud() {
      return task(async (session) => {
        const started = edits;
        const doc = await remote.read(uid);
        if (session !== generation) return;
        validate(doc);
        known = doc;
        if (!doc || edits !== started) { ready = false; emit("choose"); return; }
        accept(doc);
      });
    },
    get status() { return { ...status, hasCloud: known !== null }; }
  };
  return api;
};
