import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import AdminLayout from './layouts/AdminLayout/AdminLayout'
import Home from './pages/Home'
import { AgreementPage, AutomationPage, CampaignsPage, DashboardPage, DirectMessagePage, EmailTemplatesPage, SettingsPage } from './pages'

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<SettingsPage />} />

        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route
          path="/admin/dashboard"
          element={
            <AdminLayout>
              <DashboardPage />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/campaigns"
          element={
            <AdminLayout>
              <CampaignsPage />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/automation"
          element={
            <AdminLayout>
              <AutomationPage />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/agreement"
          element={
            <AdminLayout>
              <AgreementPage />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/direct-message"
          element={
            <AdminLayout>
              <DirectMessagePage />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/templates"
          element={
            <AdminLayout>
              <EmailTemplatesPage />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <AdminLayout>
              <SettingsPage />
            </AdminLayout>
          }
        />
      </Routes>
    </AppLayout>
  )
}

export default App
