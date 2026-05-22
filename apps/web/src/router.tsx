import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdressenPage } from './pages/AdressenPage';
import { AuswahllistenPage } from './pages/AuswahllistenPage';
import { LoginPage } from './pages/LoginPage';
import { ObjektePage } from './pages/ObjektePage';
import { PartnerPage } from './pages/PartnerPage';
import { TicketsListePage } from './pages/TicketsListePage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { UsersListePage } from './pages/UsersListePage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/tickets" replace /> },
          { path: '/tickets', element: <TicketsListePage /> },
          { path: '/tickets/:id', element: <TicketDetailPage /> },
          { path: '/stammdaten/adressen', element: <AdressenPage /> },
          { path: '/stammdaten/objekte', element: <ObjektePage /> },
          { path: '/stammdaten/partner', element: <PartnerPage /> },
          { path: '/stammdaten/auswahllisten', element: <AuswahllistenPage /> },
          { path: '/users', element: <UsersListePage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
