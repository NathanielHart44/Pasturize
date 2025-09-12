# Pasturize

### Overview

Pasturize is a mobile‑first pasture survey app. It runs offline in the browser (IndexedDB storage + service worker caching) and focuses on fast, thumb‑friendly, one‑line‑at‑a‑time data entry. Reports can be exported for sharing and analysis.

⸻

### Features

- Mobile‑first UI: optimized for phones and gloves‑on use.
- 11 pastures × 100 lines each (1,100 entries per report).
- Per‑line category (mutually exclusive):
  - Bare Ground
  - Grass → requires Grass Type and integer Grass Height (inches)
  - Litter
  - Forb/Bush
  - Weed
- Line editor auto‑advances the Foot Mark after save; quick navigation for previous/next.
- View All per‑pasture table for quick browsing of saved lines.
- Stats panels (per pasture and report):
  - Grass %, Avg Grass Height (excludes 0/null), Bare Ground %, Litter %, Forb/Bush %, Weed %
- Offline‑first: IndexedDB persistence; safe across refresh and tab close.
- Export: ZIP containing per‑pasture CSV files; single CSV also available programmatically.

⸻

### Data Model
```
export interface Report {
  id: string;            // uuid
  createdAt: string;     // ISO date
  name: string;          // e.g. "Fall 2025 Survey"
  status: 'in_progress' | 'complete';
}

export interface Pasture {
  id: string;            // uuid
  reportId: string;
  index: number;         // 1..11
  name: string;
  status: 'in_progress' | 'complete';
}

export type GrassType = 'GG' | 'WW' | 'SD' | 'LL' | 'OT';

export interface Entry {
  id: string;            // uuid
  reportId: string;
  pastureId: string;
  lineNo: number;        // 1..100

  // Exactly one category should be true per line
  bareGround: boolean;
  grass?: boolean;       // implied when grass fields are present
  litter?: boolean;
  forbBush?: boolean;
  weed?: boolean;

  // When category is Grass
  grassHeight?: number;  // integer inches
  grassType?: GrassType;

  updatedAt: string;     // ISO
}
```

Storage: IndexedDB via Dexie.

⸻

### Workflow

- Start a new report → the app creates 11 named pastures.
- Open a pasture to begin at Foot Mark 1.
- For each line, choose a Category. If Grass, select a Grass Type and enter integer Grass Height (inches).
- Save to auto‑advance the Foot Mark; navigate to any line as needed.
- Mark pasture Complete to lock it (can be reopened).
- Review the report and Export when ready.

⸻

### Export Format

- Export button: generates a ZIP with one CSV per pasture.
  - Per‑pasture CSV header: `Foot Mark,Bare Ground,Grass Height,Grass Type,Litter,Forb/Bush,Weed`
  - Per‑pasture filename: `${reportName}_${reportId}_${pastureName}_${index}.csv`
- Programmatic single‑CSV export is also available:
  - Header: `Pasture Index,Pasture Name,Foot Mark,Bare Ground,Grass Height,Grass Type,Litter,Forb/Bush,Weed`
  - Filename: `${reportName}_${reportId}.csv`

⸻

### UI Flow

- Home: continue latest report or create a new one.
- Report: list of 11 pastures with progress; Restart and Review actions.
- Pasture: one‑line editor (Category radio group); Save & Next; Prev/Next; View All.
- Finalize: report‑level stats and Export.

⸻

### Tech Stack

- React (Vite SPA)
- Dexie (IndexedDB)
- JSZip (ZIP); custom CSV builder
- Tailwind CSS

⸻

### Dev

```
npm install
npm run dev
```

Open http://localhost:5173. Build with `npm run build` and preview with `npm run preview`.

Dev notes:
- A service worker caches the SPA shell; use the in‑app Restart to reset IndexedDB and caches during testing.
- Test‑only buttons (e.g., Test Populate) are toggled via `src/config.ts` → `export const TESTING = true`.

⸻

### Notes

- Data stays local to the device/browser unless exported.
- The app is optimized for intermittent connectivity and quick field entry.

