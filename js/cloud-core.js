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
  const remember = (revision, dirty) => storage.setItem(KEY, JSON.stringify({ uid, revision, dirty }));
  const revision = (doc) => doc ? doc.revision : 0;
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
    store.replace(JSON.parse(doc.payload));
    remember(doc.revision, false);
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
      ready = false;
      if (doc && !store.hasLocal()) accept(doc);
      else emit("choose");
    } else if (!doc || saved.revision !== doc.revision) {
      ready = false;
      if (doc && !saved.dirty) accept(doc);
      else emit("choose");
    } else {
      ready = true;
      if (saved.dirty) emit("pending");
      else {
        if (JSON.stringify(store.snapshot()) !== doc.payload) accept(doc);
        else emit("synced");
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
      remember(doc.revision, dirty);
      ready = true;
      emit(dirty ? "pending" : "synced");
    } catch (error) {
      if (session !== generation) return;
      if (error.code === "chaps/conflict") {
        ready = false;
        known = await remote.read(uid);
        if (session !== generation) return;
        validate(known);
        emit("choose");
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
        if (edits !== started) {
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
