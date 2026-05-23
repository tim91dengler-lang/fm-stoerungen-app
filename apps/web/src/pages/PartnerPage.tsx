import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adresseApi, partnerApi } from '../api/endpoints';
import type {
  PartnerCreate,
  PartnerRead,
  PartnerTyp,
} from '../api/types';

const PARTNER_TYPEN: PartnerTyp[] = [
  'mieter',
  'eigentuemer',
  'auftraggeber',
  'nachunternehmer',
];

const TYP_LABEL: Record<PartnerTyp, string> = {
  mieter: 'Mieter',
  eigentuemer: 'Eigentümer',
  auftraggeber: 'Auftraggeber',
  nachunternehmer: 'Nachunternehmer',
};

const EMPTY_FORM: PartnerCreate = {
  name: '',
  ansprechpartner: '',
  email: '',
  telefon: '',
  adresse_id: null,
  notiz: '',
  typen: [],
};

export function PartnerPage() {
  const [search, setSearch] = useState('');
  const [typenFilter, setTypenFilter] = useState<PartnerTyp[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerCreate>(EMPTY_FORM);
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['partner', search, typenFilter],
    queryFn: () =>
      partnerApi.list({
        search: search || undefined,
        typ: typenFilter.length > 0 ? typenFilter : undefined,
        limit: 200,
      }),
  });

  const adressenQuery = useQuery({
    queryKey: ['adressen-for-partner'],
    queryFn: () => adresseApi.list({ limit: 500 }),
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: (payload: PartnerCreate) => partnerApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner'] });
      closeModal();
    },
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; payload: PartnerCreate }) =>
      partnerApi.update(vars.id, vars.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner'] });
      closeModal();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => partnerApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner'] }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(p: PartnerRead) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      ansprechpartner: p.ansprechpartner ?? '',
      email: p.email ?? '',
      telefon: p.telefon ?? '',
      adresse_id: p.adresse_id,
      notiz: p.notiz ?? '',
      typen: p.typen,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
  }

  function toggleTypInForm(t: PartnerTyp) {
    setForm((prev) => ({
      ...prev,
      typen: prev.typen.includes(t)
        ? prev.typen.filter((x) => x !== t)
        : [...prev.typen, t],
    }));
  }

  function toggleTypFilter(t: PartnerTyp) {
    setTypenFilter((cur) =>
      cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t],
    );
  }

  function handleSubmit() {
    const payload: PartnerCreate = {
      ...form,
      email: form.email || null,
      ansprechpartner: form.ansprechpartner || null,
      telefon: form.telefon || null,
      notiz: form.notiz || null,
    };
    if (editingId) updateMut.mutate({ id: editingId, payload });
    else createMut.mutate(payload);
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">
            Geschäftspartner
          </h1>
          <p className="text-sm text-zinc-500">
            {listQuery.data ? `${listQuery.data.total} Partner` : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          Neuer Partner
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Suche in Name, Ansprechpartner, E-Mail …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[16rem] flex-1 rounded-md border border-zinc-700 px-3 py-1.5 text-sm bg-zinc-950 text-zinc-100"
          />
          <div className="flex flex-wrap gap-1">
            {PARTNER_TYPEN.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTypFilter(t)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  typenFilter.includes(t)
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {TYP_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {listQuery.isLoading && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
          Lade Partner …
        </div>
      )}
      {listQuery.data && listQuery.data.items.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
          Keine Partner gefunden.
        </div>
      )}
      {listQuery.data && listQuery.data.items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-sm">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-900/50 text-left text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Typen</th>
                <th className="px-4 py-2 font-medium">Ansprechpartner</th>
                <th className="px-4 py-2 font-medium">Kontakt</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {listQuery.data.items.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-900/50">
                  <td className="px-4 py-2 font-medium text-zinc-200">
                    {p.name}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.typen.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300"
                        >
                          {TYP_LABEL[t]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-zinc-300">
                    {p.ansprechpartner ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-400">
                    <div>{p.email ?? '—'}</div>
                    <div>{p.telefon ?? '—'}</div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="mr-2 text-xs font-medium text-emerald-300 hover:underline"
                    >
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Partner "${p.name}" löschen?`))
                          deleteMut.mutate(p.id);
                      }}
                      className="text-xs font-medium text-red-400 hover:underline"
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-zinc-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? 'Partner bearbeiten' : 'Neuer Partner'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm bg-zinc-950 text-zinc-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Typen
                </label>
                <div className="flex flex-wrap gap-2">
                  {PARTNER_TYPEN.map((t) => (
                    <label
                      key={t}
                      className="inline-flex cursor-pointer items-center gap-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.typen.includes(t)}
                        onChange={() => toggleTypInForm(t)}
                      />
                      {TYP_LABEL[t]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">
                    Ansprechpartner
                  </label>
                  <input
                    type="text"
                    value={form.ansprechpartner ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, ansprechpartner: e.target.value })
                    }
                    className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm bg-zinc-950 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">
                    Telefon
                  </label>
                  <input
                    type="text"
                    value={form.telefon ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, telefon: e.target.value })
                    }
                    className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm bg-zinc-950 text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  E-Mail
                </label>
                <input
                  type="email"
                  value={form.email ?? ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm bg-zinc-950 text-zinc-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Adresse (optional)
                </label>
                <select
                  value={form.adresse_id ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, adresse_id: e.target.value || null })
                  }
                  className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm bg-zinc-950 text-zinc-100"
                >
                  <option value="">— Keine —</option>
                  {adressenQuery.data?.items.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.strasse}
                      {a.hausnummer ? ` ${a.hausnummer}` : ''}, {a.plz} {a.ort}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Notiz
                </label>
                <textarea
                  rows={2}
                  value={form.notiz ?? ''}
                  onChange={(e) => setForm({ ...form, notiz: e.target.value })}
                  className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm bg-zinc-950 text-zinc-100"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm bg-zinc-950 text-zinc-100"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || !form.name}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                {isPending ? 'Speichere …' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
