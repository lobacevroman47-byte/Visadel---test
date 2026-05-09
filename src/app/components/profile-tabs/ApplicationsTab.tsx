import { useState, useEffect, useCallback, Component, type ReactNode } from 'react';
import { toast } from 'sonner';
import { FileText, Clock, Download, Lock, Star, X, Loader2, RefreshCw, Hotel, Plane, Check, AlertTriangle } from 'lucide-react';

// ── Error Boundary so a single bad row doesn't blank the whole tab ─────────
class BookingsErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[BookingsErrorBoundary]', error); }
  render() {
    if (this.state.error) {
      return (
        <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">Не удалось показать брони</p>
            <p className="text-xs text-amber-800/80 mt-0.5">
              {this.state.error.message || 'Внутренняя ошибка'}. Перезагрузите мини-апп.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import {
  getUserApplications, getReviewedAppIds, submitReview,
  getUserHotelBookings, getUserFlightBookings,
  markBookingReviewBonusGranted,
  type Application,
  type HotelBookingRow, type FlightBookingRow,
} from '../../lib/db';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { apiFetch } from '../../lib/apiFetch';
import { useTelegram } from '../../App';
import { useDialog } from '../shared/BrandDialog';

interface Draft {
  id: string;
  visa: { country: string; type: string; price: number };
  urgent: boolean;
  step: number;
  savedAt: string;
  formData: unknown;
  draftKey: string;
}

interface ApplicationsTabProps {
  onContinueDraft?: (draft: Draft) => void;
  onContinueHotelDraft?: () => void;
  onContinueFlightDraft?: () => void;
  onBonusChange?: (newBalance: number) => void;
}

interface BookingDraft {
  type: 'hotel' | 'flight';
  savedAt: string;
  summary: string;
}

function loadBookingDrafts(): BookingDraft[] {
  const drafts: BookingDraft[] = [];
  try {
    const h = localStorage.getItem('hotel_booking_draft');
    if (h) {
      const d = JSON.parse(h);
      const summary = [d.country, d.city].filter(Boolean).join(', ') || 'Без страны';
      drafts.push({ type: 'hotel', savedAt: d.savedAt ?? new Date().toISOString(), summary });
    }
  } catch { /* no-op */ }
  try {
    const f = localStorage.getItem('flight_booking_draft');
    if (f) {
      const d = JSON.parse(f);
      const summary = [d.fromCity, d.toCity].filter(Boolean).join(' → ') || 'Без маршрута';
      drafts.push({ type: 'flight', savedAt: d.savedAt ?? new Date().toISOString(), summary });
    }
  } catch { /* no-op */ }
  return drafts;
}

// Visa status chip — matches booking status palette (emoji-free, brand-aligned)
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:                { label: 'Черновик',              color: 'bg-gray-100 text-gray-700' },
  pending_payment:      { label: 'Ожидает оплаты',        color: 'bg-yellow-100 text-yellow-700' },
  pending_confirmation: { label: 'Ожидает подтверждения', color: 'bg-[#EAF1FF] text-[#3B5BFF]' },
  in_progress:          { label: 'В работе',              color: 'bg-amber-100 text-amber-700' },
  ready:                { label: 'Готово',                color: 'bg-emerald-100 text-emerald-700' },
};

// ── Status Progress Bar ───────────────────────────────────────────────────────
const PROGRESS_STEPS = [
  { id: 'pending_confirmation', label: 'Заявка\nподана',    icon: '📋' },
  { id: 'in_progress',         label: 'Проверка\nоплаты',  icon: '✅' },
  { id: 'working',             label: 'Виза\nоформляется', icon: '⚙️' },
  { id: 'ready',               label: 'Готово',             icon: '🎉' },
];

function getProgressIndex(status: string): number {
  if (status === 'pending_confirmation') return 0;
  if (status === 'in_progress') return 2;
  if (status === 'ready') return 3;
  return -1;
}

function StatusProgress({ status }: { status: string }) {
  const activeIdx = getProgressIndex(status);
  if (activeIdx < 0) return null;

  return (
    <div className="mt-3 mb-1 px-1">
      <div className="flex items-start">
        {PROGRESS_STEPS.map((step, idx) => {
          const done = idx < activeIdx;
          const active = idx === activeIdx;
          return (
            <div key={step.id} className="flex items-start flex-1 last:flex-none">
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1 min-w-[44px]">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shadow-sm transition-all ${
                  done   ? 'bg-[#3B5BFF] text-white' :
                  active ? 'vd-grad text-white ring-2 ring-[#5C7BFF]/30 ring-offset-1 shadow-md' :
                           'bg-gray-100 text-gray-400'
                }`}>
                  {done ? '✓' : step.icon}
                </div>
                <span className={`text-[9px] text-center leading-tight whitespace-pre-line ${
                  active ? 'text-[#3B5BFF] font-semibold' : done ? 'text-[#5C7BFF]' : 'text-gray-400'
                }`}>
                  {step.label}
                </span>
              </div>
              {/* Connector line */}
              {idx < PROGRESS_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mt-4 mx-0.5 rounded-full transition-colors ${
                  done ? 'bg-[#3B5BFF]' : 'bg-gray-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Booking status progress ──────────────────────────────────────────────────
// Зеркалит визовый StatusProgress 1-в-1: те же 4 шага, тот же mapping
// статусов на индексы. Различается только лейбл шага 2 («Бронь
// оформляется» вместо «Виза оформляется»).
//
// Mapping booking-status → step (как у виз):
//   pending_confirmation → 0 (Заявка подана)
//   in_progress          → 2 (Бронь оформляется) — step 1 «проверка оплаты»
//                              автоматически done, как у визы
//   confirmed            → 3 (Готово)
//   cancelled            → -1 (timeline скрывается)
//
// Старый legacy 'new' тоже мапим на 0 — на случай если в БД остались
// записи с этим статусом (раньше форма ставила 'new' до момента когда мы
// перешли на pending_confirmation).
const BOOKING_PROGRESS_STEPS = [
  { id: 'pending_confirmation', label: 'Заявка\nподана',     icon: '📋' },
  { id: 'in_progress',          label: 'Проверка\nоплаты',   icon: '✅' },
  { id: 'working',              label: 'Бронь\nоформляется', icon: '⚙️' },
  { id: 'confirmed',            label: 'Готово',              icon: '🎉' },
];

function getBookingProgressIndex(status: string): number {
  if (status === 'pending_confirmation' || status === 'new' || status === 'pending_payment') return 0;
  if (status === 'in_progress') return 2;
  if (status === 'confirmed') return 3;
  return -1; // cancelled и прочее не показываем
}

function BookingProgress({ status }: { status: string }) {
  const activeIdx = getBookingProgressIndex(status);
  if (activeIdx < 0) return null;

  return (
    <div className="mt-3 mb-1 px-1">
      <div className="flex items-start">
        {BOOKING_PROGRESS_STEPS.map((step, idx) => {
          const done = idx < activeIdx;
          const active = idx === activeIdx;
          return (
            <div key={step.id} className="flex items-start flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1 min-w-[44px]">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shadow-sm transition-all ${
                  done   ? 'bg-[#3B5BFF] text-white' :
                  active ? 'vd-grad text-white ring-2 ring-[#5C7BFF]/30 ring-offset-1 shadow-md' :
                           'bg-gray-100 text-gray-400'
                }`}>
                  {done ? '✓' : step.icon}
                </div>
                <span className={`text-[9px] text-center leading-tight whitespace-pre-line ${
                  active ? 'text-[#3B5BFF] font-semibold' : done ? 'text-[#5C7BFF]' : 'text-gray-400'
                }`}>
                  {step.label}
                </span>
              </div>
              {idx < BOOKING_PROGRESS_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mt-4 mx-0.5 rounded-full transition-colors ${
                  done ? 'bg-[#3B5BFF]' : 'bg-gray-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Review Modal ──────────────────────────────────────────────────────────────
function ReviewModal({ app, onClose, onSubmitted, isPartner }: {
  app: Application;
  onClose: () => void;
  onSubmitted: () => void;
  isPartner: boolean;
}) {
  const dialog = useDialog();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const userData = (() => {
    try { return JSON.parse(localStorage.getItem('userData') ?? '{}'); } catch { return {}; }
  })();
  const telegramId: number = userData.telegramId ?? 0;
  const username: string = userData.username ?? '';

  const handleSubmit = async () => {
    if (rating === 0) { await dialog.warning('Поставьте оценку'); return; }
    if (comment.trim().length < 5) { await dialog.warning('Напишите хотя бы несколько слов'); return; }
    setSubmitting(true);
    try {
      await submitReview({
        telegramId,
        applicationId: app.id!,
        country: app.country,
        rating,
        text: comment.trim(),
        username,
      });
      // sync bonus locally — partners excluded
      if (!isPartner) {
        try {
          const ud = JSON.parse(localStorage.getItem('userData') ?? '{}');
          ud.bonusBalance = (ud.bonusBalance ?? 0) + 200;
          localStorage.setItem('userData', JSON.stringify(ud));
        } catch {}
      }
      onSubmitted();
    } catch {
      await dialog.error('Ошибка при отправке отзыва');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">Оставить отзыв</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {/* Stars */}
          <div>
            <p className="text-sm text-gray-600 mb-3 text-center">Оцените качество сервиса:</p>
            <div className="flex gap-2 justify-center">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setRating(s)} className="transition-transform hover:scale-110">
                  <Star className={`w-10 h-10 ${s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>
          </div>
          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Комментарий <span className="text-red-500">*</span>
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              placeholder="Расскажите о вашем опыте..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none resize-none"
            />
          </div>
          {/* Bonus hint — hidden for partners */}
          {!isPartner && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-sm text-green-700">🎁 За отзыв вы получите <strong>200 ₽</strong> на бонусный счёт</p>
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 bg-[#3B5BFF] hover:bg-[#4F2FE6] disabled:opacity-60 text-white rounded-xl transition flex items-center justify-center gap-2 font-medium"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? 'Отправляем...' : 'Отправить отзыв'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ApplicationsTab({ onContinueDraft, onContinueHotelDraft, onContinueFlightDraft, onBonusChange }: ApplicationsTabProps) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [hotelBookings, setHotelBookings] = useState<HotelBookingRow[]>([]);
  const [flightBookings, setFlightBookings] = useState<FlightBookingRow[]>([]);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [bookingDrafts, setBookingDrafts] = useState<BookingDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewApp, setReviewApp] = useState<Application | null>(null);
  const [submittingReviewId, setSubmittingReviewId] = useState<string | null>(null);
  const [deletingDraftKey, setDeletingDraftKey] = useState<string | null>(null);

  // ── Use context so telegramId is always up-to-date (not stale localStorage) ──
  const { appUser } = useTelegram();
  const telegramId: number = appUser?.telegram_id ?? (() => {
    try { return JSON.parse(localStorage.getItem('userData') ?? '{}').telegramId ?? 0; } catch { return 0; }
  })();

  const load = useCallback(async (tid?: number) => {
    const id = tid ?? telegramId;
    setLoading(true);
    try {
      const [apps, reviewed, hotels, flights] = await Promise.all([
        id ? getUserApplications(id) : Promise.resolve([]),
        id ? getReviewedAppIds(id) : Promise.resolve(new Set<string>()),
        id ? getUserHotelBookings(id) : Promise.resolve([] as HotelBookingRow[]),
        id ? getUserFlightBookings(id) : Promise.resolve([] as FlightBookingRow[]),
      ]);
      setApplications(apps);
      setReviewedIds(reviewed);
      setHotelBookings(hotels);
      setFlightBookings(flights);

      // Load drafts from localStorage
      try {
        const raw = localStorage.getItem('visa_drafts');
        if (raw) {
          const parsed: Draft[] = JSON.parse(raw);
          const now = Date.now();
          // Защитный фильтр: если для visa+urgent уже есть отправленная заявка
          // (любой статус, кроме 'draft'), черновик пропадает автоматически.
          // Закрывает дыру: до фикса Step7Payment удалял только одиночный
          // localStorage-ключ, но запись в visa_drafts оставалась навсегда.
          const submittedKeys = new Set(
            apps
              .filter(a => a.status !== 'draft')
              .map(a => `draft_${a.visa_id}_${a.urgent ? 'urgent' : 'normal'}`)
          );
          const valid = parsed
            .filter(d => now - new Date(d.savedAt).getTime() < 30 * 24 * 60 * 60 * 1000)
            .filter(d => !submittedKeys.has(d.id))
            .map(d => ({ ...d, draftKey: d.id }));
          // Если что-то отфильтровали — переписать localStorage чтобы не
          // показывать «пустые» черновики и в офлайне.
          if (valid.length !== parsed.length) {
            try {
              localStorage.setItem('visa_drafts', JSON.stringify(valid));
            } catch {}
          }
          setDrafts(valid);
        }
      } catch {}

      // Load booking drafts (single-slot per type) from localStorage
      setBookingDrafts(loadBookingDrafts());
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload whenever telegramId becomes available (async user load race-condition fix)
  useEffect(() => {
    if (telegramId) load(telegramId);
  }, [telegramId, load]);

  // Supabase Realtime — auto-update statuses without column-level filter
  // (column filters require Supabase Pro; we filter client-side instead).
  // Подписываемся на applications + hotel_bookings + flight_bookings —
  // когда админ меняет статус, у юзера в Профиле прогресс бар обновляется
  // мгновенно, без перезагрузки.
  useEffect(() => {
    if (!telegramId || !isSupabaseConfigured()) return;

    const channel = supabase
      .channel(`user-apps-${telegramId}`)
      // Visa applications
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'applications' },
        (payload: any) => {
          if (payload.new.user_telegram_id !== telegramId) return;
          setApplications(prev =>
            prev.map(app => (app.id === payload.new.id ? { ...app, ...payload.new } : app))
          );
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'applications' },
        (payload: any) => {
          if (payload.new.user_telegram_id !== telegramId) return;
          setApplications(prev => {
            if (prev.find(a => a.id === payload.new.id)) return prev;
            return [payload.new as Application, ...prev];
          });
        }
      )
      // Hotel bookings — статус меняется в админке, прилетает сюда
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'hotel_bookings' },
        (payload: any) => {
          if (payload.new.telegram_id !== telegramId) return;
          setHotelBookings(prev =>
            prev.map(b => (b.id === payload.new.id ? { ...b, ...payload.new } : b))
          );
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'hotel_bookings' },
        (payload: any) => {
          if (payload.new.telegram_id !== telegramId) return;
          setHotelBookings(prev => {
            if (prev.find(b => b.id === payload.new.id)) return prev;
            return [payload.new as HotelBookingRow, ...prev];
          });
        }
      )
      // Flight bookings — то же самое
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'flight_bookings' },
        (payload: any) => {
          if (payload.new.telegram_id !== telegramId) return;
          setFlightBookings(prev =>
            prev.map(b => (b.id === payload.new.id ? { ...b, ...payload.new } : b))
          );
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'flight_bookings' },
        (payload: any) => {
          if (payload.new.telegram_id !== telegramId) return;
          setFlightBookings(prev => {
            if (prev.find(b => b.id === payload.new.id)) return prev;
            return [payload.new as FlightBookingRow, ...prev];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [telegramId]);

  const handleDeleteDraft = (draftKey: string) => {
    // Remove from localStorage
    localStorage.removeItem(draftKey);
    try {
      const raw = localStorage.getItem('visa_drafts');
      if (raw) {
        const updated = JSON.parse(raw).filter((d: Draft) => d.id !== draftKey);
        localStorage.setItem('visa_drafts', JSON.stringify(updated));
      }
    } catch {}
    setDrafts(prev => prev.filter(d => d.draftKey !== draftKey));
    setDeletingDraftKey(null);
  };

  const handleReviewSubmitted = () => {
    setReviewApp(null);
    load();
  };

  // Helper: optimistic balance update + rollback on failure.
  // Возвращает [applyDelta, rollback] — applyDelta(amount) сразу прибавляет
  // к балансу, rollback() возвращает к исходному значению. Когда сервер
  // подтвердит реальный newBalance — применяем его через syncTo(actual).
  const optimisticBalance = (delta: number) => {
    let original = 0;
    try { original = JSON.parse(localStorage.getItem('userData') ?? '{}').bonusBalance ?? 0; } catch {}
    const optimistic = original + delta;
    try {
      const ud = JSON.parse(localStorage.getItem('userData') ?? '{}');
      ud.bonusBalance = optimistic;
      localStorage.setItem('userData', JSON.stringify(ud));
    } catch {}
    onBonusChange?.(optimistic);
    return {
      rollback: () => {
        try {
          const ud = JSON.parse(localStorage.getItem('userData') ?? '{}');
          ud.bonusBalance = original;
          localStorage.setItem('userData', JSON.stringify(ud));
        } catch {}
        onBonusChange?.(original);
      },
      syncTo: (actual: number) => {
        try {
          const ud = JSON.parse(localStorage.getItem('userData') ?? '{}');
          ud.bonusBalance = actual;
          localStorage.setItem('userData', JSON.stringify(ud));
        } catch {}
        onBonusChange?.(actual);
      },
    };
  };

  // One-click: submit review + open Telegram + give 200₽ review bonus
  // Балланс обновляется ОПТИМИСТИЧНО (сразу +200), review и bonus летят
  // на сервер ПАРАЛЛЕЛЬНО, при ошибке/skipped — rollback.
  const handleQuickReview = async (app: Application) => {
    if (submittingReviewId) return;
    setSubmittingReviewId(app.id!);

    const username = (() => {
      try { return JSON.parse(localStorage.getItem('userData') ?? '{}').username ?? ''; } catch { return ''; }
    })();

    const eligibleForBonus = !!telegramId && !appUser?.is_influencer;

    // 1. Optimistic UI: показываем +200₽ моментально
    const balance = eligibleForBonus ? optimisticBalance(200) : null;

    // Haptic feedback — пользователь чувствует что нажал
    try { (window as { Telegram?: { WebApp?: { HapticFeedback?: { notificationOccurred?: (t: string) => void } } } }).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success'); } catch {}

    // 2. Параллельно: review (best-effort) + bonus (нам важен ответ)
    const reviewPromise = submitReview({
      telegramId,
      applicationId: app.id!,
      country: app.country,
      rating: 5,
      text: 'Отзыв оставлен в Telegram-канале',
      username,
    }).catch(e => { console.warn('submitReview error:', e); });

    let bonusPromise: Promise<{ res: Response; data: { ok?: boolean; skipped?: unknown; newBalance?: number; error?: string } }> | null = null;
    if (eligibleForBonus) {
      bonusPromise = apiFetch('/api/grant-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: telegramId,
          type: 'review',
          amount: 200,
          description: `+200₽ за отзыв о визе ${app.country} (${app.id})`,
          application_id: app.id,
        }),
      }).then(async (res) => ({ res, data: await res.json().catch(() => ({})) as { ok?: boolean; skipped?: unknown; newBalance?: number; error?: string } }));
    } else if (!telegramId) {
      toast.error('Переоткрой мини-апп через бота — нет данных пользователя');
    }

    // 3. Ждём ответ сервера и подтверждаем/откатываем
    if (bonusPromise && balance) {
      try {
        const { res, data } = await bonusPromise;
        if (!res.ok) {
          balance.rollback();
          toast.error(`Бонус не начислен (${res.status})`);
          console.error('[review-bonus] HTTP error', res.status, data);
        } else if (data.skipped) {
          balance.rollback();
          toast.info('Бонус за этот отзыв уже был начислен');
        } else if (typeof data.newBalance === 'number') {
          balance.syncTo(data.newBalance);
          toast.success('+200 ₽ за отзыв');
        }
      } catch (e) {
        balance.rollback();
        toast.error(`Бонус не начислен — попробуй ещё раз`);
        console.error('[review-bonus] exception', e);
      }
    }

    // 4. Дожидаемся review (не блокирует UI)
    await reviewPromise;
    setReviewedIds(prev => new Set([...prev, app.id!]));
    setSubmittingReviewId(null);

    // 5. Открываем Telegram канал
    const tg = (window as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } }).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink('https://t.me/visadel_recall');
    } else {
      window.open('https://t.me/visadel_recall', '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#5C7BFF]" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Refresh */}
        <div className="flex justify-end">
          <button onClick={() => load()} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
            <RefreshCw className="w-3 h-3" /> Обновить
          </button>
        </div>

        {/* Drafts */}
        {(drafts.length > 0 || bookingDrafts.length > 0) && (
          <div>
            <h3 className="text-lg text-gray-800 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5" /> Незавершённые заявки
            </h3>
            <div className="space-y-3">
              {drafts.map(draft => (
                <div key={draft.draftKey} className="bg-white rounded-xl shadow-md p-4 border-l-4 border-gray-400">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-gray-800">{draft.visa.country}</h4>
                      <p className="text-sm text-gray-600">{draft.visa.type}</p>
                    </div>
                    <span className="bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-full">📝 Черновик</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500 mb-3">
                    <span>Шаг {draft.step + 1} из 6</span>
                    <span>{new Date(draft.savedAt).toLocaleDateString('ru-RU')}</span>
                  </div>

                  {deletingDraftKey === draft.draftKey ? (
                    /* Confirmation row */
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                      <p className="text-sm text-red-700 mb-2 text-center">Удалить черновик?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteDraft(draft.draftKey)}
                          className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium"
                        >
                          Да, удалить
                        </button>
                        <button
                          onClick={() => setDeletingDraftKey(null)}
                          className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => onContinueDraft?.(draft)}
                        className="flex-1 bg-[#3B5BFF] hover:bg-[#4F2FE6] text-white py-2 rounded-lg transition text-sm">
                        Продолжить
                      </button>
                      <button onClick={() => setDeletingDraftKey(draft.draftKey)}
                        className="px-4 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition text-sm">
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {bookingDrafts.map(bd => {
                const isHotel = bd.type === 'hotel';
                const onContinue = isHotel ? onContinueHotelDraft : onContinueFlightDraft;
                const onDelete = () => {
                  try { localStorage.removeItem(isHotel ? 'hotel_booking_draft' : 'flight_booking_draft'); } catch { /* no-op */ }
                  setBookingDrafts(loadBookingDrafts());
                };
                return (
                  <div key={`booking-${bd.type}`} className="bg-white rounded-xl shadow-md p-4 border-l-4 border-gray-400">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isHotel ? <Hotel className="w-5 h-5 text-[#3B5BFF]" /> : <Plane className="w-5 h-5 text-[#3B5BFF]" />}
                        <div>
                          <h4 className="text-gray-800">{isHotel ? 'Бронь отеля' : 'Бронь авиабилета'}</h4>
                          <p className="text-sm text-gray-600">{bd.summary}</p>
                        </div>
                      </div>
                      <span className="bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-full whitespace-nowrap">📝 Черновик</span>
                    </div>
                    <div className="flex justify-end text-xs text-gray-400 mb-3">
                      <span>{new Date(bd.savedAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={onContinue}
                        className="flex-1 bg-[#3B5BFF] hover:bg-[#4F2FE6] text-white py-2 rounded-lg transition text-sm">
                        Продолжить
                      </button>
                      <button onClick={onDelete}
                        className="px-4 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition text-sm">
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Applications */}
        <div>
          <h3 className="text-lg text-gray-800 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" /> Мои заявки
          </h3>

          {applications.length === 0 ? (
            hotelBookings.length === 0 && flightBookings.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-8 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">У вас пока нет заявок</p>
                <p className="text-sm text-gray-500 mt-1">Оформите визу или бронь, чтобы увидеть её здесь</p>
              </div>
            ) : null
          ) : (
            <div className="space-y-3">
              {applications.map(app => {
                const cfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.draft;
                const hasReview = reviewedIds.has(app.id!);
                const isReady = app.status === 'ready';
                const hasVisa = !!app.visa_file_url;

                return (
                  <div key={app.id} className="bg-white rounded-xl shadow-md p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-gray-800 font-medium">{app.country}</h4>
                        <p className="text-sm text-gray-600">{app.visa_type}</p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap shrink-0 ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Progress bar for active applications */}
                    {['pending_confirmation', 'in_progress', 'ready'].includes(app.status) && (
                      <StatusProgress status={app.status} />
                    )}

                    <div className="space-y-1 text-sm text-gray-500 mb-3 mt-2">
                      <div className="flex justify-between items-center">
                        <span>К оплате:</span>
                        <span className="text-base font-semibold text-gray-800">
                          {(app.price - (app.bonuses_used ?? 0)).toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                      {app.bonuses_used > 0 && (
                        <div className="flex justify-between text-green-600 text-xs">
                          <span>Списано бонусов:</span><span>−{app.bonuses_used} ₽</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Дата:</span>
                        <span>{new Date(app.created_at!).toLocaleDateString('ru-RU')}</span>
                      </div>
                    </div>

                    {/* Ready — visa download section */}
                    {isReady && hasVisa && (
                      <div className="space-y-2 mt-3">
                        {/* Visa preview — always visible */}
                        <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                          <img
                            src={app.visa_file_url}
                            alt="Виза"
                            className="w-full object-contain max-h-64"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>

                        {!hasReview ? (
                          /* Locked download — must review first */
                          <div className="space-y-2">
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2">
                              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                              <p className="text-sm text-amber-700">Оставьте отзыв чтобы скачать визу</p>
                            </div>
                            {/* Disabled download button */}
                            <button disabled
                              className="w-full flex items-center justify-center gap-2 py-3 bg-gray-200 text-gray-400 rounded-xl text-sm font-medium cursor-not-allowed">
                              <Lock className="w-4 h-4" /> Скачать визу (недоступно)
                            </button>
                            <button
                              onClick={() => handleQuickReview(app)}
                              disabled={submittingReviewId === app.id}
                              className="w-full py-3 vd-grad text-white shadow-md vd-shadow-cta disabled:opacity-60 rounded-xl active:scale-[0.99] transition flex items-center justify-center gap-2 text-sm font-bold">
                              {submittingReviewId === app.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Star className="w-4 h-4" />}
                              {appUser?.is_influencer ? 'Оставить отзыв' : 'Оставить отзыв (+200 ₽)'}
                            </button>
                          </div>
                        ) : (
                          /* Unlocked */
                          <div className="space-y-2">
                            <a href={app.visa_file_url} target="_blank" rel="noreferrer" download
                              className="w-full flex items-center justify-center gap-2 py-3 bg-[#EAF1FF] text-[#3B5BFF] rounded-xl hover:bg-[#DCE7FF] active:scale-[0.99] transition text-sm font-bold">
                              <Download className="w-4 h-4" /> Скачать визу
                            </a>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                              <p className="text-xs text-green-700">✓ Отзыв оставлен · спасибо!</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {isReady && !hasVisa && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700 text-center">
                        🎉 Виза готовится — скоро появится здесь
                      </div>
                    )}

                    {app.status === 'in_progress' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                        <Clock className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-green-800">Заявка в работе — мы уведомим вас когда виза будет готова</p>
                      </div>
                    )}

                    {app.status === 'pending_confirmation' && (
                      <div className="bg-[#EAF1FF] border border-[#5C7BFF]/20 rounded-lg p-3 flex items-start gap-2">
                        <Clock className="w-4 h-4 text-[#3B5BFF] mt-0.5 shrink-0" />
                        <p className="text-sm text-[#0F2A36]">Ожидаем подтверждение оплаты. Скоро возьмём заявку в работу</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Bookings (hotel + flight) ─────────────────────── */}
        {(hotelBookings.length > 0 || flightBookings.length > 0) && (
          <BookingsErrorBoundary>
            <div>
              <h3 className="text-lg text-gray-800 mb-3 flex items-center gap-2">
                <Hotel className="w-5 h-5" /> Мои брони
              </h3>
              <div className="space-y-3">
                {hotelBookings.map(b => (
                  <HotelBookingCard
                    key={b.id}
                    b={b}
                    isPartner={appUser?.is_influencer ?? false}
                    telegramId={telegramId}
                    username={(appUser as any)?.username ?? ''}
                    onBonusChange={onBonusChange}
                    onUpdate={(patch) => setHotelBookings(prev => prev.map(x => x.id === b.id ? { ...x, ...patch } : x))}
                  />
                ))}
                {flightBookings.map(b => (
                  <FlightBookingCard
                    key={b.id}
                    b={b}
                    isPartner={appUser?.is_influencer ?? false}
                    telegramId={telegramId}
                    username={(appUser as any)?.username ?? ''}
                    onBonusChange={onBonusChange}
                    onUpdate={(patch) => setFlightBookings(prev => prev.map(x => x.id === b.id ? { ...x, ...patch } : x))}
                  />
                ))}
              </div>
            </div>
          </BookingsErrorBoundary>
        )}
      </div>

      {reviewApp && (
        <ReviewModal
          app={reviewApp}
          onClose={() => setReviewApp(null)}
          onSubmitted={handleReviewSubmitted}
          isPartner={appUser?.is_influencer ?? false}
        />
      )}
    </>
  );
}

// ── Booking card components ─────────────────────────────────────────────────

const BOOKING_STATUS: Record<string, { label: string; color: string }> = {
  new:                  { label: 'Ожидает подтверждения', color: 'bg-[#EAF1FF] text-[#3B5BFF]' },
  pending_payment:      { label: 'Ждёт оплаты',           color: 'bg-amber-100 text-amber-700' },
  pending_confirmation: { label: 'Ожидает подтверждения', color: 'bg-[#EAF1FF] text-[#3B5BFF]' },
  in_progress:          { label: 'В работе',              color: 'bg-amber-100 text-amber-700' },
  confirmed:            { label: 'Готово',                color: 'bg-emerald-100 text-emerald-700' },
  cancelled:            { label: 'Отменена',              color: 'bg-red-100 text-red-700' },
};

const fmtBookingDate = (s: string) =>
  new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });

const fmtBookingDateTime = (s: string) =>
  new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

interface BookingCardCommon {
  isPartner: boolean;
  telegramId: number;
  username: string;
  onBonusChange?: (newBalance: number) => void;
}

// Shared "Download + Review" footer — works for both hotel and flight bookings.
function BookingActions({
  table, booking, isPartner, telegramId, username, onBonusChange, onUpdate, kindLabel,
}: BookingCardCommon & {
  table: 'hotel_bookings' | 'flight_bookings';
  booking: { id: string; status: string; confirmation_url?: string | null; review_bonus_granted?: boolean };
  onUpdate: (patch: Partial<HotelBookingRow & FlightBookingRow>) => void;
  kindLabel: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const reviewed = !!booking.review_bonus_granted;
  // Mirror the visa pattern: deliverable is "ready" only when status='confirmed' AND file is uploaded
  const ready = booking.status === 'confirmed' && !!booking.confirmation_url;

  const handleReview = async () => {
    if (submitting || reviewed || !ready) return;
    setSubmitting(true);

    const eligibleForBonus = !!telegramId && !isPartner;

    // 1. Optimistic UI: +200₽ моментально
    let original = 0;
    try { original = JSON.parse(localStorage.getItem('userData') ?? '{}').bonusBalance ?? 0; } catch {}
    const applyDelta = (delta: number) => {
      try {
        const ud = JSON.parse(localStorage.getItem('userData') ?? '{}');
        ud.bonusBalance = (ud.bonusBalance ?? 0) + delta;
        localStorage.setItem('userData', JSON.stringify(ud));
        onBonusChange?.(ud.bonusBalance);
      } catch {}
    };
    const syncTo = (actual: number) => {
      try {
        const ud = JSON.parse(localStorage.getItem('userData') ?? '{}');
        ud.bonusBalance = actual;
        localStorage.setItem('userData', JSON.stringify(ud));
        onBonusChange?.(actual);
      } catch {}
    };
    const rollback = () => syncTo(original);

    if (eligibleForBonus) {
      applyDelta(+200);
      try { (window as { Telegram?: { WebApp?: { HapticFeedback?: { notificationOccurred?: (t: string) => void } } } }).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success'); } catch {}
    }

    try {
      // 2. Параллельно: review (best-effort) + bonus (нам важен ответ)
      const reviewPromise = submitReview({
        telegramId,
        applicationId: `${table === 'hotel_bookings' ? 'hotel_' : 'flight_'}${booking.id}`,
        country: kindLabel,
        rating: 5,
        text: 'Отзыв оставлен в Telegram-канале',
        username,
      }).catch(e => { console.warn('submitReview for booking failed:', e); });

      let bonusPromise: Promise<{ res: Response; data: { skipped?: unknown; newBalance?: number; error?: string } }> | null = null;
      if (eligibleForBonus) {
        bonusPromise = apiFetch('/api/grant-bonus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_id: telegramId,
            type: 'review',
            amount: 200,
            description: `+200₽ за отзыв о брони (${kindLabel}, ${booking.id})`,
            application_id: `booking_${booking.id}`,
          }),
        }).then(async (res) => ({ res, data: await res.json().catch(() => ({})) as { skipped?: unknown; newBalance?: number; error?: string } }));
      } else if (!telegramId) {
        toast.error('Переоткрой мини-апп через бота — нет данных пользователя');
      }

      // 3. Подтверждаем баланс или откатываем
      if (bonusPromise) {
        try {
          const { res, data } = await bonusPromise;
          if (!res.ok) {
            rollback();
            toast.error(`Бонус не начислен (${res.status})`);
            console.error('[booking-review-bonus] HTTP error', res.status, data);
          } else if (data.skipped) {
            rollback();
            toast.info('Бонус за этот отзыв уже был начислен');
          } else if (typeof data.newBalance === 'number') {
            syncTo(data.newBalance);
            toast.success('+200 ₽ за отзыв');
          }
        } catch (e) {
          rollback();
          toast.error('Бонус не начислен — попробуй ещё раз');
          console.error('[booking-review-bonus] exception', e);
        }
      }

      await reviewPromise;

      // 3) Mark on the booking row so we don't show the button again
      await markBookingReviewBonusGranted(table, booking.id);
      onUpdate({ review_bonus_granted: true });

      // 4) Open Telegram channel
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openTelegramLink) tg.openTelegramLink('https://t.me/visadel_recall');
      else window.open('https://t.me/visadel_recall', '_blank');
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) return null;

  // Same locked → unlock structure as visas, but with VISADEL brand colours on CTAs
  return (
    <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
      {!reviewed ? (
        // Locked download — must review first
        <>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700">Оставьте отзыв чтобы скачать подтверждение</p>
          </div>
          <button
            disabled
            className="w-full flex items-center justify-center gap-2 py-3 bg-gray-200 text-gray-400 rounded-xl text-sm font-medium cursor-not-allowed"
          >
            <Lock className="w-4 h-4" /> Скачать подтверждение (недоступно)
          </button>
          <button
            type="button"
            onClick={handleReview}
            disabled={submitting}
            className="w-full py-3 vd-grad text-white shadow-md vd-shadow-cta disabled:opacity-60 rounded-xl active:scale-[0.99] transition flex items-center justify-center gap-2 text-sm font-bold"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
            {isPartner ? 'Оставить отзыв' : 'Оставить отзыв (+200 ₽)'}
          </button>
        </>
      ) : (
        // Unlocked — review submitted
        <>
          <a
            href={booking.confirmation_url ?? '#'}
            target="_blank" rel="noreferrer" download
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#EAF1FF] text-[#3B5BFF] rounded-xl hover:bg-[#DCE7FF] active:scale-[0.99] transition text-sm font-bold"
          >
            <Download className="w-4 h-4" /> Скачать подтверждение
          </a>
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
            <p className="text-xs text-green-700">✓ Отзыв оставлен · спасибо!</p>
          </div>
        </>
      )}
    </div>
  );
}

// Универсальный компонент status-message strip (как у визы внизу карточки).
// Зелёная для in_progress («в работе»), голубая для new/pending_confirmation
// («ожидаем подтверждение оплаты»), не показывается для confirmed/cancelled.
function BookingStatusMessage({ status, kind }: { status: string; kind: 'hotel' | 'flight' }) {
  const what = kind === 'hotel' ? 'бронь отеля' : 'бронь авиабилета';
  if (status === 'in_progress') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
        <Clock className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
        <p className="text-sm text-green-800">Заявка в работе — мы свяжемся с тобой когда {what} будет готова</p>
      </div>
    );
  }
  if (status === 'new' || status === 'pending_confirmation') {
    return (
      <div className="bg-[#EAF1FF] border border-[#5C7BFF]/20 rounded-lg p-3 flex items-start gap-2">
        <Clock className="w-4 h-4 text-[#3B5BFF] mt-0.5 shrink-0" />
        <p className="text-sm text-[#0F2A36]">Ожидаем подтверждение оплаты. Скоро возьмём заявку в работу</p>
      </div>
    );
  }
  if (status === 'confirmed') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
        <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
        <p className="text-sm text-emerald-800">Готово — подтверждение брони доступно ниже</p>
      </div>
    );
  }
  return null;
}

// Карточка брони — зеркалит layout визовой ApplicationCard:
//   1. Header (заголовок страны/маршрута + visa_type-стиль подзаголовок + бейдж справа)
//   2. Status timeline
//   3. Info-строки (К оплате, Дата, Заезд → Выезд, Гости)
//   4. Status-message strip (зелёная/голубая полоса с пояснением)
//   5. Actions (download confirmation / leave review)
function HotelBookingCard({ b, ...common }: { b: HotelBookingRow } & BookingCardCommon & {
  onUpdate: (patch: Partial<HotelBookingRow>) => void;
}) {
  const cfg = BOOKING_STATUS[b.status] ?? BOOKING_STATUS.new;
  const childrenAges = Array.isArray(b.children_ages) ? b.children_ages : [];
  const place = [b.country, b.city].filter(Boolean).join(', ') || 'Бронь отеля';
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-[#0F2A36] leading-tight">{place}</h3>
          <p className="text-sm text-[#0F2A36]/60 mt-0.5">Бронь отеля</p>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold shrink-0 ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      {/* Status timeline */}
      <BookingProgress status={b.status} />

      {/* Info-строки в стиле визовой карточки */}
      <div className="space-y-1.5 text-sm">
        {b.price != null && (
          <div className="flex justify-between text-[#0F2A36]/70">
            <span>К оплате:</span>
            <span className="font-bold text-[#0F2A36]">{b.price.toLocaleString('ru-RU')} ₽</span>
          </div>
        )}
        <div className="flex justify-between text-[#0F2A36]/70">
          <span>Заезд → Выезд:</span>
          <span className="font-medium text-[#0F2A36]">
            {b.check_in ? fmtBookingDate(b.check_in) : '—'} → {b.check_out ? fmtBookingDate(b.check_out) : '—'}
          </span>
        </div>
        <div className="flex justify-between text-[#0F2A36]/70">
          <span>Гостей:</span>
          <span className="font-medium text-[#0F2A36]">
            {b.guests ?? 1}{childrenAges.length > 0 && ` + ${childrenAges.length} реб.`}
          </span>
        </div>
        <div className="flex justify-between text-[#0F2A36]/70">
          <span>Дата заявки:</span>
          <span>{fmtBookingDateTime(b.created_at)}</span>
        </div>
      </div>

      {/* Status-message strip (как у визы) */}
      <BookingStatusMessage status={b.status} kind="hotel" />

      {/* Actions: download confirmation, leave review */}
      <BookingActions table="hotel_bookings" booking={b} kindLabel="Бронь отеля" {...common} />
    </div>
  );
}

function FlightBookingCard({ b, ...common }: { b: FlightBookingRow } & BookingCardCommon & {
  onUpdate: (patch: Partial<FlightBookingRow>) => void;
}) {
  const cfg = BOOKING_STATUS[b.status] ?? BOOKING_STATUS.new;
  const route = (b.from_city && b.to_city) ? `${b.from_city} → ${b.to_city}` : 'Бронь авиабилета';
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-[#0F2A36] leading-tight">{route}</h3>
          <p className="text-sm text-[#0F2A36]/60 mt-0.5">Бронь авиабилета</p>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold shrink-0 ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      {/* Status timeline */}
      <BookingProgress status={b.status} />

      {/* Info-строки */}
      <div className="space-y-1.5 text-sm">
        {b.price != null && (
          <div className="flex justify-between text-[#0F2A36]/70">
            <span>К оплате:</span>
            <span className="font-bold text-[#0F2A36]">{b.price.toLocaleString('ru-RU')} ₽</span>
          </div>
        )}
        <div className="flex justify-between text-[#0F2A36]/70">
          <span>Дата вылета:</span>
          <span className="font-medium text-[#0F2A36]">
            {b.booking_date ? fmtBookingDate(b.booking_date) : '—'}
          </span>
        </div>
        <div className="flex justify-between text-[#0F2A36]/70">
          <span>Дата заявки:</span>
          <span>{fmtBookingDateTime(b.created_at)}</span>
        </div>
      </div>

      {/* Status-message strip */}
      <BookingStatusMessage status={b.status} kind="flight" />

      {/* Actions */}
      <BookingActions table="flight_bookings" booking={b} kindLabel="Бронь авиабилета" {...common} />
    </div>
  );
}
