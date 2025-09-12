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
