export type UUID = string;

export interface UserInToken {
  id: UUID;
  email: string;
  full_name: string;
  mandant_id: UUID;
  roles: string[];
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserInToken;
}

export interface RoleRead {
  id: UUID;
  name: string;
  beschreibung: string | null;
}

export interface UserRead {
  id: UUID;
  mandant_id: UUID;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: RoleRead[];
  created_at: string;
  updated_at: string;
}

export interface UserUpdate {
  full_name?: string;
  is_active?: boolean;
  role_ids?: UUID[];
  password?: string;
}

export interface UserRef {
  id: UUID;
  full_name: string;
}

export interface AuswahlWertRef {
  id: UUID;
  key: string;
  label: string;
  farbe: string | null;
}

export interface ObjektRef {
  id: UUID;
  name: string;
}

export interface PartnerRef {
  id: UUID;
  name: string;
  /** UUIDs auf Auswahllisten-Werte der Liste `partner_typ`
   *  (umgestellt in Track 3 Sub-PR B / Migration 0016). */
  typen: UUID[];
}

// Bekannte System-Slugs (in Migration als ist_system=TRUE geseedet).
// Frontend rechnet damit für hardcoded UI-Optionen; ab Iteration 2.2
// werden die Optionen dynamisch aus /api/v1/auswahllisten geladen.
export type TicketStatusSlug = 'neu' | 'pruefung' | 'bearbeitung' | 'wartet' | 'erledigt';

export type TicketPrioritaetSlug = 'niedrig' | 'mittel' | 'hoch' | 'kritisch';

export interface HausRef {
  id: UUID;
  bezeichnung: string;
}

export interface StockwerkRef {
  id: UUID;
  bezeichnung: string;
  has_grundriss: boolean;
}

export interface EinheitRef {
  id: UUID;
  bezeichnung: string;
}

export interface TickettypRef {
  id: UUID;
  key: string;
  label: string;
  icon: string | null;
  farbe: string | null;
}

export interface ProjektRefMini {
  id: UUID;
  name: string;
  status: string;
}

export interface AnlageRef {
  id: UUID;
  bezeichnung: string;
  icon_name: string | null;
}

export interface FehlercodeRef {
  id: UUID;
  code: string;
  titel: string;
}

export interface TicketPin {
  x: number;
  y: number;
  label?: string | null;
}

export interface TicketRead {
  id: UUID;
  mandant_id: UUID;
  nummer: number;
  titel: string;
  beschreibung: string;
  status: AuswahlWertRef;
  prioritaet: AuswahlWertRef;
  kategorie: AuswahlWertRef | null;
  quelle: AuswahlWertRef | null;
  objekt: ObjektRef | null;
  adresse_id: UUID | null;
  adresse: AdresseRead | null;
  haus: HausRef | null;
  stockwerk: StockwerkRef | null;
  einheit: EinheitRef | null;
  pins: TicketPin[];
  partner: PartnerRef | null;
  beteiligte: TicketBeteiligterRead[];
  tickettyp: TickettypRef | null;
  projekt: ProjektRefMini | null;
  anlage: AnlageRef | null;
  fehlercode: FehlercodeRef | null;
  faelligkeit_am: string | null;
  wiederholung: string | null;
  wartet_grund: AuswahlWertRef | null;
  wartet_nachunternehmer: PartnerRef | null;
  wartet_kontakt_name: string | null;
  wartet_kontakt_telefon: string | null;
  wartet_kontakt_email: string | null;
  // Beteiligter, auf den gewartet wird; Kontakt wird aus `beteiligte` aufgelöst.
  wartet_beteiligter_id: UUID | null;
  eroeffnet_von: UserRef;
  zugewiesen_an: UserRef | null;
  eroeffnet_am: string;
  zugewiesen_am: string | null;
  erledigt_am: string | null;
  geschlossen_am: string | null;
  created_at: string;
  updated_at: string;
}

export interface KontaktRef {
  id: UUID;
  name: string;
  email: string | null;
  telefon: string | null;
  mobil: string | null;
}

export interface TicketBeteiligterRead {
  id: UUID;
  partner: PartnerRef;
  kontakt: KontaktRef | null;
  rolle: AuswahlWertRef | null;
  ist_hauptkontakt: boolean;
  reihenfolge: number;
  // Aufgelöst: Ansprechpartner bevorzugt, sonst Partner-Stamm.
  email: string | null;
  telefon: string | null;
  mobil: string | null;
}

export interface TicketBeteiligterWrite {
  id?: UUID | null;
  partner_id: UUID;
  partner_kontakt_id?: UUID | null;
  rolle?: string | null;
  ist_hauptkontakt?: boolean;
  reihenfolge?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface TicketCreate {
  titel: string;
  beschreibung?: string;
  status?: TicketStatusSlug | null;
  prioritaet?: TicketPrioritaetSlug;
  kategorie?: string | null;
  quelle?: string | null;
  objekt_id?: UUID | null;
  adresse_id?: UUID | null;
  haus_id?: UUID | null;
  stockwerk_id?: UUID | null;
  einheit_id?: UUID | null;
  pins?: TicketPin[];
  partner_id?: UUID | null;
  beteiligte?: TicketBeteiligterWrite[];
  zugewiesen_an_id?: UUID | null;
  tickettyp_id?: UUID | null;
  projekt_id?: UUID | null;
  anlage_id?: UUID | null;
  fehlercode_id?: UUID | null;
  faelligkeit_am?: string | null;
  wiederholung?: string | null;
}

export interface TicketUpdate {
  titel?: string;
  beschreibung?: string;
  status?: TicketStatusSlug;
  prioritaet?: TicketPrioritaetSlug;
  kategorie?: string | null;
  quelle?: string | null;
  objekt_id?: UUID | null;
  adresse_id?: UUID | null;
  haus_id?: UUID | null;
  stockwerk_id?: UUID | null;
  einheit_id?: UUID | null;
  pins?: TicketPin[] | null;
  partner_id?: UUID | null;
  beteiligte?: TicketBeteiligterWrite[] | null;
  zugewiesen_an_id?: UUID | null;
  tickettyp_id?: UUID | null;
  projekt_id?: UUID | null;
  anlage_id?: UUID | null;
  fehlercode_id?: UUID | null;
  faelligkeit_am?: string | null;
  wiederholung?: string | null;
  wartet_grund?: string | null;
  wartet_nachunternehmer_id?: UUID | null;
  wartet_kontakt_name?: string | null;
  wartet_kontakt_telefon?: string | null;
  wartet_kontakt_email?: string | null;
  wartet_beteiligter_id?: UUID | null;
}

export interface TicketListFilters {
  search?: string;
  status?: TicketStatusSlug[];
  prioritaet?: TicketPrioritaetSlug[];
  zugewiesen_an_id?: UUID;
  partner_id?: UUID;
  objekt_id?: UUID;
  anlage_id?: UUID;
  fehlercode_id?: UUID;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------- Auswahllisten

export interface AuswahllistenWertRead {
  id: UUID;
  auswahlliste_id: UUID;
  key: string;
  label: string;
  reihenfolge: number;
  farbe: string | null;
  icon_name: string | null;
  ist_aktiv: boolean;
  ist_system: boolean;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AuswahllistenWertCreate {
  key: string;
  label: string;
  reihenfolge?: number;
  farbe?: string | null;
  icon_name?: string | null;
  ist_aktiv?: boolean;
  meta?: Record<string, unknown> | null;
}

export interface AuswahllistenWertUpdate {
  label?: string;
  reihenfolge?: number;
  farbe?: string | null;
  icon_name?: string | null;
  ist_aktiv?: boolean;
  meta?: Record<string, unknown> | null;
}

export interface AuswahllisteRead {
  id: UUID;
  mandant_id: UUID;
  key: string;
  label: string;
  beschreibung: string | null;
  ist_system: boolean;
  werte: AuswahllistenWertRead[];
  created_at: string;
  updated_at: string;
}

export interface AuswahllisteCreate {
  key: string;
  label: string;
  beschreibung?: string | null;
}

export interface AuswahllisteUpdate {
  label?: string;
  beschreibung?: string | null;
}

// ---------------------------------------------------------------- Adressen

export interface AdresseRead {
  id: UUID;
  mandant_id: UUID;
  strasse: string;
  hausnummer: string | null;
  adresszusatz: string | null;
  plz: string;
  ort: string;
  land: string;
  bemerkung: string | null;
  latitude: number | null;
  longitude: number | null;
  geocode_source: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdresseWriteBase {
  strasse: string;
  hausnummer?: string | null;
  adresszusatz?: string | null;
  plz: string;
  ort: string;
  land?: string;
  bemerkung?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocode_source?: string | null;
}

export type AdresseCreate = AdresseWriteBase;
export type AdresseUpdate = Partial<AdresseWriteBase>;

export interface AdresseSuggestion {
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  land: string | null;
  latitude: number | null;
  longitude: number | null;
  label: string;
}

// ---------------------------------------------------------------- Partner

/** Slugs des Postgres-Enums `partner_typ` — werden u. a. in
 *  `ObjektPartner.rolle` weiter genutzt (Junction-Tabelle). */
export type PartnerTyp =
  | 'mieter'
  | 'eigentuemer'
  | 'auftraggeber'
  | 'nachunternehmer'
  | 'privatperson';

/** Schließt zusätzlich Slugs ein, die nur in der `partner_typ`-Auswahlliste
 *  existieren (z. B. `dienstleister`) — relevant für die Anzeige von
 *  `GeschaeftsPartner.typen` (UUID-Array) und Track-3-Endpoints. */
export type PartnerTypSlug = PartnerTyp | 'dienstleister';

export interface PartnerKontaktRead {
  id: UUID;
  partner_id: UUID;
  anrede_id: UUID | null;
  titel: string | null;
  vorname: string | null;
  nachname: string | null;
  rollen: UUID[];
  email: string | null;
  telefon: string | null;
  mobil: string | null;
  ist_hauptkontakt: boolean;
  gesperrt: boolean;
  notiz: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerKontaktWriteBase {
  anrede_id?: UUID | null;
  titel?: string | null;
  vorname?: string | null;
  nachname?: string | null;
  rollen?: UUID[];
  email?: string | null;
  telefon?: string | null;
  mobil?: string | null;
  ist_hauptkontakt?: boolean;
  gesperrt?: boolean;
  notiz?: string | null;
}

export type PartnerKontaktCreate = PartnerKontaktWriteBase;
export type PartnerKontaktUpdate = Partial<PartnerKontaktWriteBase>;

export interface PartnerAdresseRead {
  id: UUID;
  partner_id: UUID;
  adresse_id: UUID;
  typ_id: UUID | null;
  ist_primaer: boolean;
  adresse: AdresseRead | null;
}

export interface PartnerAdresseCreate {
  adresse_id: UUID;
  typ_id?: UUID | null;
  ist_primaer?: boolean;
}

export interface PartnerAdresseUpdate {
  typ_id?: UUID | null;
  ist_primaer?: boolean;
}

export interface PartnerRead {
  id: UUID;
  mandant_id: UUID;
  partner_nummer: number;
  name: string;
  gesperrt: boolean;
  parent_partner_id: UUID | null;
  rechtsform_id: UUID | null;
  branche_id: UUID | null;
  anrede_id: UUID | null;
  titel: string | null;
  vorname: string | null;
  nachname: string | null;
  ust_id_nr: string | null;
  steuer_nr: string | null;
  hrb: string | null;
  website: string | null;
  email: string | null;
  telefon: string | null;
  mobil: string | null;
  telefax: string | null;
  notiz: string | null;
  /** UUIDs auf Auswahllisten-Werte der Liste `partner_typ`
   *  (umgestellt in Track 3 Sub-PR B / Migration 0016).
   *  Für die Anzeige Label/Farbe via `usePartnerTypLookup`-Hook auflösen. */
  typen: UUID[];
  /** Backward-Compat (computed_field aus Backend): zusammengebauter Anzeigetext
   *  des Hauptkontakts (oder der Partner-Personenfelder bei Privatperson). */
  ansprechpartner: string | null;
  kontakte: PartnerKontaktRead[];
  adress_links: PartnerAdresseRead[];
  created_at: string;
  updated_at: string;
}

export interface PartnerWriteBase {
  name: string;
  parent_partner_id?: UUID | null;
  rechtsform_id?: UUID | null;
  branche_id?: UUID | null;
  anrede_id?: UUID | null;
  titel?: string | null;
  vorname?: string | null;
  nachname?: string | null;
  ust_id_nr?: string | null;
  steuer_nr?: string | null;
  hrb?: string | null;
  website?: string | null;
  email?: string | null;
  telefon?: string | null;
  mobil?: string | null;
  telefax?: string | null;
  notiz?: string | null;
  typen: UUID[];
}

export type PartnerCreate = PartnerWriteBase;
export type PartnerUpdate = Partial<PartnerWriteBase>;

export interface PartnerSperrenResponse {
  betroffene_partner_ids: UUID[];
  anzahl: number;
}

// ---------------------------------------------------------------- Partner Track 3

export interface PartnerHierarchieKnoten {
  id: UUID;
  name: string;
  gesperrt: boolean;
  ist_root: boolean;
  ist_aktueller_partner: boolean;
  children: PartnerHierarchieKnoten[];
}

export interface PartnerHierarchieResponse {
  root: PartnerHierarchieKnoten;
}

export interface PartnerObjektLinkRead {
  objekt_id: UUID;
  objekt_name: string;
  gesperrt: boolean;
  /** Rollen-Slugs, z. B. ['eigentuemer', 'mieter'] */
  rollen: PartnerTypSlug[];
  adresse_kurz: string | null;
}

export interface PartnerProjektLinkRead {
  projekt_id: UUID;
  name: string;
  status_label: string;
  status_farbe: string | null;
  projekttyp_label: string;
  start_am: string | null;
  ende_am: string | null;
  /** Rollen-Slugs an den verlinkten Objekten, z. B. ['eigentuemer'] */
  rollen_an_objekten: PartnerTypSlug[];
}

export interface PartnerTicketLinkRead {
  ticket_id: UUID;
  nummer: number;
  titel: string;
  status_slug: string;
  status_label: string;
  status_farbe: string | null;
  prioritaet_label: string;
  prioritaet_farbe: string | null;
  objekt_id: UUID | null;
  objekt_name: string | null;
  eroeffnet_am: string;
  /** 'partner' | 'wartet_nachunternehmer' */
  rolle_am_ticket: string;
}

// ---------------------------------------------------------------- Objekte

export interface ObjektPartnerLink {
  partner_id: UUID;
  rolle: PartnerTyp;
}

export interface ObjektPartnerLinkRead extends ObjektPartnerLink {
  partner_name: string;
}

export interface ObjektRead {
  id: UUID;
  mandant_id: UUID;
  name: string;
  gesperrt: boolean;
  adresse_id: UUID | null;
  adresse: AdresseRead | null;
  notiz: string | null;
  partner_links: ObjektPartnerLinkRead[];
  created_at: string;
  updated_at: string;
}

export interface ObjektCreate {
  name: string;
  adresse_id?: UUID | null;
  notiz?: string | null;
  partner_links?: ObjektPartnerLink[];
}

export type ObjektUpdate = Partial<ObjektCreate>;

// ---------------------------------------------------------------- Gespeicherte Ansichten

export interface GespeicherteAnsichtRead {
  id: UUID;
  user_id: UUID;
  view_key: string;
  name: string;
  config: Record<string, unknown>;
  ist_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface GespeicherteAnsichtCreate {
  view_key: string;
  name: string;
  config: Record<string, unknown>;
  ist_default?: boolean;
}

export interface GespeicherteAnsichtUpdate {
  name?: string;
  config?: Record<string, unknown>;
  ist_default?: boolean;
}

// ---------------------------------------------------------------- Chat / TicketMessages

export interface TicketMessageRead {
  id: UUID;
  ticket_id: UUID;
  text: string;
  mentions: UUID[];
  gelesen_von: UUID[];
  autor: UserRef | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessageCreate {
  text: string;
  mentions?: UUID[];
}

// ---------------------------------------------------------------- Fotos / Annotations

export interface PhotoAnnotation {
  type: 'stempel' | 'kreis';
  /** Bei 'stempel': defekt | pruefen | ok */
  kind?: 'defekt' | 'pruefen' | 'ok';
  /** Bei 'kreis': red | yellow | green */
  color?: 'red' | 'yellow' | 'green';
  /** Position relativ zum Bild, 0..1 */
  x: number;
  y: number;
  /** Bei 'kreis': Radius relativ zur Bildhöhe, 0..1 */
  r?: number;
  /** Optionaler Text-Tag */
  label?: string;
}

export interface TicketPhotoRead {
  id: UUID;
  ticket_id: UUID;
  filename: string;
  mime_type: string;
  size_bytes: number;
  beschreibung: string | null;
  annotations: PhotoAnnotation[];
  uploaded_by: UserRef | null;
  created_at: string;
  updated_at: string;
}

export interface TicketPhotoUpdate {
  beschreibung?: string | null;
  annotations?: PhotoAnnotation[];
}

// ---------------------------------------------------------------- Objektstruktur (Haus/Stockwerk/Einheit)

export type Ausrichtung = 'nord' | 'ost' | 'sued' | 'west';

export interface PartnerMini {
  id: UUID;
  name: string;
}

export interface EinheitRead {
  id: UUID;
  stockwerk_id: UUID;
  bezeichnung: string;
  groesse_qm: number | null;
  reihenfolge: number;
  eigentuemer: PartnerMini[];
  mieter: PartnerMini[];
  created_at: string;
  updated_at: string;
}

export interface EinheitWriteBase {
  bezeichnung: string;
  groesse_qm?: number | null;
  reihenfolge?: number;
  eigentuemer_ids?: UUID[];
  mieter_ids?: UUID[];
}

export type EinheitCreate = EinheitWriteBase;
export type EinheitUpdate = Partial<EinheitWriteBase>;

export interface StockwerkRead {
  id: UUID;
  haus_id: UUID;
  bezeichnung: string;
  ausrichtung: Ausrichtung | null;
  reihenfolge: number;
  has_grundriss: boolean;
  grundriss_mime: string | null;
  eigentuemer: PartnerMini[];
  mieter: PartnerMini[];
  einheiten: EinheitRead[];
  created_at: string;
  updated_at: string;
}

export interface StockwerkWriteBase {
  bezeichnung: string;
  ausrichtung?: Ausrichtung | null;
  reihenfolge?: number;
  eigentuemer_ids?: UUID[];
  mieter_ids?: UUID[];
}

export type StockwerkCreate = StockwerkWriteBase;
export type StockwerkUpdate = Partial<StockwerkWriteBase>;

export interface HausRead {
  id: UUID;
  objekt_id: UUID;
  bezeichnung: string;
  notiz: string | null;
  reihenfolge: number;
  adresse: AdresseRead | null;
  eigentuemer: PartnerMini[];
  mieter: PartnerMini[];
  stockwerke: StockwerkRead[];
  created_at: string;
  updated_at: string;
}

export interface HausWriteBase {
  bezeichnung: string;
  adresse_id?: UUID | null;
  notiz?: string | null;
  reihenfolge?: number;
  eigentuemer_ids?: UUID[];
  mieter_ids?: UUID[];
}

export type HausCreate = HausWriteBase;
export type HausUpdate = Partial<HausWriteBase>;

// ---------------------------------------------------------------- Tickettypen

export interface TickettypFeldRead {
  id: UUID;
  feld_key: string;
  label: string;
  ist_system_feld: boolean;
  sichtbar: boolean;
  pflicht: boolean;
  nur_admin_sichtbar: boolean;
  reihenfolge: number;
  /** Stufe C: Zuordnung zu einem Block (null ⇒ Auffang-Block "weitere"). */
  block_id: UUID | null;
}

export type BlockRegion = 'links' | 'rechts';

export interface TickettypBlockRead {
  id: UUID;
  block_key: string;
  label: string;
  region: BlockRegion;
  reihenfolge: number;
  ist_system_block: boolean;
  collapsible_default_open: boolean;
}

// ---- Layout-Write (Designer-Save, Stufe C) ----
export interface BlockLayoutWrite {
  block_key: string;
  label: string;
  region: BlockRegion;
  reihenfolge: number;
  collapsible_default_open?: boolean;
}

export interface FeldLayoutWrite {
  feld_key: string;
  block_key: string;
  reihenfolge: number;
  sichtbar: boolean;
  pflicht: boolean;
  label?: string | null;
}

export interface LayoutWrite {
  bloecke: BlockLayoutWrite[];
  felder: FeldLayoutWrite[];
}

export interface TickettypFeldUpdate {
  feld_key: string;
  sichtbar?: boolean;
  pflicht?: boolean;
  nur_admin_sichtbar?: boolean;
  reihenfolge?: number;
  label?: string;
}

export interface TickettypRead {
  id: UUID;
  mandant_id: UUID;
  key: string;
  label: string;
  beschreibung: string | null;
  icon: string | null;
  farbe: string | null;
  pflichtfelder: string[];
  default_reminder_tage: number;
  reihenfolge: number;
  ist_system: boolean;
  /** Track 2 (Migration 0016 / `0016_tickettyp_aktiv`): deaktivierbare Vorlagen. */
  aktiv: boolean;
  /** Stufe C: genau eine Alles-Vorlage pro Mandant (enthält automatisch alle Felder). */
  ist_alles_vorlage: boolean;
  felder: TickettypFeldRead[];
  /** Stufe C: frei konfigurierbare Block-Gruppierungen je Vorlage. */
  bloecke: TickettypBlockRead[];
  created_at: string;
  updated_at: string;
}

export interface TickettypCreate {
  key: string;
  label: string;
  beschreibung?: string | null;
  icon?: string | null;
  farbe?: string | null;
  pflichtfelder?: string[];
  default_reminder_tage?: number;
  reihenfolge?: number;
  aktiv?: boolean;
}

export type TickettypUpdate = Partial<Omit<TickettypCreate, 'key'>>;

// ---------------------------------------------------------------- Projekte

/**
 * F2-Migration: status und projekttyp sind jetzt FKs auf Auswahllisten-Werte.
 * Werte werden aus den Auswahllisten `projektstatus` und `projekttyp`
 * dynamisch geladen — `ProjektStatusSlug` listet nur die System-Seeds für
 * Default-Auswahl und Bulk-Aktionen.
 */
export type ProjektStatusSlug = 'geplant' | 'aktiv' | 'pausiert' | 'abgeschlossen';

export interface ProjektRead {
  id: UUID;
  mandant_id: UUID;
  name: string;
  beschreibung: string | null;
  projekttyp: AuswahlWertRef;
  status: AuswahlWertRef;
  verantwortlich: UserRef | null;
  start_am: string | null;
  ende_am: string | null;
  notizen: string | null;
  objekte: ObjektRef[];
  ticket_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjektCreate {
  name: string;
  beschreibung?: string | null;
  projekttyp_slug: string;
  status_slug?: string;
  verantwortlich_user_id?: UUID | null;
  start_am?: string | null;
  ende_am?: string | null;
  notizen?: string | null;
  objekt_ids?: UUID[];
}

export interface ProjektUpdate {
  name?: string;
  beschreibung?: string | null;
  projekttyp_slug?: string;
  status_slug?: string;
  verantwortlich_user_id?: UUID | null;
  start_am?: string | null;
  ende_am?: string | null;
  notizen?: string | null;
  objekt_ids?: UUID[];
}

export interface ProjektListFilters {
  search?: string;
  status?: string[];
  projekttyp?: string[];
  include_deleted?: boolean;
  limit?: number;
}

export interface ProjektTicketsParams {
  include_deleted?: boolean;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------- Notifications

export type NotificationTyp =
  | 'mention'
  | 'zuweisung'
  | 'status'
  | 'chat'
  | 'wartung_faellig';

export interface NotificationRead {
  id: UUID;
  user_id: UUID;
  ticket_id: UUID | null;
  typ: NotificationTyp;
  text: string;
  ref_message_id: UUID | null;
  ausloeser: UserRef | null;
  gelesen: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------- Dokumente

export type DokumentTarget = 'ticket' | 'projekt' | 'objekt' | 'partner';

export interface DokumentLink {
  target_type: DokumentTarget;
  target_id: UUID;
}

export interface DokumentRead {
  id: UUID;
  name: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  kategorie: string | null;
  beschreibung: string | null;
  hochgeladen_von: UserRef | null;
  links: DokumentLink[];
  created_at: string;
  updated_at: string;
}

export interface DokumentUpdate {
  name?: string;
  kategorie?: string | null;
  beschreibung?: string | null;
  links?: DokumentLink[];
}

// ---------------------------------------------------------------- Anlagen

export interface KategorieRef {
  id: UUID;
  key: string;
  label: string;
  farbe: string | null;
  icon_name: string | null;
}

export interface AnlageRead {
  id: UUID;
  mandant_id: UUID;
  bezeichnung: string;
  beschreibung: string | null;
  icon_name: string | null;
  kategorie_wert_id: UUID | null;
  objekt_id: UUID | null;
  stockwerk_id: UUID | null;
  aktiv: boolean;
  reihenfolge: number;
  kategorie: KategorieRef | null;
  objekt: { id: UUID; name: string } | null;
  stockwerk: { id: UUID; bezeichnung: string } | null;
  created_at: string;
  updated_at: string;
}

export interface AnlageWriteBase {
  bezeichnung: string;
  beschreibung?: string | null;
  icon_name?: string | null;
  kategorie_wert_id?: UUID | null;
  objekt_id?: UUID | null;
  stockwerk_id?: UUID | null;
  aktiv?: boolean;
  reihenfolge?: number;
}

export type AnlageCreate = AnlageWriteBase;
export type AnlageUpdate = Partial<AnlageWriteBase>;

// ---------------------------------------------------------------- Fehlercodes

export interface FehlercodeRead {
  id: UUID;
  mandant_id: UUID;
  code: string;
  titel: string;
  beschreibung: string | null;
  loesung: string | null;
  kategorie_wert_id: UUID | null;
  prio_default_wert_id: UUID | null;
  tickettyp_default_id: UUID | null;
  anlage_id: UUID | null;
  quelle: string | null;
  aktiv: boolean;
  kategorie: KategorieRef | null;
  prio_default: { id: UUID; key: string; label: string; farbe: string | null } | null;
  tickettyp_default: { id: UUID; key: string; label: string } | null;
  anlage: { id: UUID; bezeichnung: string; icon_name: string | null } | null;
  nutzung_count: number;
  created_at: string;
  updated_at: string;
}

export interface FehlercodeWriteBase {
  code: string;
  titel: string;
  beschreibung?: string | null;
  loesung?: string | null;
  kategorie_wert_id?: UUID | null;
  prio_default_wert_id?: UUID | null;
  tickettyp_default_id?: UUID | null;
  anlage_id?: UUID | null;
  quelle?: string | null;
  aktiv?: boolean;
}

export type FehlercodeCreate = FehlercodeWriteBase;
export type FehlercodeUpdate = Partial<FehlercodeWriteBase>;

// --- Status-Workflow (konfigurierbare Übergangsmatrix) ---

export interface StatusWertMini {
  key: string;
  label: string;
  farbe: string | null;
  erfordert_grund: boolean;
}

export interface StatusWorkflowRead {
  status: StatusWertMini[];
  /** Erlaubte Ziel-Status je Quell-Status-key. */
  uebergaenge: Record<string, string[]>;
}

export interface StatusWorkflowUpdate {
  uebergaenge?: Record<string, string[]>;
  erfordert_grund?: Record<string, boolean>;
}
