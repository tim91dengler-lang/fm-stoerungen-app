import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adresseApi, objektApi, partnerApi } from '../api/endpoints';
import type { ObjektCreate, ObjektRead, PartnerTyp } from '../api/types';

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

const EMPTY_FORM: ObjektCreate = {
  name: '',
  adresse_id: null,
  notiz: '',
  partner_links: [],
};

export function ObjektePage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ObjektCreate>(EMPTY_FORM);

  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['objekte', search],
    queryFn: () => objektApi.list({ search: search || undefined, limit: 100 }),
  });

  const adressenQuery = useQuery({
    queryKey: ['adressen-for-objekt'],
    queryFn: () => adresseApi.list({ limit: 500 }),
    staleTime: 60_000,
  });

  const partnerQuery = useQuery({
    queryKey: ['partner-for-objekt'],
    queryFn: () => partnerApi.list({ limit: 500 }),
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: (payload: ObjektCreate) => objektApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['objekte'] });
      closeModal();
    },
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; payload: ObjektCreate }) =>
      objektApi.update(vars.id, vars.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['objekte'] });
      closeModal();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => objektApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['objekte'] }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(o: ObjektRead) {
    setEditingId(o.id);
    setForm({
      name: o.name,
      adresse_id: o.adresse_id,
      notiz: o.notiz ?? '',
      partner_links: o.partner_links.map((l) => ({
        partner_id: l.partner_id,
        rolle: l.rolle,
      })),
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
  }

  function addLink(partnerId: string, rolle: PartnerTyp) {
    if (!partnerId) return;
    setForm((prev) => ({
      ...prev,
      partner_links: [...(prev.partner_links ?? []), { partner_id: partnerId, rolle }],
    }));
  }

  function removeLink(idx: number) {
    setForm((prev) => ({
      ...prev,
      partner_links: (prev.partner_links ?? []).filter((_, i) => i !== idx),
    }));
  }

  function handleSubmit() {
    const payload: ObjektCreate = {
      ...form,
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
          <h1 className="text-2xl font-semibold text-slate-900">Objekte</h1>
          <p className="text-sm text-slate-500">
            {listQuery.data ? `${listQuery.data.total} Objekte` : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Neues Objekt
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
        <input
          type="search"
          placeholder="Suche in Objekt-Name …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>

      {listQuery.isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
          Lade Objekte …
        </div>
      )}
      {listQuery.data && listQuery.data.items.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
          Keine Objekte gefunden.
        </div>
      )}
      {listQuery.data && listQuery.data.items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Adresse</th>
                <th className="px-4 py-2 font-medium">Partner</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listQuery.data.items.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{o.name}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {o.adresse
                      ? `${o.adresse.strasse}${o.adresse.hausnummer ? ' ' + o.adresse.hausnummer : ''}, ${o.adresse.plz} ${o.adresse.ort}`
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {o.partner_links.length === 0
                      ? '—'
                      : o.partner_links
                          .map(
                            (l) =>
                              `${l.partner_name} (${TYP_LABEL[l.rolle]})`,
                          )
                          .join(', ')}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(o)}
                      className="mr-2 text-xs font-medium text-brand-700 hover:underline"
                    >
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Objekt "${o.name}" löschen?`))
                          deleteMut.mutate(o.id);
                      }}
                      className="text-xs font-medium text-red-700 hover:underline"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? 'Objekt bearbeiten' : 'Neues Objekt'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Adresse
                </label>
                <select
                  value={form.adresse_id ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, adresse_id: e.target.value || null })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Notiz
                </label>
                <textarea
                  rows={2}
                  value={form.notiz ?? ''}
                  onChange={(e) => setForm({ ...form, notiz: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2 rounded-md border border-slate-200 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Partner-Zuordnungen
                </div>
                {(form.partner_links ?? []).length === 0 && (
                  <div className="text-xs text-slate-500">
                    Noch keine Partner zugeordnet.
                  </div>
                )}
                <ul className="space-y-1">
                  {(form.partner_links ?? []).map((l, idx) => {
                    const p = partnerQuery.data?.items.find(
                      (pp) => pp.id === l.partner_id,
                    );
                    return (
                      <li
                        key={`${l.partner_id}-${l.rolle}-${idx}`}
                        className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-sm"
                      >
                        <span>
                          {p?.name ?? l.partner_id} —{' '}
                          <span className="text-xs text-slate-600">
                            {TYP_LABEL[l.rolle]}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLink(idx)}
                          className="text-xs text-red-700 hover:underline"
                        >
                          entfernen
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <PartnerLinkAdder
                  partnerOptions={(partnerQuery.data?.items ?? []).map((p) => ({
                    id: p.id,
                    name: p.name,
                  }))}
                  onAdd={addLink}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || !form.name}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-slate-400"
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

function PartnerLinkAdder({
  partnerOptions,
  onAdd,
}: {
  partnerOptions: { id: string; name: string }[];
  onAdd: (partnerId: string, rolle: PartnerTyp) => void;
}) {
  const [partnerId, setPartnerId] = useState('');
  const [rolle, setRolle] = useState<PartnerTyp>('mieter');

  return (
    <div className="flex flex-wrap items-end gap-2">
      <select
        value={partnerId}
        onChange={(e) => setPartnerId(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
      >
        <option value="">— Partner wählen —</option>
        {partnerOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        value={rolle}
        onChange={(e) => setRolle(e.target.value as PartnerTyp)}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
      >
        {PARTNER_TYPEN.map((t) => (
          <option key={t} value={t}>
            {TYP_LABEL[t]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          onAdd(partnerId, rolle);
          setPartnerId('');
        }}
        disabled={!partnerId}
        className="rounded-md bg-slate-700 px-3 py-1 text-sm text-white hover:bg-slate-800 disabled:bg-slate-300"
      >
        + zuordnen
      </button>
    </div>
  );
}
