# Pasturize

### Overview

Pasturize is a simple mobile‑first React app for capturing pasture survey data. It’s designed to work offline in the browser (data stored locally with IndexedDB) and export completed reports as CSV or ZIP files. Built for field use: straightforward, thumb‑friendly, one‑line‑at‑a‑time entry.

⸻

### Features

	•	Mobile‑first UI: optimized for use on phones in the field.
	•	11 pastures × 100 lines each (1,100 total entries per report).
	•	Entry fields per line:
	•	Foot Mark (1–100)
	•	Bare Ground (True/False)
	•	If Bare Ground = False → Grass Height (inches), Grass Type (dropdown), Litter (True/False), Forb/Bush (True/False).
	•	Line‑by‑line editor: auto‑advances Foot Mark after save.
	•	View & edit past lines: navigate to any entry.
	•	Offline persistence: data never lost on refresh/tab close.
	•	Export is a single CSV with all pastures combined.

⸻

### Data Model
```
export interface Report {
	id: string;           // uuid
	createdAt: string;    // ISO date
	name: string;         // e.g. "Fall 2025 Survey"
	status: 'in_progress' | 'complete';
}

export interface Pasture {
	id: string;           // uuid
	reportId: string;
	index: number;        // 1..11
	name: string;
	status: 'in_progress' | 'complete';
}

export type GrassType = 'GG' | 'WW' | 'SD' | 'LL' | 'OW';

export interface Entry {
	id: string;           // uuid
	reportId: string;
	pastureId: string;
	lineNo: number;       // 1..100

	bareGround: boolean;
	grassHeight?: number; // inches
	grassType?: GrassType;
	litter?: boolean;
	forbBush?: boolean;

	updatedAt: string;    // ISO
}
```

Storage: IndexedDB via Dexie.

⸻

### Workflow
	1.	Start a new report → app creates 11 pastures with 100 empty line slots.
	2.	Open a pasture → see current Foot Mark (starts at 1).
	3.	Fill line → Bare Ground?
	•	If True, save & auto‑advance.
	•	If False, enter Grass Height, Grass Type, Litter, Forb/Bush → Save & auto‑advance.
	4.	Repeat until 100 lines are filled.
	5.	Mark pasture complete → lock entries unless reopened.
	6.	After all 11 pastures are complete → Export as CSV or ZIP.

⸻

### Export Format
	•	Filename: ${reportName}.csv
	•	Columns: report_id,pasture_index,pasture_name,line_no,bare_ground,grass_height,grass_type,litter,forb_bush

⸻

### UI Flow
	•	Home Screen
	•	Start New Report (enter name).
	•	Continue existing reports.
	•	Pasture Screen
	•	Header: Pasture name + completion (e.g. 45/100).
	•	Body: one‑line form.
	•	Foot Mark (auto‑increment)
	•	Bare Ground (Yes/No)
	•	If No → Grass Height (number), Grass Type (dropdown), Litter (Yes/No), Forb/Bush (Yes/No)
	•	Footer: Save & Next button.
	•	Navigation: jump to previous/next line, or open list of entries.
	•	Report Screen
	•	List of 11 pastures with progress bars.
	•	Export button enabled when all complete.

⸻

### Tech Stack
	•	Framework: Next.js (React) on Vercel.
	•	Storage: Dexie (IndexedDB).
	•	Forms: React Hook Form.
	•	State Management: Zustand (optional).
	•	CSV: papaparse or custom string builder.
	•	ZIP: jszip.
	•	Styling: Tailwind CSS.

⸻

### Development Plan
	1.	Scaffold Next.js app + Dexie schema.
	2.	Build Home → Report → Pasture navigation.
	3.	Implement line‑by‑line editor with Bare Ground branching.
	4.	Add table/list view for editing past lines.
	5.	Implement Export (CSV + ZIP).
	6.	Polish mobile layout, add backup JSON export.

⸻