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
