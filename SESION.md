# SESION.md — Estado del proyecto (leer al abrir sesión nueva)

> Este archivo evita re-leer todo el código. Léelo primero y continúa desde aquí.

## Última actualización: 2026-08-16

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
- ✅ Combate: barra de acciones con iconos, log colapsable, panel de ataque destacado.
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
