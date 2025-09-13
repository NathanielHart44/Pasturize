import { db } from './db';
import type { Entry, Pasture, Report } from './types';
import pastureList from '@/data/pastures.json';
import grassTypes from '@/data/grass-types.json';

export async function createReport(name: string): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const report: Report = { id, name, createdAt: now, status: 'in_progress' };

  await db.transaction('rw', db.reports, db.pastures, async () => {
    await db.reports.add(report);
    const pastures: Pasture[] = pastureList.map((p) => ({
      id: crypto.randomUUID(),
      reportId: id,
      index: p.index,
      name: p.name,
      status: 'in_progress',
    }));
    await db.pastures.bulkAdd(pastures);
  });

  return id;
}

export async function listReports(): Promise<Report[]> {
  return db.reports.orderBy('createdAt').reverse().toArray();
}

export async function getReport(id: string): Promise<Report | undefined> {
  return db.reports.get(id);
}

export async function getPastures(reportId: string): Promise<Pasture[]> {
  return db.pastures.where('reportId').equals(reportId).sortBy('index');
}

export async function getPastureByIndex(reportId: string, index: number): Promise<Pasture | undefined> {
  // Use indexed query on reportId, then filter by index
  return db.pastures.where('reportId').equals(reportId).and((p) => p.index === index).first();
}

export async function countEntriesForPasture(reportId: string, pastureId: string): Promise<number> {
  // Count distinct footmarks (lineNo) saved for this pasture
  const entries = await db.entries.where({ reportId, pastureId }).toArray();
  const unique = new Set(entries.map((e) => e.lineNo));
  return unique.size;
}

export async function saveEntry(entry: Omit<Entry, 'id' | 'updatedAt'> & { id?: string }): Promise<string> {
  const now = new Date().toISOString();
  // Upsert by composite key [reportId+pastureId+lineNo] to avoid duplicate rows inflating counts
  const existing = await db.entries
    .where('[reportId+pastureId+lineNo]')
    .equals([entry.reportId, entry.pastureId, entry.lineNo])
    .first();
  const id = existing?.id ?? entry.id ?? crypto.randomUUID();
  await db.entries.put({ ...entry, id, updatedAt: now });
  return id;
}

export async function getEntryByLine(reportId: string, pastureId: string, lineNo: number): Promise<Entry | undefined> {
  return db.entries
    .where('[reportId+pastureId+lineNo]')
    .equals([reportId, pastureId, lineNo])
    .first();
}

export async function listEntriesForPasture(reportId: string, pastureId: string): Promise<Entry[]> {
  return db.entries.where({ reportId, pastureId }).sortBy('lineNo');
}

export async function setPastureStatus(pastureId: string, status: Pasture['status']): Promise<void> {
  await db.pastures.update(pastureId, { status });
}

export async function testPopulatePasture(reportId: string, pastureId: string): Promise<void> {
  const now = new Date().toISOString();
  const entries: Entry[] = Array.from({ length: 100 }, (_, i) => {
    const lineNo = i + 1;
    // Weighted category selection: 75% bare, others distributed
    const r = Math.random();
    const category = r < 0.75 ? 'bare' : r < 0.85 ? 'grass' : r < 0.92 ? 'litter' : r < 0.98 ? 'forb' : 'weed';

    const entry: Entry = {
      id: crypto.randomUUID(),
      reportId,
      pastureId,
      lineNo,
      bareGround: category === 'bare',
      updatedAt: now,
    };

    if (category === 'grass') {
      // Integer inches 1..13
      const height = Math.floor(Math.random() * 13) + 1;
      const t = grassTypes[Math.floor(Math.random() * grassTypes.length)]?.code as any;
      entry.grassHeight = height;
      entry.grassType = t;
      entry.grass = true;
    } else if (category === 'litter') {
      entry.litter = true;
    } else if (category === 'forb') {
      entry.forbBush = true;
    } else if (category === 'weed') {
      entry.weed = true;
    }

    return entry;
  });

  await db.transaction('rw', db.entries, async () => {
    await db.entries.where({ reportId, pastureId }).delete();
    await db.entries.bulkAdd(entries);
  });
  await setPastureStatus(pastureId, 'complete');
}

export async function testPopulateReport(reportId: string): Promise<void> {
  const pastures = await db.pastures.where('reportId').equals(reportId).toArray();
  for (const p of pastures) {
    await testPopulatePasture(reportId, p.id);
  }
}

function parseBoolCell(v: string): boolean {
  const s = (v ?? '').trim().toLowerCase();
  return s === 'x' || s === 'true' || s === '1' || s === 'yes' || s === 'y';
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cur.push(field);
        field = '';
      } else if (ch === '\n') {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = '';
      } else if (ch === '\r') {
        // ignore
      } else {
        field += ch;
      }
    }
  }
  // flush
  cur.push(field);
  if (cur.length > 1 || (cur.length === 1 && cur[0] !== '')) rows.push(cur);
  return rows;
}

export async function importCsvForPasture(
  reportId: string,
  pastureId: string,
  csvText: string,
  forbCountInput: number
): Promise<void> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) throw new Error('CSV is empty');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idxLine = header.findIndex((h) => h === 'line no' || h === 'foot mark' || h === 'line');
  const idxBare = header.findIndex((h) => h === 'bare ground');
  const idxHeight = header.findIndex((h) => h === 'grass height');
  const idxType = header.findIndex((h) => h === 'grass type');
  const idxLitter = header.findIndex((h) => h === 'litter');
  const idxForb = header.findIndex((h) => h === 'forb/bush' || h === 'forb' || h === 'forb bush');
  if (idxLine < 0 || idxBare < 0) throw new Error('Missing required columns (Line No and Bare Ground)');

  const body = rows.slice(1);
  type Temp = { lineNo: number; bare: boolean; height?: number; type?: string; litter?: boolean; forb?: boolean };
  const list: Temp[] = [];
  for (const r of body) {
    const lineRaw = r[idxLine] ?? '';
    const ln = Number(String(lineRaw).replace(/[^0-9]/g, ''));
    if (!Number.isFinite(ln) || ln <= 0) continue;
    const bare = parseBoolCell(r[idxBare] ?? '');
    const heightStr = (r[idxHeight] ?? '').trim();
    const heightNum = heightStr ? Math.round(parseFloat(heightStr.replace(',', '.'))) : undefined;
    const type = (r[idxType] ?? '').trim().toUpperCase();
    const litter = idxLitter >= 0 ? parseBoolCell(r[idxLitter] ?? '') : false;
    const forb = idxForb >= 0 ? parseBoolCell(r[idxForb] ?? '') : false;
    list.push({ lineNo: ln, bare, height: Number.isFinite(heightNum as any) ? (heightNum as number) : undefined, type, litter, forb });
  }

  // Determine which forb entries to convert to weed based on provided Forb count (to keep as Forb)
  const forbLines = list.filter((t) => !t.bare && t.forb).sort((a, b) => a.lineNo - b.lineNo);
  const keepForb = Math.max(0, Math.min(forbCountInput || 0, forbLines.length));
  const weedSet = new Set<number>(forbLines.slice(keepForb).map((t) => t.lineNo));

  const now = new Date().toISOString();
  const entries: Entry[] = list.map((t) => {
    const e: Entry = {
      id: crypto.randomUUID(),
      reportId,
      pastureId,
      lineNo: t.lineNo,
      bareGround: t.bare === true,
      updatedAt: now,
    } as Entry;
    if (!e.bareGround) {
      if ((t.height && t.height > 0) || (t.type && t.type !== '')) {
        e.grass = true;
        e.grassHeight = t.height && t.height > 0 ? t.height : undefined;
        e.grassType = (t.type as any) || undefined;
      } else if (t.forb) {
        if (weedSet.has(t.lineNo)) {
          e.weed = true;
        } else {
          e.forbBush = true;
        }
      } else if (t.litter) {
        e.litter = true;
      }
    }
    return e;
  });

  await db.transaction('rw', db.entries, async () => {
    await db.entries.where({ reportId, pastureId }).delete();
    await db.entries.bulkAdd(entries);
  });
}

export type Stats = {
  total: number;
  barePct: number; // 0..100
  grassPct: number; // 0..100
  litterPct: number; // 0..100
  forbPct: number; // 0..100
  weedPct: number; // 0..100
  avgGrassHeight: number | null;
};

function calcStats(entries: Entry[]): Stats {
  const total = entries.length;
  const pct = (n: number) => (total ? (n / total) * 100 : 0);

  const bareTrue = entries.filter((e) => e.bareGround === true).length;
  const litterTrue = entries.filter((e) => e.litter === true).length;
  const forbTrue = entries.filter((e) => e.forbBush === true).length;
  const weedTrue = entries.filter((e) => e.weed === true).length;

  // Grass lines: explicit grass flag OR inferred from absence of other categories and presence of grass data
  const isGrass = (e: Entry) =>
    e.grass === true ||
    (!e.bareGround && !e.weed && !e.litter && !e.forbBush && (e.grassType != null || e.grassHeight != null));
  const grassTrue = entries.filter(isGrass).length;

  // Average grass height, excluding 0 and nulls
  const grassHeights = entries
    .map((e) => (typeof e.grassHeight === 'number' ? e.grassHeight : null))
    .filter((h): h is number => h != null && h > 0);
  const avgGrassHeight = grassHeights.length
    ? grassHeights.reduce((a, b) => a + b, 0) / grassHeights.length
    : null;

  return {
    total,
    barePct: pct(bareTrue),
    grassPct: pct(grassTrue),
    litterPct: pct(litterTrue),
    forbPct: pct(forbTrue),
    weedPct: pct(weedTrue),
    avgGrassHeight,
  };
}

export async function getPastureStats(reportId: string, pastureId: string): Promise<Stats> {
  const entries = await db.entries.where({ reportId, pastureId }).toArray();
  return calcStats(entries);
}

export async function getReportStats(reportId: string): Promise<Stats> {
  const entries = await db.entries.where('reportId').equals(reportId).toArray();
  return calcStats(entries);
}
