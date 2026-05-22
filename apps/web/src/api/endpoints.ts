import { api } from './client';
import type {
  AdresseCreate,
  AdresseRead,
  AdresseSuggestion,
  AdresseUpdate,
  AuswahllisteCreate,
  AuswahllisteRead,
  AuswahllistenWertCreate,
  AuswahllistenWertRead,
  AuswahllistenWertUpdate,
  GespeicherteAnsichtCreate,
  GespeicherteAnsichtRead,
  GespeicherteAnsichtUpdate,
  LoginResponse,
  ObjektCreate,
  ObjektRead,
  ObjektUpdate,
  PaginatedResponse,
  PartnerCreate,
  PartnerRead,
  PartnerUpdate,
  TicketCreate,
  TicketListFilters,
  TicketMessageCreate,
  TicketMessageRead,
  TicketPhotoRead,
  TicketPhotoUpdate,
  TicketRead,
  TicketUpdate,
  UserRead,
} from './types';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }).then((r) => r.data),
  logout: () => api.post<void>('/auth/logout').then(() => undefined),
};

export const userApi = {
  me: () => api.get<UserRead>('/users/me').then((r) => r.data),
  list: (params: { search?: string; limit?: number; offset?: number } = {}) =>
    api
      .get<PaginatedResponse<UserRead>>('/users', { params })
      .then((r) => r.data),
};

export const ticketApi = {
  list: (filters: TicketListFilters = {}) =>
    api
      .get<PaginatedResponse<TicketRead>>('/tickets', { params: filters })
      .then((r) => r.data),
  get: (id: string) => api.get<TicketRead>(`/tickets/${id}`).then((r) => r.data),
  create: (payload: TicketCreate) =>
    api.post<TicketRead>('/tickets', payload).then((r) => r.data),
  update: (id: string, payload: TicketUpdate) =>
    api.patch<TicketRead>(`/tickets/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete<void>(`/tickets/${id}`).then(() => undefined),
};

export const auswahllistenApi = {
  list: (search?: string) =>
    api
      .get<AuswahllisteRead[]>('/auswahllisten', { params: search ? { search } : undefined })
      .then((r) => r.data),
  get: (id: string) => api.get<AuswahllisteRead>(`/auswahllisten/${id}`).then((r) => r.data),
  create: (payload: AuswahllisteCreate) =>
    api.post<AuswahllisteRead>('/auswahllisten', payload).then((r) => r.data),
  remove: (id: string) =>
    api.delete<void>(`/auswahllisten/${id}`).then(() => undefined),
  addWert: (listeId: string, payload: AuswahllistenWertCreate) =>
    api
      .post<AuswahllistenWertRead>(`/auswahllisten/${listeId}/werte`, payload)
      .then((r) => r.data),
  updateWert: (wertId: string, payload: AuswahllistenWertUpdate) =>
    api
      .patch<AuswahllistenWertRead>(`/auswahllisten/werte/${wertId}`, payload)
      .then((r) => r.data),
  removeWert: (wertId: string) =>
    api.delete<void>(`/auswahllisten/werte/${wertId}`).then(() => undefined),
};

export const partnerApi = {
  list: (
    params: {
      search?: string;
      typ?: string[];
      limit?: number;
      offset?: number;
    } = {},
  ) =>
    api
      .get<PaginatedResponse<PartnerRead>>('/partner', { params })
      .then((r) => r.data),
  get: (id: string) => api.get<PartnerRead>(`/partner/${id}`).then((r) => r.data),
  create: (payload: PartnerCreate) =>
    api.post<PartnerRead>('/partner', payload).then((r) => r.data),
  update: (id: string, payload: PartnerUpdate) =>
    api.patch<PartnerRead>(`/partner/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete<void>(`/partner/${id}`).then(() => undefined),
};

export const objektApi = {
  list: (params: { search?: string; limit?: number; offset?: number } = {}) =>
    api
      .get<PaginatedResponse<ObjektRead>>('/objekte', { params })
      .then((r) => r.data),
  get: (id: string) => api.get<ObjektRead>(`/objekte/${id}`).then((r) => r.data),
  create: (payload: ObjektCreate) =>
    api.post<ObjektRead>('/objekte', payload).then((r) => r.data),
  update: (id: string, payload: ObjektUpdate) =>
    api.patch<ObjektRead>(`/objekte/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete<void>(`/objekte/${id}`).then(() => undefined),
};

export const photoApi = {
  list: (ticketId: string) =>
    api
      .get<TicketPhotoRead[]>(`/tickets/${ticketId}/photos`)
      .then((r) => r.data),
  upload: (ticketId: string, file: File, beschreibung?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (beschreibung) fd.append('beschreibung', beschreibung);
    return api
      .post<TicketPhotoRead>(`/tickets/${ticketId}/photos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  update: (ticketId: string, photoId: string, payload: TicketPhotoUpdate) =>
    api
      .patch<TicketPhotoRead>(
        `/tickets/${ticketId}/photos/${photoId}`,
        payload,
      )
      .then((r) => r.data),
  remove: (ticketId: string, photoId: string) =>
    api
      .delete<void>(`/tickets/${ticketId}/photos/${photoId}`)
      .then(() => undefined),
  fetchBlob: (ticketId: string, photoId: string) =>
    api
      .get<Blob>(`/tickets/${ticketId}/photos/${photoId}/file`, {
        responseType: 'blob',
      })
      .then((r) => r.data),
};

export const chatApi = {
  list: (ticketId: string) =>
    api
      .get<TicketMessageRead[]>(`/tickets/${ticketId}/messages`)
      .then((r) => r.data),
  create: (ticketId: string, payload: TicketMessageCreate) =>
    api
      .post<TicketMessageRead>(`/tickets/${ticketId}/messages`, payload)
      .then((r) => r.data),
  remove: (ticketId: string, messageId: string) =>
    api
      .delete<void>(`/tickets/${ticketId}/messages/${messageId}`)
      .then(() => undefined),
};

export const ansichtenApi = {
  list: (viewKey?: string) =>
    api
      .get<GespeicherteAnsichtRead[]>('/ansichten', {
        params: viewKey ? { view_key: viewKey } : undefined,
      })
      .then((r) => r.data),
  create: (payload: GespeicherteAnsichtCreate) =>
    api
      .post<GespeicherteAnsichtRead>('/ansichten', payload)
      .then((r) => r.data),
  update: (id: string, payload: GespeicherteAnsichtUpdate) =>
    api
      .patch<GespeicherteAnsichtRead>(`/ansichten/${id}`, payload)
      .then((r) => r.data),
  remove: (id: string) =>
    api.delete<void>(`/ansichten/${id}`).then(() => undefined),
};

export const adresseApi = {
  list: (params: { search?: string; limit?: number; offset?: number } = {}) =>
    api
      .get<PaginatedResponse<AdresseRead>>('/adressen', { params })
      .then((r) => r.data),
  get: (id: string) => api.get<AdresseRead>(`/adressen/${id}`).then((r) => r.data),
  create: (payload: AdresseCreate) =>
    api.post<AdresseRead>('/adressen', payload).then((r) => r.data),
  update: (id: string, payload: AdresseUpdate) =>
    api.patch<AdresseRead>(`/adressen/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete<void>(`/adressen/${id}`).then(() => undefined),
  suggest: (q: string, country = 'de', limit = 5) =>
    api
      .get<AdresseSuggestion[]>('/adressen/suggest', {
        params: { q, country, limit },
      })
      .then((r) => r.data),
};
