"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getPastures, countEntriesForPasture, getReport, testPopulateReport } from '@/lib/data';
import { TESTING } from '@/config';
import type { Pasture, Report } from '@/lib/types';
import RestartButton from '@/components/RestartButton';

export default function ReportPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [report, setReport] = useState<Report | null>(null);
  const [pastures, setPastures] = useState<Pasture[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  async function refresh() {
    const r = await getReport(id);
    setReport(r ?? null);
    const ps = await getPastures(id);
    setPastures(ps);
    const entries: Record<string, number> = {};
    for (const p of ps) {
      entries[p.id] = await countEntriesForPasture(id, p.id);
    }
    setCounts(entries);
  }

  useEffect(() => {
    refresh();
  }, [id]);

  const allComplete = pastures.length === 11 && Object.values(counts).every((c) => c >= 100);

  return (
    <main className="p-4 max-w-screen-sm mx-auto">
      <h1 className="text-xl font-semibold">{report?.name ?? 'Survey'}</h1>

      <section className="mt-4 space-y-2">
        {pastures.map((p) => {
          const c = counts[p.id] ?? 0;
          const isComplete = p.status === 'complete';
          const indicator = isComplete ? '✓' : c === 0 ? '☐' : '–';
          return (
            <Link
              key={p.id}
              href={`/report/${id}/pasture/${p.index}`}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <span className="flex items-center gap-2">
                <span
                  className={
                    isComplete
                      ? 'text-green-600'
                      : c === 0
                      ? 'text-neutral-400'
                      : 'text-neutral-400'
                  }
                  aria-hidden
                >
                  {indicator}
                </span>
                {p.name}
              </span>
              <span className="text-xs opacity-70">{c}/100</span>
            </Link>
          );
        })}
        {pastures.length === 0 && (
          <div className="text-sm opacity-70">No pastures found for this report.</div>
        )}
      </section>

      <div className="mt-6 flex items-center gap-3">
        <RestartButton className="w-1/2 justify-center py-3" />
        <Link
          href={`/report/${id}/finalize`}
          className="inline-flex w-1/2 items-center justify-center rounded-md bg-black px-4 py-3 text-white"
          title={allComplete ? 'All pastures complete' : 'Some pastures are incomplete'}
        >
          Review
        </Link>
      </div>

      {TESTING && (
        <div className="mt-3">
          <button
            className="inline-flex w-full items-center justify-center rounded-md border px-4 py-3"
            onClick={async () => {
              const ok = window.confirm('Test populate ALL pastures with random data? This will overwrite existing entries.');
              if (!ok) return;
              await testPopulateReport(id);
              await refresh();
            }}
          >
            Test Populate
          </button>
        </div>
      )}
    </main>
  );
}
