import React from 'react';
import { AdminProvider, useAdmin } from './contexts/AdminContext';
import { AdminLogin } from './pages/AdminLogin';
import { AdminLayout } from './components/AdminLayout';

interface AdminAppProps {
  onBackToApp?: () => void;
}

const AdminAppContent: React.FC<AdminAppProps> = ({ onBackToApp }) => {
  const { currentUser } = useAdmin();

  if (!currentUser) {
    return <AdminLogin />;
  }

  return <AdminLayout onBackToApp={onBackToApp} />;
};

export const AdminApp: React.FC<AdminAppProps> = ({ onBackToApp }) => {
  return (
    <AdminProvider onBackToApp={onBackToApp}>
      <AdminAppContent onBackToApp={onBackToApp} />
    </AdminProvider>
  );
};