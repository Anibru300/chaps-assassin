# Biblioteca de recursos visuales para CHAPS

CHAPS usa emojis e iconos SVG propios para no depender de imágenes externas, pero si quieres darle un aspecto más realista al tablero, estos repositorios son compatibles con una app web estática offline.

## Recomendados

### CapsE/FreeTokens — tokens CC0
- **URL:** https://github.com/CapsE/FreeTokens
- **Licencia:** CC0 (dominio público)
- **Qué tiene:** tokens redondos de monstruos, PNJ y héroes en PNG/SVG con statblocks SRD.
- **Cómo usarlo:** descarga las imágenes que quieras, colócalas en `assets/tokens/` y luego enlázalas por URL en cada token.
- **Ideal para:** reemplazar los emojis de enemigos por tokens ilustrados.

### mbround18/vtt-maps — mapas MIT
- **URL:** https://github.com/mbround18/vtt-maps
- **Licencia:** MIT
- **Qué tiene:** mapas pre-hechos en alta resolución, muchos con previews y fuentes DungeonDraft.
- **Cómo usarlo:** descarga los previews PNG/JPG y úsalos como fondo del tablero (`#c-board`).
- **Ideal para:** darle un fondo de mazmorra o taberna al campo de batalla.

### Azgaar/Fantasy-Map-Generator — mapas de mundo
- **URL:** https://github.com/Azgaar/Fantasy-Map-Generator
- **Licencia:** MIT
- **Qué tiene:** generador procedural de mapas de mundo completos.
- **Cómo usarlo:** genera un mapa en la web y exporta SVG/PNG.
- **Ideal para:** pantalla de inicio o sección de campaña, no tanto para battlemaps tácticos.

## No aptos para app estática offline

| Repositorio | Motivo |
|-------------|--------|
| Durtur/Dungeoneer | App Node/Electron; requiere servidor. |
| Khazlor/Open-VTT | App Godot de escritorio. |
| dungeon-revealer/dungeon-revealer | Self-hosted con Node. |
| foundryvtt/dnd5e | Sistema para Foundry VTT (backend Node). |

## Notas de licencia

- **CC0:** puedes usar, modificar y redistribuir sin atribución.
- **MIT:** puedes usar y modificar; conserva el aviso de copyright original si redistribuyes el asset tal cual.
- No incluyas imágenes oficiales de Wizards of the Coast ni de libros de D&D salvo que estén explícicamente bajo CC-BY-4.0 (SRD).

## Cómo integrar un asset descargado

1. Copia el archivo a `chaps-assassin/assets/` (por ejemplo `assets/tokens/goblin.png`).
2. En el modal de detalle de la Biblioteca o en el editor de enemigos, asigna la URL relativa al token.
3. Actualiza `sw.js` si quieres que la PWA cachee el nuevo asset.
