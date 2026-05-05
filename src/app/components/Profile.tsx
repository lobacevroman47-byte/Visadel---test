import { useState } from 'react';
import { ArrowLeft, User, FileText, Trophy, Users, MessageSquare, Gift } from 'lucide-react';
import ProfileTab from './profile/ProfileTab';
import ApplicationsTab from './profile/ApplicationsTab';
import TasksTab from './profile/TasksTab';
import ReferralsTab from './profile/ReferralsTab';
import ReviewsTab from './profile/ReviewsTab';
import BonusesTab from './profile/BonusesTab';

interface ProfileProps {
  onBack: () => void;
}

export default function Profile({ onBack }: ProfileProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'applications' | 'tasks' | 'referrals' | 'reviews' | 'bonuses'>('profile');

  const tabs = [
    { id: 'profile' as const, label: 'Профиль', icon: User },
    { id: 'applications' as const, label: 'Мои заявки', icon: FileText },
    { id: 'tasks' as const, label: 'Задания', icon: Trophy },
    { id: 'referrals' as const, label: 'Рефералы', icon: Users },
    { id: 'reviews' as const, label: 'Отзывы', icon: MessageSquare },
    { id: 'bonuses' as const, label: 'Бонусы', icon: Gift },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Brand header — VISADEL with checkmark */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-5 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700 transition"
              aria-label="Назад"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M3 12 L9 18 L21 6" stroke="#5C7BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-[#0F2A36] font-extrabold text-[16px] tracking-tight">VISADEL</span>
            </div>
            <div className="w-9" />
          </div>
          <p className="text-center text-[11px] text-[#0F2A36]/60 mt-1">Личный кабинет</p>
        </div>
      </div>

      {/* Tabs — pill-shaped with brand gradient on active */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto gap-2 py-3 no-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                    active
                      ? 'vd-grad text-white font-bold vd-shadow-cta'
                      : 'bg-gray-50 text-[#0F2A36]/70 hover:bg-gray-100 font-medium'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[13px]">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'applications' && <ApplicationsTab />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'referrals' && <ReferralsTab />}
        {activeTab === 'reviews' && <ReviewsTab />}
        {activeTab === 'bonuses' && <BonusesTab />}
      </div>
    </div>
  );
}
