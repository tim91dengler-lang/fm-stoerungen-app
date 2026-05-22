import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  auswahllistenApi,
  objektApi,
  partnerApi,
  ticketApi,
  userApi,
} from '../api/endpoints';

const schema = z.object({
  titel: z.string().min(1, 'Titel fehlt').max(200),
  beschreibung: z.string().max(10_000).optional().default(''),
  prioritaet: z
    .enum(['niedrig', 'mittel', 'hoch', 'kritisch'])
    .default('mittel'),
  kategorie: z.string().optional().nullable(),
  objekt_id: z.string().uuid().optional().nullable(),
  partner_id: z.string().uuid().optional().nullable(),
  zugewiesen_an_id: z.string().uuid().optional().nullable(),
});

type Form = z.infer<typeof schema>;

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function TicketErfassenModal({ onClose, onCreated }: Props) {
  const { data: users } = useQuery({
    queryKey: ['users-for-assign'],
    queryFn: () => userApi.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const { data: objekte } = useQuery({
    queryKey: ['objekte-for-ticket'],
    queryFn: () => objektApi.list({ limit: 500 }),
    staleTime: 60_000,
  });

  const { data: partnerListe } = useQuery({
    queryKey: ['partner-for-ticket'],
    queryFn: () => partnerApi.list({ limit: 500 }),
    staleTime: 60_000,
  });

  const { data: auswahllisten } = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
    staleTime: 60_000,
  });

  const kategorienListe = auswahllisten?.find(
    (l) => l.key === 'ticket_kategorie',
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      titel: '',
      beschreibung: '',
      prioritaet: 'mittel',
      kategorie: null,
      objekt_id: null,
      partner_id: null,
      zugewiesen_an_id: null,
    },
  });

  const create = useMutation({
    mutationFn: (data: Form) =>
      ticketApi.create({
        titel: data.titel,
        beschreibung: data.beschreibung,
        prioritaet: data.prioritaet,
        kategorie: data.kategorie || null,
        objekt_id: data.objekt_id || null,
        partner_id: data.partner_id || null,
        zugewiesen_an_id: data.zugewiesen_an_id || null,
      }),
    onSuccess: () => onCreated(),
    onError: () => setError('root', { message: 'Anlegen fehlgeschlagen.' }),
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Neues Ticket</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit((data) => create.mutate(data))}
          className="space-y-4"
        >
          <div>
            <label htmlFor="titel" className="block text-sm font-medium text-slate-700">
              Titel
            </label>
            <input
              id="titel"
              {...register('titel')}
              autoFocus
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {errors.titel && (
              <p className="mt-1 text-xs text-red-600">{errors.titel.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="beschreibung"
              className="block text-sm font-medium text-slate-700"
            >
              Beschreibung
            </label>
            <textarea
              id="beschreibung"
              rows={4}
              {...register('beschreibung')}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="prioritaet"
                className="block text-sm font-medium text-slate-700"
              >
                Priorität
              </label>
              <select
                id="prioritaet"
                {...register('prioritaet')}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="niedrig">Niedrig</option>
                <option value="mittel">Mittel</option>
                <option value="hoch">Hoch</option>
                <option value="kritisch">Kritisch</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="kategorie"
                className="block text-sm font-medium text-slate-700"
              >
                Kategorie
              </label>
              <select
                id="kategorie"
                {...register('kategorie', {
                  setValueAs: (v) => (v === '' ? null : v),
                })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">— (keine) —</option>
                {kategorienListe?.werte.map((w) => (
                  <option key={w.id} value={w.key}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="objekt_id"
                className="block text-sm font-medium text-slate-700"
              >
                Objekt
              </label>
              <select
                id="objekt_id"
                {...register('objekt_id', {
                  setValueAs: (v) => (v === '' ? null : v),
                })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">— (keins) —</option>
                {objekte?.items.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="partner_id"
                className="block text-sm font-medium text-slate-700"
              >
                Partner (Auftraggeber/Mieter)
              </label>
              <select
                id="partner_id"
                {...register('partner_id', {
                  setValueAs: (v) => (v === '' ? null : v),
                })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">— (keiner) —</option>
                {partnerListe?.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="zugewiesen_an_id"
              className="block text-sm font-medium text-slate-700"
            >
              Zugewiesen an
            </label>
            <select
              id="zugewiesen_an_id"
              {...register('zugewiesen_an_id', {
                setValueAs: (v) => (v === '' ? null : v),
              })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">— (offen) —</option>
              {users?.items.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>

          {errors.root && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {errors.root.message}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting || create.isPending}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:bg-slate-400"
            >
              {isSubmitting || create.isPending ? 'Wird angelegt …' : 'Anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
