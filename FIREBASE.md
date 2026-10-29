# CHAPS — Firebase

Proyecto: `chaps-58e61`. App sin compilación: SDK modular por CDN, cargado desde
`js/firebase-sync.js`. No hace falta ejecutar `npm install firebase` en CHAPS.

## Configuración y publicación

1. Firebase → Authentication → Método de acceso → Google y Correo/contraseña → Habilitar.
   Seleccionar correo de asistencia y guardar.
2. Firestore Database → Reglas: copiar contenido completo de `firestore.rules`
   y pulsar **Publicar**. Solo cada usuario autenticado puede leer/escribir
   `users/SU_UID/characters/ID` y su historial `versions`. No usar reglas abiertas de modo prueba.
3. Authentication → Configuración → Dominios autorizados: añadir dominio donde
   se publique CHAPS. Para pruebas locales añadir `localhost` si no aparece.
4. Abrir aplicación mediante HTTPS o servidor local; `file://` conserva ficha
   local, pero no permite conectar Firebase.

## Publicar reglas antes de actualizar GitHub Pages

App publicada en GitHub Pages: https://anibru300.github.io/chaps-assassin/.
Reglas nuevas deben estar publicadas antes de actualizar frontend: guardado
archiva versión previa en misma transacción y requiere permisos de historial.

Desde `chaps-assassin/`, con Firebase CLI instalado:

```powershell
firebase login
firebase deploy --only firestore:rules,firestore:indexes --project chaps-58e61
```

Este comando publica solo reglas e índices; alojamiento continúa en GitHub Pages.
Después de completar despliegue, publicar commit probado en `main`.

## Cuenta, personajes e historial

- Para conservar CHAPS: entrar primero con Google, abrir **Ficha → Cuenta** y
  guardar contraseña. Después usar mismo correo con contraseña en otro dispositivo.
- No registrar cuenta nueva para personaje existente. Vinculación usa usuario
  Firebase actual; si servidor rechaza correo propio, actualiza contraseña de ese
  mismo usuario y verifica proveedor, conservando UID.
- Cuenta existente con contraseña: campo contraseña actual permite verificar
  sesión antes de cambiarla; Google puede verificarse desde mismo panel.
- Personaje original mantiene ID `chaps`. Crear personaje genera ficha de pícaro
  nivel 1; duplicar copia ficha completa. Máximo 20 personajes en interfaz.
- Cada cuenta/personaje tiene ficha local, respaldo y metadatos independientes.
  Cambios offline permanecen pendientes al alternar. Combate activo bloquea cambio.
- Historial conserva últimos 50 cambios automáticos y versiones manuales marcadas
  desde **Guardar versión de hoy**, al final de ficha. Agrupa por fecha y hora.
  Versiones manuales no caducan al superar 50 cambios; restaurar conserva marcadores.
  Guardado manual requiere conexión y sincronización resuelta. No requiere reglas nuevas.
  Marcadores viajan en payload privado; duplicar personaje no copia marcadores ajenos.
- Mesa comparte PG, inspiración y descansos con ficha. Condiciones manuales no
  modifican simulador de combate. Observaciones van a Diario de aventuras existente;
  notas anteriores permanecen editables dentro del mismo diario.
- Motor sigue especializado en Pícaro Asesino; no construye otras clases.

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
  de nube conserva respaldo original interno por cuenta/personaje.
- Reglas limitan documento a payload de menos de 700,000 caracteres; personajes
  con diarios muy extensos podrían requerir dividir datos en futura versión.

## Pruebas locales

```powershell
node tests/combat.test.js
node --test tests/functional.test.js tests/cloud.test.js tests/profiles.test.js
```

Pruebas de sincronización utilizan almacenamiento remoto simulado. No requieren
cuenta ni modifican personaje real. Validación Google/dispositivos reales requiere
Google habilitado, reglas publicadas y dominio autorizado.

Prueba de dos navegadores aislados, con transporte Firebase simulado y perfiles
de escritorio/móvil (Playwright instalado aparte):

```powershell
$env:CHAPS_PLAYWRIGHT = "RUTA/AL/PAQUETE/playwright"
node --test tests/browser-sync.test.js tests/navigation.test.js tests/pwa.test.js tests/battlefield.test.js
```

`tests/firestore-rules.test.js` comprueba reglas con emulador (sin producción).
Necesita Firebase CLI, Java 21+ y paquetes de desarrollo `firebase` y
`@firebase/rules-unit-testing`. Pueden instalarse en carpeta temporal; indicar
ruta de su `node_modules` mediante variable `CHAPS_TEST_MODULES`.

```powershell
firebase emulators:exec --only auth,firestore --project demo-chaps "node --test tests/firestore-rules.test.js tests/auth-link.test.js"
```

Sin `FIRESTORE_EMULATOR_HOST`, esa prueba se omite intencionalmente. Durante esta
sesión también se ejecutó contra emulador: propietario permitido, visitantes y
otras cuentas bloqueados, revisión consecutiva y formato exigidos.

Documentación oficial:
- https://firebase.google.com/docs/web/alt-setup
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://firebase.google.com/docs/firestore/security/rules-conditions
