// Browser test and screenshots, driven over the Chrome DevTools protocol with Node's standard library only.
// It opens the guide two ways (file:// and the local static server on 127.0.0.1), clicks through it with real mouse
// input where it matters, checks localStorage persistence, filters, the spoiler guard, roadmap, missables, export,
// import (valid, invalid, merge) and reset, records every network request, and takes the screenshots.
// Usage: node tools/browser-test.mjs [--shots]   (--shots also writes screenshots/*.jpg from the same session)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const CHROME = '/opt/google/chrome/google-chrome';
const SHOTS = process.argv.includes('--shots');
const PORT = 8080;
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- CDP client ----------
class CDP {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    this.ws = new WebSocket(url);
    this.opened = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = (e) => reject(new Error('websocket error'));
    });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message}`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    };
  }
  ready() { return this.opened; }
  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(fn) { this.listeners.push(fn); }
  close() { this.ws.close(); }
}

async function startChrome() {
  const dir = mkdtempSync(join(tmpdir(), 'gta6-chrome-'));
  const proc = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
    `--user-data-dir=${dir}`, '--window-size=1280,800', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const portFile = join(dir, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await sleep(100);
  if (!existsSync(portFile)) throw new Error('Chrome did not open a DevTools port');
  const [port, wsPath] = readFileSync(portFile, 'utf8').split('\n');
  const browserWs = `ws://127.0.0.1:${port}${wsPath}`;
  return { proc, dir, browserWs, port };
}

async function openPage(port) {
  let targets = [];
  for (let i = 0; i < 50; i++) {
    targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    if (targets.some((t) => t.type === 'page')) break;
    await sleep(100);
  }
  const page = targets.find((t) => t.type === 'page');
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.ready();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  return cdp;
}

// Collects page-level problems: network requests, console errors, uncaught exceptions.
function watch(cdp) {
  const log = { requests: [], errors: [], loads: 0 };
  cdp.on((m) => {
    if (m.method === 'Network.requestWillBeSent') log.requests.push(m.params.request.url);
    if (m.method === 'Runtime.exceptionThrown') log.errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') log.errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.method === 'Page.loadEventFired') log.loads += 1;
  });
  return log;
}

async function navigate(cdp, log, url) {
  const before = log.loads;
  await cdp.send('Page.navigate', { url });
  for (let i = 0; i < 100 && log.loads === before; i++) await sleep(50);
  await sleep(250);
}

const evalJs = async (cdp, expression) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
  return r.result.value;
};

// A real mouse click at the centre of an element.
async function clickSel(cdp, selector) {
  const rect = await evalJs(cdp, `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2}; })()`);
  if (!rect) throw new Error(`no element ${selector}`);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await sleep(120);
}

const text = (cdp, sel) => evalJs(cdp, `(document.querySelector(${JSON.stringify(sel)})||{}).textContent || ''`);
const count = (cdp, sel) => evalJs(cdp, `document.querySelectorAll(${JSON.stringify(sel)}).length`);
const storage = (cdp) => evalJs(cdp, `localStorage.getItem('gta6-trophy-tracker/v1')`);
const setSelect = (cdp, id, value) => evalJs(cdp, `(() => { const s = document.getElementById(${JSON.stringify(id)}); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change')); })()`);

async function screenshot(cdp, file) {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88, captureBeyondViewport: false });
  const out = join(root, 'screenshots', file);
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  return out;
}

async function runSuite(label, url, chrome, cdp, log) {
  console.log(`\n== ${label}: ${url}`);
  await navigate(cdp, log, url);
  await evalJs(cdp, `localStorage.clear()`);
  await navigate(cdp, log, url);

  // Fresh start
  check(`[${label}] fresh start shows 0 of 55 earned`, (await text(cdp, '#progress-line')).startsWith('0 of 55 earned'));
  check(`[${label}] all 55 rows render`, (await count(cdp, '#rows tr')) === 55);
  check(`[${label}] spoiler guard hides the 21 unearned story names`, (await count(cdp, '#rows .hidden-name')) === 21);
  check(`[${label}] no story name leaks in the checklist while guarded`,
    !(await evalJs(cdp, `document.getElementById('rows').textContent.includes('Just Like Paradise')`)));

  // Earn trophy 3 (Paradise Lost) with a real click, then check persistence across reload.
  await evalJs(cdp, `document.querySelector('#rows tr[data-id="3"] input').scrollIntoView({block:'center'})`);
  await clickSel(cdp, '#rows tr[data-id="3"] input[type=checkbox]');
  check(`[${label}] clicking a checkbox earns the trophy`, (await text(cdp, '#progress-line')).startsWith('1 of 55 earned'));
  const saved = JSON.parse((await storage(cdp)) || '{"earned":[]}');
  check(`[${label}] progress is written to localStorage`, JSON.stringify(saved.earned) === '[3]', JSON.stringify(saved));
  check(`[${label}] earned story trophy shows its name`, (await evalJs(cdp, `document.querySelector('#rows tr[data-id="3"] .trophy-name')?.textContent`)) === 'Paradise Lost');
  await navigate(cdp, log, url);
  check(`[${label}] progress survives a reload`, (await text(cdp, '#progress-line')).startsWith('1 of 55 earned'));

  // Filters
  await setSelect(cdp, 'filter-kind', 'story');
  check(`[${label}] kind filter: story shows 21 rows`, (await count(cdp, '#rows tr')) === 21);
  await setSelect(cdp, 'filter-kind', 'missable');
  check(`[${label}] kind filter: missable shows 13 rows`, (await count(cdp, '#rows tr')) === 13);
  await setSelect(cdp, 'filter-kind', 'collectibles');
  check(`[${label}] kind filter: collectibles shows 5 rows`, (await count(cdp, '#rows tr')) === 5);
  await setSelect(cdp, 'filter-kind', 'activities');
  check(`[${label}] kind filter: activities shows 27 rows`, (await count(cdp, '#rows tr')) === 27);
  await setSelect(cdp, 'filter-kind', 'all');
  await setSelect(cdp, 'filter-grade', 'gold');
  check(`[${label}] grade filter: gold shows 2 rows`, (await count(cdp, '#rows tr')) === 2);
  await setSelect(cdp, 'filter-grade', 'all');
  await setSelect(cdp, 'filter-status', 'earned');
  check(`[${label}] status filter: earned shows 1 row`, (await count(cdp, '#rows tr')) === 1);
  await setSelect(cdp, 'filter-status', 'all');
  check(`[${label}] filters reset to 55 rows`, (await count(cdp, '#rows tr')) === 55);

  // Detail panel with a guide and sources open beside the list
  await clickSel(cdp, '#rows tr[data-id="16"] td.name');
  const detail = await text(cdp, '#detail');
  check(`[${label}] selecting a trophy opens its guide beside the list`,
    detail.includes('Try each type of activity once') && detail.includes('Guide') && detail.includes('S1'), detail.slice(0, 80));
  check(`[${label}] detail shows the official grade, kind and count`, detail.includes('Bronze') && detail.includes('Target 9 (source S2)'));

  // Spoiler guard off and on
  await clickSel(cdp, '#spoiler');
  check(`[${label}] spoiler guard off shows all story names`, (await count(cdp, '#rows .hidden-name')) === 0);
  await clickSel(cdp, '#spoiler');
  check(`[${label}] spoiler guard on hides unearned story names again`, (await count(cdp, '#rows .hidden-name')) === 20);
  await navigate(cdp, log, url);
  check(`[${label}] spoiler setting survives a reload`, (await evalJs(cdp, `document.getElementById('spoiler').checked`)) === true);

  // Roadmap
  await clickSel(cdp, 'button.tab[data-view="roadmap"]');
  const next = await text(cdp, '#next-up');
  check(`[${label}] roadmap next-up is the first open step (trophy 2, hidden while guarded)`, next.includes('Stage 1') && next.includes('Next up'), next.slice(0, 60));
  check(`[${label}] roadmap shows 6 stages`, (await count(cdp, '#stages .stage')) === 6);
  // Mark 2 earned via the detail panel's button, then check next-up moves to 8
  await clickSel(cdp, 'button.tab[data-view="checklist"]');
  await clickSel(cdp, '#rows tr[data-id="2"] td.name');
  await clickSel(cdp, '#detail button.primary');
  check(`[${label}] detail button marks a trophy earned`, (await text(cdp, '#progress-line')).startsWith('2 of 55 earned'));
  await clickSel(cdp, 'button.tab[data-view="roadmap"]');
  const next2 = await text(cdp, '#next-up');
  check(`[${label}] roadmap next-up advances to the next open step after step 2 is earned`,
    next2.includes('Stage 1') && next2.includes('a hidden story trophy'), next2.slice(0, 60));

  // Missables
  await clickSel(cdp, 'button.tab[data-view="missables"]');
  check(`[${label}] missables view lists 13 flagged trophies`, (await count(cdp, '#missables .missable-list li')) === 13);
  check(`[${label}] missables view keeps hidden story names guarded`, !(await evalJs(cdp, `document.getElementById('missables').textContent.includes('Witness')`)));

  // Save and load
  await clickSel(cdp, 'button.tab[data-view="saves"]');
  // Export: the download lands in the directory set by Browser.setDownloadBehavior.
  const dl = join(chrome.dl, `${label}-export`);
  mkdirSync(dl, { recursive: true });
  await chrome.browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl, eventsEnabled: false });
  await clickSel(cdp, '#export');
  let exported = null;
  for (let i = 0; i < 50 && !exported; i++) {
    await sleep(120);
    const f = readdirSync(dl).find((n) => n.endsWith('.json'));
    if (f) exported = join(dl, f);
  }
  check(`[${label}] export writes a JSON file`, !!exported);
  const exp = exported ? JSON.parse(readFileSync(exported, 'utf8')) : null;
  check(`[${label}] exported file holds the earned ids and format`,
    exp && exp.format === 'gta6-trophy-progress' && JSON.stringify(exp.earned) === '[2,3]', JSON.stringify(exp && exp.earned));
  const exportedPath = exported;

  // Invalid import: nothing changes.
  const bad = join(chrome.dl, `${label}-bad.json`);
  writeFileSync(bad, '{"format":"gta6-trophy-progress","version":1,"earned":"many"}');
  await setInputFile(cdp, '#import', bad);
  check(`[${label}] invalid import is refused and says so`, (await text(cdp, '#status')).startsWith('Import failed'));
  check(`[${label}] invalid import leaves progress unchanged`, (await text(cdp, '#progress-line')).startsWith('2 of 55 earned'));

  // Valid import in replace mode
  const replaceFile = join(chrome.dl, `${label}-replace.json`);
  writeFileSync(replaceFile, JSON.stringify({ format: 'gta6-trophy-progress', version: 1, earned: [1, 2, 5, 55, 55, 99] }));
  await setInputFile(cdp, '#import', replaceFile);
  check(`[${label}] replace import sets the file's list`, (await text(cdp, '#progress-line')).startsWith('4 of 55 earned'), await text(cdp, '#progress-line'));
  check(`[${label}] import reports what it did`, (await text(cdp, '#status')).includes('Imported 4 earned trophies') && (await text(cdp, '#status')).includes('2 entries were ignored'), await text(cdp, '#status'));

  // Merge mode
  await clickSel(cdp, 'input[name="import-mode"][value="merge"]');
  const mergeFile = join(chrome.dl, `${label}-merge.json`);
  writeFileSync(mergeFile, JSON.stringify([10, 11, 1]));
  await setInputFile(cdp, '#import', mergeFile);
  check(`[${label}] merge import adds to existing progress (1 is repeated)`, (await text(cdp, '#progress-line')).startsWith('6 of 55 earned'), await text(cdp, '#progress-line'));
  await clickSel(cdp, 'input[name="import-mode"][value="replace"]');

  // Reset then re-import the exported file: a full round trip
  await clickSel(cdp, '#reset');
  check(`[${label}] clear progress empties the list`, (await text(cdp, '#progress-line')).startsWith('0 of 55 earned'));
  if (exportedPath) {
    await setInputFile(cdp, '#import', exportedPath);
    check(`[${label}] exported file re-imports to the same progress`, (await text(cdp, '#progress-line')).startsWith('2 of 55 earned'));
  }

  // Screenshots from this same session (real renders, unedited).
  if (SHOTS) {
    // Shot 1: checklist with guide open, progress and filters visible.
    await evalJs(cdp, `localStorage.clear()`);
    await navigate(cdp, log, url);
    await clickSel(cdp, 'button.tab[data-view="checklist"]');
    for (const id of [2, 3, 4, 5, 8, 9, 10, 11, 15, 16, 19]) {
      await evalJs(cdp, `(() => { const b = document.querySelector('#rows tr[data-id="${id}"] input'); if (b) { b.click(); } })()`);
    }
    await clickSel(cdp, '#rows tr[data-id="2"] td.name');
    await sleep(150);
    await screenshot(cdp, '1-cover.jpg');
    // Shot 2: story filter with the spoiler guard on and an earned story trophy open.
    await setSelect(cdp, 'filter-kind', 'story');
    await clickSel(cdp, '#rows tr[data-id="4"] td.name');
    await sleep(150);
    await screenshot(cdp, '2-story-guard.jpg');
    // Shot 3: roadmap.
    await setSelect(cdp, 'filter-kind', 'all');
    await clickSel(cdp, 'button.tab[data-view="roadmap"]');
    await sleep(150);
    await screenshot(cdp, '3-roadmap.jpg');
    // Shot 4: save and load after an import.
    await clickSel(cdp, 'button.tab[data-view="saves"]');
    await setInputFile(cdp, '#import', replaceFile);
    await sleep(200);
    await screenshot(cdp, '4-save-load.jpg');
    await evalJs(cdp, `localStorage.clear()`);
  }
}

async function setInputFile(cdp, selector, path) {
  const { root: doc } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: doc.nodeId, selector });
  await cdp.send('DOM.setFileInputFiles', { nodeId, files: [path] });
  await sleep(250);
}

async function main() {
  const dl = mkdtempSync(join(tmpdir(), 'gta6-dl-'));
  const server = spawn(process.execPath, [join(root, 'serve.ts'), '--port', String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve) => server.stdout.once('data', resolve));

  const chrome = await startChrome();
  chrome.dl = dl;
  const browser = new CDP(chrome.browserWs);
  await browser.ready();
  chrome.browser = browser;
  const cdp = await openPage(chrome.port);
  const log = watch(cdp);
  let ok = true;
  try {
    await runSuite('file', pathToFileURL(join(root, 'app', 'index.html')).href, chrome, cdp, log);
    await runSuite('http', `http://127.0.0.1:${PORT}/`, chrome, cdp, log);

    const external = log.requests.filter((u) => !(u.startsWith('file://') || u.startsWith(`http://127.0.0.1:${PORT}/`) || u.startsWith('data:')));
    check('no request left the page for another origin (file:// and localhost only)', external.length === 0, external.slice(0, 3).join(' ') || `${log.requests.length} requests, all local`);
    check('no console error or uncaught exception', log.errors.length === 0, log.errors.slice(0, 3).join(' | ') || 'none');
    if (SHOTS) {
      for (const f of readdirSync(join(root, 'screenshots'))) {
        const st = readFileSync(join(root, 'screenshots', f));
        console.log(`screenshot ${f}: ${st.length} bytes`);
      }
    }
  } catch (e) {
    ok = false;
    check('the suite ran to the end', false, e.message);
  } finally {
    cdp.close();
    browser.close();
    chrome.proc.kill();
    server.kill();
    await sleep(300);
    try { rmSync(chrome.dir, { recursive: true, force: true }); } catch {}
    try { rmSync(dl, { recursive: true, force: true }); } catch {}
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(ok && failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
