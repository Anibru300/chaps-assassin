# Plataforma de personajes — v17

## Qué puede hacer cada usuario

Acceso con Google o correo vinculado. Cada UID mantiene catálogo propio, fichas, diario, versiones y cambios pendientes. Crear personaje abre asistente de tres pasos, valida antes de guardar y confirma si quedó sincronizado o solo local.

Incluye las 12 clases de 2024, nueve especies de reglas gratuitas, cuatro trasfondos gratuitos y opciones personalizadas. Una clase por personaje; niveles 1–20. No incluye multiclase ni contenido completo de todos los libros.

El asistente prepara una **ficha base**. Desde niveles altos, revisar elecciones anteriores (dotes/ASI, subclase, idiomas, competencias, pericias y conjuros). Instrumentos, herramientas elegibles, linajes, resistencias y rasgos especiales se completan en ficha con referencia oficial. No se declaran automáticamente resueltas elecciones que requieren DM.

## Creación y reglas

- Nombre, clase, nivel, subclase desde N3, especie, trasfondo, jugador y campaña.
- Reparto estándar, compra de hasta 27 puntos o valores acordados; aumentos de trasfondo +2/+1 o +1/+1/+1, máximo 20.
- Competencias iniciales de clase/trasfondo/especie sin duplicados; pericia inicial de Pícaro; dote adicional humana. Otros rasgos de niveles superiores se registran manualmente.
- Dados de golpe, PG fijos iniciales y por nivel, salvaciones básicas, iniciativa con Alerta, velocidad y defensa sin armadura de Bárbaro/Monje.
- Oro inicial de clase +50 po del trasfondo; no se regala simultáneamente paquete de equipo. Golpe desarmado disponible sin comprar arma.
- Tienda de armas, armaduras, escudos y equipo mágico básico: descuenta monedas, añade inventario y permite equipar armaduras. Costes en po; cambio a oro/plata/cobre; acero equivale a oro para campaña Dragonlance.
- FUE/DES y competencia se calculan por arma. Competencia puede ajustarse explícitamente por dote, entrenamiento u otra fuente. Daño recién añadido usa característica automática; edición del daño convierte ese bono en manual.
- Fichas nuevas mantienen PG fijos, iniciativa, velocidad y CA automáticos al cambiar atributos o PX. Editar esos valores directamente conserva ajuste manual. Fichas existentes CHAPS mantienen valores originales.

## Magia y recursos

Espacios calculados para lanzadores completos, Paladín/Explorador y magia de pacto. Conjuros y preparados propios por personaje. Recursos configurables de clase/especie, con recuperación corta o larga; rasgos con recuperación parcial se ajustan manualmente.

Resolución básica de siete conjuros rápidos: Descarga de fuego, Descarga sobrenatural, Llama sagrada, Burla dañina, Curar heridas, Palabra de curación y Proyectil mágico. Solo si personaje los registró preparados y pertenecen a su clase. Trucos escalan, críticos duplican dados, espacios y acciones se consumen al validar objetivo/alcance; máximo un espacio por turno. Curación rápida solo al propio personaje; daño a un objetivo enemigo.

Componentes, concentración, resistencias/inmunidades, reacciones defensivas, invocaciones, dotes, objetos, efectos de subclase y conjuros libres requieren revisión de mesa. No es un motor exhaustivo de D&D. Campos y recursos permiten registrarlos sin simular automatizaciones inexistentes. Libros de conjuros y número de preparados se revisan con referencia de clase.

## Combate por clase

Iniciativa con ventaja y daño Asesinar solo para Pícaro Asesino N3+. Furtivo y Golpes Astutos solo para Pícaro; Puntería N3, Acción Astuta N2, Esquiva N5, Evasión N7 (también Monje). Ataque extra según clase y nivel, hasta cuatro ataques del Guerrero N20. Salvaciones usan competencias de ficha.

Ocultar, Dash y Retirar gastan acción fuera de Acción Astuta; UI y ayuda explican coste real. Datos estructurados de tiradas muestran característica y competencia correspondientes al arma. PG del combate se aplican a ficha mediante botón existente al terminar; espacios gastados se guardan inmediatamente.

## Compatibilidad y privacidad

- `STATE_VERSION=4`: campos nuevos opcionales (`creation`, `spellbook`, `spellSlotsSpent`, `resources`, `portrait`). Validador acepta documentos anteriores y comprueba estructura nueva antes de subir.
- Sin datos locales: ficha neutral, nunca CHAPS de ejemplo. Cuenta nueva no adopta ficha sin dueño; se conserva respaldo local bajo `chaps-unassigned-backup-v1` sin subirlo a cuenta distinta.
- Usuarios existentes con UID mantienen personaje original y pendientes. Dispositivo nuevo selecciona primer personaje real de catálogo cuando no existe ID original `chaps`.
- Borrador de asistente por UID (`chaps-builder:{uid}`). Crear/copiar usa identificador aleatorio; cambiar cuenta durante creación se verifica antes de declarar éxito.
- Guardado de combate incluye clase/subclase y lista de conjuros en firma. Guardado legado de Asesino sin magia conserva compatibilidad.
- Firestore mantiene permisos por `request.auth.uid == userId`; no cambia reglas ni índices en esta versión. Acceso Google de producción depende de proveedor habilitado y dominio autorizado existentes en proyecto `chaps-58e61`.

## Módulos

| Archivo | Función |
| --- | --- |
| `js/character-rules.js` | Catálogos, validación, ficha neutral, creación y cálculos puros |
| `js/character-builder.js` | Asistente accesible, revisión, borradores, ficha de clase/magia/recursos |
| `js/character-equipment.js` | Catálogo ampliado, compra, armaduras y CA |
| `js/character-magic.js` | Resolución de conjuros rápidos soportados |
| `js/firebase-sync.js` | Creación validada y recuperación de catálogo entre dispositivos |
| `js/profile-store.js` | Separación de cuentas y migración sin adopción de datos ajenos |

Fuentes mecánicas: [clases oficiales](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes), [orígenes oficiales](https://www.dndbeyond.com/sources/dnd/br-2024/character-origins), [glosario](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary). Referencia individual de clase enlazada desde ficha.

## Verificación y operación

Pruebas de reglas para doce clases y varios niveles; navegador en 360/1440px para doce creaciones, compra y conjuro; transporte Firebase simulado para cuenta nueva, otro dispositivo y otra cuenta; regresiones CHAPS; PWA offline con clase, magia y descansos de pacto.

Resultado final v17: 106 pruebas, 104 correctas, 0 fallos, 2 omitidas por falta de emuladores Firebase. Motor: 59 checks correctos. Veinte scripts JS con sintaxis válida; capturas del asistente móvil/escritorio revisadas y diff sin errores.

```powershell
$env:CHAPS_PLAYWRIGHT='C:\Users\Carlos\AppData\Local\Programs\Python\Python313\Lib\site-packages\playwright\driver\package'
node --test tests/*.test.js
node tests/combat.test.js
```

Auth y permisos reales pueden comprobarse mediante suites de emuladores con variables descritas en sus archivos; no se presentan como ejecutadas si faltan emuladores. Smoke entre cuentas usa transporte simulado, sin tocar datos reales de usuarios.

Publicación: subir archivos probados a `main`; GitHub Pages ejecuta despliegue. Service Worker v17 precachea módulos nuevos. Volver a abrir o recargar aplicación actualiza interfaz; no borrar almacenamiento del navegador.
