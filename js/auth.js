/* ============================================================
   auth.js — Puerta de acceso (protección casual, sitio estático)
   La contraseña NUNCA se guarda en texto plano: solo hash SHA-256.
   ============================================================ */
(function () {
  const EXPECTED = "13d07947ff1d032dbe82cf7a868c19517604fe1e7facfb83e40b29d655748901"; // SHA-256 de "usuario:contraseña"
  const KEY = "chaps-auth-v1";

  function sha256(str) {
    const data = new TextEncoder().encode(str);
    return crypto.subtle.digest("SHA-256", data).then((buf) =>
      Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join(""));
  }

  function open() {
    sessionStorage.setItem(KEY, "1");
    const gate = document.getElementById("login-gate");
    if (gate) gate.remove();
    document.body.classList.remove("locked");
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (sessionStorage.getItem(KEY) === "1") { open(); return; }
    document.body.classList.add("locked");
    const form = document.getElementById("login-form");
    const err = document.getElementById("login-error");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const u = document.getElementById("login-user").value.trim();
      const p = document.getElementById("login-pass").value;
      sha256(u + ":" + p).then((h) => {
        if (h === EXPECTED) open();
        else {
          err.textContent = "Usuario o contraseña incorrectos";
          form.reset();
          document.getElementById("login-user").focus();
        }
      });
    });
  });
})();
