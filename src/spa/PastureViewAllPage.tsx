"use client";
import { useEffect, useMemo, useState } from 'react';
import { getPastureByIndex, listEntriesForPasture } from '../lib/data';
import type { Entry, Pasture } from '../lib/types';

export default function PastureViewAllPage({ params }: { params: { id: string; index: string } }) {
  const { id, index } = params;
  const idx = useMemo(() => Number(index), [index]);
  const [pasture, setPasture] = useState<Pasture | null>(null);
  const [rows, setRows] = useState<Entry[]>([]);

  useEffect(() => {
    let cancelled = false;
    getPastureByIndex(id, idx).then((p) => {
      if (cancelled) return;
      if (p) {
        setPasture(p);
        listEntriesForPasture(id, p.id).then((es) => {
          if (!cancelled) setRows(es);
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, idx]);

  return (
    <main className="p-4 max-w-screen-sm mx-auto">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{pasture?.name ?? 'Pasture'}</h1>
        <a href={`#/report/${id}/pasture/${index}`} className="rounded-md border px-3 py-2 text-sm">
          Back
        </a>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr className="text-left">
              <th className="px-3 py-2">Line No</th>
              <th className="px-3 py-2">Bare Ground</th>
              <th className="px-3 py-2">Grass Height</th>
              <th className="px-3 py-2">Grass Type</th>
              <th className="px-3 py-2">Litter</th>
              <th className="px-3 py-2">Forb/Bush</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="px-3 py-2">{e.lineNo}</td>
                <td className="px-3 py-2">{String(e.bareGround)}</td>
                <td className="px-3 py-2">{e.grassHeight ?? ''}</td>
                <td className="px-3 py-2">{e.grassType ?? ''}</td>
                <td className="px-3 py-2">{e.litter == null ? '' : String(e.litter)}</td>
                <td className="px-3 py-2">{e.forbBush == null ? '' : String(e.forbBush)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr className="border-t">
                <td className="px-3 py-6 text-center" colSpan={6}>
                  No entries yet for this pasture.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

