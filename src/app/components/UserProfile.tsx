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
  { id: 'profile' as Tab,      label: 'Профиль',     icon: User },
  { id: 'applications' as Tab, label: 'Мои заявки',  icon: FileText },
  { id: 'tasks' as Tab,        label: 'Задания',      icon: ListTodo },
  { id: 'referrals' as Tab,    label: 'Рефералы',    icon: Users },
  { id: 'reviews' as Tab,      label: 'Отзывы',      icon: Star },
];

const HEADER_H = 120; // px — height of the blue header block

export default function UserProfile({
  onBack, onOpenInfluencerDashboard, onOpenPartnerApplication,
  onContinueDraft, onOpenAdmin, initialTab,
}: UserProfileProps) {
  const [activeTab, setActiveTab]     = useState<Tab>(initialTab ?? 'profile');
  const [bonusBalance, setBonusBalance] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(true);

  const scrollRef  = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    setBonusBalance(userData.bonusBalance || 0);
  }, [activeTab]);

  // ── Collapse header on scroll down, reveal on scroll up ──────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const y = el.scrollTop;
      const diff = y - lastScrollY.current;
      if (diff > 4 && y > 30)  setHeaderVisible(false); // scrolling down
      if (diff < -4)            setHeaderVisible(true);  // scrolling up
      lastScrollY.current = y;
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#F5F7FA] overflow-hidden">

      {/* ── Blue header (collapses on scroll down) ────────────────────────── */}
      <div
        style={{
          height: headerVisible ? HEADER_H : 0,
          overflow: 'hidden',
          transition: 'height 0.25s ease',
          flexShrink: 0,
        }}
        className="bg-gradient-to-r from-[#0D47A1] to-[#1976D2] text-white shadow-lg"
      >
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-full transition">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl">Личный кабинет</h1>
            <div className="w-10" />
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 backdrop-blur-sm">
            <p className="text-xs text-[#E3F2FD]">Бонусный счёт</p>
            <p className="text-2xl leading-tight">{bonusBalance}₽</p>
          </div>
        </div>
      </div>

      {/* ── Tab bar (always visible) ─────────────────────────────────────── */}
      <div className="bg-white border-b shadow-sm z-10 flex-shrink-0">
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

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 pb-20">
          {activeTab === 'profile'      && <ProfileTab onOpenInfluencerDashboard={onOpenInfluencerDashboard} onOpenAdmin={onOpenAdmin} />}
          {activeTab === 'applications' && <ApplicationsTab onContinueDraft={onContinueDraft} />}
          {activeTab === 'tasks'        && <TasksTab />}
          {activeTab === 'referrals'    && <ReferralsTab onOpenPartnerApplication={onOpenPartnerApplication} />}
          {activeTab === 'reviews'      && <ReviewsTab />}
        </div>
      </div>
    </div>
  );
}
