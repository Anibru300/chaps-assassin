# Biblioteca de recursos visuales para CHAPS

CHAPS puede usar emojis propios o tokens ilustrados descargados. Actualmente tenemos tokens CC0 integrados de **CapsE/FreeTokens**.

## Tokens descargados (en uso)

Ubicación: `assets/tokens/`

| Enemigo local | Archivo | Fuente |
|---------------|---------|--------|
| Goblin | `Goblin.jpg` | FreeTokens CC0 |
| Bandido | `Bandit.jpg` | FreeTokens CC0 |
| Lobo | `Wolf.jpg` | FreeTokens CC0 |
| Lobo terrible | `Dire-Wolf.jpg` | FreeTokens CC0 |
| Mago | `Wizard.jpg` | FreeTokens CC0 |
| Dragoncelo blanco | `Red-Dragon.jpg` | FreeTokens CC0 |

Los demás enemigos del catálogo usan emoji fallback porque FreeTokens no tiene su token exacto.

## Cómo añadir más tokens

1. Busca el nombre en inglés en https://github.com/CapsE/FreeTokens.
2. Verifica que exista en `thumbnails/` o `images/`.
3. Descarga con:
   ```bash
   curl -L -o chaps-assassin/assets/tokens/Nombre.jpg \
     https://raw.githubusercontent.com/CapsE/FreeTokens/main/thumbnails/Nombre.jpg
   ```
4. Añade el mapeo en `js/combat-data.js`:
   ```javascript
   TOKEN_MAP = {
     // ...
     knight: "Knight.jpg"
   };
   ```
5. Actualiza `sw.js` para cachear el nuevo asset.

## Repositorios recomendados

### CapsE/FreeTokens — tokens CC0
- **URL:** https://github.com/CapsE/FreeTokens
- **Licencia:** CC0 1.0 Universal
- **Qué tiene:** tokens redondos de monstruos, PNJ y héroes en PNG/SVG con statblocks SRD.
- **Cómo usarlo:** descarga las imágenes que quieras, colócalas en `assets/tokens/` y enlázalas en `TOKEN_MAP`.

### mbround18/vtt-maps — mapas MIT
- **URL:** https://github.com/mbround18/vtt-maps
- **Licencia:** MIT
- **Qué tiene:** mapas pre-hechos en alta resolución, muchos con previews y fuentes DungeonDraft.
- **Cómo usarlo:** descarga los previews PNG/JPG y úsalos como fondo del tablero (`#c-board`).

### Azgaar/Fantasy-Map-Generator — mapas de mundo
- **URL:** https://github.com/Azgaar/Fantasy-Map-Generator
- **Licencia:** MIT
- **Qué tiene:** generador procedural de mapas de mundo completos.
- **Cómo usarlo:** genera un mapa en la web y exporta SVG/PNG.

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
- Los SVG con statblocks SRD de Wizards of the Coast llevan la atribución obligatoria dentro del propio SVG.
