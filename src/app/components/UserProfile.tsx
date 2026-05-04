import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, User, FileText, ListTodo, Users, Star } from 'lucide-react';
import ProfileTab from './profile-tabs/ProfileTab';
import ApplicationsTab from './profile-tabs/ApplicationsTab';
import TasksTab from './profile-tabs/TasksTab';
import ReferralsTab from './profile-tabs/ReferralsTab';
import ReviewsTab from './profile-tabs/ReviewsTab';

interface UserProfileProps {
  onBack: () => void;
  onOpenInfluencerDashboard: () => void;
  onOpenPartnerApplication?: () => void;
  onContinueDraft?: (draft: any) => void;
  onOpenAdmin?: () => void;
  initialTab?: Tab;
}

type Tab = 'profile' | 'applications' | 'tasks' | 'referrals' | 'reviews';

const TABS = [
  { id: 'profile' as Tab,      label: 'Профиль',    icon: User },
  { id: 'applications' as Tab, label: 'Мои заявки', icon: FileText },
  { id: 'tasks' as Tab,        label: 'Задания',     icon: ListTodo },
  { id: 'referrals' as Tab,    label: 'Рефералы',   icon: Users },
  { id: 'reviews' as Tab,      label: 'Отзывы',     icon: Star },
];

export default function UserProfile({
  onBack, onOpenInfluencerDashboard, onOpenPartnerApplication,
  onContinueDraft, onOpenAdmin, initialTab,
}: UserProfileProps) {
  const [activeTab, setActiveTab]       = useState<Tab>(initialTab ?? 'profile');
  const [bonusBalance, setBonusBalance] = useState(0);
  const [headerHidden, setHeaderHidden] = useState(false);

  const lastScrollY = useRef(0);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    setBonusBalance(userData.bonusBalance || 0);
  }, [activeTab]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const y = e.currentTarget.scrollTop;
    const diff = y - lastScrollY.current;
    if (diff > 6 && y > 20)  setHeaderHidden(true);   // scrolling down
    if (diff < -6)            setHeaderHidden(false);  // scrolling up
    lastScrollY.current = y;
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20" onScroll={handleScroll} style={{ overflowY: 'auto' }}>

      {/* Blue header — slides up when scrolling down */}
      <div
        className="bg-gradient-to-r from-[#0D47A1] to-[#1976D2] text-white shadow-lg sticky top-0 z-20 transition-transform duration-300"
        style={{ transform: headerHidden ? 'translateY(-100%)' : 'translateY(0)' }}
      >
        <div className="max-w-2xl mx-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-full transition">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl">Личный кабинет</h1>
            <div className="w-10" />
          </div>
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
            <p className="text-sm text-[#E3F2FD]">Бонусный счёт</p>
            <p className="text-2xl">{bonusBalance}₽</p>
          </div>
        </div>
      </div>

      {/* Tab bar — always visible, sticks right under header (or top when header hidden) */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto overflow-x-auto">
          <div className="flex">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 min-w-max px-3 py-3 flex items-center justify-center gap-1.5 transition ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4">
        {activeTab === 'profile'      && <ProfileTab onOpenInfluencerDashboard={onOpenInfluencerDashboard} onOpenAdmin={onOpenAdmin} />}
        {activeTab === 'applications' && <ApplicationsTab onContinueDraft={onContinueDraft} />}
        {activeTab === 'tasks'        && <TasksTab />}
        {activeTab === 'referrals'    && <ReferralsTab onOpenPartnerApplication={onOpenPartnerApplication} />}
        {activeTab === 'reviews'      && <ReviewsTab />}
      </div>
    </div>
  );
}
