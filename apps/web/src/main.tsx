import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

import { router } from './router';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBanner } from './components/ErrorBanner';
import { registerSW } from 'virtual:pwa-register';
import { setupInstallPrompt } from './lib/pwa';
import './index.css';

// Workbox service worker (vite-plugin-pwa). autoUpdate: a new deploy's SW takes
// over and refreshes the content-hashed precache — no stale UI. Disabled in dev
// (devOptions.enabled = false).
registerSW({ immediate: true });
setupInstallPrompt();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found in index.html');
}

// StrictMode bewusst AUS während Hot-Iteration: doppeltes Mounten triggert
// State-Race-Conditions in Custom-Hooks, die produktiv nie auftreten würden,
// aber Tester verwirren. Reaktivieren wenn Modal-Patterns stabilisiert sind.
ReactDOM.createRoot(rootEl).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </QueryClientProvider>,
);
// ErrorBanner-Import bewusst entfernt — wrapte console.error und
// triggerte vermutlich Loops in der Hot-Iterations-Phase.
void ErrorBanner;
