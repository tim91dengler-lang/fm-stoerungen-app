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
  typen: string[];
}

// Bekannte System-Slugs (in Migration als ist_system=TRUE geseedet).
// Frontend rechnet damit für hardcoded UI-Optionen; ab Iteration 2.2
// werden die Optionen dynamisch aus /api/v1/auswahllisten geladen.
export type TicketStatusSlug =
  | 'neu'
  | 'pruefung'
  | 'bearbeitung'
  | 'wartet'
  | 'erledigt';

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
  melder: string | null;
  objekt: ObjektRef | null;
  haus: HausRef | null;
  stockwerk: StockwerkRef | null;
  einheit: EinheitRef | null;
  pin_x: number | null;
  pin_y: number | null;
  partner: PartnerRef | null;
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
  eroeffnet_von: UserRef;
  zugewiesen_an: UserRef | null;
  eroeffnet_am: string;
  zugewiesen_am: string | null;
  erledigt_am: string | null;
  geschlossen_am: string | null;
  created_at: string;
  updated_at: string;
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
  melder?: string | null;
  objekt_id?: UUID | null;
  haus_id?: UUID | null;
  stockwerk_id?: UUID | null;
  einheit_id?: UUID | null;
  pin_x?: number | null;
  pin_y?: number | null;
  partner_id?: UUID | null;
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
  melder?: string | null;
  objekt_id?: UUID | null;
  haus_id?: UUID | null;
  stockwerk_id?: UUID | null;
  einheit_id?: UUID | null;
  pin_x?: number | null;
  pin_y?: number | null;
  partner_id?: UUID | null;
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
}

export interface TicketListFilters {
  search?: string;
  status?: TicketStatusSlug[];
  prioritaet?: TicketPrioritaetSlug[];
  zugewiesen_an_id?: UUID;
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

export type PartnerTyp = 'mieter' | 'eigentuemer' | 'auftraggeber' | 'nachunternehmer';

export interface PartnerRead {
  id: UUID;
  mandant_id: UUID;
  name: string;
  ansprechpartner: string | null;
  email: string | null;
  telefon: string | null;
  adresse_id: UUID | null;
  adresse: AdresseRead | null;
  notiz: string | null;
  typen: PartnerTyp[];
  created_at: string;
  updated_at: string;
}

export interface PartnerWriteBase {
  name: string;
  ansprechpartner?: string | null;
  email?: string | null;
  telefon?: string | null;
  adresse_id?: UUID | null;
  notiz?: string | null;
  typen: PartnerTyp[];
}

export type PartnerCreate = PartnerWriteBase;
export type PartnerUpdate = Partial<PartnerWriteBase>;

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
  eigentuemer: PartnerMini | null;
  mieter: PartnerMini[];
  created_at: string;
  updated_at: string;
}

export interface EinheitWriteBase {
  bezeichnung: string;
  groesse_qm?: number | null;
  eigentuemer_partner_id?: UUID | null;
  reihenfolge?: number;
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
  eigentuemer: PartnerMini | null;
  mieter: PartnerMini[];
  einheiten: EinheitRead[];
  created_at: string;
  updated_at: string;
}

export interface StockwerkWriteBase {
  bezeichnung: string;
  ausrichtung?: Ausrichtung | null;
  eigentuemer_partner_id?: UUID | null;
  reihenfolge?: number;
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
  stockwerke: StockwerkRead[];
  created_at: string;
  updated_at: string;
}

export interface HausWriteBase {
  bezeichnung: string;
  adresse_id?: UUID | null;
  notiz?: string | null;
  reihenfolge?: number;
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
  felder: TickettypFeldRead[];
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
}

export type TickettypUpdate = Partial<Omit<TickettypCreate, 'key'>>;

// ---------------------------------------------------------------- Projekte

export type ProjektStatus =
  | 'geplant'
  | 'laufend'
  | 'abgeschlossen'
  | 'storniert';

export interface ProjektRead {
  id: UUID;
  mandant_id: UUID;
  name: string;
  beschreibung: string | null;
  objekt_id: UUID | null;
  verantwortlich_user_id: UUID | null;
  verantwortlich: UserRef | null;
  start_am: string | null;
  ende_am: string | null;
  status: ProjektStatus;
  notizen: string | null;
  ticket_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjektWriteBase {
  name: string;
  beschreibung?: string | null;
  objekt_id?: UUID | null;
  verantwortlich_user_id?: UUID | null;
  start_am?: string | null;
  ende_am?: string | null;
  status?: ProjektStatus;
  notizen?: string | null;
}

export type ProjektCreate = ProjektWriteBase;
export type ProjektUpdate = Partial<ProjektWriteBase>;

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
