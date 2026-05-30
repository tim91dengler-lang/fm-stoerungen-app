import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Image as ImageIcon, Trash2, Upload, X } from 'lucide-react';
import { photoApi } from '../api/endpoints';
import { formatRelativeDateTime } from '../lib/format';
import type { TicketPhotoRead } from '../api/types';
import { AnnotationEditor } from './AnnotationEditor';

interface Props {
  ticketId: string;
}

export function PhotoGallery({ ticketId }: Props) {
  const qc = useQueryClient();
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const photosQuery = useQuery({
    queryKey: ['ticket-photos', ticketId],
    queryFn: () => photoApi.list(ticketId),
  });

  const upload = useMutation({
    mutationFn: ({ file, beschreibung }: { file: File; beschreibung?: string }) =>
      photoApi.upload(ticketId, file, beschreibung),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['ticket-photos', ticketId] }),
  });

  const remove = useMutation({
    mutationFn: (pid: string) => photoApi.remove(ticketId, pid),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['ticket-photos', ticketId] }),
  });

  function onFilesSelected(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      upload.mutate({ file });
    });
  }

  const photos = photosQuery.data ?? [];
  const lightboxPhoto = photos.find((p) => p.id === lightboxId) ?? null;

  return (
    <details
      open
      className="group rounded-md border border-zinc-800 bg-zinc-900"
    >
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 lg:min-h-0">
        <Camera className="h-3.5 w-3.5" />
        Fotos vor Ort
        {photos.length > 0 && (
          <span className="ml-1 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            {photos.length}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            fileInputRef.current?.click();
          }}
          className="ml-auto flex min-h-11 items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold normal-case text-emerald-300 hover:bg-emerald-500/25 lg:min-h-0"
        >
          <Upload className="h-3 w-3" /> + Foto hinzufügen
        </button>
      </summary>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        className="hidden"
        onChange={(e) => onFilesSelected(e.target.files)}
      />

      <div className="border-t border-zinc-800 p-3">
        {photosQuery.isLoading && (
          <div className="text-xs text-zinc-500">Lade …</div>
        )}
        {!photosQuery.isLoading && photos.length === 0 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-md border-2 border-dashed border-zinc-700 px-4 py-8 text-zinc-500 hover:border-emerald-500/40 hover:text-emerald-300"
          >
            <ImageIcon className="h-8 w-8" />
            <div className="text-sm font-medium">
              Foto vom Schaden anhängen
            </div>
            <div className="text-xs text-zinc-500">
              Mit Klick öffnen oder Dateien hier ablegen — auch später möglich
            </div>
          </button>
        )}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <PhotoThumbnail
                key={p.id}
                ticketId={ticketId}
                photo={p}
                onOpen={() => setLightboxId(p.id)}
                onDelete={() => {
                  if (confirm('Foto wirklich löschen?')) remove.mutate(p.id);
                }}
              />
            ))}
          </div>
        )}
        {upload.isPending && (
          <div className="mt-2 text-xs text-zinc-500">
            Lade Foto hoch …
          </div>
        )}
        {upload.isError && (
          <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300">
            Upload fehlgeschlagen. Max. 10 MB, Format JPG/PNG/WEBP.
          </div>
        )}
      </div>

      {lightboxPhoto && (
        <PhotoLightbox
          ticketId={ticketId}
          photo={lightboxPhoto}
          onClose={() => setLightboxId(null)}
        />
      )}
    </details>
  );
}

function PhotoThumbnail({
  ticketId,
  photo,
  onOpen,
  onDelete,
}: {
  ticketId: string;
  photo: TicketPhotoRead;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    photoApi
      .fetchBlob(ticketId, photo.id)
      .then((blob) => {
        if (revoked) return;
        setUrl(URL.createObjectURL(blob));
      })
      .catch(() => setUrl(null));
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, photo.id]);

  return (
    <div className="group/photo relative aspect-square overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
      {url ? (
        <button
          type="button"
          onClick={onOpen}
          className="block h-full w-full"
        >
          <img
            src={url}
            alt={photo.filename}
            className="h-full w-full object-cover"
          />
        </button>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-zinc-700">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-1 top-1 rounded-md bg-zinc-950/80 p-1 text-zinc-300 opacity-0 transition-opacity hover:bg-red-500/30 hover:text-red-300 group-hover/photo:opacity-100"
        title="Foto löschen"
      >
        <Trash2 className="h-3 w-3" />
      </button>
      {photo.annotations.length > 0 && (
        <div className="absolute bottom-1 left-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
          {photo.annotations.length} ✎
        </div>
      )}
    </div>
  );
}

function PhotoLightbox({
  ticketId,
  photo,
  onClose,
}: {
  ticketId: string;
  photo: TicketPhotoRead;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    photoApi
      .fetchBlob(ticketId, photo.id)
      .then((blob) => {
        if (revoked) return;
        setUrl(URL.createObjectURL(blob));
      })
      .catch(() => setUrl(null));
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, photo.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] max-w-5xl flex-col overflow-hidden rounded-lg bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-zinc-200">
              {photo.filename}
            </div>
            <div className="text-[10px] text-zinc-500">
              {photo.uploaded_by?.full_name ?? '—'} ·{' '}
              {formatRelativeDateTime(photo.created_at)} ·{' '}
              {Math.round(photo.size_bytes / 1024)} kB
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative flex flex-1 items-center justify-center overflow-auto bg-zinc-950">
          {url ? (
            <AnnotationEditor
              ticketId={ticketId}
              photo={photo}
              imageUrl={url}
            />
          ) : (
            <div className="p-8 text-sm text-zinc-500">Lade Bild …</div>
          )}
        </div>
      </div>
    </div>
  );
}
