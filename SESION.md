# SESION.md — Estado del proyecto (leer al abrir sesión nueva)

> Este archivo evita re-leer todo el código. Léelo primero y continúa desde aquí.

## Última actualización: 2026-10-29 — v11: versiones diarias y tablero visual

- Usuario confirmó reglas publicadas; versión anterior `91d95f3` se publicó con
  workflow Pages exitoso. GitHub shell no tiene red; usar conexión GitHub disponible.
- Nueva actualización: Cerrar sesión arriba derecha; apartado Notas de partida
  retirado. Notas anteriores siguen editables en Diario; observaciones Mesa van allí.
- Guardar versión de hoy al final de ficha: checkpoint atómico, marcadores privados
  `savedVersions` en payload; conserva snapshots manuales más allá de 50 cambios.
  Historial agrupa por fecha, hora y origen. Restaurar conserva marcadores; duplicar los limpia.
- Tablero: retrato, aros PG, estados, caídos, seleccionar objetivo por ficha, zoom;
  efectos sobreviven render, líneas mantienen ángulo, texturas y movimiento reducido.
- Nuevo CSS `css/combat-visuals.css`; caché `chaps-v11-daily-versions-battlefield`.
- Pruebas: 32 unitarias/funcionales, sincronización con checkpoint y logout,
  navegación seis tamaños, PWA y pruebas visuales en 390/1440. Combate conserva 59 checks.
- No cambian reglas Firebase. Ver bitácora vigente para commit/publicación final.

### Registro anterior (sustituido por v11 y bitácora vigente)

**Estado vigente:** [BITACORA-2026-10-29.md](../BITACORA-2026-10-29.md).

- Usuario autorizó terminar y avisar para probar. Cuenta, personajes, historial,
  Mesa y notas implementados y verificados; caché `chaps-v10-characters-table`.
- Vinculación Google/contraseña conserva UID. Ante `auth/email-already-in-use`,
  actualiza contraseña del usuario actual, recarga y verifica proveedor password.
  No crea cuenta alternativa. Prueba real contra emuladores incluye conservar ficha.
- Pruebas: 30 unitarias/funcionales, 20 navegador (incluye grupos), reglas/Auth en
  emuladores y 59 comprobaciones de combate. Ver bitácora para resultado final.
- CLI producción bloqueado por `EPERM` al leer configuración privada de Firebase.
  Emuladores usan configuración temporal independiente, sin credenciales reales.
- Se pidió usuario publicar reglas desde terminal normal con comando de FIREBASE.md.
  No actualizar GitHub Pages hasta confirmar éxito. Versión online continúa `1a3c5b8`.
- Logs excluidos mediante `.gitignore`. Documentación y versiones de assets actualizadas.

### Registro anterior — 2026-10-28 (histórico; sustituido por estado vigente)

**Leer bitácora de continuación:** [BITACORA-2026-10-28.md](../BITACORA-2026-10-28.md).

### Estado actual que reemplaza notas antiguas de abajo

- Última versión publicada: commit `1a3c5b8`, rama `main`, GitHub Pages `https://anibru300.github.io/chaps-assassin/`.
- Usuario confirmó sincronización Google funcionando entre celular y computadora.
- Ya publicados: tres errores funcionales corregidos, sincronización/reconexión/conflictos, retirada de botones JSON y navegación móvil/tablet/escritorio con búsqueda y accesibilidad.
- Firebase: proyecto `chaps-58e61`; dominio autorizado `anibru300.github.io`; personaje original `users/{uid}/characters/chaps`.
- **Hay cambios sin commit y sin publicar:** cuenta con correo/contraseña vinculada, varios personajes, historial, Mesa y notas de partida.
- Nuevos módulos: `js/profile-store.js`, `js/account-auth.js`, `js/features.js`; estilos `css/features.css`.
- Nuevas pruebas: `tests/profiles.test.js`, `tests/auth-link.test.js`; reglas y prueba de reglas ampliadas.
- Último unitario: **28 pruebas pasan**. Reglas: seis escenarios pasan en emulador.
- **Bloqueo de prueba:** `tests/auth-link.test.js` falla con `auth/email-already-in-use` al vincular contraseña a cuenta Google simulada. Diagnóstico pendiente.
- Pruebas Playwright antiguas aún necesitan fixtures multicaracter/historial/Auth; nuevas funciones no verificadas en navegador.
- CLI Firebase sin sesión; se pidió al usuario `firebase login`, todavía sin confirmación al pausar.
- Reglas nuevas solo locales. **No publicar frontend hasta validar y publicar reglas compatibles**, o historial bloqueará transacciones de guardado.
- Falta actualizar caché `sw.js` (sigue v9) y versiones de JS modificados; añadir scripts/CSS nuevos al precaché.
- `firebase-debug.log` generado por CLI aparece sin seguimiento: no añadir a Git ni publicar.
- Usuario pidió pausa/documentación; no continuar implementación hasta que retome.

### Notas históricas previas (2026-08-16; pueden estar desactualizadas)

## Qué es
Ficha web de CHAPS (Pícaro Asesino N12, D&D 2024, Dragonlance). Sitio estático: `index.html` + JS plano (sin módulos). Estado en localStorage (`chaps-state-v1`), export/import JSON.

## Tabs actuales
1. **Ficha** — identidad, PX, atributos (+salvaciones con toggle), habilidades, herramientas, **idiomas** (chips), **competencias** (chips), armas, maestría, dotes, progresión, **inventario con peso/capacidad (FUE×15)**, monedas+conversor, diario, importar PCGen, export/import. **Nuevo: sidebar de secciones en desktop y navegación flotante en móvil.**
2. **Combos** — guía + rodillos de daño + tabla rasgos.
3. **Combate** — motor completo (tablero 12x8, IA 4 dificultades, catálogo enemigos, Golpes Astutos) + referencia de condiciones. **Nuevo: barra de acciones táctil, log colapsable.**
4. **Biblioteca** — SRD 2024 vía Open5e. **Nuevo: detalle en modal, botones para añadir monstruos al combate y armas a la ficha.**

## Hecho recientemente
- ✅ Login con fondo `_login5.png` (`assets/login-bg.png`).
- ✅ Sidebar de secciones en la ficha (desktop) + botón flotente en móvil.
- ✅ Mobile-first: grids 1 col, tablas con scroll, inputs 16 px, botones táctiles ≥ 44 px.
- ✅ Header con botones rápidos de exportar/importar JSON.
- ✅ Combate: barra de acciones con iconos, log colapsable, panel de ataque destacado, animaciones de impacto, tracker vertical, sugerencias contextuales, selector de estrategia enemiga, simulador Monte Carlo, resumen post-combate.
- ✅ PWA básica: `manifest.json`, `sw.js`, iconos 192/512 y botón "Instalar aplicación".
- ✅ Biblioteca: detalle en modal, "Añadir como enemigo" y "Añadir a armas".
- ❌ Tab "Simulador" ELIMINADA (HTML+JS). Helpers conservados en app.js: `dexMod`, `saveDC`, `maxCunningStrikes` (los usa combat.js).
- ✅ Idiomas, competencias, inventario, salvaciones (state: `languages`, `proficiencies`, `inventory`, `saveProfs`).
- ✅ Login: `js/auth.js`, gate `#login-gate`, hash SHA-256, sesión por pestaña (sessionStorage `chaps-auth-v1`).

## Pendiente / ideas
- Inventario con catálogo desplegable (ref-data/items.json existe en carpeta padre).
- ~~Idiomas elegidos~~ ✅ Común, Jerga de ladrones, Dracónido, Orco.
- ~~Sincronizar chaps-ficha.json~~ ✅ hecho (2026-08-15).
- Pasiva editable: `passiveManual` en state (null=auto). Auto de CHAPS = 12 (sin competencia Percepción).
- Pendiente DM: PG 111, 3 dotes faltantes N12, PX=N13, 7 skills (regla 6), velocidad 40?, moneda "st" inválida.
- Posible Fase 6 combate (Vex/Nick ya empezado en combat.js, sin commitear antes).

## Reglas clave
- **CAVEMAN ULTRA SIEMPRE** (ver AGENTS.md).
- Tests: `node tests/combat.test.js` (37 tests, deben pasar).
- i18n todo: claves en data.js (es/en).
- Commit style: Conventional Commits, cuerpo breve.
