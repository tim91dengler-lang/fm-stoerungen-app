import { useEffect, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { objektstrukturApi } from '../api/endpoints';
import type { TicketPin } from '../api/types';

export interface PinMark {
  x: number;
  y: number;
  /** Tailwind-Hintergrundklasse für den Aggregat-Punkt (z. B. nach Priorität). */
  colorClass?: string;
  title?: string;
}

interface Props {
  stockwerkId: string;
  /** Markierungen dieses Tickets (Prozentkoordinaten 0..100). */
  pins: TicketPin[];
  /** Editierbar: Klick auf den Grundriss fügt einen Pin hinzu, Klick auf einen
   *  Pin entfernt ihn. Ohne onChange ist die Anzeige nur lesend. */
  onChange?: (pins: TicketPin[]) => void;
  /** Weitere Pins (z. B. andere offene Tickets im Stockwerk) — nur Anzeige. */
  extraPins?: PinMark[];
}

function round2(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)) * 100) / 100;
}

/**
 * Grundriss-Viewer mit mehreren Pins (Konzept TicketDetail_UX §3). Lädt das
 * Stockwerk-Grundrissbild als Blob und überlagert Pins per Prozentkoordinaten.
 * Im Edit-Modus (onChange gesetzt) setzt ein Klick einen weiteren Pin; ein
 * Klick auf einen vorhandenen Pin entfernt ihn.
 */
export function GrundrissPin({ stockwerkId, pins, onChange, extraPins }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const list = pins ?? [];

  useEffect(() => {
    let revoked = false;
    let objUrl: string | null = null;
    setUrl(null);
    setErr(false);
    objektstrukturApi
      .fetchGrundrissBlob(stockwerkId)
      .then((blob) => {
        if (revoked) return;
        objUrl = URL.createObjectURL(blob);
        setUrl(objUrl);
      })
      .catch(() => setErr(true));
    return () => {
      revoked = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [stockwerkId]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = round2(((e.clientX - rect.left) / rect.width) * 100);
    const y = round2(((e.clientY - rect.top) / rect.height) * 100);
    onChange([...list, { x, y }]);
  }

  function removePin(index: number) {
    if (!onChange) return;
    onChange(list.filter((_, i) => i !== index));
  }

  if (err) {
    return <div className="text-xs text-zinc-500">Grundriss konnte nicht geladen werden.</div>;
  }
  if (!url) {
    return <div className="text-xs text-zinc-500">Lade Grundriss …</div>;
  }

  return (
    <div
      className={`relative overflow-hidden rounded-md border border-zinc-800 ${onChange ? 'cursor-crosshair' : ''}`}
      onClick={handleClick}
    >
      <img src={url} alt="Grundriss" className="block w-full select-none" draggable={false} />

      {extraPins?.map((p, i) => (
        <span
          key={`extra-${i}`}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          title={p.title}
        >
          <span
            className={`block h-3 w-3 rounded-full border border-white/70 ${p.colorClass ?? 'bg-zinc-400'}`}
          />
        </span>
      ))}

      {list.map((pin, i) => (
        <button
          key={`pin-${i}`}
          type="button"
          disabled={!onChange}
          onClick={(e) => {
            e.stopPropagation();
            removePin(i);
          }}
          title={onChange ? `Pin ${i + 1} entfernen` : `Pin ${i + 1}`}
          className={`absolute -translate-x-1/2 -translate-y-full ${onChange ? 'group cursor-pointer' : 'pointer-events-none'}`}
          style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
        >
          <MapPin className="h-6 w-6 text-emerald-400 drop-shadow" fill="currentColor" />
          <span className="absolute left-1/2 top-1.5 -translate-x-1/2 text-[9px] font-bold text-zinc-950">
            {i + 1}
          </span>
          {onChange && (
            <span className="absolute -right-1 -top-1 hidden rounded-full bg-red-500 p-0.5 text-white group-hover:block">
              <X className="h-2.5 w-2.5" />
            </span>
          )}
        </button>
      ))}

      {onChange && (
        <div className="pointer-events-none absolute bottom-1 left-1 rounded bg-zinc-950/70 px-1.5 py-0.5 text-[10px] text-zinc-300">
          Klicken zum Markieren · Pin antippen zum Entfernen
        </div>
      )}
    </div>
  );
}
