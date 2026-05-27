import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  ExternalLink,
  FileText,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';

import { dokumentApi } from '../../api/endpoints';
import type { DokumentRead } from '../../api/types';
import { ConfirmDialog } from '../../core/liste/ConfirmDialog';

interface Props {
  partnerId: string;
  partnerName: string;
}

/**
 * Tab 6 — Dokumente (Track 3 Polish 2026-05-26).
 *
 * Listet alle Dokumente, die per `DokumentLink { target_type: 'partner',
 * target_id }` mit dem Partner verknüpft sind. Upload-Button hängt das
 * hochgeladene Dokument direkt mit dem Partner-Link an.
 *
 * Bewusst schlank: keine Detail-Ansicht (Dokumente werden über die zentrale
 * Dokumente-Seite verwaltet), nur Liste + Upload + Lösen + Download.
 */
export function PartnerTabDokumente({ partnerId, partnerName }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<DokumentRead | null>(null);

  const dokumenteQuery = useQuery({
    queryKey: ['partner', partnerId, 'dokumente'],
    queryFn: () =>
      dokumentApi.list({ target_type: 'partner', target_id: partnerId }),
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) =>
      dokumentApi.upload(file, {
        name: file.name,
        links: [{ target_type: 'partner', target_id: partnerId }],
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner', partnerId, 'dokumente'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => dokumentApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', partnerId, 'dokumente'] });
      setDeleteConfirm(null);
    },
  });

  const filtered = useMemo<DokumentRead[]>(() => {
    if (!dokumenteQuery.data) return [];
    if (!search) return dokumenteQuery.data;
    const needle = search.toLowerCase();
    return dokumenteQuery.data.filter((d) =>
      [d.name, d.filename, d.kategorie ?? '', d.beschreibung ?? ''].some((v) =>
        v.toLowerCase().includes(needle),
      ),
    );
  }, [dokumenteQuery.data, search]);

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) uploadMut.mutate(f);
    // Reset input so the same file can be picked twice
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

  return (
    <div className="space-y-4 px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-300">
          Dokumente zu {partnerName}
        </h2>
        <span className="text-xs text-zinc-500">
          {filtered.length} von {dokumenteQuery.data?.length ?? 0}
        </span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMut.isPending}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {uploadMut.isPending ? (
            <Upload className="h-3.5 w-3.5 animate-pulse" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {uploadMut.isPending ? 'Lade hoch …' : 'Dokument hochladen'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={onFilePick}
          className="hidden"
        />
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Suche im Namen / Kategorie / Beschreibung"
        className="w-80 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
      />

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/50 text-xs uppercase text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Kategorie</th>
              <th className="px-3 py-2 font-medium">Hochgeladen</th>
              <th className="px-3 py-2 font-medium">Größe</th>
              <th className="w-24 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {dokumenteQuery.isLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-zinc-500">
                  Lade …
                </td>
              </tr>
            )}
            {!dokumenteQuery.isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-zinc-500">
                  Keine Dokumente verknüpft. Klick auf &bdquo;Dokument hochladen&ldquo;.
                </td>
              </tr>
            )}
            {filtered.map((d) => (
              <tr
                key={d.id}
                className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    <div className="min-w-0">
                      <div className="truncate text-zinc-200">{d.name}</div>
                      <div className="truncate text-[11px] text-zinc-500">
                        {d.filename}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-zinc-400">{d.kategorie ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-zinc-400">
                  {new Date(d.created_at).toLocaleDateString('de-DE')}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-400">
                  {formatBytes(d.size_bytes)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDownload(d)}
                      title="Herunterladen"
                      aria-label="Herunterladen"
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <a
                      href={`/dokumente?selected=${d.id}`}
                      title="Zu Dokumente-Seite"
                      aria-label="Zur Dokumente-Seite"
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(d)}
                      title="Löschen"
                      aria-label="Löschen"
                      className="rounded p-1 text-zinc-400 hover:bg-red-500/15 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Dokument löschen?"
        message={
          deleteConfirm
            ? `Dokument "${deleteConfirm.name}" wird unwiderruflich gelöscht (auch aus anderen Verknüpfungen).`
            : ''
        }
        confirmLabel="Löschen"
        tone="danger"
        onConfirm={() => deleteConfirm && deleteMut.mutate(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
