"use strict";
globalThis.CHAPS_PROFILE_STORE = function ({ storage, store }) {
  const parse = (key, fallback) => { try { return JSON.parse(storage.getItem(key)) || fallback; } catch (_) { return fallback; } };
  const legacy = parse("chaps-cloud-meta-v1", {});
  let working = parse("chaps-working-character-v1", { uid: legacy.uid || null, id: "chaps" });
  const sheetKey = (uid, id) => `chaps-sheet:${uid}:${id}`;
  const catalogKey = (uid) => `chaps-characters:${uid}`;
  function remember() {
    if (!working.uid || !store.hasLocal()) return;
    const data = store.snapshot();
    storage.setItem(sheetKey(working.uid, working.id), JSON.stringify(data));
    const catalog = parse(catalogKey(working.uid), {});
    catalog[working.id] = { id: working.id, name: data.name, level: data.level };
    storage.setItem(catalogKey(working.uid), JSON.stringify(catalog));
  }
  return {
    get current() { return { ...working }; },
    save: remember,
    activeFor: (uid) => storage.getItem(`chaps-active:${uid}`) || "chaps",
    metadataKey(uid, id) {
      const key = `chaps-cloud-meta:${uid}:${id}`;
      if (id === "chaps" && !storage.getItem(key) && legacy.uid === uid) storage.setItem(key, JSON.stringify(legacy));
      return key;
    },
    activate(uid, id, seed) {
      if (!uid || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error("Personaje no válido.");
      remember();
      const same = working.uid === uid && working.id === id;
      const adoptLegacy = !working.uid && id === "chaps";
      const data = seed || (same || adoptLegacy ? (store.hasLocal() ? store.snapshot() : null) : parse(sheetKey(uid, id), null));
      if (data) store.validate(data);
      working = { uid, id };
      storage.setItem("chaps-working-character-v1", JSON.stringify(working));
      storage.setItem(`chaps-active:${uid}`, id);
      store.activate(data);
      remember();
    },
    catalog(uid) { return Object.values(parse(catalogKey(uid), {})); },
    updateCatalog(uid, entries) {
      const catalog = parse(catalogKey(uid), {});
      for (const entry of entries) catalog[entry.id] = entry;
      storage.setItem(catalogKey(uid), JSON.stringify(catalog));
    }
  };
};
