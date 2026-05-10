import React from 'react';
import { AdminProvider, useAdmin } from './contexts/AdminContext';
import { AdminLogin } from './pages/AdminLogin';
import { AdminLayout } from './components/AdminLayout';
import type { MainTab } from '../components/BottomNav';

interface AdminAppProps {
  onBackToApp?: () => void;
  onOpenMainTab?: (tab: MainTab) => void;
}

const AdminAppContent: React.FC<AdminAppProps> = ({ onBackToApp, onOpenMainTab }) => {
  const { currentUser } = useAdmin();
  if (!currentUser) return <AdminLogin />;
  return <AdminLayout onBackToApp={onBackToApp} onOpenMainTab={onOpenMainTab} />;
};

export const AdminApp: React.FC<AdminAppProps> = ({ onBackToApp, onOpenMainTab }) => {
  return (
    <AdminProvider onBackToApp={onBackToApp}>
      <AdminAppContent onBackToApp={onBackToApp} onOpenMainTab={onOpenMainTab} />
    </AdminProvider>
  );
};
