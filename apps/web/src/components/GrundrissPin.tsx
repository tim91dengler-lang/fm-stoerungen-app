import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { objektstrukturApi } from '../api/endpoints';

export interface PinMark {
  x: number;
  y: number;
  /** Tailwind-Hintergrundklasse für den Aggregat-Punkt (z. B. nach Priorität). */
  colorClass?: string;
  title?: string;
}

interface Props {
  stockwerkId: string;
  /** Hauptpin dieses Tickets (Prozentkoordinaten 0..100) oder null. */
  pin: { x: number; y: number } | null;
  /** Editierbar: Klick auf den Grundriss ruft onSetPin mit %-Koordinaten. */
  onSetPin?: (x: number, y: number) => void;
  /** Weitere Pins (z. B. andere offene Tickets im Stockwerk). */
  extraPins?: PinMark[];
}

/**
 * Grundriss-Viewer mit Pin (Konzept §8.3). Lädt das Stockwerk-Grundrissbild
 * als Blob und überlagert Pins per Prozentkoordinaten. Im Edit-Modus
 * (onSetPin gesetzt) markiert ein Klick die Lage.
 */
export function GrundrissPin({ stockwerkId, pin, onSetPin, extraPins }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);

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
    if (!onSetPin) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onSetPin(
      Math.round(Math.max(0, Math.min(100, x)) * 100) / 100,
      Math.round(Math.max(0, Math.min(100, y)) * 100) / 100,
    );
  }

  if (err) {
    return <div className="text-xs text-zinc-500">Grundriss konnte nicht geladen werden.</div>;
  }
  if (!url) {
    return <div className="text-xs text-zinc-500">Lade Grundriss …</div>;
  }

  return (
    <div
      className={`relative overflow-hidden rounded-md border border-zinc-800 ${onSetPin ? 'cursor-crosshair' : ''}`}
      onClick={handleClick}
    >
      <img src={url} alt="Grundriss" className="block w-full select-none" draggable={false} />
      {extraPins?.map((p, i) => (
        <span
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          title={p.title}
        >
          <span
            className={`block h-3 w-3 rounded-full border border-white/70 ${p.colorClass ?? 'bg-zinc-400'}`}
          />
        </span>
      ))}
      {pin && (
        <span
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
          style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
        >
          <MapPin className="h-6 w-6 text-emerald-400 drop-shadow" fill="currentColor" />
        </span>
      )}
      {onSetPin && (
        <div className="pointer-events-none absolute bottom-1 left-1 rounded bg-zinc-950/70 px-1.5 py-0.5 text-[10px] text-zinc-300">
          Klicken, um die Lage zu markieren
        </div>
      )}
    </div>
  );
}
