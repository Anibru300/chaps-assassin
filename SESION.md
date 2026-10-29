# SESION.md — Estado del proyecto (leer al abrir sesión nueva)

> Este archivo evita re-leer todo el código. Léelo primero y continúa desde aquí.

## Actualización: 2026-10-29 — v17: plataforma general de personajes

- Usuario pidió implementación multiusuario completa; continúa autorización de publicar cambios de plataforma.
- Inicio neutral, asistente tres pasos para doce clases, orígenes gratuitos/personalizados, reparto/compra/manual y validaciones. Ficha creada es base; elecciones especiales/niveles altos pendientes se señalan explícitamente.
- Módulos `character-rules`, `character-builder`, `character-equipment`, `character-magic`; CSS y avatar neutral SVG.
- Creación valida datos, guarda por UID/personaje y confirma sincronización. Cuenta nueva no adopta ficha sin dueño; respaldo local conservado. Otro dispositivo recupera primer personaje real.
- Armas usan FUE/DES y competencia propia; nueva tienda compra/equipa sin regalar oro y equipo simultáneos. Descansos usan dado de clase; magia de pacto recupera espacios al finalizar descanso corto.
- Furtivo/Asesino/Esquiva y acciones astutas requieren clase/nivel. Ataques extra por clase, salvaciones propias; progresión por clase. CHAPS previo conserva valores manuales.
- Conjuros/espacios y recursos editables; siete conjuros rápidos con resolución básica. Efectos especiales y opciones no automatizadas se indican como mesa/DM; no multiclase.
- Precaché `chaps-v17-character-platform`. Nuevas pruebas de reglas, combate, asistente 360/1440, cuentas/dispositivos y PWA offline.
- Documento técnico: `PLATAFORMA.md`. Ver bitácora raíz para resultado final y despliegue. No publicar antes de completar comprobación.
- Validación final: 106 pruebas, 104 pasan, 0 fallan, 2 omitidas (emuladores Firebase ausentes); 59 checks de motor pasan. Veinte scripts JS con sintaxis válida; diff correcto. Capturas 360/1440 revisadas.

## Actualización: 2026-10-29 — v16: correcciones de auditoría de ficha

- Usuario autorizó corregir, comprobar y desplegar seis fallos confirmados.
- Descanso corto abre diálogo accesible para gastar d8 de uno en uno: CON, mínimo 1 PG, límite PG máximos, bloqueo sin dados o con 0 PG. Cerrar sin gastar conserva recursos.
- Descanso largo recupera todos los dados 2024; no comienza con 0 PG.
- DES actualiza ataque mostrado y combos; competencia/pericia actualiza pasiva. PX actualiza todos los derivados de nivel. Ajustes manuales conservados.
- Características rechazan vacíos, decimales y valores fuera de 1–30.
- Caché `chaps-v16-sheet-audit-fixes`; app v10, data v7, CSS v5.
- Pruebas nuevas `tests/sheet.test.js` con 360/1440px; PWA prueba descansos offline. Ver bitácora de raíz para validación y publicación final.
- Validación: 82 pruebas, 80 pasan, 0 fallan, 2 omitidas por falta de emuladores Firebase. Motor pasa; sintaxis y diff correctos.
- No modificar datos personales dudosos del archivo local como si fueran ficha sincronizada actual.

## Actualización: 2026-10-29 — v15: icono CHAPS

- Retrato CHAPS adaptado con imagegen; iconos Android 192/512, maskable 512, iPhone 180 y favicon 48.
- Caché v15 incluye todos los iconos para uso offline. Identidad de instalación conservada.
- Prueba PWA verifica tamaños reales, precaché y funcionamiento offline.

## Última actualización: 2026-10-29 — v14: movimiento inmediato y tirada interactiva

- Usuario pidió quitar confirmación de movimiento; Mover + clic/toque en casilla
  ejecuta ruta directamente. Enter/Espacio también. Hover solo previsualiza.
  Se retiraron botón, referencias y ayuda de confirmación; conserva costes/AdO/terreno.
- Usuario reportó bloqueo de Ocultar después de ataque y pidió dados visibles a derecha.
  Atacar mantiene adicional independiente; nuevo indicador explica recurso disponible,
  Puntería/Extra ya gastados o combate terminado. Ocultar usa adicional, no reacción.
- Corrección real: Extra consumía adicional antes de validar alcance/visión; ahora
  consume solo al resolver tirada. Preparación inválida conserva modo Extra y recursos.
- Nuevo `js/combat-rolls.js`: presenta datos estructurados emitidos por motor,
  d20/ventaja, DES+competencia, total/CA, resultado y daño/PG. Sin nuevas tiradas
  para animación y sin bloquear adicionales. Incluye acceso a Ocultar y resultado Sigilo.
- `lastBonus` en combatiente local explica coste; se reinicia al comenzar turno.
  Dados conservan resultado visible tras derrotar último enemigo. Respeta movimiento reducido.
- Caché `chaps-v14-instant-move-rolls`: motor v12, tools v3, help/layout v2,
  data v6, módulo rolls v1. Nuevo módulo precacheado.
- Prueba nueva `tests/combat-rolls.test.js`: móvil/escritorio, sumas/daño reales,
  sin reroll, Atacar→Ocultar, Puntería agotada, fallo, crítico, fin y Extra inválido.
- Ver bitácora para validación final y publicación.

### Registro anterior — v13 (histórico)

- Usuario pidió mapa izquierda, atacar/tirar derecha sin perder mapa y ayuda de
  botones/reglas/recursos (propuesta general #6).
- Nueva estructura `.battle-workspace`: mapa y consola lateral desde 900px;
  paneles sticky con scroll independiente. Móvil: acciones fijas y tirada inferior
  compacta, mapa adaptado a altura disponible. Inicio/retomar centra zona de combate.
- Curación, Golpes Astutos, iniciativa y leyenda plegables. Tirada antes de opciones
  secundarias. Ficha táctica abre al seleccionar combatiente.
- Nuevo `js/combat-help.js`, CSS `css/combat-layout.css`: ayuda contextual, modal
  accesible con recursos reales y enlaces oficiales. Abrir ayuda pausa enemigos;
  cerrar recupera estado anterior sin consumir acciones/PG/movimiento.
- Ruta elegida queda fijada al tocar/clicar: hover posterior no cambia destino
  mientras usuario llega a botón Confirmar movimiento (regresión detectada por test).
- Caché `chaps-v13-combat-console-help`; motor v11, combat-tools v2, ayuda/layout v1.
- Prueba `tests/combat-layout.test.js`: cinco pantallas, mapa/tirada juntos, página
  no se desplaza al atacar en escritorio, móvil sin solapamiento, ayuda sin gasto.
- Ver bitácora para pruebas finales y commit/despliegue.

### Registro anterior — v12 (histórico)

- Usuario pidió implementar ocho mejoras: rutas, alcance, ficha ampliada, efectos,
  turnos pausables, escenarios, guardar/retomar combate y resumen táctico.
- Nuevo `js/combat-tools.js` se carga después de motor y antes de simulador.
  Core mantiene fallback síncrono sin módulo y durante `combat.quiet`.
- `movementPath` usa coste mínimo compatible con terreno/ocupación. Movimiento
  recorre casillas, aplica peligros y AdO en trayecto; UI exige confirmar ruta.
- Rango por arma y visión; inspector accesible con ataques/hechizos/usos y cobertura.
- Efectos por arma/conjuro, aliento, veneno, terreno y curación externa registrada.
- IA diferida con velocidad, pausa/paso y cancelación por generación/turno/sesión.
  Pestaña oculta pausa; guardado recuperado empieza pausado, sin reiniciar acciones.
- Escenarios: emboscada, escape por este, defender aliado, sobrevivir cinco rondas
  completas. Defensa tiene PG y ataques reales al aliado; condiciones y terreno activos.
- Guardado local v1 por UID/personaje: mapa, actores, orden/turno, recursos,
  condiciones, escenario y métricas. Valida formato/ficha; no sincroniza por nube.
  Cambio de identidad limpia combate visible. Guardado offline probado en PWA.
- Telemetría de daño efectivo, críticos, reacciones, acciones, Furtivo y costes;
  simulación masiva excluye escenarios y conserva estado/estadísticas reales.
- Caché `chaps-v12-tactical-combat`; `combat.js?v=10`, CSS visual v2 y módulo nuevo v1.
- Nuevas pruebas integrales `tests/combat-tools.test.js`; ver bitácora para
  resultado final, commit publicado y estado de despliegue.

### Registro anterior — v11 (histórico)

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
