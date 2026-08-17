# CHAPS — Asesino D&D 2024 🗡

Plataforma web estática de **entrenamiento y gestión de personaje** para **CHAPS**, un pícaro humano nivel 12 (subclase Asesino, trasfondo Criminal) con las reglas del nuevo Manual del Jugador de D&D 2024.

## Contenido

- **Ficha** — Ficha viva completa (es la ficha principal del personaje):
  - **Retrato** del personaje y datos de identidad editables: nombre, clase, subclase, especie, trasfondo, alineamiento, jugador y campaña.
  - **Experiencia y nivel**: PX actuales con barra de progreso al siguiente nivel (tabla de PX 2024), botones para sumar PX (+100/+500/+1000/cantidad libre) y botón para aplicar el nivel correspondiente a los PX.
  - Características con modificadores automáticos, habilidades con competencia/pericia, armas, PG, dados de golpe, salvaciones de muerte, inspiración, monedas y notas.
  - **Dotes**: lista editable (nombre + descripción) para apuntar las dotes elegidas.
  - **Progresión por nivel**: tabla interactiva con los rasgos del Pícaro Asesino de nivel 1 a 20 (reglas 2024), con casillas que se marcan solas según el nivel (y se pueden cambiar a mano) y un campo de texto en los niveles de mejora para anotar la dote o subida de característica elegida.
  - **Maestría de armas (2024)**: elige las 2 armas dominadas (con su propiedad de maestría visible) y un glosario desplegable de las 8 propiedades (Vex, Nick, Slow, Sap, Topple, Push, Graze, Cleave). Tras un descanso largo la tarjeta se ilumina para recordarte que puedes cambiar la elección.
  - **Diario de aventuras**: entradas con fecha, título y texto; las más recientes primero.
  - Todo se **guarda automáticamente en el navegador** (localStorage) y se puede **exportar/importar en JSON** (incluye todas las secciones).
- **Combate** — Simulador de combate turno a turno: iniciativa con ventaja (Asesinar), ataques con ventaja/desventaja, críticos que duplican dados, Ataque Furtivo 6d6 (una vez por turno), Golpes Astutos con CD de salvación y coste en dados (incluidos los **Golpes Tortuosos** de nivel 14 — Aturdir, Noquear y Obnubilar — que se desbloquean al subir de nivel), nota automática de **Armas Envenenadas** a nivel 13+, acciones adicionales, recordatorios de reacciones (reglas 2024), referencia rápida de **condiciones** y registro de daño detallado.
  - **🎲 Dados rápidos**: tirador de d4 a d100 con cantidad, modificador, ventaja/desventaja en d20 y registro de las últimas 30 tiradas.
  - **📊 Calculadora de daño (DPR 2024)**: probabilidad de impacto y de crítico, daño medio por ataque y daño total por turno con varios ataques, Furtivo (con sus dados según tu nivel) y ventaja. Se **precarga desde la ficha** (bono de ataque = competencia + DES) y compara opciones contra la CA del enemigo.
- **Combos** — Guía interactiva de combos paso a paso con calculadora de daño real (tira los dados), más tabla de rasgos por nivel y avance de mejoras futuras (niveles 13, 14 y 17).
- **📚 Biblioteca** — Consulta del **System Reference Document 5.2 (reglas 2024)** servida por la API de [Open5e](https://open5e.com):
  - **✨ Hechizos** (339): filtro por nivel, tiempo de lanzamiento, componentes, concentración/ritual, escalado a niveles superiores y clases que lo conocen.
  - **🗡 Armas** y **🛡 Armaduras**: daño, propiedades y **propiedad de maestría 2024** de cada arma, CA y requisitos de las armaduras.
  - **🐉 Monstruos** (331): statblock completo (CA, PG, velocidad, características, rasgos y acciones), con filtro por bandas de CR.
  - **📜 Clases** (12 base), **💫 Condiciones** y **💍 Objetos mágicos**.
  - Buscador instantáneo en cada categoría. Los datos se **guardan en el navegador durante 7 días**, así que tras la primera descarga funcionan incluso sin conexión. El texto del SRD está en inglés (es el oficial); la interfaz está en español.
  - **Nuevo**: detalle en modal, botón para **añadir un monstruo directamente como enemigo** en el combate y botón para **añadir un arma del catálogo** a tu ficha.

Interfaz **bilingüe ES/EN** con botón de cambio de idioma (español por defecto). *Nota: las secciones de Biblioteca, Dados rápidos y Calculadora DPR están solo en español de momento.*

## Diseño mobile-first

- En **escritorio** la pestaña **Ficha** muestra un **sidebar izquierdo** con todas las secciones; pulsa una para ir directamente.
- En **móvil** el sidebar se oculte y aparece un **botón flotante ☰** para abrir el índice de secciones.
- Tablas, grids, botones y checkboxes están adaptados para uso táctil: inputs de 16 px (evita zoom en iOS), botones de al menos 44 × 44 px y tablas con scroll horizontal cuando no caben.
- Exportar e importar JSON están ahora en la **cabecera** para encontrarlos rápido en cualquier dispositivo.

## Cómo usarla

### En local
No necesita servidor ni instalación: **haz doble clic en `index.html`** y se abre en tu navegador. Funciona sin conexión (la Biblioteca necesita internet solo la primera vez que abres cada categoría).

### En GitHub Pages
1. Crea un repositorio en GitHub y sube el contenido de esta carpeta (`index.html`, `css/`, `js/`, `manifest.json`, `sw.js`, `assets/`).
2. En el repositorio: **Settings → Pages → Source: Deploy from a branch**, elige la rama (`main`) y la carpeta raíz (`/root`).
3. Espera un minuto y abre la URL que te indica GitHub: `https://<tu-usuario>.github.io/<repo>/`.

### Instalar en el celular (PWA)
La app cuenta con **Web App Manifest** y **Service Worker**, por lo que el navegador ofrecerá "Añadir a pantalla de inicio" / "Instalar aplicación". También puedes pulsar el botón flotante **📲 Instalar aplicación** cuando aparezca. Funciona offline una vez cargada (la Biblioteca necesita internet solo la primera vez que abres cada categoría).

## Importar desde PCGen

Si usas **PCGen 6.09.08** (instalado en `C:\Users\Carlos\Desktop\D&D\PCGen\PcGen\PcGen.exe`) puedes importar tu personaje a la plataforma:

1. **Crea a CHAPS en PCGen**: al crear el personaje elige el juego **D&D 5e** y carga las fuentes **SRD5** (System Reference Document 5e). Selecciona especie Humano, clase Pícaro (nivel 12), trasfondo Criminal y el arquetipo de Asesino.
2. **Exporta el XML**: con el personaje abierto, ve al menú **Character → Export → Standard…** y elige la plantilla **`csheet_fantasy_generic_export.xml.ftl`** (está en `outputsheets/d20/fantasy/htmlxml`). Guarda el archivo `.xml` donde quieras.
3. **Impórtalo aquí**: en la pestaña **Ficha**, baja hasta la tarjeta **PCGen**, pulsa *«Elegir XML de PCGen…»* y selecciona el archivo exportado.
4. **Revisa la vista previa**: verás una tabla campo a campo (valor actual → valor importado: nombre, jugador, clase, nivel, PX, características, PG, CA, iniciativa, competencias en habilidades, armas y oro). Nada se sobrescribe hasta que pulses **«Confirmar importación»**.

> ⚠ **Aviso**: PCGen usa las reglas de **D&D 5e (SRD 2014)** y esta plataforma sigue las reglas de **2024**. Los datos importados son una base para revisar (p. ej. los rasgos y el Ataque Furtivo siguen la progresión 2024 que ya trae la plataforma).

## Tecnología

HTML + CSS + JavaScript puro. Sin frameworks, sin build, sin CDNs: funciona offline y con el protocolo `file://`. La Biblioteca consume la API pública de **Open5e** (SRD 5.2 © Wizards of the Coast, licencia CC-BY-4.0; condiciones y objetos mágicos del SRD 5.1).

---

*Herramienta de fans sin afiliación con Wizards of the Coast.*
