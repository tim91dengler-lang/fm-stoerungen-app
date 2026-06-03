import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adresseApi } from '../../api/endpoints';
import type { AdresseUpdate } from '../../api/types';
import { MapsLink } from '../MapsLink';
import {
  DetailBlock,
  DetailHeader,
  DetailOverlay,
  DetailRegions,
  DetailTabs,
  InlineEditText,
  type DetailTab,
} from '../../core/detail';

/**
 * Adresse-Detail als zentriertes Overlay (Master-Layout-Standard, Reiter-Modell).
 * Bewusst schlank (nur Anschrift), inline editierbar. Hinter Flag `modul_standard`.
 * Adresse ist primär ein wiederverwendbares Inline-Formular-Feld; dieses Overlay
 * dient der Stammdaten-Pflege.
 */

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div>
      <label className="mb-0.5 block text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </label>
      <div className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-300">
        {empty ? <span className="text-zinc-600">—</span> : value}
      </div>
    </div>
  );
}

const grid = 'grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2';
const fmtDate = (s?: string | null) =>
  s ? s.slice(0, 10).split('-').reverse().join('.') : null;

type Adresse = NonNullable<ReturnType<typeof useAdresse>['data']>;
function useAdresse(adresseId: string) {
  return useQuery({
    queryKey: ['adresse', adresseId],
    queryFn: () => adresseApi.get(adresseId),
  });
}

function AdresseUebersicht({ a }: { a: Adresse }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (patch: AdresseUpdate) => adresseApi.update(a.id, patch),
    onSuccess: (updated) => {
      qc.setQueryData(['adresse', a.id], updated);
      qc.invalidateQueries({ queryKey: ['adressen'] });
    },
  });
  const commit = (patch: AdresseUpdate) =>
    mutation.mutateAsync(patch).then(() => undefined);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-3">
          <MapsLink adresse={a} />
        </div>
        <DetailRegions
          left={
            <>
              <DetailBlock title="Anschrift" blockKey="anschrift" defaultOpen count={6}>
                <div className={grid}>
                  <InlineEditText
                    label="Straße"
                    value={a.strasse}
                    required
                    onCommit={(v) => commit({ strasse: v ?? '' })}
                  />
                  <InlineEditText
                    label="Hausnummer"
                    value={a.hausnummer}
                    onCommit={(v) => commit({ hausnummer: v })}
                  />
                  <div className="sm:col-span-2">
                    <InlineEditText
                      label="Adresszusatz"
                      value={a.adresszusatz}
                      onCommit={(v) => commit({ adresszusatz: v })}
                    />
                  </div>
                  <InlineEditText
                    label="PLZ"
                    value={a.plz}
                    required
                    onCommit={(v) => commit({ plz: v ?? '' })}
                  />
                  <InlineEditText
                    label="Ort"
                    value={a.ort}
                    required
                    onCommit={(v) => commit({ ort: v ?? '' })}
                  />
                  <InlineEditText
                    label="Land"
                    value={a.land}
                    onCommit={(v) => commit({ land: v ?? '' })}
                  />
                  <div className="sm:col-span-2">
                    <InlineEditText
                      label="Bemerkung"
                      value={a.bemerkung}
                      multiline
                      onCommit={(v) => commit({ bemerkung: v })}
                    />
                  </div>
                </div>
              </DetailBlock>
            </>
          }
          right={
            <>
              <DetailBlock title="Historie" blockKey="historie" defaultOpen count={3}>
                <div className={grid}>
                  <Field label="Angelegt am" value={fmtDate(a.created_at)} />
                  <Field label="Zuletzt geändert am" value={fmtDate(a.updated_at)} />
                  <Field label="Interne ID" value={a.id} />
                </div>
              </DetailBlock>
            </>
          }
        />
      </div>
    </div>
  );
}

export function AdresseDetailOverlay({
  adresseId,
  onClose,
}: {
  adresseId: string;
  onClose: () => void;
}) {
  const adresseQuery = useAdresse(adresseId);
  const a = adresseQuery.data;

  const tabs: DetailTab[] = a
    ? [
        {
          key: 'uebersicht',
          label: 'Übersicht',
          render: () => <AdresseUebersicht a={a} />,
        },
      ]
    : [];

  return (
    <DetailOverlay open onClose={onClose} width="panel" fixedHeight>
      {adresseQuery.isLoading || !a ? (
        <div className="p-8 text-sm text-zinc-500">
          {adresseQuery.isError
            ? 'Adresse konnte nicht geladen werden.'
            : 'Lade Adresse …'}
        </div>
      ) : (
        <>
          <DetailHeader
            title={`${a.strasse}${a.hausnummer ? ' ' + a.hausnummer : ''}`}
            subtitle={`${a.plz} ${a.ort}`}
            onClose={onClose}
          />
          <DetailTabs tabs={tabs} />
        </>
      )}
    </DetailOverlay>
  );
}
