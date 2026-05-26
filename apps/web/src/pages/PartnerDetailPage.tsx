import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { auswahllistenApi, partnerApi } from '../api/endpoints';
import type {
  AuswahllisteRead,
  PartnerRead,
  PartnerUpdate,
} from '../api/types';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';
import { usePartnerTypLookup } from '../lib/usePartnerTypLookup';
import { PartnerDetailHeader } from './partner/PartnerDetailHeader';
import {
  PartnerDetailTabBar,
  type PartnerTabKey,
} from './partner/PartnerDetailTabBar';
import { PartnerTabAllgemein } from './partner/PartnerTabAllgemein';
import { PartnerTabKontakte } from './partner/PartnerTabKontakte';
import { PartnerTabObjekte } from './partner/PartnerTabObjekte';
import { PartnerTabProjekte } from './partner/PartnerTabProjekte';
import { PartnerTabTickets } from './partner/PartnerTabTickets';
import {
  extractMutationError,
  nullIfEmpty,
} from './partner/helpers';
import { useEditBuffer } from './partner/useEditBuffer';

/**
 * Partner-Detail-Page (Track 3 Sub-PR B Refactor).
 *
 * Trägt nur den Layout-Rahmen (Header + TabBar + aktiver Tab) und das
 * gemeinsame Datenmodell (Partner laden, Edit-Buffer, Sperren-Mutation,
 * Save-Mutation). Die eigentliche UI-Logik liegt in den Tab-Komponenten
 * unter `pages/partner/` (Spec §5.1).
 */
export function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const partnerId = id ?? '';
  const qc = useQueryClient();
  const partnerTypLookup = usePartnerTypLookup();

  const partnerQuery = useQuery({
    queryKey: ['partner', partnerId],
    queryFn: () => partnerApi.get(partnerId),
    enabled: !!partnerId,
  });

  const listenQuery = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
    staleTime: 60_000,
  });

  const listen = useMemo(() => {
    const m = new Map<string, AuswahllisteRead>();
    for (const l of listenQuery.data ?? []) m.set(l.key, l);
    return m;
  }, [listenQuery.data]);

  const edit = useEditBuffer<PartnerUpdate>(
    partnerQuery.data ? partnerToDraft(partnerQuery.data) : null,
  );

  const updateMut = useMutation({
    mutationFn: (payload: PartnerUpdate) =>
      partnerApi.update(partnerId, normalizeForSave(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', partnerId] });
      edit.finishEdit();
    },
  });

  const sperrenMut = useMutation({
    mutationFn: (next: boolean) =>
      next ? partnerApi.sperren(partnerId) : partnerApi.entsperren(partnerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner', partnerId] }),
  });

  const [activeTab, setActiveTab] = useState<PartnerTabKey>('allgemein');

  if (!partnerId) {
    return <div className="p-6 text-sm text-zinc-500">Kein Partner ausgewählt.</div>;
  }
  if (partnerQuery.isLoading || partnerTypLookup.isLoading) {
    return <div className="p-6 text-sm text-zinc-500">Lade …</div>;
  }
  if (partnerQuery.isError || !partnerQuery.data) {
    return (
      <div className="p-6 text-sm text-red-300">
        Partner konnte nicht geladen werden. Eventuell wurde er gelöscht.
      </div>
    );
  }

  const partner = partnerQuery.data;
  const saveError = extractMutationError(updateMut.error);

  return (
    <div className="min-h-full">
      <PartnerDetailHeader
        partner={partner}
        partnerTypLookup={partnerTypLookup}
        editMode={edit.editMode}
        isDirty={edit.isDirty}
        onEnterEdit={edit.enterEdit}
        onCancelEdit={edit.cancelEdit}
        onSave={() => edit.draft && updateMut.mutate(edit.draft)}
        onToggleSperre={(next) => sperrenMut.mutate(next)}
        saving={updateMut.isPending}
      />

      <PartnerDetailTabBar active={activeTab} onChange={setActiveTab} />

      {saveError && (
        <div className="mx-4 mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 lg:mx-8">
          <span className="font-semibold">Speichern fehlgeschlagen:</span> {saveError}
        </div>
      )}

      {activeTab === 'allgemein' && (
        <PartnerTabAllgemein
          partner={partner}
          listen={listen}
          partnerTypLookup={partnerTypLookup}
          edit={edit}
        />
      )}
      {activeTab === 'kontakte' && (
        <PartnerTabKontakte partner={partner} listen={listen} />
      )}
      {activeTab === 'objekte' && (
        <PartnerTabObjekte partnerId={partner.id} partnerName={partner.name} />
      )}
      {activeTab === 'projekte' && (
        <PartnerTabProjekte partnerId={partner.id} partnerName={partner.name} />
      )}
      {activeTab === 'tickets' && (
        <PartnerTabTickets partnerId={partner.id} partnerName={partner.name} />
      )}

      <ConfirmDialog
        open={edit.blocker.state === 'blocked'}
        title="Ungespeicherte Änderungen"
        message="Wenn du fortfährst, gehen die ungespeicherten Änderungen verloren. Trotzdem verlassen?"
        confirmLabel="Verwerfen"
        tone="danger"
        onConfirm={() => {
          edit.cancelEdit();
          edit.blocker.proceed?.();
        }}
        onCancel={() => edit.blocker.reset?.()}
      />
    </div>
  );
}

/** Server-Partner → editbarer Draft. Felder mit null werden mit '' / null
 *  initialisiert, damit die Inputs kontrolliert bleiben. */
function partnerToDraft(p: PartnerRead): PartnerUpdate {
  return {
    name: p.name,
    rechtsform_id: p.rechtsform_id,
    branche_id: p.branche_id,
    anrede_id: p.anrede_id,
    titel: p.titel,
    vorname: p.vorname,
    nachname: p.nachname,
    ust_id_nr: p.ust_id_nr,
    steuer_nr: p.steuer_nr,
    hrb: p.hrb,
    website: p.website,
    email: p.email,
    telefon: p.telefon,
    mobil: p.mobil,
    telefax: p.telefax,
    notiz: p.notiz,
    typen: p.typen,
  };
}

/** Trimmt leere Strings auf null (sonst 422 bei EmailStr & Co). */
function normalizeForSave(draft: PartnerUpdate): PartnerUpdate {
  return {
    ...draft,
    titel: nullIfEmpty(draft.titel),
    vorname: nullIfEmpty(draft.vorname),
    nachname: nullIfEmpty(draft.nachname),
    ust_id_nr: nullIfEmpty(draft.ust_id_nr),
    steuer_nr: nullIfEmpty(draft.steuer_nr),
    hrb: nullIfEmpty(draft.hrb),
    website: nullIfEmpty(draft.website),
    email: nullIfEmpty(draft.email),
    telefon: nullIfEmpty(draft.telefon),
    mobil: nullIfEmpty(draft.mobil),
    telefax: nullIfEmpty(draft.telefax),
    notiz: nullIfEmpty(draft.notiz),
  };
}
