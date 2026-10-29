/* Firebase modular desde CDN; la ficha local funciona aunque falle la red. */
(function () {
  "use strict";
  const firebaseConfig = {
    apiKey: "AIzaSyBGO_TgmHi0ZczeueS2BJW1vEdFEQ9atB4",
    authDomain: "chaps-58e61.firebaseapp.com",
    projectId: "chaps-58e61",
    storageBucket: "chaps-58e61.firebasestorage.app",
    messagingSenderId: "825128918868",
    appId: "1:825128918868:web:f59faf7f486ba949b272c1"
  };
  let sdk, auth, db, user, unsubscribe, timer, booting, retryTimer;
  let recovering = false, retryDelay = 1000;
  let account, catalogUnsubscribe, switching = false, sessionToken = 0;
  const profiles = window.CHAPS_FEATURES?.profiles;
  const el = (id) => document.getElementById(id);
  const messages = {
    local: "Copia local · conecta Google para sincronizar.",
    loading: "Consultando personaje en nube…",
    empty: "Sincronización automática activa · próximo cambio creará personaje en nube.",
    choose: "Dos versiones incompatibles: elige ficha que conservar. Copia anterior conservada.",
    pending: "Cambios guardados en dispositivo · pendientes de subir.",
    saving: "Guardando personaje en nube…",
    synced: "Personaje sincronizado · actualizaciones automáticas entre dispositivos."
  };
  function errorText(error) {
    const code = error?.code || "";
    if (code.includes("unauthorized-domain")) return "Autoriza este dominio en Firebase → Authentication → Configuración.";
    if (code.includes("operation-not-allowed")) return "Habilita proveedor de acceso en Firebase → Authentication.";
    if (code.includes("email-already-in-use") || code.includes("credential-already-in-use")) return "Correo ya tiene cuenta. Entra con Google y agrega contraseña desde Cuenta; no crees otra cuenta.";
    if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Correo o contraseña incorrectos.";
    if (code.includes("weak-password")) return "Contraseña no cumple política de cuenta. Usa al menos 8 caracteres.";
    if (code.includes("requires-recent-login")) return "Verifica sesión con Google o introduce contraseña actual y vuelve a guardar.";
    if (code.includes("too-many-requests")) return "Demasiados intentos. Espera antes de volver a entrar.";
    if (code.includes("permission-denied")) return "Publica reglas de firestore.rules en Firebase → Firestore → Reglas.";
    if (code.includes("popup-blocked")) return "Permite ventana de Google y vuelve a pulsar Conectar.";
    if (code.includes("popup-closed") || code.includes("cancelled-popup")) return "Acceso Google cancelado; copia local conservada.";
    if (code.includes("unavailable") || code.includes("network-request-failed") || !navigator.onLine) {
      return "Sin conexión · copia local conservada. Reintenta al recuperar internet.";
    }
    return error?.message || "No se pudo sincronizar; copia local conservada.";
  }
  function showStatus(status) {
    el("cloud-status").textContent = status.mode === "error" ? errorText(status.error) : messages[status.mode];
    el("cloud-choice").hidden = status.mode !== "choose";
    el("cloud-use-remote").disabled = !cloud.status.hasCloud;
    el("cloud-account").textContent = user ? (user.email || user.displayName || "Google conectado") : "";
    el("cloud-connect").hidden = !!user;
    el("cloud-disconnect").hidden = !user;
    el("cloud-retry").hidden = !user;
    window.CHAPS_FEATURES?.render();
    if (status.mode === "pending" && navigator.onLine) schedule();
    if (status.mode === "error" && user && navigator.onLine &&
        !["permission-denied", "unauthenticated"].includes(status.error?.code)) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(recover, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    } else if (status.mode === "synced" || status.mode === "empty") {
      clearTimeout(retryTimer);
      retryDelay = 1000;
    }
  }
  function createCore(uid, characterId) { return CHAPS_CLOUD_CORE({
    store: window.CHAPS_STORE,
    storage: localStorage,
    onStatus: showStatus,
    metadataKey: profiles && uid ? profiles.metadataKey(uid, characterId) : "chaps-cloud-meta-v1",
    remote: {
      async read(uid) {
        const snapshot = await sdk.getDocFromServer(sdk.doc(db, "users", uid, "characters", characterId));
        return snapshot.exists() ? snapshot.data() : null;
      },
      async write(uid, expected, payload) {
        const ref = sdk.doc(db, "users", uid, "characters", characterId);
        return sdk.runTransaction(db, async (tx) => {
          const snapshot = await tx.get(ref);
          const revision = snapshot.exists() ? snapshot.data().revision : 0;
          if (revision !== expected) {
            throw Object.assign(new Error("Personaje cambiado desde otro dispositivo."), { code: "chaps/conflict" });
          }
          if (snapshot.exists()) {
            const old = snapshot.data();
            tx.set(sdk.doc(db, "users", uid, "characters", characterId, "versions", "r" + revision), {
              schema: 1, revision, payload: old.payload, createdAt: sdk.serverTimestamp()
            });
            if (revision > 50) tx.delete(sdk.doc(db, "users", uid, "characters", characterId, "versions", "r" + (revision - 50)));
          }
          const value = { schema: 1, revision: revision + 1, payload, updatedAt: sdk.serverTimestamp() };
          tx.set(ref, value);
          return value;
        });
      }
    }
  }); }
  let cloud = createCore(null, "chaps");
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => cloud.flush(), 500);
  }
  window.CHAPS_CLOUD = {
    changed() { cloud.changed(); },
    // Permite recuperar manualmente copia anterior desde exportación JSON.
    get core() { return cloud; },
    errorText,
    userInfo() {
      const current = auth?.currentUser || user;
      return current ? { uid: current.uid, email: current.email || "", providers: (current.providerData || []).map((entry) => entry.providerId) } : null;
    },
    async login(...args) { await boot(); return account.login(...args); },
    async register(...args) { await boot(); return account.register(...args); },
    async resetPassword(...args) { await boot(); return account.reset(...args); },
    async setPassword(...args) { await boot(); const result = await account.setPassword(...args); user = auth.currentUser; return result; },
    async linkGoogle() { await boot(); const result = await account.linkGoogle(); user = auth.currentUser; return result; },
    async verifyGoogle() { await boot(); return account.verifyGoogle(); },
    selectCharacter: (id) => selectCharacter(id),
    async createCharacter(name, copy) {
      requireUser();
      if (!name.trim() || name.length > 80) throw new Error("Nombre de personaje no válido.");
      if (profiles.catalog(user.uid).length >= 20) throw new Error("Límite: 20 personajes por cuenta.");
      const data = copy ? window.CHAPS_STORE.snapshot() : freshCharacter();
      data.name = name.trim();
      await selectCharacter("c_" + crypto.randomUUID(), data);
    },
    async history() {
      requireUser();
      const id = profiles.current.id;
      const rows = await sdk.getDocs(sdk.query(sdk.collection(db, "users", user.uid, "characters", id, "versions"), sdk.orderBy("revision", "desc"), sdk.limit(50)));
      return rows.docs.map((row) => ({ id: row.id, ...row.data(), date: row.data().createdAt?.toDate?.().toLocaleString("es-MX") || "" }));
    },
    async restore(versionId) {
      requireUser();
      if (typeof combat !== "undefined" && combat.on) throw new Error("Termina combate antes de restaurar ficha.");
      const uid = user.uid, id = profiles.current.id, token = sessionToken;
      await cloud.flush();
      if (token !== sessionToken || user?.uid !== uid) throw new Error("Cuenta o personaje cambió durante restauración.");
      if (cloud.status.mode === "error" || cloud.status.mode === "choose") throw new Error("Resuelve sincronización actual antes de restaurar.");
      const row = await sdk.getDocFromServer(sdk.doc(db, "users", uid, "characters", id, "versions", versionId));
      if (token !== sessionToken || !row.exists()) throw new Error("Versión no disponible para personaje activo.");
      const data = JSON.parse(row.data().payload);
      window.CHAPS_STORE.validate(data); window.CHAPS_STORE.replace(data); saveState(); await cloud.flush();
    }
  };

  function requireUser() { if (!user || !profiles) throw new Error("Inicia sesión para usar personajes e historial."); }
  function messageCharacterError(error) { const node = el("character-status"); if (node) node.textContent = errorText(error); }
  function freshCharacter() {
    const data = window.CHAPS_STORE.defaults();
    Object.assign(data, { level: 1, xp: 0, hpCurrent: 8, hpMax: 8, hpTemp: 0, ac: 10, initiative: 0, hitDiceSpent: 0, deathSuccess: 0, deathFail: 0, inspiration: false, weapons: [], feats: [], inventory: [], journal: [], notes: "", backstory: "" });
    data.identity = { ...data.identity, subclass: "", playerName: "", campaign: "" };
    for (const key of Object.keys(data.abilities)) data.abilities[key] = 10;
    for (const skill of Object.values(data.skills)) { skill.p = false; skill.e = false; }
    for (const tool of Object.values(data.tools)) { tool.p = false; tool.e = false; }
    for (const coin of Object.keys(data.currency)) data.currency[coin] = 0;
    return data;
  }
  async function selectCharacter(id, seed) {
    requireUser();
    if (switching) throw new Error("Espera cambio de personaje actual.");
    if (typeof combat !== "undefined" && combat.on) throw new Error("Termina combate antes de cambiar personaje.");
    const uid = user.uid, token = sessionToken;
    switching = true;
    try {
      await cloud.flush();
      if (user?.uid !== uid || token !== sessionToken) return;
      if (unsubscribe) unsubscribe(); unsubscribe = null;
      const nextToken = ++sessionToken;
      cloud.disconnect();
      profiles.activate(uid, id, seed);
      cloud = createCore(uid, id);
      await cloud.connect(uid);
      if (sessionToken === nextToken && user?.uid === uid) listen(uid, id, nextToken);
    } finally { switching = false; }
  }

  function listen(uid, id = profiles?.current.id || "chaps", token = sessionToken) {
    if (unsubscribe) unsubscribe();
    unsubscribe = sdk.onSnapshot(sdk.doc(db, "users", uid, "characters", id),
      { includeMetadataChanges: true }, (snapshot) => {
        if (user?.uid !== uid || token !== sessionToken) return;
        if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {
          cloud.receive(snapshot.exists() ? snapshot.data() : null);
        }
      }, (error) => {
        if (user?.uid !== uid || token !== sessionToken) return;
        unsubscribe = null; // Escucha terminal: recuperarla en reintento/resume.
        showStatus({ mode: "error", error });
      });
  }
  async function recover() {
    if (!user || recovering || document.visibilityState === "hidden" || !navigator.onLine) return;
    const uid = user.uid, token = sessionToken, current = cloud;
    recovering = true;
    try {
      await current.refresh();
      if (user?.uid === uid && token === sessionToken && !unsubscribe) listen(uid, profiles?.current.id || "chaps", token);
    } finally { recovering = false; }
  }

  async function boot() {
    if (booting) return booting;
    booting = (async () => {
      const base = "https://www.gstatic.com/firebasejs/13.1.0/";
      const [appSDK, authSDK, firestoreSDK] = await Promise.all([
        import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-firestore.js")
      ]);
      sdk = { ...appSDK, ...authSDK, ...firestoreSDK };
      const app = sdk.initializeApp(firebaseConfig);
      auth = sdk.getAuth(app);
      db = sdk.getFirestore(app);
      account = CHAPS_ACCOUNT_AUTH({ sdk, auth });
      sdk.onAuthStateChanged(auth, async (nextUser) => {
        if (unsubscribe) unsubscribe();
        unsubscribe = null;
        if (catalogUnsubscribe) catalogUnsubscribe(); catalogUnsubscribe = null;
        clearTimeout(timer);
        clearTimeout(retryTimer);
        const previousUser = user;
        user = nextUser;
        const token = ++sessionToken;
        cloud.disconnect();
        if (!user) { if (previousUser) window.CHAPS_AUTH.lock(); return; }
        const uid = user.uid;
        if (profiles) profiles.activate(uid, profiles.activeFor(uid));
        cloud = createCore(uid, profiles?.current.id || "chaps");
        window.CHAPS_AUTH.open();
        await cloud.connect(uid);
        if (user?.uid !== uid || token !== sessionToken) return;
        listen(uid);
        catalogUnsubscribe = sdk.onSnapshot(sdk.query(sdk.collection(db, "users", uid, "characters"), sdk.limit(20)), (snapshot) => {
          if (user !== nextUser) return;
          const entries = snapshot.docs.map((row) => {
            try { const data = JSON.parse(row.data().payload); return { id: row.id, name: String(data.name || row.id), level: Number(data.level) || 1 }; }
            catch (_) { return null; }
          }).filter(Boolean);
          profiles?.updateCatalog(uid, entries); window.CHAPS_FEATURES?.render();
        }, (error) => messageCharacterError(error));
      }, (error) => showStatus({ mode: "error", error }));
    })().catch((error) => { booting = null; throw error; });
    return booting;
  }
  async function connect() {
    try {
      // Popup se abre directamente desde gesto cuando SDK ya está preparado.
      if (!auth) await boot();
      await sdk.signInWithPopup(auth, new sdk.GoogleAuthProvider());
    } catch (error) {
      showStatus({ mode: "error", error });
      const gateError = el("login-error");
      if (gateError) gateError.textContent = errorText(error);
    }
  }
  function init() {
    showStatus({ mode: "local" });
    if (!["https:", "http:"].includes(location.protocol)) {
      el("cloud-status").textContent = "Sincronización requiere abrir CHAPS mediante HTTPS o localhost.";
      el("cloud-connect").disabled = true;
      const googleButton = el("login-google");
      if (googleButton) googleButton.disabled = true;
      return;
    }
    el("cloud-connect").addEventListener("click", connect);
    el("login-google")?.addEventListener("click", connect);
    el("cloud-disconnect").addEventListener("click", async () => {
      try { await sdk.signOut(auth); }
      catch (error) { showStatus({ mode: "error", error }); }
    });
    el("cloud-retry").addEventListener("click", recover);
    el("cloud-use-local").addEventListener("click", () => {
      if (confirm("¿Usar ficha de este dispositivo como personaje en nube? Reemplazará versión remota si existe.")) cloud.useLocal();
    });
    el("cloud-use-remote").addEventListener("click", () => {
      if (confirm("¿Descargar personaje de nube y reemplazar ficha visible? Se guardará respaldo local.")) cloud.useCloud();
    });
    window.addEventListener("online", () => { if (user) recover(); else boot().catch((error) => showStatus({ mode: "error", error })); });
    window.addEventListener("focus", recover);
    window.addEventListener("pageshow", recover);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") cloud.flush();
      else recover();
    });
    // Respaldo para conexiones móviles que quedan suspendidas sin evento online.
    setInterval(recover, 20000);
    window.addEventListener("offline", () => { if (user) el("cloud-status").textContent = "Sin conexión · cambios conservados en dispositivo."; });
    window.addEventListener("beforeunload", (event) => {
      if (cloud.status.mode === "pending" || cloud.status.mode === "saving") {
        event.preventDefault(); event.returnValue = "";
      }
    });
    boot().catch((error) => showStatus({ mode: "error", error }));
  }
  document.addEventListener("DOMContentLoaded", init);
})();
