import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './contexts/ToastContext';
import { ConfirmProvider } from './hooks/useConfirm';
import MainLayout from './layouts/MainLayout';
import PortalLayout from './layouts/PortalLayout';
import Login from './pages/Login';
import PartnerSetup from './pages/PartnerSetup';
import Dashboard from './pages/Dashboard';
import Partners from './pages/Partners';
import Ranks from './pages/Ranks';
import Products from './pages/Products';
import Leads from './pages/Leads';
import Deals from './pages/Deals';
import Commissions from './pages/Commissions';
import Materials from './pages/Materials';
import Settings from './pages/Settings';
import PortalHome from './pages/portal/PortalHome';
import PortalRefer from './pages/portal/PortalRefer';
import PortalReferrals from './pages/portal/PortalReferrals';
import PortalRewards from './pages/portal/PortalRewards';
import PortalMaterials from './pages/portal/PortalMaterials';
import PortalProfile from './pages/portal/PortalProfile';

// 管理者専用ルートのガード
function AdminRoute({ children }) {
  const { user, role } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role === 'partner') return <Navigate to="/portal" replace />;
  return children;
}

// パートナー専用ルートのガード
function PartnerRoute({ children }) {
  const { user, role } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role === 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/portal/setup/:token" element={<PartnerSetup />} />

      {/* 管理者 */}
      <Route element={<AdminRoute><MainLayout /></AdminRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/partners" element={<Partners />} />
        <Route path="/ranks" element={<Ranks />} />
        <Route path="/products" element={<Products />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/deals" element={<Deals />} />
        <Route path="/commissions" element={<Commissions />} />
        <Route path="/materials" element={<Materials />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* パートナー */}
      <Route element={<PartnerRoute><PortalLayout /></PartnerRoute>}>
        <Route path="/portal" element={<PortalHome />} />
        <Route path="/portal/refer" element={<PortalRefer />} />
        <Route path="/portal/referrals" element={<PortalReferrals />} />
        <Route path="/portal/rewards" element={<PortalRewards />} />
        <Route path="/portal/materials" element={<PortalMaterials />} />
        <Route path="/portal/profile" element={<PortalProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AppRoutes />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
