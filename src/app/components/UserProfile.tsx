import { useState, useEffect } from 'react';
import { ChevronLeft, User, FileText, Users, Star, Info } from 'lucide-react';
import ProfileTab from './profile-tabs/ProfileTab';
import ApplicationsTab from './profile-tabs/ApplicationsTab';
import ReferralsTab from './profile-tabs/ReferralsTab';
import ReviewsTab from './profile-tabs/ReviewsTab';
import { HeaderActions } from './HeaderActions';

interface UserProfileProps {
  onBack: () => void;
  onOpenPartnerApplication?: () => void;
  onOpenPartnerDashboard?: () => void;
  onContinueDraft?: (draft: any) => void;
  onContinueHotelDraft?: () => void;
  onContinueFlightDraft?: () => void;
  initialTab?: Tab;
}

type Tab = 'profile' | 'applications' | 'referrals' | 'reviews';

const TABS = [
  { id: 'profile' as Tab,      label: 'Профиль',    icon: User },
  { id: 'applications' as Tab, label: 'Мои заявки', icon: FileText },
  { id: 'referrals' as Tab,    label: 'Партнёрство', icon: Users },
  { id: 'reviews' as Tab,      label: 'Отзывы',     icon: Star },
];

export default function UserProfile({
  onBack, onOpenPartnerApplication, onOpenPartnerDashboard,
  onContinueDraft, onContinueHotelDraft, onContinueFlightDraft, initialTab,
}: UserProfileProps) {
  const [activeTab, setActiveTab]       = useState<Tab>(initialTab ?? 'profile');
  const [bonusBalance, setBonusBalance] = useState(0);
  const [showBonusInfo, setShowBonusInfo] = useState(false);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    setBonusBalance(userData.bonusBalance || 0);
  }, [activeTab]);

  const handleBonusChange = (newBalance: number) => setBonusBalance(newBalance);

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20">
      {/* Combined sticky header — brand row + tab bar (banking-app pattern,
          чтобы тaбы и логотип всегда стояли вместе при скролле, без проблем
          с расчётом offset как было раньше при двух отдельных sticky). */}
      <div className="bg-white sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-2xl mx-auto">
          {/* Brand row: ←  ✓ VISADEL  [Profile][Partner][Admin] */}
          <div className="px-5 pt-3 pb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={onBack}
                className="w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700 transition active:scale-95 shrink-0"
                aria-label="Назад"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 min-w-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
                  <path d="M3 12 L9 18 L21 6" stroke="#5C7BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[#0F2A36] font-extrabold text-[16px] tracking-tight truncate">VISADEL</span>
              </div>
            </div>
            <HeaderActions />
          </div>
          {/* Tab bar — pill tabs, в той же sticky-области */}
          <div className="px-3 pb-2 overflow-x-auto border-t border-gray-100">
            <div className="flex gap-1.5 min-w-max pt-2">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                      isActive
                        ? 'vd-grad text-white shadow-md vd-shadow-cta'
                        : 'text-[#5C7BFF]/70 hover:bg-[#EAF1FF]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Hero — bonus balance. Показываем ТОЛЬКО на табе «Профиль».
            На остальных табах (Мои заявки / Партнёрство / Отзывы) бонусный
            счёт смыслово не нужен и только отвлекает. */}
        {activeTab === 'profile' && (
          <div className="vd-grad-soft px-5 pt-7 pb-6">
            <p className="text-center text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold">
              Личный кабинет
            </p>
            <h1 className="text-center text-[28px] leading-[1.05] tracking-tight font-extrabold text-[#0F2A36] mt-1">
              Бонусный счёт
            </h1>
            <p className="text-center mt-3">
              <span className="vd-grad-text text-[36px] font-extrabold tracking-tight">
                {bonusBalance.toLocaleString('ru-RU')} ₽
              </span>
            </p>
            <p className="text-center text-[12px] text-[#0F2A36]/55 mt-1">
              1 ₽ бонуса = 1 ₽ скидки
            </p>

            {/* Subtle disclaimer — small "где можно потратить бонусы" с раскрывашкой */}
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setShowBonusInfo(v => !v)}
                className="inline-flex items-center gap-1 text-[11px] text-[#0F2A36]/45 hover:text-[#3B5BFF] transition"
              >
                <Info className="w-3 h-3" />
                На что можно потратить
              </button>
            </div>
            {showBonusInfo && (
              <div className="mt-2 mx-auto max-w-md bg-white/60 border border-blue-100/50 rounded-xl px-3 py-2.5">
                <p className="text-[11px] text-[#0F2A36]/75 leading-snug">
                  Бонусы можно использовать как скидку при оформлении{' '}
                  <span className="font-semibold">визы</span>,{' '}
                  <span className="font-semibold">брони отеля</span> и{' '}
                  <span className="font-semibold">брони авиабилета</span>.
                </p>
                <p className="text-[10px] text-[#0F2A36]/50 mt-1.5 leading-snug">
                  Не действуют на готовые авиабилеты, отели из каталога,
                  экскурсии, страховки, eSIM и прочие услуги.
                  Лимит списания — 500₽ на одну заявку.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="px-4 py-4">
          {activeTab === 'profile'      && <ProfileTab onBonusChange={handleBonusChange} />}
          {activeTab === 'applications' && (
            <ApplicationsTab
              onContinueDraft={onContinueDraft}
              onContinueHotelDraft={onContinueHotelDraft}
              onContinueFlightDraft={onContinueFlightDraft}
              onBonusChange={handleBonusChange}
            />
          )}
          {activeTab === 'referrals'    && <ReferralsTab onOpenPartnerApplication={onOpenPartnerApplication} onOpenPartnerDashboard={onOpenPartnerDashboard} />}
          {activeTab === 'reviews'      && <ReviewsTab />}
        </div>
      </div>
    </div>
  );
}
