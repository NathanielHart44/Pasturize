"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { countEntriesForPasture, getEntryByLine, getPastureByIndex, getPastures, saveEntry, testPopulatePasture, setPastureStatus, getPastureStats, type Stats } from '../lib/data';
import type { GrassType } from '../lib/types';
import grassTypes from '../../data/grass-types.json';
import { TESTING } from '../config';

export default function PasturePage({ params }: { params: { id: string; index: string } }) {
  const { id, index } = params;
  const idx = useMemo(() => Number(index), [index]);

  const [pastureName, setPastureName] = useState<string>('');
  const [pastureId, setPastureId] = useState<string | null>(null);
  const [pastureStatus, setPastureStatusState] = useState<'in_progress' | 'complete'>('in_progress');
  const [count, setCount] = useState(0);
  const [lineNo, setLineNo] = useState(1);
  const [totalPastures, setTotalPastures] = useState(0);
  const [completePastures, setCompletePastures] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);

  // Form state
  const [bareGround, setBareGround] = useState<boolean>(true);
  const [grassHeight, setGrassHeight] = useState<string>('');
  const [grassType, setGrassType] = useState<GrassType | ''>('');
  const [litter, setLitter] = useState<boolean>(false);
  const [forbBush, setForbBush] = useState<boolean>(false);

  // Load pasture meta and default line
  useEffect(() => {
    let cancelled = false;
    getPastureByIndex(id, idx).then((p) => {
      if (!p || cancelled) return;
      setPastureName(p.name);
      setPastureId(p.id);
      setPastureStatusState(p.status);
      countEntriesForPasture(id, p.id).then((c) => {
        if (cancelled) return;
        setCount(c);
        setLineNo(Math.min(100, Math.max(1, c + 1)));
        // Always compute stats so the panel can show while in progress
        getPastureStats(id, p.id).then((s) => !cancelled && setStats(s));
      });
    });
    // Load completion across all pastures
    getPastures(id).then(async (ps) => {
      if (cancelled) return;
      setTotalPastures(ps.length);
      const counts = await Promise.all(ps.map((p) => countEntriesForPasture(id, p.id)));
      if (cancelled) return;
      setCompletePastures(counts.filter((c) => c >= 100).length);
    });
    return () => {
      cancelled = true;
    };
  }, [id, idx]);

  // Load current line entry when pasture/line changes
  useEffect(() => {
    let cancelled = false;
    if (!pastureId || !lineNo) return;
    getEntryByLine(id, pastureId, lineNo).then((e) => {
      if (cancelled) return;
      if (!e) {
        // default values for a new line
        setBareGround(true);
        setGrassHeight('');
        setGrassType('');
        setLitter(false);
        setForbBush(false);
      } else {
        setBareGround(e.bareGround);
        setGrassHeight(e.grassHeight != null ? String(e.grassHeight) : '');
        setGrassType((e.grassType as GrassType) ?? '');
        setLitter(Boolean(e.litter));
        setForbBush(Boolean(e.forbBush));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, pastureId, lineNo]);

  const saveAndNext = useCallback(async () => {
    if (!pastureId) return;
    const payload = {
      reportId: id,
      pastureId,
      lineNo,
      bareGround,
      grassHeight: !bareGround && grassHeight !== '' ? parseFloat(grassHeight.replace(',', '.')) : undefined,
      grassType: !bareGround && grassType ? grassType : undefined,
      litter: !bareGround ? Boolean(litter) : undefined,
      forbBush: !bareGround ? Boolean(forbBush) : undefined,
    } as const;
    await saveEntry(payload as any);

    const newCount = await countEntriesForPasture(id, pastureId);
    setCount(newCount);
    const next = Math.min(100, lineNo + 1);
    setLineNo(next);
    // Refresh stats after every save
    const s = await getPastureStats(id, pastureId);
    setStats(s);

    if (newCount >= 100 && pastureStatus !== 'complete') {
      await setPastureStatus(pastureId, 'complete');
      setPastureStatusState('complete');
    }
    if (newCount < 100 && pastureStatus !== 'in_progress') {
      await setPastureStatus(pastureId, 'in_progress');
      setPastureStatusState('in_progress');
    }
    // Recompute complete pastures
    const ps = await getPastures(id);
    const counts = await Promise.all(ps.map((p) => countEntriesForPasture(id, p.id)));
    setCompletePastures(counts.filter((c) => c >= 100).length);
  }, [id, pastureId, lineNo, bareGround, grassHeight, grassType, litter, forbBush, pastureStatus]);

  const goPrev = () => setLineNo((n) => Math.max(1, n - 1));
  const goNext = () => setLineNo((n) => Math.min(100, n + 1));

  return (
    <main className="p-4 max-w-screen-sm mx-auto">
      <header className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            {pastureName || 'Loading…'}
            {pastureStatus === 'complete' && (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Complete</span>
            )}
          </h1>
          <a href={`#/report/${id}`} className="inline-flex rounded-md border px-3 py-2 text-sm">
            Back
          </a>
        </div>
        <p className="text-sm opacity-80">{count}/100 complete</p>
        <p className="text-xs opacity-70">Pasture {idx} of {totalPastures || 11} • {completePastures}/{totalPastures || 11} pastures complete</p>
      </header>

      <section className="space-y-4">
        <div className="text-sm">Foot Mark</div>
        <div className="flex items-center gap-3">
          <div>
            <input
              className="w-24 h-10 rounded-md border px-3 text-center"
              type="number"
              min={1}
              max={100}
              value={lineNo}
              onChange={(e) => setLineNo(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
              disabled={pastureStatus === 'complete'}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" className="inline-flex items-center h-10 rounded-md border px-3" onClick={goPrev} disabled={pastureStatus === 'complete'}>
              Prev
            </button>
            <button type="button" className="inline-flex items-center h-10 rounded-md border px-3" onClick={goNext} disabled={pastureStatus === 'complete'}>
              Next
            </button>
          </div>
          <div className="ml-auto">
            <a
              href={`#/report/${id}/pasture/${index}/view`}
              className="inline-flex items-center h-10 rounded-md border px-3"
            >
              View All
            </a>
          </div>
        </div>

        <div>
          <label className="block text-sm">Bare Ground</label>
          <div className="mt-2 flex gap-4">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="bareGround"
                checked={bareGround === true}
                onChange={() => setBareGround(true)}
                disabled={pastureStatus === 'complete'}
              />
              Yes
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="bareGround"
                checked={bareGround === false}
                onChange={() => setBareGround(false)}
                disabled={pastureStatus === 'complete'}
              />
              No
            </label>
          </div>
        </div>

        {!bareGround && (
          <div className="space-y-3">
            <label className="block">
              <span className="block text-sm">Grass Height (inches)</span>
              <input
                className="mt-1 w-32 rounded-md border px-3 py-2"
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                value={grassHeight}
                onChange={(e) => {
                  const raw = e.target.value;
                  const cleaned = raw.replace(/[^0-9.,]/g, '').replace(/([.,]).*\1/g, '$1');
                  setGrassHeight(cleaned);
                  const num = parseFloat(cleaned.replace(',', '.'));
                  if (!Number.isNaN(num) && num > 0 && !grassType) {
                    setGrassType('GG');
                  }
                }}
                placeholder="e.g. 5.5"
                disabled={pastureStatus === 'complete'}
              />
            </label>

            <label className="block">
              <span className="block text-sm">Grass Type</span>
              <select
                className="mt-1 w-48 rounded-md border px-3 py-2"
                value={grassType}
                onChange={(e) => setGrassType((e.target.value as GrassType) || '')}
                disabled={pastureStatus === 'complete'}
              >
                <option value="">Select…</option>
                {(grassTypes as { code: string; name: string }[]).map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </label>

            <div className="flex gap-6">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={litter} onChange={(e) => setLitter(e.target.checked)} disabled={pastureStatus === 'complete'} />
                Litter
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={forbBush} onChange={(e) => setForbBush(e.target.checked)} disabled={pastureStatus === 'complete'} />
                Forb/Bush
              </label>
            </div>
          </div>
        )}

        <div>
          <button
            type="button"
            className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-3 text-white disabled:opacity-50"
            onClick={saveAndNext}
            disabled={pastureStatus === 'complete'}
          >
            {lineNo >= 100 ? 'Save' : 'Save & Next'}
          </button>
        </div>

        <div>
          {pastureStatus !== 'complete' ? (
            <button
              type="button"
              className="mt-2 inline-flex w-full items-center justify-center rounded-md border px-4 py-3 disabled:opacity-50"
              disabled={!pastureId || lineNo !== 100}
              onClick={async () => {
                if (!pastureId) return;
                if (count < 100) {
                  const ok = window.confirm('Not all 100 lines are filled. Complete and lock this pasture anyway?');
                  if (!ok) return;
                }
                await setPastureStatus(pastureId, 'complete');
                setPastureStatusState('complete');
              }}
            >
              Complete Pasture
            </button>
          ) : (
            <button
              type="button"
              className="mt-2 inline-flex w-full items-center justify-center rounded-md border px-4 py-3"
              onClick={async () => {
                if (!pastureId) return;
                const ok = window.confirm('Reopen this pasture for editing?');
                if (!ok) return;
                await setPastureStatus(pastureId, 'in_progress');
                setPastureStatusState('in_progress');
              }}
            >
              Reopen Pasture
            </button>
          )}
        </div>

        {TESTING && (
          <div>
            <button
              type="button"
              className="mt-2 inline-flex w-full items-center justify-center rounded-md border px-4 py-3 disabled:opacity-50"
              disabled={!pastureId}
              onClick={async () => {
                if (!pastureId) return;
                const ok = window.confirm('Test populate all 100 lines with random data? This will overwrite existing lines for this pasture.');
                if (!ok) return;
                await testPopulatePasture(id, pastureId);
                const newCount = await countEntriesForPasture(id, pastureId);
                setCount(newCount);
                setLineNo(100);
                setPastureStatusState('complete');
                const s = await getPastureStats(id, pastureId);
                setStats(s);
                const ps = await getPastures(id);
                const counts = await Promise.all(ps.map((p) => countEntriesForPasture(id, p.id)));
                setCompletePastures(counts.filter((c) => c >= 100).length);
              }}
            >
              Test Populate
            </button>
          </div>
        )}

        {stats && (
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
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
      </section>
    </main>
  );
}
