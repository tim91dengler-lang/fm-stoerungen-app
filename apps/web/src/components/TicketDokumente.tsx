import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileStack, FileText, Plus, Trash2, Upload } from 'lucide-react';
import { dokumentApi } from '../api/endpoints';
import type { DokumentRead } from '../api/types';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';

interface Props {
  ticketId: string;
}

/**
 * Kompakte Dokumente-Sektion fürs Ticket-Detail-Panel (Konzept §5.8).
 * Listet alle per DokumentLink { target_type: 'ticket' } verknüpften
 * Dokumente, Upload hängt direkt am Ticket. Bewusst schlank (Liste +
 * Upload + Download + Löschen) — die Vollverwaltung lebt auf der
 * zentralen Dokumente-Seite.
 */
export function TicketDokumente({ ticketId }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DokumentRead | null>(null);

  const query = useQuery({
    queryKey: ['ticket', ticketId, 'dokumente'],
    queryFn: () => dokumentApi.list({ target_type: 'ticket', target_id: ticketId }),
  });

  const upload = useMutation({
    mutationFn: (file: File) =>
      dokumentApi.upload(file, {
        name: file.name,
        links: [{ target_type: 'ticket', target_id: ticketId }],
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', ticketId, 'dokumente'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => dokumentApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', ticketId, 'dokumente'] });
      setDeleteConfirm(null);
    },
  });

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) upload.mutate(f);
    e.target.value = '';
  }

  async function onDownload(d: DokumentRead) {
    const blob = await dokumentApi.fetchBlob(d.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = d.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const docs = query.data ?? [];

  return (
    <details open className="group rounded-md border border-zinc-800 bg-zinc-900">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 lg:min-h-0">
        <FileStack className="h-3.5 w-3.5" />
        Dokumente
        {docs.length > 0 && (
          <span className="ml-1 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            {docs.length}
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
          {upload.isPending ? (
            <Upload className="h-3 w-3 animate-pulse" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
          Hochladen
        </button>
      </summary>
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onPick} />

      <div className="border-t border-zinc-800 p-3">
        {query.isLoading && <div className="text-xs text-zinc-500">Lade …</div>}
        {!query.isLoading && docs.length === 0 && (
          <div className="text-xs text-zinc-500">Keine Dokumente verknüpft.</div>
        )}
        {docs.length > 0 && (
          <ul className="space-y-1">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                <span className="min-w-0 flex-1 truncate text-zinc-200" title={d.filename}>
                  {d.name}
                </span>
                <button
                  type="button"
                  onClick={() => onDownload(d)}
                  title="Herunterladen"
                  aria-label="Herunterladen"
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(d)}
                  title="Löschen"
                  aria-label="Löschen"
                  className="rounded p-1 text-zinc-400 hover:bg-red-500/15 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {upload.isError && (
          <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300">
            Upload fehlgeschlagen.
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Dokument löschen?"
        message={
          deleteConfirm
            ? `Dokument „${deleteConfirm.name}“ wird unwiderruflich gelöscht (auch aus anderen Verknüpfungen).`
            : ''
        }
        confirmLabel="Löschen"
        tone="danger"
        onConfirm={() => deleteConfirm && remove.mutate(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </details>
  );
}
