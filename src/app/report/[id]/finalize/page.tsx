"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getExportRows, type ExportRow, exportZip } from '@/lib/export';
import { getReport, getReportStats, type Stats } from '@/lib/data';

export default function FinalizePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [reportName, setReportName] = useState<string>('Survey');
  const [zipFilename, setZipFilename] = useState<string>('report.zip');
  const [rows, setRows] = useState<ExportRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const rep = await getReport(id);
        if (rep) setReportName(rep.name);
        const [exportRows, s] = await Promise.all([
          getExportRows(id),
          getReportStats(id),
        ]);
        if (cancelled) return;
        setRows(exportRows);
        const sanitize = (name: string) => name.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '');
        setZipFilename(`${sanitize(rep?.name ?? 'Survey')}_${id}.zip`);
        setStats(s);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Failed to build CSV');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const saveZip = async () => {
    try {
      const { filename, blob } = await exportZip(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || 'Failed to generate ZIP');
    }
  };

  return (
    <main className="p-4 max-w-screen-md mx-auto">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{reportName}</h1>
        <Link href={`/report/${id}`} className="inline-flex rounded-md border px-3 py-2 text-sm">
          Back
        </Link>
      </div>

      {loading && <p className="text-sm opacity-70">Building CSV…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div>
          {stats && (
            <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border p-2">
                <div className="opacity-70">Grass</div>
                <div className="text-lg font-medium">{stats.grassPct.toFixed(0)}%</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="opacity-70">Avg Grass Height</div>
                <div className="text-lg font-medium">{stats.avgGrassHeight == null ? '—' : stats.avgGrassHeight.toFixed(1)} in</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="opacity-70">Bare Ground</div>
                <div className="text-lg font-medium">{stats.barePct.toFixed(0)}%</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="opacity-70">Litter</div>
                <div className="text-lg font-medium">{stats.litterPct.toFixed(0)}%</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="opacity-70">Forb/Bush</div>
                <div className="text-lg font-medium">{stats.forbPct.toFixed(0)}%</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="opacity-70">Weed</div>
                <div className="text-lg font-medium">{stats.weedPct.toFixed(0)}%</div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={saveZip}
            className="inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-3 text-white disabled:opacity-50"
            disabled={loading || !!error || rows.length === 0}
          >
            Export
          </button>
        </div>
      )}
    </main>
  );
}
