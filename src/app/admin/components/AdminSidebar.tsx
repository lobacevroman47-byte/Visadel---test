import React from 'react';
import {
  Home,
  FileText,
  Users,
  Globe,
  FileEdit,
  Shield,
  Settings,
  LogOut,
  ArrowLeft,
  Package,
  MessageSquare,
  Gift,
  X
} from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, active, onClick, disabled }) => {
  return (
    <div className="px-3 mb-1">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
          disabled 
            ? 'opacity-40 cursor-not-allowed' 
            : active 
              ? 'bg-[#2196F3] text-white shadow-sm' 
              : 'text-gray-700 hover:bg-[#F5F7FA]'
        }`}
        title={disabled ? 'Недостаточно прав' : ''}
      >
        <div className="w-5 h-5 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-sm">{label}</span>
      </button>
    </div>
  );
};

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ 
  activeSection, 
  onSectionChange,
  isOpen,
  onClose
}) => {
  const { currentUser, logout, hasPermission, onBackToApp } = useAdmin();

  const canAccessAdministrators = hasPermission(['owner', 'admin']);
  const canAccessSettings = hasPermission('owner');

  return (
    <div 
      className={`
        fixed lg:static
        inset-y-0 left-0
        w-64 h-screen 
        bg-white border-r border-gray-200 
        flex flex-col
        z-50
        transition-transform duration-300 ease-in-out
        shadow-2xl lg:shadow-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Close button for mobile */}
      <button
        onClick={onClose}
        className="lg:hidden absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors z-10"
        aria-label="Закрыть меню"
      >
        <X size={20} />
      </button>

      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-[#2196F3] pr-8">Visadel Agency</h1>
        <p className="text-sm text-gray-500 mt-1">Админ-панель</p>
      </div>

      {/* User Info */}
      {currentUser && (
        <div className="px-4 py-4 border-b border-gray-200">
          <p className="text-sm pr-8">{currentUser.name}</p>
          <p className="text-xs text-gray-500">{currentUser.telegram}</p>
          <span className="inline-block mt-2 px-2 py-1 bg-[#F5F7FA] text-xs rounded">
            {currentUser.role === 'owner' ? 'Владелец' : currentUser.role === 'admin' ? 'Администратор' : 'Менеджер'}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <SidebarItem
          icon={<Home size={20} />}
          label="Главная"
          active={activeSection === 'dashboard'}
          onClick={() => onSectionChange('dashboard')}
        />
        <SidebarItem
          icon={<FileText size={20} />}
          label="Заявки"
          active={activeSection === 'applications'}
          onClick={() => onSectionChange('applications')}
        />
        <SidebarItem
          icon={<Users size={20} />}
          label="Пользователи"
          active={activeSection === 'users'}
          onClick={() => onSectionChange('users')}
          disabled={!hasPermission(['owner', 'admin'])}
        />
        <SidebarItem
          icon={<Shield size={20} />}
          label="Администраторы"
          active={activeSection === 'administrators'}
          onClick={() => onSectionChange('administrators')}
          disabled={!canAccessAdministrators}
        />
        <SidebarItem
          icon={<MessageSquare size={20} />}
          label="Отзывы"
          active={activeSection === 'reviews'}
          onClick={() => onSectionChange('reviews')}
          disabled={!hasPermission(['owner', 'admin'])}
        />
        <SidebarItem
          icon={<Gift size={20} />}
          label="История бонусов"
          active={activeSection === 'bonus-logs'}
          onClick={() => onSectionChange('bonus-logs')}
          disabled={!hasPermission(['owner', 'admin'])}
        />
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <div className="px-3">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <LogOut size={20} />
            <span className="text-sm">Выход</span>
          </button>
        </div>
      </div>
    </div>
  );
};