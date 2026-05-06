import { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react';
import SplashScreen from './components/SplashScreen';
import Home from './components/Home';
import BottomNav, { type MainTab } from './components/BottomNav';
import ComingSoon from './components/ComingSoon';
import { initializeUserData } from './utils/userData';

// Heavy on-demand routes — split into separate chunks so the home screen loads fast
const ApplicationForm        = lazy(() => import('./components/ApplicationForm'));
const UserProfile            = lazy(() => import('./components/UserProfile'));
const SriLankaExtensionForm  = lazy(() => import('./components/SriLankaExtensionForm'));
const PartnerApplicationForm = lazy(() => import('./components/PartnerApplicationForm'));
const HotelBookingForm       = lazy(() => import('./components/HotelBookingForm'));
const FlightBookingForm      = lazy(() => import('./components/FlightBookingForm'));
const BookingsMenu           = lazy(() => import('./components/BookingsMenu'));
const AdminApp               = lazy(() => import('./admin/AdminApp').then(m => ({ default: m.AdminApp })));
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
  | 'extension'
  | 'partner_application'
  | 'hotel_booking'
  | 'flight_booking'
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
  const [mainTab, setMainTab] = useState<MainTab>('visas');
  const [selectedVisa, setSelectedVisa] = useState<VisaOption | null>(null);
  const [urgentVisa, setUrgentVisa] = useState(false);
  const [prefilledAddons, setPrefilledAddons] = useState<{ urgent: boolean; hotel: boolean; ticket: boolean } | undefined>(undefined);
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

      // Track referral click (if user came via a referral link)
      if (startParam) {
        fetch('/api/track-click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referral_code: startParam, telegram_id: tg.id }),
        }).catch(() => {});
      }

      upsertUser(tg, startParam)
        .then(async u => {
          setAppUser(u);
          localStorage.setItem('vd_user', JSON.stringify(u));
          // Merge with existing localStorage — preserve streak/checkin data
          const existing = (() => { try { return JSON.parse(localStorage.getItem('userData') ?? '{}'); } catch { return {}; } })();
          localStorage.setItem('userData', JSON.stringify({
            ...existing,
            bonusBalance: u.bonus_balance,
            isInfluencer: u.is_influencer,
            name: existing.name || `${u.first_name}${u.last_name ? ' ' + u.last_name : ''}`,
            phone: existing.phone || u.phone || '',
            email: existing.email || u.email || '',
            telegramId: u.telegram_id,
            username: u.username,
            telegramHandle: existing.telegramHandle || u.username || u.first_name || '',
            photoUrl: u.photo_url,
            referralCode: u.referral_code,
            // Supabase is source of truth for streak; only overwrite if newer
            consecutiveDays: u.bonus_streak ?? existing.consecutiveDays ?? 0,
            lastCheckIn: u.last_bonus_date ?? existing.lastCheckIn ?? '',
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
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleVisaSelect = (visa: VisaOption, urgent = false, addons?: { urgent: boolean; hotel: boolean; ticket: boolean }) => {
    setSelectedVisa(visa);
    setUrgentVisa(urgent);
    setPrefilledAddons(addons);
    setCurrentScreen('application');
  };

  const handleContinueDraft = (draft: { visa: VisaOption; urgent: boolean }) => {
    setSelectedVisa(draft.visa);
    setUrgentVisa(draft.urgent);
    setPrefilledAddons(undefined);
    setCurrentScreen('application');
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
    setSelectedVisa(null);
    setUrgentVisa(false);
    setPrefilledAddons(undefined);
  };

  return (
    <TelegramCtx.Provider value={{ tgUser, appUser, isLoading, refreshUser }}>
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        {currentScreen === 'splash' && <SplashScreen />}
        {currentScreen === 'home' && (
          <>
            {mainTab === 'visas' && (
              <div className="pb-20">
                <Home
                  onVisaSelect={handleVisaSelect}
                  onOpenProfile={() => { setInitialProfileTab('profile'); setCurrentScreen('profile'); }}
                  onOpenReferrals={() => { setInitialProfileTab('referrals'); setCurrentScreen('profile'); }}
                  onOpenExtension={(visa) => { setSelectedVisa(visa); setCurrentScreen('extension'); }}
                  onOpenPartnerApplication={() => setCurrentScreen('partner_application')}
                  onOpenAdmin={adminRole ? () => setCurrentScreen('admin') : undefined}
                />
              </div>
            )}
            {mainTab === 'bookings' && (
              <Suspense fallback={<SplashScreen />}>
                <BookingsMenu
                  onOpenProfile={() => { setInitialProfileTab('profile'); setCurrentScreen('profile'); }}
                  onOpenHotelBooking={() => setCurrentScreen('hotel_booking')}
                  onOpenFlightBooking={() => setCurrentScreen('flight_booking')}
                />
              </Suspense>
            )}
            {mainTab === 'flights' && (
              <ComingSoon
                title="Авиабилеты"
                description="Поиск и покупка авиабилетов в одном окне. Планируем подключить Aviasales API — будет полноценный поиск туда-обратно."
                emoji="✈️"
                onOpenProfile={() => { setInitialProfileTab('profile'); setCurrentScreen('profile'); }}
              />
            )}
            {mainTab === 'hotels' && (
              <ComingSoon
                title="Отели"
                description="Бронирование отелей по всему миру. Подключим Островок и Booking — будет фильтр по звёздам, цене и удобствам."
                emoji="🏨"
                onOpenProfile={() => { setInitialProfileTab('profile'); setCurrentScreen('profile'); }}
              />
            )}
            {mainTab === 'insurance' && (
              <ComingSoon
                title="Страховки"
                description="Туристические страховки на любой бюджет. Базовая, Стандарт и Премиум — подбираем под страну поездки."
                emoji="🛡️"
                onOpenProfile={() => { setInitialProfileTab('profile'); setCurrentScreen('profile'); }}
              />
            )}
            {mainTab === 'excursions' && (
              <ComingSoon
                title="Экскурсии"
                description="Каталог экскурсий по странам с местными гидами. После запуска — бронирования напрямую через приложение, как у виз и отелей."
                emoji="🗺️"
                onOpenProfile={() => { setInitialProfileTab('profile'); setCurrentScreen('profile'); }}
              />
            )}
            <BottomNav active={mainTab} onChange={setMainTab} />
          </>
        )}
        {currentScreen === 'application' && selectedVisa && (
          <Suspense fallback={<SplashScreen />}>
            <ApplicationForm
              visa={selectedVisa}
              urgent={urgentVisa}
              prefilledAddons={prefilledAddons}
              onBack={handleBackToHome}
              onContinueDraft={handleContinueDraft}
            />
          </Suspense>
        )}
        {currentScreen === 'profile' && (
          <Suspense fallback={<SplashScreen />}>
            <UserProfile
              onBack={handleBackToHome}
              onOpenPartnerApplication={() => setCurrentScreen('partner_application')}
              onContinueDraft={handleContinueDraft}
              onContinueHotelDraft={() => setCurrentScreen('hotel_booking')}
              onContinueFlightDraft={() => setCurrentScreen('flight_booking')}
              onOpenAdmin={adminRole ? () => setCurrentScreen('admin') : undefined}
              initialTab={initialProfileTab}
            />
          </Suspense>
        )}

        {currentScreen === 'extension' && selectedVisa && (
          <Suspense fallback={<SplashScreen />}>
            <SriLankaExtensionForm
              visa={selectedVisa}
              onBack={handleBackToHome}
              onComplete={handleBackToHome}
            />
          </Suspense>
        )}
        {currentScreen === 'partner_application' && (
          <Suspense fallback={<SplashScreen />}>
            <PartnerApplicationForm onBack={handleBackToHome} onSubmit={handleBackToHome} />
          </Suspense>
        )}
        {currentScreen === 'hotel_booking' && (
          <Suspense fallback={<SplashScreen />}>
            <HotelBookingForm
              onBack={() => { setMainTab('bookings'); setCurrentScreen('home'); }}
              onComplete={() => { setMainTab('visas'); setCurrentScreen('home'); }}
            />
          </Suspense>
        )}
        {currentScreen === 'flight_booking' && (
          <Suspense fallback={<SplashScreen />}>
            <FlightBookingForm
              onBack={() => { setMainTab('bookings'); setCurrentScreen('home'); }}
              onComplete={() => { setMainTab('visas'); setCurrentScreen('home'); }}
            />
          </Suspense>
        )}
        {currentScreen === 'admin' && (
          <Suspense fallback={<SplashScreen />}>
            <AdminApp onBackToApp={handleBackToHome} />
          </Suspense>
        )}
      </div>
    </TelegramCtx.Provider>
  );
}

export default App;
