// Dos navegadores aislados y transporte Firebase simulado; nunca usa datos reales.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");

test("sincronización entre computadora/celular y panel sin superposición", {
  skip: !process.env.CHAPS_PLAYWRIGHT,
  timeout: 60000
}, async (t) => {
  const { chromium } = require(process.env.CHAPS_PLAYWRIGHT);
  const documents = new Map();
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/__cloud") {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "POST") {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const value = JSON.parse(raw);
        if (value.expected !== (documents.get(value.path)?.revision || 0)) {
          res.writeHead(409); res.end("{}"); return;
        }
        for (const [key, data] of value.writes) {
          if (data === null) documents.delete(key); else documents.set(key, data);
        }
      }
      const requested = new URL(req.url, "http://localhost").searchParams;
      const key = requested.get("path");
      res.end(JSON.stringify(requested.has("list")
        ? [...documents].filter(([name]) => name.startsWith(key + "/") && name.split("/").length === key.split("/").length + 1)
        : documents.get(key) || null));
      return;
    }
    const file = path.join(root, pathname === "/" ? "index.html" : pathname);
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); res.end(); return; }
      res.setHeader("Content-Type", ({ ".js": "application/javascript", ".html": "text/html",
        ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg",
        ".png": "image/png", ".svg": "image/svg+xml" })[path.extname(file)] || "text/plain");
      res.end(data);
    });
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const sandbox = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(root, "js/data.js"), "utf8"), sandbox);
    const seed = JSON.parse(vm.runInContext("JSON.stringify(DEFAULT_STATE)", sandbox));
    const sdk = {
      "firebase-app.js": "export const initializeApp = config => config;",
      "firebase-auth.js": `const user={uid:'same-user',email:'ing.carlosurbina300@example.com',providerData:[{providerId:'google.com'}]};
        export const getAuth=()=>({currentUser:user}); export class GoogleAuthProvider {}
        export function onAuthStateChanged(auth, cb) { queueMicrotask(()=>cb(user)); }
        export async function signInWithPopup() {} export async function signOut() {}`,
      "firebase-firestore.js": `export const getFirestore=()=>({}); export const doc=(db,...parts)=>parts.join('/');
        export const collection=doc; export const query=(path,...filters)=>({path,filters});
        export const orderBy=(field,direction)=>({field,direction}); export const limit=count=>({count});
        export const serverTimestamp=()=>0;
        const snapshot=data=>({exists:()=>data!==null,data:()=>data,metadata:{fromCache:false,hasPendingWrites:false}});
        export async function getDocFromServer(ref) {
          const response=await fetch('/__cloud?path='+encodeURIComponent(ref)); return snapshot(await response.json());
        }
        export async function getDocs(ref) {
          const response=await fetch('/__cloud?list=1&path='+encodeURIComponent(ref.path));
          let rows=(await response.json()).map(([path,data])=>({id:path.split('/').at(-1),data:()=>data}));
          for(const filter of ref.filters){
            if(filter.field) rows.sort((a,b)=>(b.data()[filter.field]-a.data()[filter.field])*(filter.direction==='desc'?1:-1));
            if(filter.count) rows=rows.slice(0,filter.count);
          }
          return {docs:rows};
        }
        export async function runTransaction(db, callback) {
          let path,expected; const writes=[];
          const result=await callback({get:async ref=>{path=ref;const row=await getDocFromServer(ref);expected=row.data()?.revision||0;return row},set:(ref,data)=>writes.push([ref,data]),delete:ref=>writes.push([ref,null])});
          const response=await fetch('/__cloud',{method:'POST',body:JSON.stringify({path,expected,writes})});
          if(response.status===409)throw Object.assign(new Error('conflict'),{code:'chaps/conflict'});
          return result;
        }
        export function onSnapshot(ref, options, callback, onError) {
          if(typeof options==='function'){onError=callback;callback=options;}
          let previous, closed=false;
          async function poll() {
            if(closed || globalThis.pauseRealtime) return;
            if(globalThis.breakListener) {
              globalThis.breakListener=false;closed=true;clearInterval(timer);
              globalThis.listenerFailures=(globalThis.listenerFailures||0)+1;
              onError(Object.assign(new Error('stream ended'),{code:'unavailable'}));return;
            }
            const value=typeof ref==='string'?await getDocFromServer(ref):await getDocs(ref), key=JSON.stringify(typeof ref==='string'?value.data():value.docs.map(row=>[row.id,row.data()]));
            if(!closed && key!==previous){previous=key;callback(value);}
          }
          const timer=setInterval(()=>poll().catch(()=>{}),60);
          poll().catch(()=>{});
          return ()=>{closed=true;clearInterval(timer)};
        }`
    };
    async function device(viewport, name) {
      const context = await browser.newContext({ viewport, serviceWorkers: "block" });
      await context.addInitScript((data) => {
        if (!localStorage.getItem("chaps-state-v1")) localStorage.setItem("chaps-state-v1", JSON.stringify(data));
      }, { ...seed, name });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("https://www.gstatic.com/firebasejs/**", (route) => route.fulfill({
        contentType: "application/javascript", body: sdk[route.request().url().split("/").at(-1)]
      }));
      await page.goto(url);
      await page.waitForFunction(() => CHAPS_CLOUD.core.status.mode === "synced");
      return page;
    }
    const pc = await device({ width: 1440, height: 1000 }, "CHAPS PC");
    const phone = await device({ width: 390, height: 844 }, "FICHA VIEJA CELULAR");
    await t.test("vinculación automática sin elección y respaldo de ficha anterior", async () => {
      assert.equal(await phone.locator("#f-name").inputValue(), "CHAPS PC");
      assert.equal(await phone.locator("#cloud-choice").isVisible(), false);
      assert.equal(await phone.evaluate(() => JSON.parse(localStorage.getItem("chaps-backup:" + localStorage.getItem("chaps-working-character-v1"))).name), "FICHA VIEJA CELULAR");
    });
    await t.test("notas viajan de computadora a celular sin perder foco", async () => {
      await pc.locator("#f-notes").fill("Desde PC");
      await phone.waitForFunction(() => document.querySelector("#f-notes").value === "Desde PC");
      assert.equal(await pc.locator("#f-notes").evaluate((element) => element === document.activeElement), true);
    });
    await t.test("historia y PG viajan de celular a computadora sin salir de campo", async () => {
      await phone.locator("#f-backstory").fill("Historia desde celular");
      await pc.waitForFunction(() => document.querySelector("#f-backstory").value === "Historia desde celular");
      await phone.locator("#f-hpCurrent").fill("70");
      await pc.waitForFunction(() => document.querySelector("#f-hpCurrent").value === "70");
    });
    await t.test("cambios simultáneos en campos distintos llegan a ambos dispositivos", async () => {
      await Promise.all([
        pc.locator("#f-notes").fill("PC simultáneo"),
        phone.locator("#f-backstory").fill("Celular simultáneo")
      ]);
      for (const page of [pc, phone]) {
        await page.waitForFunction(() => document.querySelector("#f-notes").value === "PC simultáneo" &&
          document.querySelector("#f-backstory").value === "Celular simultáneo" && CHAPS_CLOUD.core.status.mode === "synced");
      }
    });
    await t.test("al volver a teléfono recupera cambios aunque escucha estuviera suspendida", async () => {
      await phone.evaluate(() => { globalThis.pauseRealtime = true; });
      await pc.locator("#f-notes").fill("Cambio mientras teléfono dormía");
      await pc.waitForFunction(() => CHAPS_CLOUD.core.status.mode === "synced");
      await phone.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await phone.waitForFunction(() => document.querySelector("#f-notes").value === "Cambio mientras teléfono dormía");
      await phone.evaluate(() => { globalThis.pauseRealtime = false; });
    });
    await t.test("recupera escucha terminada y continúa sincronizando", async () => {
      await phone.evaluate(() => { globalThis.breakListener = true; });
      await phone.waitForFunction(() => globalThis.listenerFailures === 1);
      await pc.locator("#f-notes").fill("Escucha recuperada");
      await phone.waitForFunction(() => document.querySelector("#f-notes").value === "Escucha recuperada");
    });
    await t.test("Mesa aplica daño sobre PG temporales y sincroniza condiciones", async () => {
      await pc.locator('.tab-btn[data-tab="table"]').click();
      await pc.locator("#table-temp").fill("5");
      await pc.locator("#table-amount").fill("8");
      await pc.locator("#table-damage").click();
      await pc.locator("#table-conditions input").first().check();
      await phone.waitForFunction(() => state.hpCurrent === 67 && state.hpTemp === 0 && Object.values(state.tableConditions).some(Boolean));
      await pc.locator('[data-table-die="20"]').click();
      assert.match(await pc.locator("#table-roll").textContent(), /d20:/);
      await pc.locator("#table-observation").fill("Encontramos puerta secreta");
      await pc.locator("#table-note-add").click();
      await phone.waitForFunction(() => Object.values(state.sessionNotes).some(note => note.text === "Encontramos puerta secreta"));
      await pc.locator("#table-open-notes").click();
      await pc.locator('[data-session-field="location"]').fill("Palanthas");
      await phone.waitForFunction(() => state.session.location === "Palanthas");
    });
    await t.test("historial restaura versión previa creando revisión nueva", async () => {
      await pc.waitForFunction(() => CHAPS_CLOUD.core.status.mode === "synced");
      const previous = (await pc.evaluate(() => CHAPS_CLOUD.history())).find(row => JSON.parse(row.payload).notes === "Escucha recuperada");
      assert.ok(previous, "historial contiene estado previo");
      await pc.locator("#f-notes").fill("Cambio que recuperaremos después");
      await pc.waitForFunction(() => CHAPS_CLOUD.core.status.mode === "synced");
      const revision = documents.get("users/same-user/characters/chaps").revision;
      await pc.evaluate(id => CHAPS_CLOUD.restore(id), previous.id);
      await phone.waitForFunction(() => state.notes === "Escucha recuperada");
      assert.ok(documents.get("users/same-user/characters/chaps").revision > revision);
      assert.ok((await pc.evaluate(() => CHAPS_CLOUD.history())).some(row => JSON.parse(row.payload).notes === "Cambio que recuperaremos después"));
      await pc.locator("#history-load").click();
      await pc.waitForFunction(() => document.querySelectorAll("#history-list button").length > 0);
    });
    let secondId;
    await t.test("crear personaje independiente y alternar conserva CHAPS", async () => {
      await pc.locator("#character-name").fill("Segundo pícaro");
      await pc.locator("#character-create").click();
      await pc.waitForFunction(() => state.name === "Segundo pícaro" && CHAPS_CLOUD.core.status.mode === "synced");
      secondId = await pc.evaluate(() => CHAPS_FEATURES.profiles.current.id);
      assert.equal(await pc.evaluate(() => state.level), 1);
      assert.equal(await pc.evaluate(() => Object.keys(state.sessionNotes).length), 0);
      await pc.locator("#f-notes").fill("Solo segundo personaje");
      await pc.waitForFunction(() => CHAPS_CLOUD.core.status.mode === "synced");
      await pc.locator("[data-character-picker]").first().selectOption("chaps");
      await pc.waitForFunction(() => state.name === "CHAPS PC" && CHAPS_CLOUD.core.status.mode === "synced");
      assert.equal(await pc.locator("#f-notes").inputValue(), "Escucha recuperada");
      await phone.waitForFunction(() => [...document.querySelector("[data-character-picker]").options].some(option => option.textContent.includes("Segundo pícaro")));
      await phone.evaluate(id => CHAPS_CLOUD.selectCharacter(id), secondId);
      assert.equal(await phone.locator("#f-notes").inputValue(), "Solo segundo personaje");
    });
    await t.test("ediciones offline quedan en personaje correcto tras alternar y recargar", async () => {
      await phone.context().setOffline(true);
      await phone.locator("#f-notes").fill("Segundo offline");
      await phone.evaluate(() => CHAPS_CLOUD.selectCharacter("chaps"));
      await phone.context().setOffline(false);
      await phone.reload();
      await phone.waitForFunction(() => state.name === "CHAPS PC");
      await phone.evaluate(() => dispatchEvent(new Event("online")));
      await phone.waitForFunction(() => CHAPS_CLOUD.core.status.mode === "synced");
      await phone.evaluate(id => CHAPS_CLOUD.selectCharacter(id), secondId);
      await phone.waitForFunction(() => state.notes === "Segundo offline" && CHAPS_CLOUD.core.status.mode === "synced");
      await phone.evaluate(() => CHAPS_CLOUD.selectCharacter("chaps"));
      assert.equal(await phone.locator("#f-notes").inputValue(), "Escucha recuperada");
    });
    await t.test("panel respeta sidebar y ancho de teléfono incluso mostrando conflicto", async () => {
      await pc.locator("#f-notes").scrollIntoViewIfNeeded();
      await pc.evaluate(() => window.scrollTo(0, 0));
      for (const page of [pc, phone]) await page.locator("#cloud-choice").evaluate((element) => { element.hidden = false; });
      const panel = await pc.locator("#cloud-panel").boundingBox();
      assert.equal(await pc.locator("#cloud-panel").evaluate((element) => getComputedStyle(element).counterIncrement), "none");
      const sidebar = await pc.locator("#sheet-sidebar").boundingBox();
      assert.ok(panel.x >= sidebar.x + sidebar.width, "sidebar no invade panel");
      for (const page of [pc, phone]) {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        assert.equal(overflow, false, "sin desbordamiento horizontal");
        const bounds = await page.locator("#cloud-panel").boundingBox();
        for (const button of await page.locator("#cloud-panel button:visible").all()) {
          const rect = await button.boundingBox();
          assert.ok(rect.x >= bounds.x && rect.x + rect.width <= bounds.x + bounds.width + 1);
        }
      }
    });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
