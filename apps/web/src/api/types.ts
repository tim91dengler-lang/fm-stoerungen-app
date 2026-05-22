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

export interface TicketRead {
  id: UUID;
  mandant_id: UUID;
  nummer: number;
  titel: string;
  beschreibung: string;
  status: AuswahlWertRef;
  prioritaet: AuswahlWertRef;
  kategorie: AuswahlWertRef | null;
  objekt: ObjektRef | null;
  partner: PartnerRef | null;
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
  objekt_id?: UUID | null;
  partner_id?: UUID | null;
  zugewiesen_an_id?: UUID | null;
}

export interface TicketUpdate {
  titel?: string;
  beschreibung?: string;
  status?: TicketStatusSlug;
  prioritaet?: TicketPrioritaetSlug;
  kategorie?: string | null;
  objekt_id?: UUID | null;
  partner_id?: UUID | null;
  zugewiesen_an_id?: UUID | null;
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
  ist_aktiv?: boolean;
  meta?: Record<string, unknown> | null;
}

export interface AuswahllistenWertUpdate {
  label?: string;
  reihenfolge?: number;
  farbe?: string | null;
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
