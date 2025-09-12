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
  return db.entries.where({ reportId, pastureId }).count();
}

export async function saveEntry(entry: Omit<Entry, 'id' | 'updatedAt'> & { id?: string }): Promise<string> {
  const now = new Date().toISOString();
  const id = entry.id ?? crypto.randomUUID();
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
    const isBare = Math.random() < 0.75; // 75% bare ground
    const entry: Entry = {
      id: crypto.randomUUID(),
      reportId,
      pastureId,
      lineNo,
      bareGround: isBare,
      updatedAt: now,
    };
    if (!isBare) {
      const height = Math.round((Math.random() * 12 + 1) * 10) / 10; // 1.0 - 13.0 inches
      const t = grassTypes[Math.floor(Math.random() * grassTypes.length)]?.code as any;
      entry.grassHeight = height;
      entry.grassType = t;
      entry.litter = Math.random() < 0.3;
      entry.forbBush = Math.random() < 0.3;
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
  bareCount: number;
  barePct: number; // 0..100
  avgGrassHeight: number | null;
  litterTrue: number;
  litterTotal: number;
  litterPct: number; // 0..100
  forbTrue: number;
  forbTotal: number;
  forbPct: number; // 0..100
};

function calcStats(entries: Entry[]): Stats {
  const total = entries.length;
  const bareCount = entries.filter((e) => e.bareGround).length;
  const barePct = total ? (bareCount / total) * 100 : 0;

  // Average grass height over non-bare entries with a recorded height
  const heights = entries
    .filter((e) => !e.bareGround && typeof e.grassHeight === 'number')
    .map((e) => e.grassHeight as number);
  const avgGrassHeight = heights.length ? heights.reduce((a, b) => a + b, 0) / heights.length : null;

  // Litter/Forb: compute over all non-bare lines, regardless of grass height presence
  const applicable = entries.filter((e) => !e.bareGround);
  const litterTrue = applicable.filter((e) => e.litter === true).length;
  const litterTotal = applicable.length; // denominator: all non-bare lines
  const litterPct = litterTotal ? (litterTrue / litterTotal) * 100 : 0;

  const forbTrue = applicable.filter((e) => e.forbBush === true).length;
  const forbTotal = applicable.length; // denominator: all non-bare lines
  const forbPct = forbTotal ? (forbTrue / forbTotal) * 100 : 0;

  return { total, bareCount, barePct, avgGrassHeight, litterTrue, litterTotal, litterPct, forbTrue, forbTotal, forbPct };
}

export async function getPastureStats(reportId: string, pastureId: string): Promise<Stats> {
  const entries = await db.entries.where({ reportId, pastureId }).toArray();
  return calcStats(entries);
}

export async function getReportStats(reportId: string): Promise<Stats> {
  const entries = await db.entries.where('reportId').equals(reportId).toArray();
  return calcStats(entries);
}
