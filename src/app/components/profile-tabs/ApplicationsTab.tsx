import { useState, useEffect, useCallback } from 'react';
import { FileText, Clock, Download, Lock, Star, X, Loader2, RefreshCw } from 'lucide-react';
import { getUserApplications, getReviewedAppIds, submitReview, type Application } from '../../lib/db';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useTelegram } from '../../App';

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
  onBonusChange?: (newBalance: number) => void;
}

const STATUS_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  draft:                { label: 'Черновик',                icon: '📝', color: 'bg-gray-100 text-gray-700' },
  pending_payment:      { label: 'Ожидает оплаты',          icon: '💰', color: 'bg-yellow-100 text-yellow-700' },
  pending_confirmation: { label: 'Ожидает подтверждения',   icon: '⏳', color: 'bg-blue-100 text-blue-700' },
  in_progress:          { label: 'В работе',                icon: '✅', color: 'bg-green-100 text-green-700' },
  ready:                { label: 'Готово',                  icon: '🎉', color: 'bg-purple-100 text-purple-700' },
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
                  done   ? 'bg-blue-500 text-white shadow-blue-200' :
                  active ? 'bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-1 shadow-blue-300' :
                           'bg-gray-100 text-gray-400'
                }`}>
                  {done ? '✓' : step.icon}
                </div>
                <span className={`text-[9px] text-center leading-tight whitespace-pre-line ${
                  active ? 'text-blue-600 font-semibold' : done ? 'text-blue-400' : 'text-gray-400'
                }`}>
                  {step.label}
                </span>
              </div>
              {/* Connector line */}
              {idx < PROGRESS_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mt-4 mx-0.5 rounded-full transition-colors ${
                  done ? 'bg-blue-500' : 'bg-gray-200'
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
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const userData = (() => {
    try { return JSON.parse(localStorage.getItem('userData') ?? '{}'); } catch { return {}; }
  })();
  const telegramId: number = userData.telegramId ?? 0;
  const username: string = userData.username ?? '';

  const handleSubmit = async () => {
    if (rating === 0) { alert('Поставьте оценку'); return; }
    if (comment.trim().length < 5) { alert('Напишите хотя бы несколько слов'); return; }
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
      alert('Ошибка при отправке отзыва');
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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
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
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white rounded-xl transition flex items-center justify-center gap-2 font-medium"
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
export default function ApplicationsTab({ onContinueDraft, onBonusChange }: ApplicationsTabProps) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Draft[]>([]);
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
      const [apps, reviewed] = await Promise.all([
        id ? getUserApplications(id) : Promise.resolve([]),
        id ? getReviewedAppIds(id) : Promise.resolve(new Set<string>()),
      ]);
      setApplications(apps);
      setReviewedIds(reviewed);

      // Load drafts from localStorage
      try {
        const raw = localStorage.getItem('visa_drafts');
        if (raw) {
          const parsed: Draft[] = JSON.parse(raw);
          const now = Date.now();
          const valid = parsed
            .filter(d => now - new Date(d.savedAt).getTime() < 30 * 24 * 60 * 60 * 1000)
            .map(d => ({ ...d, draftKey: d.id }));
          setDrafts(valid);
        }
      } catch {}
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
  // (column filters require Supabase Pro; we filter client-side instead)
  useEffect(() => {
    if (!telegramId || !isSupabaseConfigured()) return;

    const channel = supabase
      .channel(`user-apps-${telegramId}`)
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'applications' },
        (payload: any) => {
          // Client-side filter — only update this user's applications
          if (payload.new.user_telegram_id !== telegramId) return;
          setApplications(prev =>
            prev.map(app =>
              app.id === payload.new.id ? { ...app, ...payload.new } : app
            )
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

  // One-click: submit review + open Telegram + give 200₽ review bonus
  const handleQuickReview = async (app: Application) => {
    if (submittingReviewId) return;
    setSubmittingReviewId(app.id!);

    const username = (() => {
      try { return JSON.parse(localStorage.getItem('userData') ?? '{}').username ?? ''; } catch { return ''; }
    })();

    try {
      await submitReview({
        telegramId,
        applicationId: app.id!,
        country: app.country,
        rating: 5,
        text: 'Отзыв оставлен в Telegram-канале',
        username,
      });

      // Grant +200₽ review bonus via service-key API (with dedup) — partners excluded
      if (telegramId && !appUser?.is_influencer) {
        try {
          const res = await fetch('/api/grant-bonus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegram_id: telegramId,
              type: 'review',
              amount: 200,
              description: `+200₽ за отзыв о визе ${app.country} (${app.id})`,
              application_id: app.id,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (!data.skipped && data.newBalance != null) {
              try {
                const ud = JSON.parse(localStorage.getItem('userData') ?? '{}');
                ud.bonusBalance = data.newBalance;
                localStorage.setItem('userData', JSON.stringify(ud));
              } catch {}
              onBonusChange?.(data.newBalance);
            }
          }
        } catch (e) { console.error('review bonus error', e); }
      }

      setReviewedIds(prev => new Set([...prev, app.id!]));
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingReviewId(null);
    }

    // Open Telegram channel
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink('https://t.me/visadel_recall');
    } else {
      window.open('https://t.me/visadel_recall', '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
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
        {drafts.length > 0 && (
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
                        className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition text-sm">
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
            </div>
          </div>
        )}

        {/* Applications */}
        <div>
          <h3 className="text-lg text-gray-800 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" /> Мои заявки
          </h3>

          {applications.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">У вас пока нет заявок</p>
              <p className="text-sm text-gray-500 mt-1">Оформите первую визу, чтобы увидеть её здесь</p>
            </div>
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
                      <span className={`${cfg.color} text-xs px-3 py-1 rounded-full shrink-0`}>
                        {cfg.icon} {cfg.label}
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
                              className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl transition flex items-center justify-center gap-2 text-sm font-medium">
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
                              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:shadow-lg transition text-sm font-medium">
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
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                        <Clock className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-blue-800">Ожидаем подтверждение оплаты. Скоро возьмём заявку в работу</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
