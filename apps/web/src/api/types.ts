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

export type TicketStatus =
  | 'neu'
  | 'zugewiesen'
  | 'in_arbeit'
  | 'erledigt'
  | 'geschlossen';

export type TicketPrioritaet = 'niedrig' | 'mittel' | 'hoch' | 'kritisch';

export interface TicketRead {
  id: UUID;
  mandant_id: UUID;
  nummer: number;
  titel: string;
  beschreibung: string;
  status: TicketStatus;
  prioritaet: TicketPrioritaet;
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
  prioritaet?: TicketPrioritaet;
  zugewiesen_an_id?: UUID | null;
}

export interface TicketUpdate {
  titel?: string;
  beschreibung?: string;
  prioritaet?: TicketPrioritaet;
  status?: TicketStatus;
  zugewiesen_an_id?: UUID | null;
}

export interface TicketListFilters {
  search?: string;
  status?: TicketStatus[];
  prioritaet?: TicketPrioritaet[];
  zugewiesen_an_id?: UUID;
  limit?: number;
  offset?: number;
}
