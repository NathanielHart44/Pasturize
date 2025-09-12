"use client";
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';

export default function RestartButton({ className = '' }: { className?: string }) {
  const router = useRouter();

  const onRestart = async () => {
    const sure = window.confirm('Are you sure you want to restart? This will clear all local data.');
    if (!sure) return;
    try {
      await db.delete();
    } catch (e) {
      // ignore; we'll force reload anyway
      console.error(e);
    }
    try {
      // Also clear any other local storage in case we add later
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    // Hard navigate to root to ensure fresh boot
    window.location.replace('/');
  };

  const base = 'inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm active:scale-[0.99] disabled:opacity-50';
  return (
    <button type="button" onClick={onRestart} className={`${base} ${className}`} aria-label="Restart">
      Restart
    </button>
  );
}
