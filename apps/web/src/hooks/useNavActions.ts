import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Shared navigation actions used by the sidebar, the mobile drawer and the
 * header. Keeps "Neues Ticket" and "Abmelden" behaviour in one place so the
 * desktop and mobile entry points never drift apart.
 */
export function useNavActions() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const newTicket = useCallback(() => {
    navigate('/tickets?new=1');
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  return { newTicket, handleLogout };
}
