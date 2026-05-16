import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { WorkHoursPage } from './pages/WorkHoursPage';
import { JobSitesPage } from './pages/JobSitesPage';
import { ClientsPage } from './pages/ClientsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { TaxPage } from './pages/TaxPage';
import { WcbPage } from './pages/WcbPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { VehiclePage } from './pages/VehiclePage';
import { HomeOfficePage } from './pages/HomeOfficePage';
import { EmploymentPage } from './pages/EmploymentPage';
import { BusinessCard } from './components/BusinessCard';

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return <Layout />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/card/:slug" element={<BusinessCard />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/hours" element={<WorkHoursPage />} />
              <Route path="/sites" element={<JobSitesPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/employment" element={<EmploymentPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/vehicle" element={<VehiclePage />} />
              <Route path="/home-office" element={<HomeOfficePage />} />
              <Route path="/tax" element={<TaxPage />} />
              <Route path="/wcb" element={<WcbPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
