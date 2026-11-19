# GTA VI trophy guide and tracker

[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/trolloks/trolloks-leonida-field-guide/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/trolloks/trolloks-leonida-field-guide/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

An offline, static web app: a guide to the 55 PlayStation 5 trophies of Grand Theft Auto VI, and a tracker for them.
It runs from `app/index.html` in desktop Chrome with the network off (it also works from `file://`).

Built and tested locally. Project page: <https://make.fun/bounty/gta6-trophy-guide-01>. Repository: <https://github.com/trolloks/trolloks-leonida-field-guide>. Submission status: the first receipt was rejected and a retry is under way. See “Submission history” below.

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

## Move your progress to another browser

Progress is kept in the browser you play in (localStorage), so it does not follow you to another browser by itself.
Use the export file to carry it:

1. In the browser you have now, open the guide and choose the **Save and load** tab.
2. Under **Export progress**, click **Export progress file**. The browser downloads `gta6-trophy-progress.json`.
   The status line then reads “Exported N earned trophies to gta6-trophy-progress.json.”
3. Copy that file to the other browser or computer (it is plain JSON; nothing in it identifies you).
4. In the other browser, open the guide the same way (`app/index.html`, or `http://localhost:8080` after `node serve.ts`)
   and choose **Save and load**.
5. Under **Import progress**, pick **Replace my progress** to take the file's list as it is, or **Merge with my progress**
   to add its trophies to the ones already there.
6. Use the page's file picker to select `gta6-trophy-progress.json`. The status line reports how many trophies were
   imported and how many entries were ignored. The checklist, progress count and spoiler setting then show the restored state.

A file that is not a progress file, or is not valid JSON, is refused with a message, and the progress stays as it was.
Trophy numbers outside 1 to 55 and repeated numbers are ignored and counted. **Clear all progress** empties the list in
the current browser only, so export first if you want to keep it.

What is verified: the export and the replace and merge imports were run through the page's own buttons in headless
Chrome, from `file://` and from `http://127.0.0.1:8080`, and an exported file re-imports to the same list (`tools/browser-test.mjs`,
72 checks). Restoring into a second, separate browser profile was not run as a separate test; the file and the import
path do not depend on the browser, but that step is not claimed as tested.

## Submission history

- **First receipt, `01a1f45c-a21c-7060-a5f3-a02b6aa20248`: rejected.** Make.fun rejected it for two reasons: the final
  README had edits made outside the first recording, and the run record was missing. The run record is the file
  `makefun-run.json` that the entry must carry beside its recordings from 17 November 2026.
- **Current retry: under way.** A supplementary recording was started by the coordinator before this revision session.
  The retry's receipt ID and its run record are not in this repository, so this README does not state either.
- This revision changed only `README.md`. It did not submit anything and did not touch any wallet.

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

1. **Retry pending.** The first receipt was rejected (see “Submission history”). The retry's receipt ID and run record
   are not yet in this repository.
2. **Build recording.** The first recording was rejected along with the first receipt. The supplementary recording
   covers this revision session and the retry. Whether it is accepted, and disclosure of the originating session,
   remain unresolved.
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
10. **Committed locally only.** The build is commit `51e4ecf` on `main`. Nothing has been pushed by this revision.
11. **No referral.** No referral code or link exists in this workspace or in the kit, so none is in this README.
    The three badges carry make.fun's own tracking parameters (`utm_*`). Add a referral link only from a source that
    provides one.


