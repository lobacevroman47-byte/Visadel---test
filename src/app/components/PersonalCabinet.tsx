import { useState } from 'react';
import { ArrowLeft, User, FileText, Target, Users, Star } from 'lucide-react';
import ProfileTab from './cabinet-tabs/ProfileTab';
import ApplicationsTab from './cabinet-tabs/ApplicationsTab';
import TasksTab from './cabinet-tabs/TasksTab';
import ReferralsTab from './cabinet-tabs/ReferralsTab';
import ReviewsTab from './cabinet-tabs/ReviewsTab';

interface PersonalCabinetProps {
  onBack: () => void;
}

type Tab = 'profile' | 'applications' | 'tasks' | 'referrals' | 'reviews';

export default function PersonalCabinet({ onBack }: PersonalCabinetProps) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const tabs = [
    { id: 'profile' as Tab, label: 'Профиль', icon: User },
    { id: 'applications' as Tab, label: 'Заявки', icon: FileText },
    { id: 'tasks' as Tab, label: 'Задания', icon: Target },
    { id: 'referrals' as Tab, label: 'Рефералы', icon: Users },
    { id: 'reviews' as Tab, label: 'Отзывы', icon: Star }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-lg text-gray-900">Личный кабинет</h1>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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

      {/* Tab Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'applications' && <ApplicationsTab />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'referrals' && <ReferralsTab />}
        {activeTab === 'reviews' && <ReviewsTab />}
      </div>
    </div>
  );
}
