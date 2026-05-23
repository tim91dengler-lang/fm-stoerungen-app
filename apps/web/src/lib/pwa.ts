/**
 * Service-Worker-Registrierung und Install-Prompt-Hilfen.
 *
 * Der SW liegt unter /sw.js und wird nur in production registriert. Der
 * beforeinstallprompt-Event wird global gespeichert, damit die App ihn
 * später bei Bedarf zeigen kann (z. B. über den Mobile-Demo-Banner).
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  // Service Worker während Hot-Iteration deaktiviert (Tim 2026-05-23) —
  // hat in der Phase mehr Probleme verursacht als gelöst (gecachte alte UI).
  // Stattdessen: alle bisherigen Registrierungen löschen + Caches leeren,
  // damit Tester sofort die aktuelle App-Version sehen.
  window.addEventListener('load', () => {
    void (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) await reg.unregister();
        if ('caches' in window) {
          const keys = await caches.keys();
          for (const k of keys) await caches.delete(k);
        }
      } catch {
        // ignore — best-effort cleanup
      }
    })();
  });
}

export function setupInstallPrompt(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((cb) => cb(true));
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((cb) => cb(false));
  });
}

export function installPromptAvailable(): boolean {
  return deferredPrompt !== null;
}

export async function triggerInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  listeners.forEach((cb) => cb(false));
  return outcome;
}

export function onInstallAvailabilityChange(cb: (available: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
