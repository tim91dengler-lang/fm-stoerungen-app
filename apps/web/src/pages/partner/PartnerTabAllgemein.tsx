import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';

import { partnerApi } from '../../api/endpoints';
import type {
  AuswahllisteRead,
  PartnerHierarchieResponse,
  PartnerRead,
  PartnerUpdate,
} from '../../api/types';
import type { PartnerTypLookup } from '../../lib/usePartnerTypLookup';
import { FilialenBaum } from './FilialenBaum';
import { TypenMultiSelect } from './TypenMultiSelect';
import type { EditBuffer } from './useEditBuffer';

interface Props {
  partner: PartnerRead;
  listen: Map<string, AuswahllisteRead>;
  partnerTypLookup: PartnerTypLookup;
  edit: EditBuffer<PartnerUpdate>;
}

const inputCls =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none';

/**
 * Tab 1 — Allgemein / Struktur (Spec §5.4).
 *
 * Zweispaltig auf lg-Screens. Links: Stammdaten, Hauptsitz, Kommunikation,
 * Weitere Stammdaten, Notizen. Rechts: Filialen-Baum + Typen-Klassifikation.
 */
export function PartnerTabAllgemein({ partner, listen, partnerTypLookup, edit }: Props) {
  const hierarchieQuery = useQuery({
    queryKey: ['partner', partner.id, 'hierarchie'],
    queryFn: () => partnerApi.getHierarchie(partner.id) as Promise<PartnerHierarchieResponse>,
  });

  const anreden = listen.get('anrede')?.werte ?? [];
  const titelWerte = listen.get('titel')?.werte ?? [];
  const rechtsformen = listen.get('rechtsform')?.werte ?? [];
  const branchen = listen.get('branche')?.werte ?? [];

  const isEdit = edit.editMode && edit.draft !== null;
  const draft = edit.draft;

  // Wert für die Anzeige: im Edit-Modus aus Draft, sonst vom Server.
  const v = isEdit && draft
    ? {
        name: draft.name ?? partner.name,
        anrede_id: draft.anrede_id ?? null,
        titel: draft.titel ?? '',
        vorname: draft.vorname ?? '',
        nachname: draft.nachname ?? '',
        telefon: draft.telefon ?? '',
        mobil: draft.mobil ?? '',
        telefax: draft.telefax ?? '',
        email: draft.email ?? '',
        website: draft.website ?? '',
        rechtsform_id: draft.rechtsform_id ?? null,
        branche_id: draft.branche_id ?? null,
        ust_id_nr: draft.ust_id_nr ?? '',
        steuer_nr: draft.steuer_nr ?? '',
        hrb: draft.hrb ?? '',
        notiz: draft.notiz ?? '',
        typen: draft.typen ?? partner.typen,
      }
    : {
        name: partner.name,
        anrede_id: partner.anrede_id,
        titel: partner.titel ?? '',
        vorname: partner.vorname ?? '',
        nachname: partner.nachname ?? '',
        telefon: partner.telefon ?? '',
        mobil: partner.mobil ?? '',
        telefax: partner.telefax ?? '',
        email: partner.email ?? '',
        website: partner.website ?? '',
        rechtsform_id: partner.rechtsform_id,
        branche_id: partner.branche_id,
        ust_id_nr: partner.ust_id_nr ?? '',
        steuer_nr: partner.steuer_nr ?? '',
        hrb: partner.hrb ?? '',
        notiz: partner.notiz ?? '',
        typen: partner.typen,
      };

  // Hauptsitz: erste Adresse mit ist_primaer=true; sonst erste, sonst null.
  const hauptsitzLink =
    partner.adress_links.find((a) => a.ist_primaer) ?? partner.adress_links[0] ?? null;
  const hauptsitz = hauptsitzLink?.adresse ?? null;

  return (
    <div className="grid gap-6 px-4 py-6 lg:grid-cols-2 lg:px-8">
      {/* Linke Spalte */}
      <div className="space-y-6">
        <Block title="Stammdaten">
          <Field label="Name">
            {isEdit ? (
              <input
                type="text"
                value={v.name}
                onChange={(e) => edit.update({ name: e.target.value })}
                className={inputCls}
              />
            ) : (
              <ReadValue>{v.name}</ReadValue>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Anrede">
              {isEdit ? (
                <select
                  value={v.anrede_id ?? ''}
                  onChange={(e) =>
                    edit.update({ anrede_id: e.target.value || null })
                  }
                  className={inputCls}
                >
                  <option value="">—</option>
                  {anreden.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              ) : (
                <ReadValue>
                  {anreden.find((w) => w.id === v.anrede_id)?.label ?? '—'}
                </ReadValue>
              )}
            </Field>
            <Field label="Titel">
              {isEdit ? (
                <select
                  value={v.titel}
                  onChange={(e) => edit.update({ titel: e.target.value || null })}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {titelWerte.map((w) => (
                    <option key={w.id} value={w.label}>
                      {w.label}
                    </option>
                  ))}
                </select>
              ) : (
                <ReadValue>{v.titel || '—'}</ReadValue>
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vorname">
              {isEdit ? (
                <input
                  type="text"
                  value={v.vorname}
                  onChange={(e) =>
                    edit.update({ vorname: e.target.value || null })
                  }
                  className={inputCls}
                />
              ) : (
                <ReadValue>{v.vorname || '—'}</ReadValue>
              )}
            </Field>
            <Field label="Nachname">
              {isEdit ? (
                <input
                  type="text"
                  value={v.nachname}
                  onChange={(e) =>
                    edit.update({ nachname: e.target.value || null })
                  }
                  className={inputCls}
                />
              ) : (
                <ReadValue>{v.nachname || '—'}</ReadValue>
              )}
            </Field>
          </div>
        </Block>

        <Block title="Hauptsitz">
          {hauptsitz ? (
            <div className="text-sm text-zinc-300">
              <div>
                {hauptsitz.strasse} {hauptsitz.hausnummer ?? ''}
              </div>
              <div>
                {hauptsitz.plz} {hauptsitz.ort}
              </div>
              {hauptsitz.land && hauptsitz.land !== 'DE' && (
                <div>{hauptsitz.land}</div>
              )}
              <div className="mt-1 text-[11px] text-zinc-500">
                Adressen pflegst du via Tab &bdquo;Adressen&ldquo; (Folge-Release).
              </div>
            </div>
          ) : (
            <span className="text-sm text-zinc-500">Keine Hauptsitz-Adresse hinterlegt.</span>
          )}
        </Block>

        <Block title="Kommunikation">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefon">
              {isEdit ? (
                <input
                  type="text"
                  value={v.telefon}
                  onChange={(e) =>
                    edit.update({ telefon: e.target.value || null })
                  }
                  className={inputCls}
                />
              ) : (
                <ReadValue>{v.telefon || '—'}</ReadValue>
              )}
            </Field>
            <Field label="Mobil">
              {isEdit ? (
                <input
                  type="text"
                  value={v.mobil}
                  onChange={(e) =>
                    edit.update({ mobil: e.target.value || null })
                  }
                  className={inputCls}
                />
              ) : (
                <ReadValue>{v.mobil || '—'}</ReadValue>
              )}
            </Field>
            <Field label="Telefax">
              {isEdit ? (
                <input
                  type="text"
                  value={v.telefax}
                  onChange={(e) =>
                    edit.update({ telefax: e.target.value || null })
                  }
                  className={inputCls}
                />
              ) : (
                <ReadValue>{v.telefax || '—'}</ReadValue>
              )}
            </Field>
            <Field label="E-Mail">
              {isEdit ? (
                <input
                  type="email"
                  value={v.email}
                  onChange={(e) => edit.update({ email: e.target.value || null })}
                  className={inputCls}
                />
              ) : (
                <ReadValue>{v.email || '—'}</ReadValue>
              )}
            </Field>
          </div>
          <Field label="Website">
            {isEdit ? (
              <input
                type="text"
                value={v.website}
                onChange={(e) => edit.update({ website: e.target.value || null })}
                className={inputCls}
              />
            ) : (
              <ReadValue>{v.website || '—'}</ReadValue>
            )}
          </Field>
        </Block>

        <Block title="Weitere Stammdaten">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rechtsform">
              {isEdit ? (
                <select
                  value={v.rechtsform_id ?? ''}
                  onChange={(e) =>
                    edit.update({ rechtsform_id: e.target.value || null })
                  }
                  className={inputCls}
                >
                  <option value="">—</option>
                  {rechtsformen.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              ) : (
                <ReadValue>
                  {rechtsformen.find((w) => w.id === v.rechtsform_id)?.label ?? '—'}
                </ReadValue>
              )}
            </Field>
            <Field label="Branche">
              {isEdit ? (
                <select
                  value={v.branche_id ?? ''}
                  onChange={(e) =>
                    edit.update({ branche_id: e.target.value || null })
                  }
                  className={inputCls}
                >
                  <option value="">—</option>
                  {branchen.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              ) : (
                <ReadValue>
                  {branchen.find((w) => w.id === v.branche_id)?.label ?? '—'}
                </ReadValue>
              )}
            </Field>
            <Field label="Steuernummer">
              {isEdit ? (
                <input
                  type="text"
                  value={v.steuer_nr}
                  onChange={(e) =>
                    edit.update({ steuer_nr: e.target.value || null })
                  }
                  className={inputCls}
                />
              ) : (
                <ReadValue>{v.steuer_nr || '—'}</ReadValue>
              )}
            </Field>
            <Field label="USt-IdNr.">
              {isEdit ? (
                <input
                  type="text"
                  value={v.ust_id_nr}
                  onChange={(e) =>
                    edit.update({ ust_id_nr: e.target.value || null })
                  }
                  className={inputCls}
                />
              ) : (
                <ReadValue>{v.ust_id_nr || '—'}</ReadValue>
              )}
            </Field>
            <Field label="HRB">
              {isEdit ? (
                <input
                  type="text"
                  value={v.hrb}
                  onChange={(e) => edit.update({ hrb: e.target.value || null })}
                  className={inputCls}
                />
              ) : (
                <ReadValue>{v.hrb || '—'}</ReadValue>
              )}
            </Field>
          </div>
        </Block>

        <Block title="Notizen">
          {isEdit ? (
            <textarea
              value={v.notiz}
              onChange={(e) => edit.update({ notiz: e.target.value || null })}
              rows={3}
              className={clsx(inputCls, 'resize-y')}
            />
          ) : (
            <div className="whitespace-pre-wrap text-sm text-zinc-300">
              {v.notiz || <span className="text-zinc-500">— keine Notiz —</span>}
            </div>
          )}
        </Block>
      </div>

      {/* Rechte Spalte */}
      <div className="space-y-6">
        <Block title="Struktur">
          {hierarchieQuery.isLoading && (
            <div className="text-xs text-zinc-500">Lade Filialen-Baum …</div>
          )}
          {hierarchieQuery.isError && (
            <div className="text-xs text-red-400">
              Konnte Filialen-Baum nicht laden.
            </div>
          )}
          {hierarchieQuery.data && (
            <FilialenBaum root={hierarchieQuery.data.root} />
          )}
        </Block>

        <Block title="Klassifikation">
          <Field label="Typen">
            <TypenMultiSelect
              value={isEdit ? (v.typen as string[]) : (partner.typen as string[])}
              onChange={(next) => edit.update({ typen: next })}
              lookup={partnerTypLookup}
              readOnly={!isEdit}
            />
          </Field>
        </Block>
      </div>
    </div>
  );
}

// ============================================================================
// Helper-Komponenten — bewusst inline, da nur hier verwendet
// ============================================================================

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-zinc-400">{label}</div>
      {children}
    </div>
  );
}

function ReadValue({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-zinc-200">{children}</div>;
}
