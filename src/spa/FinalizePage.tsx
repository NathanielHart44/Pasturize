"use client";
import { useEffect, useState } from 'react';
import { getExportRows, type ExportRow, exportZip } from '../lib/export';
import { getReport, getReportStats, type Stats } from '../lib/data';

export default function FinalizePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [reportName, setReportName] = useState<string>('Survey');
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={saveZip}
            className="inline-flex rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
            disabled={loading || !!error || rows.length === 0}
          >
            Save
          </button>
          <a href={`#/report/${id}`} className="inline-flex rounded-md border px-3 py-2 text-sm">
            Back
          </a>
        </div>
      </div>

      {loading && <p className="text-sm opacity-70">Building CSV…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-md border">
          {stats && (
            <div className="p-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border p-2">
                <div className="opacity-70">Bare Ground</div>
                <div className="text-lg font-medium">{stats.barePct.toFixed(0)}%</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="opacity-70">Avg Grass Height</div>
                <div className="text-lg font-medium">{stats.avgGrassHeight == null ? '—' : stats.avgGrassHeight.toFixed(1)} in</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="opacity-70">Litter</div>
                <div className="text-lg font-medium">{stats.litterPct.toFixed(0)}%</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="opacity-70">Forb/Bush</div>
                <div className="text-lg font-medium">{stats.forbPct.toFixed(0)}%</div>
              </div>
            </div>
          )}
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50">
              <tr className="text-left">
                <th className="px-3 py-2">Pasture Index</th>
                <th className="px-3 py-2">Pasture Name</th>
                <th className="px-3 py-2">Line No</th>
                <th className="px-3 py-2">Bare Ground</th>
                <th className="px-3 py-2">Grass Height</th>
                <th className="px-3 py-2">Grass Type</th>
                <th className="px-3 py-2">Litter</th>
                <th className="px-3 py-2">Forb/Bush</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.pasture_index}-${r.line_no}-${i}`} className="border-t">
                  <td className="px-3 py-2">{r.pasture_index}</td>
                  <td className="px-3 py-2">{r.pasture_name}</td>
                  <td className="px-3 py-2">{r.line_no}</td>
                  <td className="px-3 py-2">{String(r.bare_ground)}</td>
                  <td className="px-3 py-2">{r.grass_height}</td>
                  <td className="px-3 py-2">{r.grass_type}</td>
                  <td className="px-3 py-2">{r.litter === '' ? '' : String(r.litter)}</td>
                  <td className="px-3 py-2">{r.forb_bush === '' ? '' : String(r.forb_bush)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr className="border-t">
                  <td className="px-3 py-6 text-center" colSpan={8}>
                    No entries recorded for this report.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

