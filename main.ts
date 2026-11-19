// The gta6-trophy-guide-01 entry's program (Node 22, standard library only). It hands the guide in: it copies app/ and
// screenshots/ from beside this file to the output folder (/output, or MAKEFUN_OUTPUT_DIR outside the grader), checks
// the screenshots against the scorer's rules before anything is written, and writes dossier.json with buildDossier from
// vendor/makefun-frontend.ts (the kit's copy, unchanged). Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const SHOT_MAX = 4;
const SHOT_MIN = 3;
const SHOT_MAX_BYTES = 256 * 1024;
const SHOT_NAME = /^[A-Za-z0-9._-]{1,128}$/;

// Screenshot rules from the scorer: 3 to 4 regular PNG or JPEG files, each named with letters, digits and . _ -, at
// most 256 KiB, long side at most 1280 and short side at least 480 pixels. Checked here so a bad set fails early.
function imageSize(bytes: Buffer): { type: 'png' | 'jpeg'; width: number; height: number } | null {
  if (bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { type: 'png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i += 1; continue; }
      const marker = bytes[i + 1];
      if (marker === 0xff) { i += 1; continue; }
      const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isStartOfFrame) {
        return { type: 'jpeg', height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
      }
      i += 2 + bytes.readUInt16BE(i + 2);
    }
  }
  return null;
}

function checkScreenshots(dir: string): string[] {
  if (!existsSync(dir)) throw new Error('screenshots/ is missing');
  const files = readdirSync(dir).filter((f) => !f.startsWith('.') && statSync(join(dir, f)).isFile()).sort();
  if (files.length < SHOT_MIN || files.length > SHOT_MAX) throw new Error(`need ${SHOT_MIN} to ${SHOT_MAX} screenshots, found ${files.length}`);
  for (const f of files) {
    if (!SHOT_NAME.test(f) || f.startsWith('-')) throw new Error(`bad screenshot name: ${f}`);
    const data = readFileSync(join(dir, f));
    if (data.length > SHOT_MAX_BYTES) throw new Error(`${f} is ${data.length} bytes, over 256 KiB`);
    const size = imageSize(data);
    if (!size) throw new Error(`${f} is not a whole PNG or JPEG`);
    const long = Math.max(size.width, size.height);
    const short = Math.min(size.width, size.height);
    if (long > 1280 || short < 480) throw new Error(`${f} is ${size.width}x${size.height}; long side must be at most 1280 and short side at least 480`);
  }
  return files;
}

checkScreenshots(join(here, 'screenshots'));

// /output is a mountpoint in the grader, so the output root itself is never removed or replaced. Only the three paths
// this program writes are cleared first, so a rerun leaves no stale file from an earlier run; anything else in the
// folder is left alone.
mkdirSync(out, { recursive: true });
for (const name of ['app', 'screenshots', 'dossier.json']) rmSync(join(out, name), { recursive: true, force: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's caps (as the kit's program sets them): only text_max_bytes shapes the bytes, the others refuse an entry
// the scorer would refuse, so the dossier is never built past them.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: SHOT_MAX, max_bytes: SHOT_MAX_BYTES },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`wrote ${join(out, 'dossier.json')} (${Buffer.byteLength(dossier)} bytes)`);
