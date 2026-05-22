import { Navigate, useParams } from 'react-router-dom';

/**
 * Backward-compat-Route: alte `/tickets/:id`-URLs leiten auf
 * `/tickets?ticket=<id>` weiter — der Detail-Slide-in öffnet sich dann
 * automatisch über die TicketsListePage.
 */
export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/tickets" replace />;
  return <Navigate to={`/tickets?ticket=${id}`} replace />;
}
