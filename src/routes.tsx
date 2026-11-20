import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import DashboardPage from '@/pages/DashboardPage';
import ExperimentsPage from '@/pages/ExperimentsPage';
import ExperimentDetailPage from '@/pages/ExperimentDetailPage';
import LearnPage from '@/pages/LearnPage';
import ReportsPage from '@/pages/ReportsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'experiments', element: <ExperimentsPage /> },
      { path: 'experiments/:id', element: <ExperimentDetailPage /> },
      { path: 'learn', element: <LearnPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);