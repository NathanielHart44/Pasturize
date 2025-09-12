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
  type Category = 'bareGround' | 'grass' | 'litter' | 'forbBush' | 'weed';
  const [category, setCategory] = useState<Category>('bareGround');
  const [grassHeight, setGrassHeight] = useState<string>('');
  const [grassType, setGrassType] = useState<GrassType | ''>('');

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
        setCategory('bareGround');
        setGrassHeight('');
        setGrassType('');
      } else {
        // Derive category from flags, default to grass if grass fields are present
        const cat: Category = e.bareGround
          ? 'bareGround'
          : e.weed
          ? 'weed'
          : e.litter
          ? 'litter'
          : e.forbBush
          ? 'forbBush'
          : 'grass';
        setCategory(cat);
        setGrassHeight(e.grassHeight != null ? String(e.grassHeight) : '');
        setGrassType((e.grassType as GrassType) ?? '');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, pastureId, lineNo]);

  const saveAndNext = useCallback(async () => {
    if (!pastureId) return;
    // Validation: when category is grass, require integer height and type
    if (category === 'grass') {
      const h = grassHeight.trim();
      const isInt = /^\d+$/.test(h) && Number(h) > 0;
      if (!isInt) {
        alert('Please enter grass height as a positive whole number.');
        return;
      }
      if (!grassType) {
        alert('Please select a grass type.');
        return;
      }
    }
    const payload = {
      reportId: id,
      pastureId,
      lineNo,
      bareGround: category === 'bareGround',
      grassHeight: category === 'grass' && grassHeight !== '' ? parseInt(grassHeight, 10) : undefined,
      grassType: category === 'grass' && grassType ? grassType : undefined,
      grass: category === 'grass' ? true : undefined,
      litter: category === 'litter' ? true : undefined,
      forbBush: category === 'forbBush' ? true : undefined,
      weed: category === 'weed' ? true : undefined,
    } as const;
    await saveEntry(payload as any);

    const newCount = await countEntriesForPasture(id, pastureId);
    setCount(newCount);
    const next = Math.min(100, lineNo + 1);
    setLineNo(next);
    // Refresh stats after every save
    const s = await getPastureStats(id, pastureId);
    setStats(s);

    // Do not auto-complete the pasture when reaching 100; require explicit click on Complete Pasture
    if (newCount < 100 && pastureStatus !== 'in_progress') {
      await setPastureStatus(pastureId, 'in_progress');
      setPastureStatusState('in_progress');
    }
    // Recompute complete pastures
    const ps = await getPastures(id);
    const counts = await Promise.all(ps.map((p) => countEntriesForPasture(id, p.id)));
    setCompletePastures(counts.filter((c) => c >= 100).length);
  }, [id, pastureId, lineNo, category, grassHeight, grassType, pastureStatus]);

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
        {/* Moved the completion counter next to Foot Mark */}
        <p className="text-xs opacity-70">Pasture {idx} of {totalPastures || 11}</p>
      </header>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between text-sm">
          <span>Foot Mark</span>
          <span className="opacity-70">{count}/100 complete</span>
        </div>
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
          <label className="block text-sm">Category</label>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="category"
                checked={category === 'bareGround'}
                onChange={() => setCategory('bareGround')}
                disabled={pastureStatus === 'complete'}
              />
              Bare Ground
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="category"
                checked={category === 'grass'}
                onChange={() => setCategory('grass')}
                disabled={pastureStatus === 'complete'}
              />
              Grass
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="category"
                checked={category === 'litter'}
                onChange={() => setCategory('litter')}
                disabled={pastureStatus === 'complete'}
              />
              Litter
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="category"
                checked={category === 'forbBush'}
                onChange={() => setCategory('forbBush')}
                disabled={pastureStatus === 'complete'}
              />
              Forb/Bush
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="category"
                checked={category === 'weed'}
                onChange={() => setCategory('weed')}
                disabled={pastureStatus === 'complete'}
              />
              Weed
            </label>
          </div>
        </div>

        {category === 'grass' && (
          <div className="space-y-3">
            <label className="block">
              <span className="block text-sm">Grass Height (inches)</span>
              <input
                className="mt-1 w-32 rounded-md border px-3 py-2"
                type="text"
                inputMode="numeric"
                pattern="\\d*"
                value={grassHeight}
                onChange={(e) => {
                  const raw = e.target.value;
                  const cleaned = raw.replace(/[^0-9]/g, '');
                  setGrassHeight(cleaned);
                  const num = parseInt(cleaned, 10);
                  if (!Number.isNaN(num) && num > 0 && !grassType) {
                    setGrassType('GG');
                  }
                }}
                placeholder="e.g. 5"
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
              className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-3 text-white disabled:opacity-50"
              disabled={count < 100}
              onClick={async () => {
                if (!pastureId) return;
                await setPastureStatus(pastureId, 'complete');
                setPastureStatusState('complete');
              }}
            >
              Complete Pasture
            </button>
          ) : (
            <button
              type="button"
              className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-3 text-white"
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
      </section>
    </main>
  );
}
