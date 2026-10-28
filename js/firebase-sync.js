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
    if (code.includes("operation-not-allowed")) return "Habilita Google en Firebase → Authentication.";
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
  const cloud = CHAPS_CLOUD_CORE({
    store: window.CHAPS_STORE,
    storage: localStorage,
    onStatus: showStatus,
    remote: {
      async read(uid) {
        const snapshot = await sdk.getDocFromServer(sdk.doc(db, "users", uid, "characters", "chaps"));
        return snapshot.exists() ? snapshot.data() : null;
      },
      async write(uid, expected, payload) {
        const ref = sdk.doc(db, "users", uid, "characters", "chaps");
        return sdk.runTransaction(db, async (tx) => {
          const snapshot = await tx.get(ref);
          const revision = snapshot.exists() ? snapshot.data().revision : 0;
          if (revision !== expected) {
            throw Object.assign(new Error("Personaje cambiado desde otro dispositivo."), { code: "chaps/conflict" });
          }
          const value = { schema: 1, revision: revision + 1, payload, updatedAt: sdk.serverTimestamp() };
          tx.set(ref, value);
          return value;
        });
      }
    }
  });
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => cloud.flush(), 500);
  }
  window.CHAPS_CLOUD = {
    changed() { cloud.changed(); },
    // Permite recuperar manualmente copia anterior desde exportación JSON.
    core: cloud
  };

  function listen(uid) {
    if (unsubscribe) unsubscribe();
    unsubscribe = sdk.onSnapshot(sdk.doc(db, "users", uid, "characters", "chaps"),
      { includeMetadataChanges: true }, (snapshot) => {
        if (user?.uid !== uid) return;
        if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {
          cloud.receive(snapshot.exists() ? snapshot.data() : null);
        }
      }, (error) => {
        if (user?.uid !== uid) return;
        unsubscribe = null; // Escucha terminal: recuperarla en reintento/resume.
        showStatus({ mode: "error", error });
      });
  }
  async function recover() {
    if (!user || recovering || document.visibilityState === "hidden" || !navigator.onLine) return;
    const uid = user.uid;
    recovering = true;
    try {
      await cloud.refresh();
      if (user?.uid === uid && !unsubscribe) listen(uid);
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
      sdk.onAuthStateChanged(auth, async (nextUser) => {
        if (unsubscribe) unsubscribe();
        unsubscribe = null;
        clearTimeout(timer);
        clearTimeout(retryTimer);
        user = nextUser;
        cloud.disconnect();
        if (!user) return;
        const uid = user.uid;
        window.CHAPS_AUTH.open();
        await cloud.connect(uid);
        if (user?.uid !== uid) return;
        listen(uid);
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
