import { useState, useEffect, createContext, useContext } from 'react';
import SplashScreen from './components/SplashScreen';
import Home from './components/Home';
import ApplicationForm from './components/ApplicationForm';
import UserProfile from './components/UserProfile';
import InfluencerDashboard from './components/InfluencerDashboard';
import SriLankaExtensionForm from './components/SriLankaExtensionForm';
import PartnerApplicationForm from './components/PartnerApplicationForm';
import { AdminApp } from './admin/AdminApp';
import { initializeUserData } from './utils/userData';
import {
  getTelegramUser,
  initTelegramApp,
  isTelegramWebApp,
  getMockUser,
  type TelegramUser,
} from './lib/telegram';
import { upsertUser, getAdminRole, type AppUser, type AdminRole } from './lib/db';

// ─── Telegram User Context ────────────────────────────────────────────────────

interface TelegramContext {
  tgUser: TelegramUser | null;
  appUser: AppUser | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const TelegramCtx = createContext<TelegramContext>({
  tgUser: null,
  appUser: null,
  isLoading: true,
  refreshUser: async () => {},
});

export function useTelegram() {
  return useContext(TelegramCtx);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | 'splash'
  | 'home'
  | 'application'
  | 'profile'
  | 'influencer'
  | 'extension'
  | 'partner_application'
  | 'admin';

export interface VisaOption {
  id: string;
  country: string;
  type: string;
  duration: string;
  price: number;
  description?: string;
  readinessTime: string;
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [selectedVisa, setSelectedVisa] = useState<VisaOption | null>(null);
  const [urgentVisa, setUrgentVisa] = useState(false);
  const [initialProfileTab, setInitialProfileTab] = useState<'profile' | 'applications' | 'tasks' | 'referrals' | 'reviews' | undefined>(undefined);

  const [tgUser, setTgUser] = useState<TelegramUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);

  const refreshUser = async () => {
    const user = tgUser ?? getMockUser();
    try {
      const u = await upsertUser(user);
      setAppUser(u);
      // Sync into legacy userData slot so existing components can read it
      localStorage.setItem('vd_user', JSON.stringify(u));
      localStorage.setItem('userData', JSON.stringify({
        bonusBalance: u.bonus_balance,
        isInfluencer: u.is_influencer,
        name: `${u.first_name}${u.last_name ? ' ' + u.last_name : ''}`,
        phone: u.phone ?? '',
        email: u.email ?? '',
        telegramId: u.telegram_id,
        username: u.username,
        photoUrl: u.photo_url,
        referralCode: u.referral_code,
        bonusStreak: u.bonus_streak,
        lastBonusDate: u.last_bonus_date,
      }));
    } catch (err) {
      console.error('Failed to upsert user:', err);
    }
  };

  useEffect(() => {
    // Initialize Telegram WebApp
    initTelegramApp();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === 'true') {
      setCurrentScreen('admin');
      setIsLoading(false);
      return;
    }
    const tabParam = urlParams.get('tab');
    if (tabParam === 'applications' || tabParam === 'tasks' || tabParam === 'referrals' || tabParam === 'reviews') {
      setInitialProfileTab(tabParam);
    }

    // Get Telegram user (or mock for local dev)
    const tg = isTelegramWebApp() ? getTelegramUser() : getMockUser();
    setTgUser(tg);

    // Initialize legacy localStorage (for components that still read it)
    initializeUserData();

    // Upsert user in Supabase / localStorage
    if (tg) {
      const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param ?? undefined;
      upsertUser(tg, startParam)
        .then(async u => {
          setAppUser(u);
          localStorage.setItem('vd_user', JSON.stringify(u));
          localStorage.setItem('userData', JSON.stringify({
            bonusBalance: u.bonus_balance,
            isInfluencer: u.is_influencer,
            name: `${u.first_name}${u.last_name ? ' ' + u.last_name : ''}`,
            phone: u.phone ?? '',
            email: u.email ?? '',
            telegramId: u.telegram_id,
            username: u.username,
            photoUrl: u.photo_url,
            referralCode: u.referral_code,
            bonusStreak: u.bonus_streak,
            lastBonusDate: u.last_bonus_date,
          }));
          const role = await getAdminRole(u.telegram_id);
          setAdminRole(role);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && tab !== 'profile') {
        setCurrentScreen('profile');
      } else {
        setCurrentScreen('home');
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleVisaSelect = (visa: VisaOption, urgent = false) => {
    setSelectedVisa(visa);
    setUrgentVisa(urgent);
    setCurrentScreen('application');
  };

  const handleContinueDraft = (draft: { visa: VisaOption; urgent: boolean }) => {
    setSelectedVisa(draft.visa);
    setUrgentVisa(draft.urgent);
    setCurrentScreen('application');
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
    setSelectedVisa(null);
    setUrgentVisa(false);
  };

  return (
    <TelegramCtx.Provider value={{ tgUser, appUser, isLoading, refreshUser }}>
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        {currentScreen === 'splash' && <SplashScreen />}
        {currentScreen === 'home' && (
          <Home
            onVisaSelect={handleVisaSelect}
            onOpenProfile={() => setCurrentScreen('profile')}
            onOpenExtension={(visa) => { setSelectedVisa(visa); setCurrentScreen('extension'); }}
            onOpenPartnerApplication={() => setCurrentScreen('partner_application')}
            onOpenAdmin={adminRole ? () => setCurrentScreen('admin') : undefined}
          />
        )}
        {currentScreen === 'application' && selectedVisa && (
          <ApplicationForm
            visa={selectedVisa}
            urgent={urgentVisa}
            onBack={handleBackToHome}
            onContinueDraft={handleContinueDraft}
          />
        )}
        {currentScreen === 'profile' && (
          <UserProfile
            onBack={handleBackToHome}
            onOpenInfluencerDashboard={() => setCurrentScreen('influencer')}
            onOpenPartnerApplication={() => setCurrentScreen('partner_application')}
            onContinueDraft={handleContinueDraft}
            onOpenAdmin={adminRole ? () => setCurrentScreen('admin') : undefined}
            initialTab={initialProfileTab}
          />
        )}
        {currentScreen === 'influencer' && (
          <InfluencerDashboard onBack={handleBackToHome} />
        )}
        {currentScreen === 'extension' && selectedVisa && (
          <SriLankaExtensionForm
            visa={selectedVisa}
            onBack={handleBackToHome}
            onComplete={handleBackToHome}
          />
        )}
        {currentScreen === 'partner_application' && (
          <PartnerApplicationForm onBack={handleBackToHome} onSubmit={handleBackToHome} />
        )}
        {currentScreen === 'admin' && (
          <AdminApp onBackToApp={handleBackToHome} />
        )}
      </div>
    </TelegramCtx.Provider>
  );
}

export default App;
