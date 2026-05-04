import { useState, useEffect } from 'react';
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
  { id: 'profile' as Tab, label: 'Профиль', icon: User },
  { id: 'applications' as Tab, label: 'Мои заявки', icon: FileText },
  { id: 'tasks' as Tab, label: 'Задания', icon: ListTodo },
  { id: 'referrals' as Tab, label: 'Рефералы', icon: Users },
  { id: 'reviews' as Tab, label: 'Отзывы', icon: Star },
];

export default function UserProfile({ onBack, onOpenInfluencerDashboard, onOpenPartnerApplication, onContinueDraft, onOpenAdmin, initialTab }: UserProfileProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'profile');
  const [bonusBalance, setBonusBalance] = useState(0);

  useEffect(() => {
    // Load bonus balance from localStorage
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    setBonusBalance(userData.bonusBalance || 0);
  }, [activeTab]); // Reload when tab changes

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0D47A1] to-[#1976D2] text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/20 rounded-full transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl">Личный кабинет</h1>
            <div className="w-10" /> {/* Spacer */}
          </div>

          {/* Bonus Balance */}
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
            <p className="text-sm text-[#E3F2FD]">Бонусный счёт</p>
            <p className="text-2xl">{bonusBalance}₽</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b sticky top-[120px] z-10 shadow-sm">
        <div className="max-w-2xl mx-auto overflow-x-auto">
          <div className="flex">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 min-w-max px-4 py-3 flex items-center justify-center gap-2 transition ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-2xl mx-auto p-4">
        {activeTab === 'profile' && <ProfileTab onOpenInfluencerDashboard={onOpenInfluencerDashboard} onOpenAdmin={onOpenAdmin} />}
        {activeTab === 'applications' && <ApplicationsTab onContinueDraft={onContinueDraft} />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'referrals' && <ReferralsTab onOpenPartnerApplication={onOpenPartnerApplication} />}
        {activeTab === 'reviews' && <ReviewsTab />}
      </div>
    </div>
  );
}