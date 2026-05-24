import { api } from './client';
import type {
  AdresseCreate,
  AdresseRead,
  AdresseSuggestion,
  AdresseUpdate,
  AnlageCreate,
  AnlageRead,
  AnlageUpdate,
  AuswahllisteCreate,
  AuswahllisteRead,
  AuswahllistenWertCreate,
  AuswahllistenWertRead,
  AuswahllistenWertUpdate,
  DokumentLink,
  DokumentRead,
  DokumentTarget,
  DokumentUpdate,
  EinheitCreate,
  EinheitRead,
  EinheitUpdate,
  FehlercodeCreate,
  FehlercodeRead,
  FehlercodeUpdate,
  GespeicherteAnsichtCreate,
  GespeicherteAnsichtRead,
  GespeicherteAnsichtUpdate,
  HausCreate,
  HausRead,
  HausUpdate,
  LoginResponse,
  NotificationRead,
  ObjektCreate,
  ObjektRead,
  ObjektUpdate,
  PaginatedResponse,
  PartnerCreate,
  PartnerRead,
  PartnerUpdate,
  ProjektCreate,
  ProjektRead,
  ProjektStatus,
  ProjektUpdate,
  StockwerkCreate,
  StockwerkRead,
  StockwerkUpdate,
  TickettypFeldUpdate,
  TickettypRead,
  TickettypCreate,
  TickettypUpdate,
  TicketCreate,
  TicketListFilters,
  TicketMessageCreate,
  TicketMessageRead,
  TicketPhotoRead,
  TicketPhotoUpdate,
  TicketRead,
  TicketUpdate,
  UserRead,
  UUID,
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
  remove: (id: string) => api.delete<void>(`/users/${id}`).then(() => undefined),
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

export const tickettypApi = {
  list: () =>
    api.get<TickettypRead[]>('/tickettypen').then((r) => r.data),
  get: (id: UUID) =>
    api.get<TickettypRead>(`/tickettypen/${id}`).then((r) => r.data),
  create: (payload: TickettypCreate) =>
    api.post<TickettypRead>('/tickettypen', payload).then((r) => r.data),
  update: (id: UUID, payload: TickettypUpdate) =>
    api.patch<TickettypRead>(`/tickettypen/${id}`, payload).then((r) => r.data),
  updateFelder: (id: UUID, payload: TickettypFeldUpdate[]) =>
    api
      .patch<TickettypRead>(`/tickettypen/${id}/felder`, payload)
      .then((r) => r.data),
  remove: (id: UUID) =>
    api.delete<void>(`/tickettypen/${id}`).then(() => undefined),
};

export const anlageApi = {
  list: (
    params: {
      search?: string;
      objekt_id?: UUID;
      aktiv_only?: boolean;
    } = {},
  ) =>
    api.get<AnlageRead[]>('/anlagen', { params }).then((r) => r.data),
  get: (id: UUID) =>
    api.get<AnlageRead>(`/anlagen/${id}`).then((r) => r.data),
  create: (payload: AnlageCreate) =>
    api.post<AnlageRead>('/anlagen', payload).then((r) => r.data),
  update: (id: UUID, payload: AnlageUpdate) =>
    api.patch<AnlageRead>(`/anlagen/${id}`, payload).then((r) => r.data),
  remove: (id: UUID) =>
    api.delete<void>(`/anlagen/${id}`).then(() => undefined),
};

export const fehlercodeApi = {
  list: (
    params: {
      search?: string;
      anlage_id?: UUID;
      aktiv_only?: boolean;
    } = {},
  ) =>
    api
      .get<FehlercodeRead[]>('/fehlercodes', { params })
      .then((r) => r.data),
  get: (id: UUID) =>
    api.get<FehlercodeRead>(`/fehlercodes/${id}`).then((r) => r.data),
  create: (payload: FehlercodeCreate) =>
    api.post<FehlercodeRead>('/fehlercodes', payload).then((r) => r.data),
  update: (id: UUID, payload: FehlercodeUpdate) =>
    api
      .patch<FehlercodeRead>(`/fehlercodes/${id}`, payload)
      .then((r) => r.data),
  remove: (id: UUID) =>
    api.delete<void>(`/fehlercodes/${id}`).then(() => undefined),
};

export const projektApi = {
  list: (
    params: {
      search?: string;
      status?: ProjektStatus[];
      include_deleted?: boolean;
    } = {},
  ) =>
    api
      .get<ProjektRead[]>('/projekte', { params })
      .then((r) => r.data),
  get: (id: UUID) =>
    api.get<ProjektRead>(`/projekte/${id}`).then((r) => r.data),
  create: (payload: ProjektCreate) =>
    api.post<ProjektRead>('/projekte', payload).then((r) => r.data),
  update: (id: UUID, payload: ProjektUpdate) =>
    api.patch<ProjektRead>(`/projekte/${id}`, payload).then((r) => r.data),
  remove: (id: UUID) =>
    api.delete<void>(`/projekte/${id}`).then(() => undefined),
};

export const objektstrukturApi = {
  listHaus: (objektId: UUID) =>
    api
      .get<HausRead[]>(`/objektstruktur/objekte/${objektId}/haus`)
      .then((r) => r.data),
  createHaus: (objektId: UUID, payload: HausCreate) =>
    api
      .post<HausRead>(`/objektstruktur/objekte/${objektId}/haus`, payload)
      .then((r) => r.data),
  updateHaus: (hausId: UUID, payload: HausUpdate) =>
    api
      .patch<HausRead>(`/objektstruktur/haus/${hausId}`, payload)
      .then((r) => r.data),
  removeHaus: (hausId: UUID) =>
    api
      .delete<void>(`/objektstruktur/haus/${hausId}`)
      .then(() => undefined),
  createStockwerk: (hausId: UUID, payload: StockwerkCreate) =>
    api
      .post<StockwerkRead>(`/objektstruktur/haus/${hausId}/stockwerke`, payload)
      .then((r) => r.data),
  updateStockwerk: (stockwerkId: UUID, payload: StockwerkUpdate) =>
    api
      .patch<StockwerkRead>(`/objektstruktur/stockwerke/${stockwerkId}`, payload)
      .then((r) => r.data),
  removeStockwerk: (stockwerkId: UUID) =>
    api
      .delete<void>(`/objektstruktur/stockwerke/${stockwerkId}`)
      .then(() => undefined),
  uploadGrundriss: (stockwerkId: UUID, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post<StockwerkRead>(`/objektstruktur/stockwerke/${stockwerkId}/grundriss`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  fetchGrundrissBlob: (stockwerkId: UUID) =>
    api
      .get<Blob>(`/objektstruktur/stockwerke/${stockwerkId}/grundriss/file`, {
        responseType: 'blob',
      })
      .then((r) => r.data),
  createEinheit: (stockwerkId: UUID, payload: EinheitCreate) =>
    api
      .post<EinheitRead>(`/objektstruktur/stockwerke/${stockwerkId}/einheiten`, payload)
      .then((r) => r.data),
  updateEinheit: (einheitId: UUID, payload: EinheitUpdate) =>
    api
      .patch<EinheitRead>(`/objektstruktur/einheiten/${einheitId}`, payload)
      .then((r) => r.data),
  removeEinheit: (einheitId: UUID) =>
    api
      .delete<void>(`/objektstruktur/einheiten/${einheitId}`)
      .then(() => undefined),
};

export const notificationApi = {
  list: (limit = 50) =>
    api
      .get<NotificationRead[]>('/notifications', { params: { limit } })
      .then((r) => r.data),
  count: () =>
    api
      .get<{ unread: number }>('/notifications/count')
      .then((r) => r.data),
  markRead: (ids: UUID[]) =>
    api
      .post<{ status: string }>('/notifications/mark-read', { ids })
      .then((r) => r.data),
  markAllRead: () =>
    api
      .post<{ status: string }>('/notifications/mark-all-read')
      .then((r) => r.data),
};

export const dokumentApi = {
  list: (
    params: {
      search?: string;
      target_type?: DokumentTarget;
      target_id?: UUID;
    } = {},
  ) =>
    api
      .get<DokumentRead[]>('/dokumente', { params })
      .then((r) => r.data),
  upload: (
    file: File,
    opts: {
      name?: string;
      kategorie?: string;
      beschreibung?: string;
      links?: DokumentLink[];
    } = {},
  ) => {
    const fd = new FormData();
    fd.append('file', file);
    if (opts.name) fd.append('name', opts.name);
    if (opts.kategorie) fd.append('kategorie', opts.kategorie);
    if (opts.beschreibung) fd.append('beschreibung', opts.beschreibung);
    if (opts.links && opts.links.length > 0)
      fd.append('links_json', JSON.stringify(opts.links));
    return api
      .post<DokumentRead>('/dokumente', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  update: (id: UUID, payload: DokumentUpdate) =>
    api
      .patch<DokumentRead>(`/dokumente/${id}`, payload)
      .then((r) => r.data),
  remove: (id: UUID) =>
    api.delete<void>(`/dokumente/${id}`).then(() => undefined),
  fetchBlob: (id: UUID) =>
    api
      .get<Blob>(`/dokumente/${id}/file`, { responseType: 'blob' })
      .then((r) => r.data),
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
