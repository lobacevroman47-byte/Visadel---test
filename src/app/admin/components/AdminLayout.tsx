import React, { useState, lazy, Suspense } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminBottomNav, type AdminProductTab } from './AdminBottomNav';
// Dashboard тащит recharts (~65KB gzipped). Грузим только когда админ
// открывает дашборд, а не на старте AdminApp.
const Dashboard = lazy(() => import('../pages/Dashboard').then(m => ({ default: m.Dashboard })));
import { Applications } from '../pages/Applications';
import { Users } from '../pages/Users';
import { Catalog } from '../pages/Catalog';
// Countries и FormBuilder больше не рендерятся напрямую (заменены Catalog'ом),
// но экспорты сохраняются — другие части админки (страницы/тесты) могут их
// импортировать напрямую.
import { Administrators } from '../pages/Administrators';
import { Settings } from '../pages/Settings';
import { AdditionalServices } from '../pages/AdditionalServices';
import { Reviews } from '../pages/Reviews';
import { BonusLogs } from '../pages/BonusLogs';
import { Bookings } from '../pages/Bookings';
import { Partners } from '../pages/Partners';
import { PartnerApplications } from '../pages/PartnerApplications';
import { AuditLog } from '../pages/AuditLog';
import { useAdmin } from '../contexts/AdminContext';
import { Menu, ArrowLeft } from 'lucide-react';

interface AdminLayoutProps {
  onBackToApp?: () => void;
}

type ProductSection = 'product-visas' | 'product-bookings' | 'product-flights' | 'product-hotels';

const PRODUCT_PLACEHOLDERS: Record<Exclude<AdminProductTab, 'visas'>, { title: string; description: string; emoji: string }> = {
  bookings: {
    title: 'Брони',
    description: 'Раздел управления отдельными бронями (отель + билет) появится с подключением API. Сейчас брони доступны как доп. услуги внутри визовых заявок.',
    emoji: '📅',
  },
  flights: {
    title: 'Авиабилеты',
    description: 'Прямой поиск и продажа билетов через API. На стадии планирования — после интеграции появятся отдельные заявки и финансовая аналитика.',
    emoji: '✈️',
  },
  hotels: {
    title: 'Отели',
    description: 'Каталог отелей с динамическими ценами через API. Будет работать так же, как раздел виз: каталог, заявки, статусы, выручка/прибыль.',
    emoji: '🏨',
  },
};

const ComingSoonAdmin: React.FC<{ tab: Exclude<AdminProductTab, 'visas'> }> = ({ tab }) => {
  const data = PRODUCT_PLACEHOLDERS[tab];
  return (
    <div className="min-h-screen pb-32 lg:pb-12 px-5 pt-8 flex flex-col items-center text-center">
      <div className="w-24 h-24 rounded-3xl vd-grad-soft border border-blue-100 flex items-center justify-center text-5xl shadow-sm mb-6">
        {data.emoji}
      </div>
      <p className="text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold">Скоро</p>
      <h1 className="text-[28px] font-extrabold tracking-tight text-[#0F2A36] mt-1">{data.title}</h1>
      <p className="text-sm text-[#0F2A36]/60 mt-3 max-w-md leading-relaxed">{data.description}</p>
      <div className="mt-8 vd-grad-soft border border-blue-100 rounded-2xl px-5 py-4 max-w-md">
        <p className="text-[11px] uppercase tracking-widest text-[#3B5BFF] font-bold">Что уже работает</p>
        <p className="text-sm text-[#0F2A36] mt-1">
          Раздел <strong>«Визы»</strong> — каталог, заявки, финансы, конструктор анкет, доп. услуги.
        </p>
      </div>
    </div>
  );
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onBackToApp }) => {
  const [activeSection, setActiveSection] = useState<string>('dashboard');
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

  const handleProductTabChange = (tab: AdminProductTab) => {
    if (tab === 'visas') {
      setActiveSection('applications');
      setSectionFilter(null);
    } else {
      setActiveSection(`product-${tab}` as ProductSection);
      setSectionFilter(null);
    }
  };

  const productActive: AdminProductTab | undefined = (() => {
    if (activeSection === 'applications') return 'visas';
    if (activeSection.startsWith('product-')) {
      return activeSection.slice('product-'.length) as AdminProductTab;
    }
    return undefined;
  })();

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <Suspense fallback={<div className="p-8 text-sm text-gray-400">Загружаем дашборд…</div>}>
            <Dashboard onNavigate={handleNavigate} />
          </Suspense>
        );
      case 'applications':
        return <Applications filter={sectionFilter} />;
      case 'bookings':
        return <Bookings />;
      case 'product-bookings':
        return <Bookings />;
      case 'product-flights':
        return <Bookings initialTab="flights" />;
      case 'product-hotels':
        return <Bookings initialTab="hotels" />;
      case 'users':
        return hasPermission(['owner', 'admin']) ? (
          <Users filter={sectionFilter} />
        ) : (
          <PermissionDenied />
        );
      // Объединённый раздел «Каталог» — оба legacy-ключа (countries и
      // form-builder) ведут сюда, чтобы не сломать существующие deeplink'и.
      case 'countries':
      case 'form-builder':
        return hasPermission(['owner', 'admin']) ? (
          <Catalog />
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
      // Legacy redirect — раздел переехал в Каталог → вкладка «Доп. услуги»
      case 'additional-services':
        return hasPermission(['owner', 'admin']) ? (
          <Catalog />
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
      // 'payouts' — legacy alias (старая отдельная страница), остаётся для
      // backwards-совместимости URL'ов; рендерит ту же объединённую Partners.
      case 'partners':
      case 'payouts':
        return hasPermission(['owner', 'admin']) ? (
          <Partners />
        ) : (
          <PermissionDenied />
        );
      case 'partner-applications':
        return hasPermission(['owner', 'admin']) ? (
          <PartnerApplications />
        ) : (
          <PermissionDenied />
        );
      case 'audit-log':
        return hasPermission(['owner', 'admin']) ? (
          <AuditLog />
        ) : (
          <PermissionDenied />
        );
      default:
        return (
          <Suspense fallback={<div className="p-8 text-sm text-gray-400">Загружаем дашборд…</div>}>
            <Dashboard onNavigate={handleNavigate} />
          </Suspense>
        );
    }
  };

  return (
    <div className="flex h-screen bg-[#F5F7FA] overflow-hidden relative">
      {/* Mobile top bar — slim, brand-styled */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={toggleSidebar}
            className="w-9 h-9 rounded-xl bg-[#EAF1FF] text-[#3B5BFF] flex items-center justify-center active:scale-95 transition"
            aria-label="Открыть меню"
          >
            <Menu size={18} strokeWidth={2.5} />
          </button>
          <div className="flex items-center gap-1.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M3 12 L9 18 L21 6" stroke="#5C7BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[#0F2A36] font-extrabold text-[15px] tracking-tight">VISADEL</span>
            <span className="ml-1 text-[9px] uppercase tracking-widest text-[#3B5BFF] font-bold">Admin</span>
          </div>
          {onBackToApp ? (
            <button
              onClick={onBackToApp}
              className="h-9 px-2.5 rounded-xl bg-[#EAF1FF] text-[#3B5BFF] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 active:scale-95 transition"
              aria-label="К мини-аппу"
              title="К мини-аппу"
            >
              <ArrowLeft size={14} strokeWidth={2.5} />
              <span className="hidden xs:inline">Мини-апп</span>
            </button>
          ) : (
            <span className="w-9" />
          )}
        </div>
      </div>

      {/* Backdrop for mobile */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-[#0F2A36]/35 backdrop-blur-sm z-40 transition-opacity duration-300 animate-in fade-in"
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

      {/* Main Content — pad-top on mobile so the fixed header doesn't cover content; pad-bottom for bottom nav */}
      <div className="flex-1 overflow-y-auto admin-main">
        {renderContent()}
      </div>

      {/* Mobile bottom nav — same style as main mini-app */}
      <AdminBottomNav
        active={productActive ?? 'visas'}
        onChange={handleProductTabChange}
      />

      <style>{`
        .admin-main {
          padding-top: calc(env(safe-area-inset-top, 0px) + 56px);
          padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 72px);
        }
        @media (min-width: 1024px) {
          .admin-main {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }
        }
      `}</style>
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
