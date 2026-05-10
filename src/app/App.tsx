import { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react';
import { Toaster } from 'sonner';
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
const PartnerDashboard       = lazy(() => import('./components/PartnerDashboard'));
const HotelBookingForm       = lazy(() => import('./components/HotelBookingForm'));
const FlightBookingForm      = lazy(() => import('./components/FlightBookingForm'));
const BookingsMenu           = lazy(() => import('./components/BookingsMenu'));
const Flights                = lazy(() => import('./components/Flights'));
const AdminApp               = lazy(() => import('./admin/AdminApp').then(m => ({ default: m.AdminApp })));
import {
  getTelegramUser,
  initTelegramApp,
  isTelegramWebApp,
  getMockUser,
  type TelegramUser,
} from './lib/telegram';
import { upsertUser, resolveReferralCode, getAdminRole, markUserEngaged, type AppUser, type AdminRole } from './lib/db';
import { AppCatalogProvider } from './contexts/AppCatalogContext';

// ─── Telegram User Context ────────────────────────────────────────────────────

interface TelegramContext {
  tgUser: TelegramUser | null;
  appUser: AppUser | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  // RBAC: роль администратора, если есть.
  // null = обычный пользователь, кнопка админки не показывается, /admin не доступен.
  // Проверяется по env VITE_ADMIN_TELEGRAM_IDS (founder) и admin_users таблице.
  // Backend дополнительно валидирует через initData → telegram_id и admin_users / env.
  adminRole: AdminRole | null;
  openAdmin: (() => void) | undefined;
  // Универсальная навигация для shared-header'а в кабинетах (Профиль, Админка,
  // Партнёрский). Показываются как кружочки-кнопки справа от логотипа.
  // Каждая optional: undefined → кнопка скрывается.
  openProfile: (() => void) | undefined;
  openPartner: (() => void) | undefined;
  // Имя текущего экрана — чтобы header скрывал кнопку текущей страницы
  currentScreenName?: 'profile' | 'admin' | 'partner_dashboard' | null;
}

const TelegramCtx = createContext<TelegramContext>({
  tgUser: null,
  appUser: null,
  isLoading: true,
  refreshUser: async () => {},
  adminRole: null,
  openAdmin: undefined,
  openProfile: undefined,
  openPartner: undefined,
  currentScreenName: null,
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
  | 'partner_dashboard'
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
    // Partner dashboard — отдельный экран. Открывается из push-уведомлений
    // партнёру (?tab=partner_dashboard в URL кнопки).
    if (tabParam === 'partner_dashboard') {
      setCurrentScreen('partner_dashboard');
      setIsLoading(false);
      return;
    }

    // Get Telegram user (or mock for local dev)
    const tg = isTelegramWebApp() ? getTelegramUser() : getMockUser();
    setTgUser(tg);

    // Initialize legacy localStorage (for components that still read it)
    initializeUserData();

    // Upsert user in Supabase / localStorage
    if (tg) {
      const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param ?? undefined;

      // Deeplink-команды: t.me/<bot>/app?startapp=<param>
      //   booking_hotel     — открыть форму брони отеля
      //   booking_flight    — открыть форму брони авиабилета
      //   applications      — открыть «Мои заявки» в кабинете
      //   referrals         — открыть реферальный таб
      //   partner_dashboard — открыть партнёрский кабинет (для is_influencer=true)
      //   <реф.код>         — обычный referral-click (как раньше)
      let referralCode: string | undefined = startParam;
      if (startParam === 'booking_hotel') {
        setCurrentScreen('hotel_booking'); referralCode = undefined;
      } else if (startParam === 'booking_flight') {
        setCurrentScreen('flight_booking'); referralCode = undefined;
      } else if (startParam === 'applications') {
        setInitialProfileTab('applications'); setCurrentScreen('profile'); referralCode = undefined;
      } else if (startParam === 'referrals') {
        setInitialProfileTab('referrals'); setCurrentScreen('profile'); referralCode = undefined;
      } else if (startParam === 'partner_dashboard') {
        setCurrentScreen('partner_dashboard'); referralCode = undefined;
      }

      // Резолв реф-кода: если это vanity (например ANYA) — найти каноничный
      // referral_code (VIS...) партнёра. Если это уже VIS-код — пройдёт проверкой.
      // Резолв через .then() чтобы не делать useEffect async (нельзя).
      const resolvedPromise: Promise<string | null> = referralCode
        ? resolveReferralCode(referralCode).catch(e => { console.warn('resolve refcode failed:', e); return null; })
        : Promise.resolve(null);

      resolvedPromise.then(resolvedRefCode => {
      // Track referral click (по введённому коду или каноническому)
      if (referralCode) {
        const codeToTrack = resolvedRefCode ?? referralCode;
        fetch('/api/track-click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referral_code: codeToTrack, telegram_id: tg.id }),
        })
          .then(async (r) => {
            if (!r.ok) {
              const body = await r.text().catch(() => '');
              console.warn('[track-click] non-OK response:', r.status, body, 'code:', codeToTrack);
            }
          })
          .catch((e) => { console.warn('[track-click] fetch failed:', e, 'code:', codeToTrack); });
      }

      // Передаём в upsertUser RAW код если резолв на фронте не сработал
      // (RLS блокирует anon SELECT users — resolveReferralCode возвращает null).
      // API на сервере сам резолвит canonical через service_key.
      return upsertUser(tg, resolvedRefCode ?? referralCode ?? undefined);
      })
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

    // Splash минимум 600ms (плавность, чтобы не моргало), максимум 1500ms.
    // Если upsertUser завершился раньше — диcмиссим как только сработает
    // setIsLoading(false). Раньше всегда ждали 1500ms независимо от готовности.
    const splashStart = Date.now();
    const minSplash = 600;
    const maxSplash = 1500;

    const goNext = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && tab !== 'profile') setCurrentScreen('profile');
      else setCurrentScreen('home');
    };

    const earlyTimer = setTimeout(() => {
      const elapsed = Date.now() - splashStart;
      // Если данные уже загрузились — переходим сразу, иначе ждём.
      if (!isLoading) goNext();
      else {
        // ждём до maxSplash и тогда переходим в любом случае
        setTimeout(goNext, Math.max(0, maxSplash - elapsed));
      }
    }, minSplash);
    return () => clearTimeout(earlyTimer);
  }, []);

  // Engagement tracking: при первой навигации ВНЕ home (юзер «остался» в апп
  // и сделал хотя бы одно действие) — ставим users.engaged_at. Используется
  // в реф-метриках чтобы отделить «открыл и закрыл» от «остался и взаимодействовал».
  // Один раз: повторно не пингуем (engaged_at уже стоит — markUserEngaged идемпотентно).
  const [hasEngaged, setHasEngaged] = useState(false);
  useEffect(() => {
    if (hasEngaged) return;
    if (!appUser?.telegram_id) return;
    // Не считаем splash и home — это «открыл и сразу закрыл» сценарии
    if (currentScreen === 'splash' || currentScreen === 'home') return;
    setHasEngaged(true);
    markUserEngaged(appUser.telegram_id).catch(e => console.warn('markUserEngaged failed:', e));
  }, [currentScreen, appUser?.telegram_id, hasEngaged]);

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

  const isPartner = appUser?.is_influencer === true || !!adminRole;
  const screenName: 'profile' | 'admin' | 'partner_dashboard' | null =
    currentScreen === 'profile' ? 'profile'
    : currentScreen === 'admin' ? 'admin'
    : currentScreen === 'partner_dashboard' ? 'partner_dashboard'
    : null;

  return (
    <TelegramCtx.Provider value={{
      tgUser,
      appUser,
      isLoading,
      refreshUser,
      adminRole,
      openAdmin: adminRole ? () => setCurrentScreen('admin') : undefined,
      openProfile: () => { setInitialProfileTab(undefined); setCurrentScreen('profile'); },
      openPartner: isPartner ? () => setCurrentScreen('partner_dashboard') : undefined,
      currentScreenName: screenName,
    }}>
      <AppCatalogProvider>
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
              <Suspense fallback={<SplashScreen />}>
                <Flights
                  onOpenProfile={() => { setInitialProfileTab('profile'); setCurrentScreen('profile'); }}
                />
              </Suspense>
            )}
            {mainTab === 'hotels' && (
              <ComingSoon
                title="Отели"
                description="Бронирование отелей по всему миру. Подключим Островок и Booking — будет фильтр по звёздам, цене и удобствам."
                emoji="🏨"
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
              onGoToProfile={() => { setInitialProfileTab('applications'); setCurrentScreen('profile'); }}
            />
          </Suspense>
        )}
        {currentScreen === 'profile' && (
          <Suspense fallback={<SplashScreen />}>
            <UserProfile
              onBack={handleBackToHome}
              onOpenPartnerApplication={() => setCurrentScreen('partner_application')}
              onOpenPartnerDashboard={() => setCurrentScreen('partner_dashboard')}
              onContinueDraft={handleContinueDraft}
              onContinueHotelDraft={() => setCurrentScreen('hotel_booking')}
              onContinueFlightDraft={() => setCurrentScreen('flight_booking')}
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
        {currentScreen === 'partner_dashboard' && (
          <Suspense fallback={<SplashScreen />}>
            <PartnerDashboard onBack={() => { setInitialProfileTab('referrals'); setCurrentScreen('profile'); }} />
          </Suspense>
        )}
        {currentScreen === 'hotel_booking' && (
          <Suspense fallback={<SplashScreen />}>
            <HotelBookingForm
              onBack={() => { setMainTab('bookings'); setCurrentScreen('home'); }}
              onComplete={() => { setMainTab('visas'); setCurrentScreen('home'); }}
              onGoToProfile={() => { setInitialProfileTab('applications'); setCurrentScreen('profile'); }}
            />
          </Suspense>
        )}
        {currentScreen === 'flight_booking' && (
          <Suspense fallback={<SplashScreen />}>
            <FlightBookingForm
              onBack={() => { setMainTab('bookings'); setCurrentScreen('home'); }}
              onComplete={() => { setMainTab('visas'); setCurrentScreen('home'); }}
              onGoToProfile={() => { setInitialProfileTab('applications'); setCurrentScreen('profile'); }}
            />
          </Suspense>
        )}
        {currentScreen === 'admin' && (
          <Suspense fallback={<SplashScreen />}>
            <AdminApp onBackToApp={handleBackToHome} />
          </Suspense>
        )}
      </div>
      <Toaster
        position="top-center"
        richColors
        closeButton={false}
        duration={2500}
        toastOptions={{
          style: {
            borderRadius: '12px',
            fontFamily: 'inherit',
          },
        }}
      />
      </AppCatalogProvider>
    </TelegramCtx.Provider>
  );
}

export default App;
