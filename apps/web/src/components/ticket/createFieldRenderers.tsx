/**
 * Shim — die Ticket-Feld-Definitionen leben jetzt zentral in `ticketFieldDefs.tsx`
 * (Phase 2a, ADR 0006: eine Quelle pro Feld). Re-Export für bestehende Importe.
 */
export { renderCreateFeld } from './ticketFieldDefs';
export type { CreateFieldCtx, CreateFieldValues } from './ticketFieldDefs';
