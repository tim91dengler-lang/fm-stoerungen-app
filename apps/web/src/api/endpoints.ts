import { api } from './client';
import type {
  LoginResponse,
  PaginatedResponse,
  TicketCreate,
  TicketListFilters,
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
  get: (id: string) =>
    api.get<TicketRead>(`/tickets/${id}`).then((r) => r.data),
  create: (payload: TicketCreate) =>
    api.post<TicketRead>('/tickets', payload).then((r) => r.data),
  update: (id: string, payload: TicketUpdate) =>
    api.patch<TicketRead>(`/tickets/${id}`, payload).then((r) => r.data),
  remove: (id: string) =>
    api.delete<void>(`/tickets/${id}`).then(() => undefined),
};
