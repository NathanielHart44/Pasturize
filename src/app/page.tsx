"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createReport, listReports } from '@/lib/data';

export default function HomePage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'redirecting'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      const reports = await listReports();
      if (cancelled) return;
      if (reports.length > 0) {
        const latest = reports[0];
        setStatus('redirecting');
        router.replace(`/report/${latest.id}`);
        return;
      }
      const name = `Survey ${new Date().toLocaleDateString()}`;
      const id = await createReport(name);
      if (cancelled) return;
      setStatus('redirecting');
      router.replace(`/report/${id}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="p-4 max-w-screen-sm mx-auto">
      <h1 className="text-2xl font-semibold">Pasturize</h1>
      <p className="text-sm opacity-80">Mobile-first pasture survey app</p>
      <p className="mt-6 text-sm opacity-70">
        {status === 'loading' ? 'Checking local data…' : 'Opening your report…'}
      </p>
    </main>
  );
}
