# CHAPS — Asesino D&D 2024 🗡

Plataforma web estática de **entrenamiento y gestión de personaje** para **CHAPS**, un pícaro humano nivel 12 (subclase Asesino, trasfondo Criminal) con las reglas del nuevo Manual del Jugador de D&D 2024.

## Contenido

- **Ficha** — Ficha viva editable: características con modificadores automáticos, habilidades con competencia/pericia, armas, PG, dados de golpe, salvaciones de muerte, inspiración, monedas y notas. Todo se **guarda automáticamente en el navegador** (localStorage) y se puede **exportar/importar en JSON**.
- **Simulador** — Simulador de combate turno a turno: iniciativa con ventaja (Asesinar), ataques con ventaja/desventaja, críticos que duplican dados, Ataque Furtivo 6d6 (una vez por turno), Golpes Astutos con CD de salvación, acciones adicionales y registro de daño detallado.
- **Combos** — Guía interactiva de combos paso a paso con calculadora de daño real (tira los dados), más tabla de rasgos por nivel y avance de mejoras futuras (niveles 13, 14 y 17).

Interfaz **bilingüe ES/EN** con botón de cambio de idioma (español por defecto).

## Cómo usarla

### En local
No necesita servidor ni instalación: **haz doble clic en `index.html`** y se abre en tu navegador. Funciona sin conexión.

### En GitHub Pages
1. Crea un repositorio en GitHub y sube el contenido de esta carpeta (`index.html`, `css/`, `js/`).
2. En el repositorio: **Settings → Pages → Source: Deploy from a branch**, elige la rama (`main`) y la carpeta raíz (`/root`).
3. Espera un minuto y abre la URL que te indica GitHub: `https://<tu-usuario>.github.io/<repo>/`.

## Tecnología

HTML + CSS + JavaScript puro. Sin frameworks, sin build, sin CDNs: funciona offline y con el protocolo `file://`.

---

*Herramienta de fans sin afiliación con Wizards of the Coast.*
