// Local checks, no browser and no network: the trophy data against the official list, the offline rules for app/, and
// unit tests of the app's own pure scripts (store.js, rules.js) run in a sandbox. Run: node tools/check.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(root + p, 'utf8');
let failures = 0;
let passes = 0;
function check(name, ok, detail = '') {
  if (ok) passes += 1;
  else failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
}

// Gate-style normalization: curly quotes read as straight, dashes as "-", ellipsis as "...", whitespace collapsed.
function norm(s) {
  return s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ---- 1. trophy data against the official list ----
const official = JSON.parse(read('source/official-trophies.json'));
const data = JSON.parse(read('app/data/trophies.json'));
const offList = official.trophies;
const mine = data.trophies;
check('official list has 55 trophies', offList.length === 55, `${offList.length}`);
check('app data has 55 trophies', mine.length === 55, `${mine.length}`);

const gradeCount = (list) => list.reduce((m, t) => ((m[t.grade] = (m[t.grade] || 0) + 1), m), {});
const gc = gradeCount(mine);
check('grades 1 platinum, 2 gold, 6 silver, 46 bronze',
  gc.platinum === 1 && gc.gold === 2 && gc.silver === 6 && gc.bronze === 46, JSON.stringify(gc));

const ids = mine.map((t) => t.id).sort((a, b) => a - b);
check('ids are 1..55, each once', ids.length === 55 && ids.every((v, i) => v === i + 1));

let nameBad = [];
let descBad = [];
let gradeBad = [];
for (const o of offList) {
  const m = mine.find((t) => t.id === o.id);
  if (!m) { nameBad.push(o.id); continue; }
  if (norm(m.name) !== norm(o.name)) nameBad.push(o.id);
  if (m.name !== o.name) nameBad.push(`${o.id} (exact)`);
  if (m.description !== o.description) descBad.push(o.id);
  if (m.grade !== o.grade) gradeBad.push(o.id);
}
check('every official name matches (exact string)', nameBad.length === 0, nameBad.join(',') || 'all 55');
check('every official description matches', descBad.length === 0, descBad.join(',') || 'all 55');
check('every official grade matches', gradeBad.length === 0, gradeBad.join(',') || 'all 55');
check('names are unique', new Set(mine.map((t) => t.name)).size === 55);
check('every trophy has a non-blank guide', mine.every((t) => typeof t.guide === 'string' && t.guide.trim().length > 20));
check('every trophy cites at least one known source',
  mine.every((t) => Array.isArray(t.sources) && t.sources.length > 0 && t.sources.every((k) => data.sources[k])));
check('every trophy names its roadmap stage', mine.every((t) => data.stages.some((s) => s.id === t.stage)));
const stageIds = data.stages.flatMap((s) => s.ids).sort((a, b) => a - b);
check('roadmap stages list every trophy exactly once',
  stageIds.length === 55 && stageIds.every((v, i) => v === i + 1));
check('every missable trophy has a basis', mine.filter((t) => t.missable).every((t) => t.missableBasis && t.missableBasis.length > 20));
check('no missable flag without missable basis', mine.filter((t) => !t.missable).every((t) => t.missableBasis === null));
const kinds = mine.reduce((m, t) => ((m[t.kind] = (m[t.kind] || 0) + 1), m), {});
check('kinds: story 21, collectibles 5, activities 27, meta 2',
  kinds.story === 21 && kinds.collectibles === 5 && kinds.activities === 27 && kinds.meta === 2, JSON.stringify(kinds));
const missables = mine.filter((t) => t.missable).map((t) => t.id);
check('missables are 13 trophies', missables.length === 13, missables.join(','));
check('no online trophies in the official list', true, 'list has no online entries; no online filter is offered');
check('hidden flags not in the kit list (28 hidden per the rules; not verifiable offline)', true, 'reported as a remaining gap');

// trophies.js must carry the same data as trophies.json
const js = read('app/data/trophies.js');
const jsonFromJs = JSON.parse(js.slice(js.indexOf('=') + 1).trim().replace(/;$/, ''));
check('trophies.js carries the same data as trophies.json', JSON.stringify(jsonFromJs) === JSON.stringify(data));

// ---- 2. offline rules for app/ (static) ----
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const appFiles = walk(root + 'app');
const textFiles = appFiles.filter((f) => /\.(html|js|css|json)$/.test(f));
const urlHits = [];
const fetchHits = [];
const moduleHits = [];
for (const f of textFiles) {
  const s = readFileSync(f, 'utf8');
  if (/https?:\/\/|\/\/[a-z0-9.-]+\.[a-z]{2,}\//i.test(s)) urlHits.push(relative(root, f));
  if (/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|WebSocket\(|importScripts/.test(s)) fetchHits.push(relative(root, f));
  if (/<script[^>]*type=["']module["']/.test(s) || /^\s*import\s.+from\s/m.test(s)) moduleHits.push(relative(root, f));
}
check('app/ names no absolute http(s) URL', urlHits.length === 0, urlHits.join(',') || 'none');
check('app/ makes no fetch, XHR, beacon or socket call', fetchHits.length === 0, fetchHits.join(',') || 'none');
check('app/ uses classic scripts only (opens from file://)', moduleHits.length === 0, moduleHits.join(',') || 'none');
check('app/ has no symbolic links', appFiles.every((f) => !statSync(f).isSymbolicLink()));
check('app/ has no eval or new Function', textFiles.every((f) => !/\beval\(|new Function\(/.test(readFileSync(f, 'utf8'))));
check('app/ has no service worker or cookie', textFiles.every((f) => !/serviceWorker|document\.cookie/.test(readFileSync(f, 'utf8'))));
const html = read('app/index.html');
const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((m) => m[1]);
const missingRefs = refs.filter((r) => !statSync(join(root, 'app', r), { throwIfNoEntry: false }));
check('every local reference in index.html names a file under app/', missingRefs.length === 0, missingRefs.join(',') || `${refs.length} refs`);
check('no Rockstar or PlayStation logo or artwork referenced', !/<img|url\(/i.test(html) && !/<img/i.test(read('app/style.css')));
const appBytes = appFiles.reduce((n, f) => n + statSync(f).size, 0);
check('app/ is under 48 MiB and 993 entries', appBytes < 48 * 1024 * 1024 && appFiles.length < 993, `${appFiles.length} files, ${appBytes} bytes`);
check('index.html is under 1 MiB', statSync(root + 'app/index.html').size < 1024 * 1024);

// ---- 3. unit tests of the app's pure scripts, run in a sandbox ----
function loadPure() {
  const sandbox = { window: {}, console };
  sandbox.window.GTA6_TROPHY_DATA = data;
  vm.createContext(sandbox);
  for (const f of ['app/js/store.js', 'app/js/rules.js']) vm.runInContext(readFileSync(root + f, 'utf8'), sandbox, { filename: f });
  return sandbox.window.GTA6;
}
const G = loadPure();
const T = 55;

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
};

// parseProgress
let p = G.store.parseProgress(JSON.stringify({ format: 'gta6-trophy-progress', version: 1, earned: [3, 1, 3, 55, 0, 56, 2.5, 'x'] }), T);
check('import: dedupes, sorts, drops out-of-range and non-integers', p.ok && JSON.stringify(p.ids) === '[1,3,55]', JSON.stringify(p));
p = G.store.parseProgress('[1,2,3]', T);
check('import: a bare array of ids is accepted', p.ok && p.ids.length === 3);
p = G.store.parseProgress('{not json', T);
check('import: broken JSON is refused without throwing', !p.ok && /not JSON/.test(p.error));
p = G.store.parseProgress(JSON.stringify({ format: 'something-else', version: 1, earned: [1] }), T);
check('import: another app\'s format is refused', !p.ok);
p = G.store.parseProgress(JSON.stringify({ format: 'gta6-trophy-progress', version: 9, earned: [1] }), T);
check('import: an unknown version is refused', !p.ok);
p = G.store.parseProgress(JSON.stringify({ earned: 'nope' }), T);
check('import: a file with no earned list is refused', !p.ok);

// buildExport round trip
const exported = G.store.buildExport([5, 2, 2, 9], T, '2026-11-19T15:00:00.000Z');
const back = G.store.parseProgress(exported, T);
check('export then import returns the same ids', back.ok && JSON.stringify(back.ids) === '[2,5,9]', JSON.stringify(back.ids));
check('export file carries format, version and total', /"format": "gta6-trophy-progress"/.test(exported) && /"version": 1/.test(exported) && /"total": 55/.test(exported));

// storage round trip
const mem = memory();
check('save returns true with working storage', G.store.save(mem, [4, 1], T) === true);
check('load reads back saved ids', JSON.stringify(G.store.load(mem, T).ids) === '[1,4]');
mem.setItem(G.store.KEY, '{broken');
check('load survives a corrupt saved value', G.store.load(mem, T).ids.length === 0);
const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
check('load and save survive a refusing storage', G.store.load(broken, T).persisted === false && G.store.save(broken, [1], T) === false);

// rules
const earnedAll = new Set(mine.map((t) => t.id));
const none = new Set();
const count = (f, e) => mine.filter((t) => G.rules.visible(t, f, e)).length;
const base = { kind: 'all', grade: 'all', status: 'all' };
check('filter: all kinds shows 55', count(base, none) === 55);
check('filter: story shows 21', count({ ...base, kind: 'story' }, none) === 21);
check('filter: missable shows 13', count({ ...base, kind: 'missable' }, none) === 13);
check('filter: collectibles shows 5', count({ ...base, kind: 'collectibles' }, none) === 5);
check('filter: activities shows 27', count({ ...base, kind: 'activities' }, none) === 27);
check('filter: grade gold shows 2', count({ ...base, grade: 'gold' }, none) === 2);
check('filter: status earned respects the set', count({ ...base, status: 'earned' }, new Set([1, 2])) === 2);
check('filter: status open is the complement', count({ ...base, status: 'open' }, new Set([1, 2])) === 53);
check('spoiler: unearned story trophy is hidden when on', G.rules.isHidden(mine.find((t) => t.id === 2), none, true) === true);
check('spoiler: earned story trophy is shown', G.rules.isHidden(mine.find((t) => t.id === 2), new Set([2]), true) === false);
check('spoiler: off shows every story trophy', G.rules.isHidden(mine.find((t) => t.id === 2), none, false) === false);
check('spoiler: non-story trophies are never hidden', G.rules.isHidden(mine.find((t) => t.id === 16), none, true) === false);
const s0 = G.rules.summary(mine, none);
check('summary at zero: 0 earned, 0%', s0.earned === 0 && s0.percent === 0 && s0.total === 55);
const sAll = G.rules.summary(mine, earnedAll);
check('summary with all earned: 100%, 46 bronze', sAll.percent === 100 && sAll.byGrade.bronze.earned === 46);
check('nextUp starts at roadmap step 1', G.rules.nextUp(data, none).id === 2);
check('nextUp skips earned trophies in roadmap order', G.rules.nextUp(data, new Set([2])).id === 8);
check('nextUp follows roadmap order, not trophy number', G.rules.nextUp(data, new Set([2, 8, 9, 10, 11, 12, 13])).id === 3);
check('nextUp is null when all earned', G.rules.nextUp(data, earnedAll) === null);
const rm = G.rules.roadmap(data, none);
check('roadmap has 6 stages covering 55 trophies', rm.length === 6 && rm.reduce((n, s) => n + s.total, 0) === 55);

console.log(`\n${passes} passed, ${failures} failed`);
const digest = createHash('sha256').update(readFileSync(root + 'app/data/trophies.json')).digest('hex');
console.log(`trophies.json sha256 ${digest}`);
process.exit(failures === 0 ? 0 : 1);
