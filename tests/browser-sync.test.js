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
  let remoteDoc = null;
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/__cloud") {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "POST") {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const value = JSON.parse(raw);
        if (value.revision !== (remoteDoc?.revision || 0) + 1) {
          res.writeHead(409); res.end("{}"); return;
        }
        remoteDoc = value;
      }
      res.end(JSON.stringify(remoteDoc));
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
      "firebase-auth.js": `export const getAuth=()=>({}); export class GoogleAuthProvider {}
        export function onAuthStateChanged(auth, cb) { queueMicrotask(()=>cb({uid:'same-user',email:'ing.carlosurbina300@example.com'})); }
        export async function signInWithPopup() {} export async function signOut() {}`,
      "firebase-firestore.js": `export const getFirestore=()=>({}); export const doc=()=>'';
        export const serverTimestamp=()=>0;
        const snapshot=data=>({exists:()=>data!==null,data:()=>data,metadata:{fromCache:false,hasPendingWrites:false}});
        export async function getDocFromServer() {
          const response=await fetch('/__cloud'); return snapshot(await response.json());
        }
        export async function runTransaction(db, callback) {
          let value;
          await callback({get:getDocFromServer,set:(ref,data)=>{value=data}});
          const response=await fetch('/__cloud',{method:'POST',body:JSON.stringify(value)});
          if(response.status===409)throw Object.assign(new Error('conflict'),{code:'chaps/conflict'});
          return value;
        }
        export function onSnapshot(ref, options, callback, onError) {
          let previous, closed=false;
          async function poll() {
            if(closed || globalThis.pauseRealtime) return;
            if(globalThis.breakListener) {
              globalThis.breakListener=false;closed=true;clearInterval(timer);
              globalThis.listenerFailures=(globalThis.listenerFailures||0)+1;
              onError(Object.assign(new Error('stream ended'),{code:'unavailable'}));return;
            }
            const value=await getDocFromServer(), key=JSON.stringify(value.data());
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
      assert.equal(await phone.evaluate(() => JSON.parse(localStorage.getItem("chaps-state-before-cloud-v1")).name), "FICHA VIEJA CELULAR");
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
    await t.test("panel respeta sidebar y ancho de teléfono incluso mostrando conflicto", async () => {
      await pc.locator("#f-notes").scrollIntoViewIfNeeded();
      await pc.evaluate(() => window.scrollTo(0, 0));
      for (const page of [pc, phone]) await page.locator("#cloud-choice").evaluate((element) => { element.hidden = false; });
      const panel = await pc.locator("#cloud-panel").boundingBox();
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
