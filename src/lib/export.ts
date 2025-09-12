import { db } from './db';
import type { Entry } from './types';
import JSZip from 'jszip';

// Human-friendly CSV header (capitalized, no underscores)
const CSV_HEADER = 'Pasture Index,Pasture Name,Foot Mark,Bare Ground,Grass Height,Grass Type,Litter,Forb/Bush,Weed';
// Per-pasture CSV header (no pasture columns, per request)
const CSV_HEADER_PASTURE = 'Foot Mark,Bare Ground,Grass Height,Grass Type,Litter,Forb/Bush,Weed';
export const PER_PASTURE_COLUMNS = [
  'Foot Mark',
  'Bare Ground',
  'Grass Height',
  'Grass Type',
  'Litter',
  'Forb/Bush',
  'Weed',
] as const;

function mark(val: unknown): string {
  return val === true ? 'x' : '';
}

export function perPastureRowValues(e: Entry): (string | number)[] {
  return [
    String(e.lineNo),
    mark(e.bareGround),
    e.grassHeight ?? '',
    e.grassType ?? '',
    mark(e.litter),
    mark(e.forbBush),
    mark(e.weed),
  ];
}

export async function exportCsv(reportId: string): Promise<{ filename: string; csv: string }> {
  const report = await db.reports.get(reportId);
  if (!report) throw new Error('Report not found');

  const pastures = await db.pastures.where('reportId').equals(reportId).toArray();
  const pastureMap = new Map(pastures.map((p) => [p.id, p] as const));

  const entries = await db.entries.where('reportId').equals(reportId).toArray();
  // Sort by pasture index then line number for readability
  entries.sort((a, b) => {
    const pa = pastureMap.get(a.pastureId)?.index ?? 0;
    const pb = pastureMap.get(b.pastureId)?.index ?? 0;
    if (pa !== pb) return pa - pb;
    return a.lineNo - b.lineNo;
  });

  const rows = entries.map((e) => {
    const p = pastureMap.get(e.pastureId);
    const cols = [
      String(p?.index ?? ''),
      p?.name ?? '',
      String(e.lineNo),
      mark(e.bareGround),
      e.grassHeight ?? '',
      e.grassType ?? '',
      mark(e.litter),
      mark(e.forbBush),
      mark(e.weed),
    ];
    return cols.map(escapeCsv).join(',');
  });

  // Include report UUID in filename to disambiguate
  const filename = `${sanitizeFilename(report.name)}_${report.id}.csv`;
  const csv = [CSV_HEADER, ...rows].join('\n');
  return { filename, csv };
}

export async function exportZipStub(reportId: string): Promise<void> {
  // Intentionally left as a stub; will implement with jszip later
  void reportId;
}

export type ExportRow = {
  pasture_index: number | '';
  pasture_name: string;
  line_no: number;
  bare_ground: string; // 'x' or ''
  grass_height: number | '';
  grass_type: string;
  litter: string; // 'x' or ''
  forb_bush: string; // 'x' or ''
  weed: string; // 'x' or ''
};

export async function getExportRows(reportId: string): Promise<ExportRow[]> {
  const pastures = await db.pastures.where('reportId').equals(reportId).toArray();
  const pastureMap = new Map(pastures.map((p) => [p.id, p] as const));
  const entries = await db.entries.where('reportId').equals(reportId).toArray();
  const rows: ExportRow[] = entries.map((e) => {
    const p = pastureMap.get(e.pastureId);
    return {
      pasture_index: p?.index ?? '',
      pasture_name: p?.name ?? '',
      line_no: e.lineNo,
      bare_ground: mark(e.bareGround),
      grass_height: e.grassHeight ?? '',
      grass_type: e.grassType ?? '',
      litter: mark(e.litter),
      forb_bush: mark(e.forbBush),
      weed: mark(e.weed),
    };
  });
  // Sort by pasture index then line number for readability
  rows.sort((a, b) => {
    const ai = typeof a.pasture_index === 'number' ? a.pasture_index : 0;
    const bi = typeof b.pasture_index === 'number' ? b.pasture_index : 0;
    if (ai !== bi) return ai - bi;
    return a.line_no - b.line_no;
  });
  return rows;
}

export async function exportZip(reportId: string): Promise<{ filename: string; blob: Blob }> {
  const report = await db.reports.get(reportId);
  if (!report) throw new Error('Report not found');
  const pastures = await db.pastures.where('reportId').equals(reportId).toArray();
  const entries = await db.entries.where('reportId').equals(reportId).toArray();
  // Group entries by pastureId
  const byPasture = new Map<string, typeof entries>();
  for (const e of entries) {
    const arr = byPasture.get(e.pastureId) ?? [];
    arr.push(e);
    byPasture.set(e.pastureId, arr);
  }
  const zip = new JSZip();

  for (const p of pastures) {
    const list = (byPasture.get(p.id) ?? []).slice().sort((a, b) => a.lineNo - b.lineNo);
    const rows = list.map((e) => perPastureRowValues(e).map(escapeCsv).join(','));
    const csv = [CSV_HEADER_PASTURE, ...rows].join('\n');
    const fname = `${sanitizeFilename(report.name)}_${report.id}_${sanitizeFilename(p.name)}_${p.index}.csv`;
    zip.file(fname, csv);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const zipFilename = `${sanitizeFilename(report.name)}_${report.id}.zip`;
  return { filename: zipFilename, blob: content };
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '');
}

function escapeCsv(value: unknown): string {
  const s = String(value ?? '');
  if (s === '') return '';
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
