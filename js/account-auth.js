"use strict";
globalThis.CHAPS_ACCOUNT_AUTH = function ({ sdk, auth }) {
  const email = (value) => String(value || "").trim();
  function password(value, repeat) {
    if (typeof value !== "string" || value.length < 8) throw new Error("Contraseña: mínimo 8 caracteres.");
    if (value !== repeat) throw new Error("Contraseñas no coinciden.");
  }
  const current = () => {
    if (!auth.currentUser) throw new Error("Inicia sesión primero.");
    return auth.currentUser;
  };
  return {
    async login(address, secret) { return sdk.signInWithEmailAndPassword(auth, email(address), secret); },
    async register(address, secret, repeat, alias) {
      password(secret, repeat);
      const result = await sdk.createUserWithEmailAndPassword(auth, email(address), secret);
      if (String(alias || "").trim()) await sdk.updateProfile(result.user, { displayName: String(alias).trim().slice(0, 80) });
      return result;
    },
    async setPassword(secret, repeat, oldSecret) {
      password(secret, repeat);
      const user = current();
      if (!user.email) throw new Error("Cuenta sin correo asociado.");
      const credential = sdk.EmailAuthProvider.credential(user.email, secret);
      if ((user.providerData || []).some((provider) => provider.providerId === "password")) {
        if (oldSecret) await sdk.reauthenticateWithCredential(user, sdk.EmailAuthProvider.credential(user.email, oldSecret));
        await sdk.updatePassword(user, secret);
      } else {
        try { await sdk.linkWithCredential(user, credential); }
        catch (error) {
          // Algunos servidores/emuladores rechazan signUp de un correo que ya
          // pertenece al mismo usuario. Actualizar su contraseña conserva UID.
          if (error.code !== "auth/email-already-in-use" || auth.currentUser?.uid !== user.uid) throw error;
          await sdk.updatePassword(user, secret);
          await sdk.reload(user);
          if (!(user.providerData || []).some((provider) => provider.providerId === "password")) throw error;
        }
      }
      return user;
    },
    async linkGoogle() { return sdk.linkWithPopup(current(), new sdk.GoogleAuthProvider()); },
    async verifyGoogle() { return sdk.reauthenticateWithPopup(current(), new sdk.GoogleAuthProvider()); },
    async reset(address) {
      if (!email(address)) throw new Error("Escribe tu correo primero.");
      await sdk.sendPasswordResetEmail(auth, email(address));
    }
  };
};
