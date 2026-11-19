# GTA VI trophy guide and tracker

[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/trolloks/trolloks-leonida-field-guide/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/trolloks/trolloks-leonida-field-guide/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

An offline, static web app: a guide to the 55 PlayStation 5 trophies of Grand Theft Auto VI, and a tracker for them.
It runs from `app/index.html` in desktop Chrome with the network off (it also works from `file://`).

Built and tested locally. Contest submission is on hold. See “Open items” below.

## Layout

- `app/` the guide (static files, classic scripts, no build step at run time)
  - `index.html`, `style.css`
  - `js/store.js` progress storage, export and import (pure functions)
  - `js/rules.js` filters, spoiler guard, progress counts, roadmap order (pure functions)
  - `js/app.js` the page: checklist, detail panel with guide and sources, roadmap, missables, save and load, sources
  - `data/trophies.json` the 55 trophies (the file the gate reads); `data/trophies.js` the same data as a classic script
- `main.ts` the program: copies `app/` and `screenshots/` to the output folder, checks the screenshots, writes `dossier.json`
- `vendor/makefun-frontend.ts` the kit's dossier library, unchanged (sha256 `4c8da1c8e76490b3a847670f49137d3ec23953e3c988fe6a6cb320fce5739240`, same as the kit)
- `serve.ts` the kit's static server, unchanged
- `LICENSE` the kit's MIT file, unchanged (see Open items)
- `screenshots/` four JPEG renders of the app (1280×800), taken from a headless Chrome session
- `source/official-trophies.json` the kit's official list, as handed out (names, descriptions, grades)
- `tools/notes.mjs` our guide notes for each trophy (kind, count, missable flag and basis, sources, stage, guide text)
- `tools/build-data.mjs` builds `app/data/trophies.json` and `app/data/trophies.js` from the official list and the notes
- `tools/check.mjs` local data checks and unit tests of the app's scripts (no browser)
- `tools/browser-test.mjs` headless Chrome test over the DevTools protocol; `--shots` also writes the screenshots

## Run

    node tools/build-data.mjs                 # regenerate the data files
    node tools/check.mjs                      # 60 local checks
    node tools/browser-test.mjs --shots       # 72 browser checks and the four screenshots
    mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # dossier.json
    node serve.ts                             # then open http://localhost:8080

## Sources and sourcing

- **S1** the official trophy list as carried in the kit (`source/official-trophies.json`, dated 2026-11-18): names,
  descriptions, grades, and any count the official description states.
- **S2** the kit's one-line hint per trophy, used only for a count the description does not state (16, 17, 18, 28, 42,
  43, 48, 54). Marked in the app.
- **S3** this guide's own reasoning from the S1 wording: roadmap order and the missable flags, each with its basis shown.

No external guide, wiki, video or forum was consulted: the workspace has no network access. The guide text is written
for this entry from those three sources only.

## Measured results

| Check | Result |
|---|---|
| Official list: ids | 55 unique, 1 to 55 |
| Official list: names, descriptions, grades vs. app data | all 55 equal (exact string) |
| Grades | 1 platinum, 2 gold, 6 silver, 46 bronze |
| Kinds | story 21, activities 27, collectibles 5, meta 2 |
| Missable flags | 13 (ids 22, 23, 24, 25, 26, 27, 29, 33, 34, 37, 47, 48, 50), each with its basis |
| Roadmap | 6 stages, each trophy in exactly one stage |
| Local checks (`tools/check.mjs`) | 60 passed, 0 failed |
| Browser checks (`tools/browser-test.mjs`) | 72 passed, 0 failed, on `file://` and `http://127.0.0.1:8080` |
| Network | 61 page requests, all local; none to another origin |
| Console errors and uncaught exceptions | none |
| Persistence | earned marks, spoiler setting survive reload (localStorage) |
| Export | downloads `gta6-trophy-progress.json`; re-imports to the same list |
| Import | valid replace and merge work; invalid file refused and progress unchanged; repeats and out-of-range ids ignored and counted |
| Spoiler guard | 21 unearned story trophies hidden (name, description, guide) until earned or switched off |
| Dossier | 830,862 bytes (cap 1.5 MiB); two builds byte-identical; 4 images; text 89,822 chars (cap 163,840) |
| First load (dossier Load block) | 6 files, 16,315 bytes gzip-9 (57,217 raw); later import() 0 files; whole app 7 files, 88,767 bytes |
| URLs named in source | 0 |
| Screenshots | 4 JPEG, 1280×800, 101 to 165 KB each (cap 256 KiB) |

## Open items (not done)

1. **Not submitted.** No entry, no GitHub repository, no wallet or keypair, no signed submission.
2. **Build recording.** The coordinator started the sponsor recorder before the builder wrote code.
   The recording is unsealed. Submission eligibility and disclosure of the originating session remain unresolved.
3. **External sources.** The guide cites only the official list, the kit hints and its own reasoning. Citing public
   guides needs network access that this workspace does not have. Judge criterion 3 is weak until that is done.
4. **Hidden flags.** The rules say 28 trophies are hidden on PlayStation. The kit's list has no hidden field, so the app
   shows none and the count is unverified.
5. **Roadmap and missables are inference (S3).** The order and the 13 missable flags come from the official wording,
   not from a game check. Locations and steps beyond the description are not claimed. Trophy 38 (Rhinos) and 31
   (WAiNK) are vague in the description and the guide says so.
6. **LICENSE.** It is the kit's MIT file, which names make.fun as copyright holder. The entrant should decide the
   copyright line before any entry.
7. **Runtime tested on Node 25.2.1 only.** The rules require Node 22.18 or later for `main.ts`; the code uses only
   standard-library calls and erasable TypeScript, but Node 22 has not been run here.
8. **Headless test harness.** The browser test starts Chrome with `--no-sandbox`, which is for this test run only.
9. **No judge run.** The house judge is reached through make.fun and was not called.
10. **Not committed.** The repository has no commits; the files are untracked.


