# CHAPS — Firebase

Proyecto: `chaps-58e61`. App sin compilación: SDK modular por CDN, cargado desde
`js/firebase-sync.js`. No hace falta ejecutar `npm install firebase` en CHAPS.

## Consola: pasos pendientes

1. Firebase → Authentication → Método de acceso → Google → Habilitar.
   Seleccionar correo de asistencia y guardar.
2. Firestore Database → Reglas: copiar contenido completo de `firestore.rules`
   y pulsar **Publicar**. Solo cada usuario autenticado puede leer/escribir
   `users/SU_UID/characters/chaps`. No usar reglas abiertas de modo prueba.
3. Authentication → Configuración → Dominios autorizados: añadir dominio donde
   se publique CHAPS. Para pruebas locales añadir `localhost` si no aparece.
4. Abrir aplicación mediante HTTPS o servidor local; `file://` conserva ficha
   local, pero no permite conectar Firebase.

## Publicar con Firebase Hosting

Si ya se publica en GitHub Pages, puede conservarse ese alojamiento y autorizar
su dominio en Authentication. Firebase Hosting es opcional.

Desde `chaps-assassin/`, con Firebase CLI instalado:

```powershell
firebase login
firebase deploy --only firestore:rules,firestore:indexes,hosting --project chaps-58e61
```

`firebase.json` y `.firebaserc` están preparados. El despliegue publicará app
estática en `https://chaps-58e61.web.app` si se conserva sitio Hosting por defecto.
No se ha desplegado ni modificado configuración remota desde esta sesión.

## Migrar personaje sin perder datos

1. Abrir primero dispositivo que tiene ficha correcta.
2. Abrir versión actualizada e iniciar sesión con Google.
3. Revisar ficha visible antes de vincular cuenta por primera vez.
4. Vinculación automática: si nube está vacía y existe ficha guardada localmente,
   se sube esa ficha. Si existe personaje en nube, se descarga con respaldo previo.
   Navegador nuevo sin ficha ni nube espera primer cambio para crear personaje.
5. Esperar mensaje **Personaje sincronizado · actualizaciones automáticas entre dispositivos**.
6. En teléfono u otra computadora, abrir misma URL e iniciar sesión con misma
   cuenta Google. Si no había ficha local, descargará automáticamente.
7. Si ya había datos locales sin vinculación, se enlaza nube automáticamente.
   Primera copia reemplazada se conserva internamente en `chaps-state-before-cloud-v1`.
   Actualizaciones posteriores no sobrescriben ese respaldo original. Controles
   JSON retirados de interfaz: sincronización es automática.

## Comportamiento

- Sincroniza ficha completa exportable: atributos, PG, inventario, monedas,
  dotes, diario, historia, etc. No sincroniza combate en curso, idioma ni caché SRD.
- Guarda primero en navegador; espera 0.5 segundos sin nuevas ediciones antes
  de subir, reduciendo escrituras.
- Cambios remotos llegan mediante escucha Firestore. Las actualizaciones se
  comprueban con revisión atómica. Ediciones simultáneas de campos distintos se
  combinan automáticamente; valores incompatibles del mismo campo requieren elegir.
- Sin internet conserva datos pendientes y reintenta al reconectar/recargar.
  Primera conexión Google y primera descarga del SDK necesitan internet.
- Al volver a teléfono/pestaña vuelve a consultar nube. Una escucha terminada se
  recupera con reintentos; consulta de respaldo cada 20 segundos mientras esté visible.
- Cambiar de cuenta no sube automáticamente datos de cuenta anterior.
- Desconectar Google detiene sincronización, pero conserva copia local: en
  computadora compartida esa copia sigue accesible mediante acceso local.
- Reemplazo explícito por ficha local conserva copia visible; primera descarga
  de nube conserva respaldo original descargable.
- Reglas limitan documento a payload de menos de 700,000 caracteres; personajes
  con diarios muy extensos podrían requerir dividir datos en futura versión.

## Pruebas locales

```powershell
node tests/combat.test.js
node --test tests/functional.test.js tests/cloud.test.js
```

Pruebas de sincronización utilizan almacenamiento remoto simulado. No requieren
cuenta ni modifican personaje real. Validación Google/dispositivos reales requiere
Google habilitado, reglas publicadas y dominio autorizado.

Prueba de dos navegadores aislados, con transporte Firebase simulado y perfiles
de escritorio/móvil (Playwright instalado aparte):

```powershell
$env:CHAPS_PLAYWRIGHT = "RUTA/AL/PAQUETE/playwright"
node --test tests/browser-sync.test.js tests/navigation.test.js
```

`tests/firestore-rules.test.js` comprueba reglas con emulador (sin producción).
Necesita Firebase CLI, Java 21+ y paquetes de desarrollo `firebase` y
`@firebase/rules-unit-testing`. Pueden instalarse en carpeta temporal; indicar
ruta de su `node_modules` mediante variable `CHAPS_TEST_MODULES`.

```powershell
firebase emulators:exec --only firestore --project demo-chaps "node --test tests/firestore-rules.test.js"
```

Sin `FIRESTORE_EMULATOR_HOST`, esa prueba se omite intencionalmente. Durante esta
sesión también se ejecutó contra emulador: propietario permitido, visitantes y
otras cuentas bloqueados, revisión consecutiva y formato exigidos.

Documentación oficial:
- https://firebase.google.com/docs/web/alt-setup
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://firebase.google.com/docs/firestore/security/rules-conditions
