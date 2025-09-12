import React, { useEffect, useMemo, useState } from 'react';
import HomePage from './spa/HomePage';
import ReportPage from './spa/ReportPage';
import PasturePage from './spa/PasturePage';
import FinalizePage from './spa/FinalizePage';

type Route =
  | { name: 'home' }
  | { name: 'report'; id: string }
  | { name: 'pasture'; id: string; index: string }
  | { name: 'finalize'; id: string };

function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '') || '/';
  const parts = h.split('?')[0].split('/').filter(Boolean);
  // "/" or "#/"
  if (h === '/' || parts.length === 0) return { name: 'home' };
  if (parts[0] === 'report' && parts[1] && parts.length === 2) {
    return { name: 'report', id: parts[1] };
  }
  if (parts[0] === 'report' && parts[1] && parts[2] === 'pasture' && parts[3]) {
    return { name: 'pasture', id: parts[1], index: parts[3] };
  }
  if (parts[0] === 'report' && parts[1] && parts[2] === 'finalize') {
    return { name: 'finalize', id: parts[1] };
  }
  // Fallback
  return { name: 'home' };
}

export function navigate(to: string) {
  // Always use hash-based routes
  if (!to.startsWith('#')) {
    if (!to.startsWith('/')) to = '/' + to;
    to = '#' + to;
  }
  location.hash = to;
}

export default function AppRouter() {
  const [hash, setHash] = useState<string>(location.hash || '#/');
  useEffect(() => {
    const onHash = () => setHash(location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const route = useMemo(() => parseHash(hash), [hash]);

  switch (route.name) {
    case 'home':
      return <HomePage navigate={navigate} />;
    case 'report':
      return <ReportPage params={{ id: route.id }} />;
    case 'pasture':
      return <PasturePage params={{ id: route.id, index: route.index }} />;
    case 'finalize':
      return <FinalizePage params={{ id: route.id }} />;
    default:
      return <HomePage navigate={navigate} />;
  }
}

