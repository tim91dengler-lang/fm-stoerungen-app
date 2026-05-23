import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adresseApi } from '../api/endpoints';
import type {
  AdresseCreate,
  AdresseRead,
  AdresseSuggestion,
} from '../api/types';
import { AdressSuggestCombobox } from '../components/AdressSuggestCombobox';

const EMPTY_FORM: AdresseCreate = {
  strasse: '',
  hausnummer: '',
  adresszusatz: '',
  plz: '',
  ort: '',
  land: 'DE',
  bemerkung: '',
};

export function AdressenPage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AdresseCreate>(EMPTY_FORM);
  const [suggestQuery, setSuggestQuery] = useState('');
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['adressen', search],
    queryFn: () => adresseApi.list({ search: search || undefined, limit: 100 }),
  });

  const createMut = useMutation({
    mutationFn: (payload: AdresseCreate) => adresseApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adressen'] });
      closeModal();
    },
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; payload: AdresseCreate }) =>
      adresseApi.update(vars.id, vars.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adressen'] });
      closeModal();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adresseApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adressen'] }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSuggestQuery('');
    setShowModal(true);
  }

  function openEdit(adresse: AdresseRead) {
    setEditingId(adresse.id);
    setForm({
      strasse: adresse.strasse,
      hausnummer: adresse.hausnummer ?? '',
      adresszusatz: adresse.adresszusatz ?? '',
      plz: adresse.plz,
      ort: adresse.ort,
      land: adresse.land,
      bemerkung: adresse.bemerkung ?? '',
      latitude: adresse.latitude,
      longitude: adresse.longitude,
      geocode_source: adresse.geocode_source,
    });
    setSuggestQuery(`${adresse.strasse}${adresse.hausnummer ? ' ' + adresse.hausnummer : ''}`);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
  }

  function applySuggestion(s: AdresseSuggestion) {
    setForm((prev) => ({
      ...prev,
      strasse: s.strasse ?? prev.strasse,
      hausnummer: s.hausnummer ?? prev.hausnummer,
      plz: s.plz ?? prev.plz,
      ort: s.ort ?? prev.ort,
      land: (s.land ?? prev.land ?? 'DE').toUpperCase(),
      latitude: s.latitude,
      longitude: s.longitude,
      geocode_source: 'photon',
    }));
    setSuggestQuery(s.label);
  }

  function handleSubmit() {
    if (editingId) {
      updateMut.mutate({ id: editingId, payload: form });
    } else {
      createMut.mutate(form);
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Adressen</h1>
          <p className="text-sm text-zinc-500">
            {listQuery.data ? `${listQuery.data.total} Adressen` : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          Neue Adresse
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <input
          type="search"
          placeholder="Suche in Straße, PLZ, Ort …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-zinc-700 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 bg-zinc-950 text-zinc-100"
        />
      </div>

      {listQuery.isLoading && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
          Lade Adressen …
        </div>
      )}
      {listQuery.data && listQuery.data.items.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
          Keine Adressen gefunden.
        </div>
      )}
      {listQuery.data && listQuery.data.items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-sm">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-900/50 text-left text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Straße</th>
                <th className="px-4 py-2 font-medium">PLZ / Ort</th>
                <th className="px-4 py-2 font-medium">Land</th>
                <th className="px-4 py-2 font-medium">Geocode</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {listQuery.data.items.map((a) => (
                <tr key={a.id} className="hover:bg-zinc-900/50">
                  <td className="px-4 py-2">
                    {a.strasse}
                    {a.hausnummer ? ` ${a.hausnummer}` : ''}
                    {a.adresszusatz ? (
                      <span className="ml-1 text-xs text-zinc-500">
                        ({a.adresszusatz})
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    {a.plz} {a.ort}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs uppercase">{a.land}</td>
                  <td className="px-4 py-2 text-xs text-zinc-500">
                    {a.latitude && a.longitude
                      ? `${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      className="mr-2 text-xs font-medium text-emerald-300 hover:underline"
                    >
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Adresse "${a.strasse}" löschen?`)) {
                          deleteMut.mutate(a.id);
                        }
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
            className="w-full max-w-xl rounded-xl bg-zinc-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">
                {editingId ? 'Adresse bearbeiten' : 'Neue Adresse'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800"
                aria-label="Schließen"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Adress-Suche (Photon)
                </label>
                <AdressSuggestCombobox
                  value={suggestQuery}
                  onChange={setSuggestQuery}
                  onSelect={applySuggestion}
                  country={form.land?.toLowerCase()}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-300">
                    Straße
                  </label>
                  <input
                    type="text"
                    value={form.strasse}
                    onChange={(e) =>
                      setForm({ ...form, strasse: e.target.value })
                    }
                    className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm bg-zinc-950 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">
                    Hausnummer
                  </label>
                  <input
                    type="text"
                    value={form.hausnummer ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, hausnummer: e.target.value })
                    }
                    className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm bg-zinc-950 text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Adresszusatz (z. B. Hinterhaus, 3. OG)
                </label>
                <input
                  type="text"
                  value={form.adresszusatz ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, adresszusatz: e.target.value })
                  }
                  className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm bg-zinc-950 text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">
                    PLZ
                  </label>
                  <input
                    type="text"
                    value={form.plz}
                    onChange={(e) => setForm({ ...form, plz: e.target.value })}
                    className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm bg-zinc-950 text-zinc-100"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-300">
                    Ort
                  </label>
                  <input
                    type="text"
                    value={form.ort}
                    onChange={(e) => setForm({ ...form, ort: e.target.value })}
                    className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm bg-zinc-950 text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Land (ISO 2-Letter)
                </label>
                <input
                  type="text"
                  value={form.land ?? 'DE'}
                  onChange={(e) =>
                    setForm({ ...form, land: e.target.value.toUpperCase() })
                  }
                  className="w-24 rounded-md border border-zinc-700 px-3 py-2 text-sm uppercase bg-zinc-950 text-zinc-100"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Bemerkung
                </label>
                <textarea
                  value={form.bemerkung ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, bemerkung: e.target.value })
                  }
                  rows={2}
                  className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm bg-zinc-950 text-zinc-100"
                />
              </div>

              {(form.latitude !== null && form.latitude !== undefined) && (
                <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Geocodiert via {form.geocode_source ?? 'photon'} —{' '}
                  {form.latitude?.toFixed(4)}, {form.longitude?.toFixed(4)}
                </div>
              )}
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
                disabled={isPending}
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
