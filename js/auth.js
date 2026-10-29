/* ============================================================
   auth.js — Interfaz de acceso; credenciales verificadas por Firebase.
   ============================================================ */
(function () {
  const KEY = "chaps-auth-v1";

  function open() {
    sessionStorage.setItem(KEY, "1");
    const gate = document.getElementById("login-gate");
    if (gate) gate.hidden = true;
    document.body.classList.remove("locked");
  }

  function lock() {
    sessionStorage.removeItem(KEY);
    const gate = document.getElementById("login-gate");
    if (gate) gate.hidden = false;
    document.body.classList.add("locked");
  }
  window.CHAPS_AUTH = { open, lock };

  document.addEventListener("DOMContentLoaded", () => {
    if (sessionStorage.getItem(KEY) === "1") open(); else document.body.classList.add("locked");
    const form = document.getElementById("login-form");
    const err = document.getElementById("login-error");
    let register = false;
    document.getElementById("auth-switch").addEventListener("click", () => {
      register = !register;
      document.getElementById("auth-register-fields").hidden = !register;
      document.getElementById("auth-confirm").required = register;
      document.getElementById("auth-submit").textContent = register ? "Crear cuenta" : "Entrar";
      document.getElementById("auth-switch").textContent = register ? "Ya tengo cuenta" : "Crear cuenta con correo";
      document.getElementById("login-pass").autocomplete = register ? "new-password" : "current-password";
      err.textContent = "";
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const button = document.getElementById("auth-submit");
      button.disabled = true;
      try {
        const service = window.CHAPS_CLOUD;
        if (!service) throw new Error("Espera a que cargue conexión de cuenta.");
        const email = document.getElementById("login-user").value.trim();
        const secret = document.getElementById("login-pass").value;
        if (register) await service.register(email, secret, document.getElementById("auth-confirm").value, document.getElementById("auth-alias").value);
        else await service.login(email, secret);
        form.reset();
      } catch (error) { err.textContent = window.CHAPS_CLOUD?.errorText(error) || error.message; }
      finally { button.disabled = false; }
    });
    document.getElementById("auth-forgot").addEventListener("click", async () => {
      try {
        await window.CHAPS_CLOUD.resetPassword(document.getElementById("login-user").value);
        err.textContent = "Si correo tiene cuenta, recibirás instrucciones de recuperación.";
      } catch (error) { err.textContent = window.CHAPS_CLOUD?.errorText(error) || error.message; }
    });
  });
})();
