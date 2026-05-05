import React, { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { Dashboard } from '../pages/Dashboard';
import { Applications } from '../pages/Applications';
import { Users } from '../pages/Users';
import { Countries } from '../pages/Countries';
import { Administrators } from '../pages/Administrators';
import { Settings } from '../pages/Settings';
import { AdditionalServices } from '../pages/AdditionalServices';
import { Reviews } from '../pages/Reviews';
import { BonusLogs } from '../pages/BonusLogs';
import { useAdmin } from '../contexts/AdminContext';
import { Menu } from 'lucide-react';

interface AdminLayoutProps {
  onBackToApp?: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onBackToApp }) => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [sectionFilter, setSectionFilter] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { hasPermission } = useAdmin();

  const handleNavigate = (section: string, filter?: any) => {
    setActiveSection(section);
    setSectionFilter(filter || null);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'applications':
        return <Applications filter={sectionFilter} />;
      case 'users':
        return hasPermission(['owner', 'admin']) ? (
          <Users filter={sectionFilter} />
        ) : (
          <PermissionDenied />
        );
      case 'countries':
        return hasPermission(['owner', 'admin']) ? (
          <Countries />
        ) : (
          <PermissionDenied />
        );
      case 'administrators':
        return hasPermission(['owner', 'admin']) ? (
          <Administrators />
        ) : (
          <PermissionDenied />
        );
      case 'settings':
        return hasPermission('owner') ? (
          <Settings />
        ) : (
          <PermissionDenied />
        );
      case 'additional-services':
        return hasPermission(['owner', 'admin']) ? (
          <AdditionalServices />
        ) : (
          <PermissionDenied />
        );
      case 'reviews':
        return hasPermission(['owner', 'admin']) ? (
          <Reviews />
        ) : (
          <PermissionDenied />
        );
      case 'bonus-logs':
        return hasPermission(['owner', 'admin']) ? (
          <BonusLogs />
        ) : (
          <PermissionDenied />
        );
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#F5F7FA] overflow-hidden relative">
      {/* Mobile Hamburger Button - Only show when menu is closed */}
      {!isSidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="lg:hidden fixed top-4 left-4 z-50 p-3.5 bg-[#2196F3] text-white rounded-xl shadow-lg hover:bg-[#1E88E5] transition-all active:scale-95 hover:shadow-xl"
          aria-label="Открыть меню"
          title="Открыть меню"
        >
          <Menu size={24} strokeWidth={2.5} />
        </button>
      )}

      {/* Backdrop for mobile */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 animate-in fade-in"
          onClick={closeSidebar}
          aria-label="Закрыть меню"
        />
      )}

      {/* Sidebar */}
      <AdminSidebar 
        activeSection={activeSection} 
        onSectionChange={(section) => {
          setActiveSection(section);
          closeSidebar();
        }}
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
};

const PermissionDenied: React.FC = () => {
  return (
    <div className="p-8 flex items-center justify-center min-h-screen">
      <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🔒</span>
        </div>
        <h2 className="mb-2">Доступ ограничен</h2>
        <p className="text-gray-600">
          У вас недостаточно прав для просмотра этого раздела
        </p>
      </div>
    </div>
  );
};