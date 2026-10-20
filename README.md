# LungMarker app

The review app of LungMarker, a tool that cuts the time a lung-cancer research team spends finding, outlining and measuring nodules on CT scans.
Built on [Base44](https://base44.com) for the (simulated) Harbor Thoracic Oncology Lab, as part of the Base44 Forward Deployed Engineer home assignment.

**For research use only. Not for clinical use. No clinical claims.**

- **Live app:** https://lung-marker-scan.base44.app. Sign in with Google (one click).
- **Project overview, results and the AI engine:** [Lung-Tumour-Measurement-Engine](https://github.com/stavdelmar/Lung-Tumour-Measurement-Engine). Start there: it has the discovery story, the architecture, and the results (what works, what fails, how time saved was measured).
- **Demo data:** public RIDER Lung CT scans with the engine's AI drafts, served read-only from `https://lungmarker-demo-data-sd.s3.eu-north-1.amazonaws.com/api/v1`.

## Access

Sign in with Google. During the review period, anyone who signs in gets the **reviewer** role (saved on first sign-in), so they can confirm, edit, approve and export. The data is demo data only.
The owner can switch any user to **viewer** (read-only) in **Settings (gear icon) → User roles**.

## What the app does

1. **Worklist.** Scans grouped by patient (baseline, then follow-ups), with the prior scan already linked. The AI has processed every scan before the reviewer opens it.
2. **Review**, one nodule at a time, in four steps:
   1. *Is it a nodule?* Confirm or reject with a reason. Rejected findings stay in the edit trail.
   2. *Outline and measurements.* The AI's outline on every slice. Drag, add or delete points, Erase, Draw, Undo. Long and short axis and volume update at once. *First / Last slice* jump to the nodule's edges. The volume is recorded only after **Confirm outline**. An amber "AI unsure about the edges" label shows where to look closely.
   3. *Match to the prior scan.* The AI suggests a match, shown side by side with the prior. The reviewer chooses Same, Other or New. A prior nodule that isn't seen is recorded as *Not found*.
   4. *Notes and accept.*
3. **Central check.** The AI's misses in testing were all tumours touching the hilum or mediastinum, so Approve stays blocked until the reviewer has checked those areas (mediastinal window, Add nodule).
4. **Approve and export.** One click to Excel in the lab's 18-column master-sheet format, plus an append-only *Edit trail* sheet (AI draft vs final value, who, when). Each export holds only new rows.
5. **Dashboard.** Report builder and export, nodules over time against expert measurement noise, and the AI's findings against the reviewer's decisions.

A built-in timer records **active minutes** per scan, without long breaks. That is the lab's "Minutes on scan" column.

## How it works

```
Engine (Python, batch on GPU)  ──►  static API on S3  ──►  this app (Base44)
find · outline · measure · match     scans, slices, AI      review · approve · Excel export
```

- The app reads the engine's output over HTTP from the **Engine base URL** in Settings. The contract is [`docs/engine_api.md`](https://github.com/stavdelmar/Lung-Tumour-Measurement-Engine/blob/main/docs/engine_api.md) in the engine repo.
- Base44 stores **review data only** (entities in `base44/entities/`): `Scan`, `Nodule`, `EditEvent` (the edit trail), `AppSettings`, `User`. Images are never stored in the app.
- All editing (outline points, erase, draw, axes, volume) runs in the browser, in `src/lib/`.

## Code map

| Path | What it is |
|---|---|
| `src/pages/` | `Worklist.jsx`, `Review.jsx`, `Results.jsx` (the Dashboard), `Settings.jsx`, plus the sign-in pages |
| `src/components/review/` | Review screen: viewer, slice slider, nodule list, the four steps, prior comparison |
| `src/components/results/` | Dashboard: report builder, nodules over time, performance |
| `src/components/settings/` | Test data reset / re-import, user roles |
| `src/lib/` | App logic without UI: loading AI findings, outline geometry and editing, calipers, prior matching checks, timer minutes, edit trail, Excel export |
| `base44/entities/` | Data model (Base44 entities) |
| `tests/` | Logic tests for review and export (see below) |

## Tests

```bash
npm install
npm test       # all review tests + the Excel export check
npm run lint
npm run build
```

`npm test` runs the app's own code from `src/lib` against synthetic AI findings and an in-memory stand-in for Base44. No engine or network is needed.
The export check compares the generated workbook with the lab's master-sheet rules (30 checks). It needs `python3` with `openpyxl`, and is skipped if they are missing.
Browser interaction (mouse handling on the scan) is tested by hand. See `tests/review/README.md` and `tests/export/README.md`.

## Run locally (developers)

Prerequisites: Node 20.19+ or 22.12+, `npm install`, the Base44 CLI (`npm install -g base44@latest`), and [Deno](https://docs.deno.com/runtime/getting_started/installation/) for the local Base44 backend.

```bash
base44 login   # once per machine
base44 link    # once per clone; writes base44/.app.jsonc (gitignored)
base44 dev     # local backend + frontend together
```

Open the URL that `base44 dev` prints (usually `http://localhost:5173`). Then, in Settings, set the Engine base URL to the demo data URL above.

- Don't run `npm run dev` alongside `base44 dev`. `base44 dev` already starts the frontend.
- Local entity data is in-memory and is wiped when `base44 dev` restarts.
- `base44 dev --remote` runs the frontend against the **live** backend, so writes go to production data.

## Publishing

This repo syncs both ways with the Base44 Builder through GitHub (`main`). After a push, wait until the Builder shows the sync finished, then **Publish** from the Base44 dashboard (`base44 dashboard open`).
Don't use `base44 deploy`: it bypasses the git sync, and the live app drifts from the repo.

## Data and credits

The app shows only public data: RIDER Lung CT (Zhao et al., 2015, [doi:10.7937/k9/tcia.2015.u1x8a5nr](https://doi.org/10.7937/k9/tcia.2015.u1x8a5nr), CC BY 3.0) from The Cancer Imaging Archive.
AI drafts are made by the engine with TotalSegmentator (Apache-2.0). Full credits are in the [engine repo](https://github.com/stavdelmar/Lung-Tumour-Measurement-Engine#data-and-credits).
