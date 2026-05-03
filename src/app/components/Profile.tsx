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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1>Личный кабинет</h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto gap-2 py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{tab.label}</span>
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
