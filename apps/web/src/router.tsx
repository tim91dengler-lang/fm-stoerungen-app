import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdressenPage } from './pages/AdressenPage';
import { AuswahllistenPage } from './pages/AuswahllistenPage';
import { DashboardPage } from './pages/DashboardPage';
import { DokumentePage } from './pages/DokumentePage';
import { KanbanPage } from './pages/KanbanPage';
import { LoginPage } from './pages/LoginPage';
import { MeineTicketsPage } from './pages/MeineTicketsPage';
import { MobileDemoPage } from './pages/MobileDemoPage';
import { ObjektDetailPage } from './pages/ObjektDetailPage';
import { ObjektePage } from './pages/ObjektePage';
import { PartnerPage } from './pages/PartnerPage';
import { ProjektePage } from './pages/ProjektePage';
import { TicketsListePage } from './pages/TicketsListePage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { UsersListePage } from './pages/UsersListePage';
import { WartungenPage } from './pages/WartungenPage';

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
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/meine-tickets', element: <MeineTicketsPage /> },
          { path: '/tickets', element: <TicketsListePage /> },
          { path: '/tickets/:id', element: <TicketDetailPage /> },
          { path: '/kanban', element: <KanbanPage /> },
          { path: '/wartungen', element: <WartungenPage /> },
          { path: '/projekte', element: <ProjektePage /> },
          { path: '/dokumente', element: <DokumentePage /> },
          { path: '/mobile-demo', element: <MobileDemoPage /> },
          { path: '/stammdaten/adressen', element: <AdressenPage /> },
          { path: '/stammdaten/objekte', element: <ObjektePage /> },
          { path: '/stammdaten/objekte/:id', element: <ObjektDetailPage /> },
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
