import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import AppRouter from './router';
import ServiceWorkerRegister from './components/ServiceWorkerRegister';

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root not found');

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <AppRouter />
    <ServiceWorkerRegister />
  </React.StrictMode>
);

