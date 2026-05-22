import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  FileBox,
  FileText,
  Image as ImageIcon,
  Plus,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../api/client';
import { dokumentApi } from '../api/endpoints';
import type { DokumentRead } from '../api/types';

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf') return FileText;
  return FileBox;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function DokumentePage() {
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['dokumente'],
    queryFn: () => dokumentApi.list(),
  });

  const filtered = useMemo(() => {
    const items = listQuery.data ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.filename.toLowerCase().includes(q) ||
        (d.kategorie ?? '').toLowerCase().includes(q),
    );
  }, [listQuery.data, search]);

  const upload = useMutation({
    mutationFn: (files: File[]) =>
      Promise.all(files.map((f) => dokumentApi.upload(f))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dokumente'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => dokumentApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dokumente'] }),
  });

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) upload.mutate(files);
  }

  async function download(d: DokumentRead) {
    const blob = await api
      .get<Blob>(`/dokumente/${d.id}/file`, { responseType: 'blob' })
      .then((r) => r.data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = d.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <FileBox className="h-5 w-5 text-emerald-400" /> Dokumente
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Wartungsverträge, Pläne, Datenblätter — mit Verknüpfungen zu Ticket / Projekt / Objekt
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Hochladen
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) upload.mutate(files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Drop-Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={clsx(
          'rounded-lg border-2 border-dashed bg-zinc-900/40 p-6 text-center transition-colors',
          dragOver ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800',
        )}
      >
        <UploadCloud
          className={clsx(
            'mx-auto mb-2 h-8 w-8',
            dragOver ? 'text-emerald-400' : 'text-zinc-600',
          )}
        />
        <p className="text-sm text-zinc-400">
          {upload.isPending ? 'Lade hoch …' : 'Dateien hier ablegen oder oben rechts hochladen'}
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          PDF, Bilder, Office-Dokumente (max 30 MB)
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            placeholder="Suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 py-1.5 pl-8 pr-3 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div className="text-xs text-zinc-500">
          {filtered.length} / {listQuery.data?.length ?? 0}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
        {listQuery.isLoading && (
          <div className="py-12 text-center text-sm text-zinc-500">Lade Dokumente …</div>
        )}
        {!listQuery.isLoading && filtered.length === 0 && (
          <div className="py-12 text-center">
            <FileBox className="mx-auto mb-2 h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-400">Keine Dokumente gefunden.</p>
          </div>
        )}
        {filtered.length > 0 && (
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Kategorie</th>
                <th className="px-4 py-2 font-medium">Größe</th>
                <th className="px-4 py-2 font-medium">Hochgeladen</th>
                <th className="px-4 py-2 font-medium">Verknüpfungen</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((d) => {
                const Icon = fileIcon(d.mime_type);
                return (
                  <tr key={d.id} className="hover:bg-zinc-900/50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-zinc-500" />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-zinc-200">{d.name}</div>
                          <div className="truncate text-xs text-zinc-500">{d.filename}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-zinc-400">
                      {d.kategorie ? (
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs">
                          {d.kategorie}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-500">{formatBytes(d.size_bytes)}</td>
                    <td className="px-4 py-2 text-xs text-zinc-500">
                      {d.hochgeladen_von?.full_name ?? '—'}
                      <div className="text-[10px]">{new Date(d.created_at).toLocaleDateString('de-DE')}</div>
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-400">
                      {d.links.length === 0 ? (
                        '—'
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {d.links.map((l) => (
                            <span
                              key={`${l.target_type}-${l.target_id}`}
                              className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400"
                            >
                              {l.target_type}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => download(d)}
                        className="mr-1 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                        title="Herunterladen"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`"${d.name}" löschen?`)) remove.mutate(d.id);
                        }}
                        className="rounded-md p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
                        title="Löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
