import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdressenPage } from './pages/AdressenPage';
import { AnlagenPage } from './pages/AnlagenPage';
import { AuswahllistenPage } from './pages/AuswahllistenPage';
import { StatusWorkflowPage } from './pages/StatusWorkflowPage';
import { DashboardPage } from './pages/DashboardPage';
import { DokumentePage } from './pages/DokumentePage';
import { FehlercodesPage } from './pages/FehlercodesPage';
import { KanbanPage } from './pages/KanbanPage';
import { LoginPage } from './pages/LoginPage';
import { MeineTicketsPage } from './pages/MeineTicketsPage';
import { MobileDemoPage } from './pages/MobileDemoPage';
import { ObjektDetailPage } from './pages/ObjektDetailPage';
import { ObjektePage } from './pages/ObjektePage';
import { PartnerDetailPage } from './pages/PartnerDetailPage';
import { PartnerPage } from './pages/PartnerPage';
import { ProjektDetailPage } from './pages/ProjektDetailPage';
import { ProjektePage } from './pages/ProjektePage';
import { TicketsListePage } from './pages/TicketsListePage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { UsersListePage } from './pages/UsersListePage';
import { VorlageDesignerPage } from './pages/VorlageDesignerPage';
import { VorlagenPage } from './pages/VorlagenPage';
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
          { path: '/projekte/:id', element: <ProjektDetailPage /> },
          { path: '/dokumente', element: <DokumentePage /> },
          { path: '/mobile-demo', element: <MobileDemoPage /> },
          { path: '/stammdaten/adressen', element: <AdressenPage /> },
          { path: '/stammdaten/objekte', element: <ObjektePage /> },
          { path: '/stammdaten/objekte/:id', element: <ObjektDetailPage /> },
          { path: '/stammdaten/partner', element: <PartnerPage /> },
          { path: '/stammdaten/partner/:id', element: <PartnerDetailPage /> },
          { path: '/stammdaten/anlagen', element: <AnlagenPage /> },
          { path: '/stammdaten/fehlercodes', element: <FehlercodesPage /> },
          { path: '/stammdaten/vorlagen', element: <VorlagenPage /> },
          { path: '/stammdaten/vorlagen/neu', element: <VorlageDesignerPage /> },
          { path: '/stammdaten/vorlagen/:id/bearbeiten', element: <VorlageDesignerPage /> },
          { path: '/stammdaten/auswahllisten', element: <AuswahllistenPage /> },
          { path: '/stammdaten/status-workflow', element: <StatusWorkflowPage /> },
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
