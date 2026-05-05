import React, { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { Dashboard } from '../pages/Dashboard';
import { Applications } from '../pages/Applications';
import { Users } from '../pages/Users';
import { Countries } from '../pages/Countries';
import { FormBuilder } from '../pages/FormBuilder';
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
      case 'form-builder':
        return hasPermission(['owner', 'admin']) ? (
          <FormBuilder />
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
      {/* Mobile top bar with hamburger — sits in document flow, doesn't overlap */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <button
          onClick={toggleSidebar}
          className="w-9 h-9 rounded-lg vd-grad text-white flex items-center justify-center active:scale-95 transition vd-shadow-cta"
          aria-label="Открыть меню"
        >
          <Menu size={18} strokeWidth={2.5} />
        </button>
        <div className="flex items-center gap-1.5">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M3 12 L9 18 L21 6" stroke="#5C7BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[#0F2A36] font-extrabold text-[15px] tracking-tight">VISADEL</span>
        </div>
        <span className="w-9" />
      </div>

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

      {/* Main Content — pad-top on mobile so the fixed header doesn't cover content */}
      <div className="flex-1 overflow-y-auto pt-14 lg:pt-0">
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