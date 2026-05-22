import { useEffect, useState } from 'react';
import { Download, Smartphone, Tablet } from 'lucide-react';
import clsx from 'clsx';
import {
  installPromptAvailable,
  onInstallAvailabilityChange,
  triggerInstallPrompt,
} from '../lib/pwa';

type Device = 'phone' | 'tablet';

export function MobileDemoPage() {
  const [device, setDevice] = useState<Device>('phone');
  const [canInstall, setCanInstall] = useState(installPromptAvailable());
  const url = window.location.origin + '/tickets';

  useEffect(() => {
    return onInstallAvailabilityChange(setCanInstall);
  }, []);

  async function handleInstall() {
    const outcome = await triggerInstallPrompt();
    if (outcome === 'unavailable') {
      alert(
        'Installation aktuell nicht möglich. In Chrome/Edge: Adressleiste → Install-Symbol. ' +
          'iOS Safari: Teilen → Zum Home-Bildschirm.',
      );
    }
  }

  const dims =
    device === 'phone'
      ? { w: 390, h: 844, label: 'iPhone 14 (390×844)' }
      : { w: 768, h: 1024, label: 'iPad (768×1024)' };

  return (
    <div className="space-y-4 px-4 py-6 lg:px-8">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
          <Smartphone className="h-5 w-5 text-emerald-400" /> Mobile-Vorschau
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Vorschau der App in der Mobile-/Tablet-Ansicht. Die App ist als PWA installierbar
          (Browser → &bdquo;Zum Startbildschirm hinzufügen&ldquo;).
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDevice('phone')}
          className={clsx(
            'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs',
            device === 'phone'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800',
          )}
        >
          <Smartphone className="h-3.5 w-3.5" /> Phone
        </button>
        <button
          type="button"
          onClick={() => setDevice('tablet')}
          className={clsx(
            'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs',
            device === 'tablet'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800',
          )}
        >
          <Tablet className="h-3.5 w-3.5" /> Tablet
        </button>
        <span className="ml-auto text-xs text-zinc-500">{dims.label}</span>
        {canInstall && (
          <button
            type="button"
            onClick={handleInstall}
            className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-emerald-400"
          >
            <Download className="h-3.5 w-3.5" /> App installieren
          </button>
        )}
      </div>

      <div className="flex justify-center py-6">
        <div
          className="overflow-hidden rounded-[2.5rem] border-8 border-zinc-800 bg-zinc-950 shadow-2xl"
          style={{
            width: dims.w + 16,
            height: dims.h + 16,
            maxHeight: 'calc(100vh - 200px)',
          }}
        >
          <iframe
            title="Mobile Preview"
            src={url}
            className="h-full w-full bg-zinc-950"
            style={{ width: dims.w, height: dims.h }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-400">
        <p>
          <strong className="text-zinc-200">Hinweis:</strong> Diese Vorschau spiegelt die App
          im aktuellen Login-Kontext. Die Volldarstellung läuft per PWA-Installation
          (Manifest unter /manifest.json).
        </p>
      </div>
    </div>
  );
}
