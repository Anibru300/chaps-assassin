# SESION.md — Estado del proyecto (leer al abrir sesión nueva)

> Este archivo evita re-leer todo el código. Léelo primero y continúa desde aquí.

## Última actualización: 2026-08-15

## Qué es
Ficha web de CHAPS (Pícaro Asesino N12, D&D 2024, Dragonlance). Sitio estático: `index.html` + JS plano (sin módulos). Estado en localStorage (`chaps-state-v1`), export/import JSON.

## Tabs actuales
1. **Ficha** — identidad, PX, atributos (+salvaciones con toggle), habilidades, herramientas, **idiomas** (chips), **competencias** (chips), armas, maestría, dotes, progresión, **inventario con peso/capacidad (FUE×15)**, monedas+conversor, diario, importar PCGen, export/import.
2. **Combos** — guía + rodillos de daño + tabla rasgos.
3. **Combate** — motor completo (tablero 12x8, IA 4 dificultades, catálogo enemigos, Golpes Astutos) + referencia de condiciones.

## Hecho recientemente
- ❌ Tab "Simulador" ELIMINADA (HTML+JS). Helpers conservados en app.js: `dexMod`, `saveDC`, `maxCunningStrikes` (los usa combat.js).
- ✅ Idiomas, competencias, inventario, salvaciones (state: `languages`, `proficiencies`, `inventory`, `saveProfs`).
- ✅ Login: `js/auth.js`, gate `#login-gate`, hash SHA-256, sesión por pestaña (sessionStorage `chaps-auth-v1`).

## Pendiente / ideas
- Inventario con catálogo desplegable (ref-data/items.json existe en carpeta padre).
- Idiomas elegidos reales de CHAPS (usuario debe decir cuáles: +1 Humano, +1 Jerga).
- Sincronizar chaps-ficha.json (carpeta padre) con nuevos campos.
- Posible Fase 6 combate (Vex/Nick ya empezado en combat.js, sin commitear antes).

## Reglas clave
- **CAVEMAN ULTRA SIEMPRE** (ver AGENTS.md).
- Tests: `node tests/combat.test.js` (37 tests, deben pasar).
- i18n todo: claves en data.js (es/en).
- Commit style: Conventional Commits, cuerpo breve.
