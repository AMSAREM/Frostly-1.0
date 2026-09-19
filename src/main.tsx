import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './utils/pwa';
import { AuthGate } from './components/AuthGate';
import { runSchemaHealthcheck } from './utils/schemaHealthcheck';

// Initialize Progressive Web App Service Worker
registerServiceWorker();

// Trigger schema healthcheck on initialization
runSchemaHealthcheck().catch((err) => console.warn('[main] Schema healthcheck error:', err));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
);

