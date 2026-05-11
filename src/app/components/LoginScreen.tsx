import { useState } from 'react';
import { Mail, Lock, User, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/brand';
import { signInWithEmail, signUpWithEmail, upsertWebUser } from '../lib/web-auth';
import type { AppUser } from '../lib/db';

// Экран входа/регистрации для веб-юзеров (открыли visadel-test.vercel.app
// в браузере без Telegram WebApp). Показывается из App.tsx когда:
//   1. Нет Telegram initData (юзер не в TG mini-app)
//   2. Нет активной Supabase Auth session (не залогинен)
//
// После успешного входа/регистрации → upsertWebUser создаёт запись в
// public.users со связью auth_id → App.tsx переходит к обычному UI.

interface LoginScreenProps {
  // Callback после успешной авторизации — передаём AppUser. App.tsx
  // сохраняет его в state и переключает на главный экран.
  onAuthenticated: (user: AppUser) => void;
  // Реф-код из URL ?ref=XXX или ?startapp=XXX — пробрасываем при регистрации.
  referredBy?: string | null;
  // Имя бота для deeplink «Открыть в Telegram».
  telegramBotUsername?: string;
}

type Mode = 'login' | 'signup';

export default function LoginScreen({ onAuthenticated, referredBy, telegramBotUsername }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // После signUp ждём подтверждения email — показываем плашку.
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(email)) {
      setError('Введите корректный email');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }
    if (mode === 'signup' && !firstName.trim()) {
      setError('Введите имя');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const { needsConfirmation, error: signUpError } = await signUpWithEmail(email, password, firstName);
        if (signUpError) {
          setError(signUpError);
          setSubmitting(false);
          return;
        }
        if (needsConfirmation) {
          // Письмо отправлено — ждём клика по ссылке.
          setConfirmationSentTo(email.trim());
          setSubmitting(false);
          return;
        }
        // Если confirmation не требуется (например админ выключил его в Supabase)
        // — сразу создаём запись в users.
        const user = await upsertWebUser({
          firstName: firstName.trim(),
          referredBy,
          signupSource: 'email',
        });
        if (!user) {
          setError('Не удалось создать профиль. Попробуйте ещё раз.');
          setSubmitting(false);
          return;
        }
        onAuthenticated(user);
      } else {
        // login
        const { session, error: signInError } = await signInWithEmail(email, password);
        if (signInError || !session) {
          setError(signInError ?? 'Не удалось войти');
          setSubmitting(false);
          return;
        }
        // Подтянем (или досоздадим если запись пропала) запись из users по auth_id.
        const user = await upsertWebUser({
          firstName: firstName.trim() || email.split('@')[0],
          referredBy,
          signupSource: 'email',
        });
        if (!user) {
          setError('Аккаунт найден, но профиль не загрузился. Обновите страницу.');
          setSubmitting(false);
          return;
        }
        onAuthenticated(user);
      }
    } catch (err) {
      console.error('[LoginScreen]', err);
      setError(err instanceof Error ? err.message : 'Ошибка входа');
      setSubmitting(false);
    }
  };

  // ── Экран «Письмо отправлено» ─────────────────────────────────────────────
  if (confirmationSentTo) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full vd-grad flex items-center justify-center mb-4">
            <Send className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#0F2A36] mb-2">
            Письмо отправлено
          </h2>
          <p className="text-sm text-[#0F2A36]/70 mb-1">
            Мы отправили ссылку для подтверждения на
          </p>
          <p className="text-base font-semibold text-[#3B5BFF] mb-4 break-all">{confirmationSentTo}</p>
          <p className="text-sm text-[#0F2A36]/60 mb-6">
            Откройте письмо и перейдите по ссылке, чтобы завершить регистрацию.
            Не приходит? Проверьте папку «Спам».
          </p>
          <Button
            variant="soft"
            size="md"
            fullWidth
            onClick={() => { setConfirmationSentTo(null); setMode('login'); setPassword(''); }}
          >
            Вернуться ко входу
          </Button>
        </div>
      </div>
    );
  }

  // ── Основной экран Login / Signup ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6">
        {/* Logo + brand */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M3 12 L9 18 L21 6" stroke="#5C7BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[#0F2A36] font-extrabold text-xl tracking-tight">VISADEL</span>
          </div>
          <p className="text-sm text-[#0F2A36]/60">Оформление виз онлайн</p>
        </div>

        {/* Mode tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${
              mode === 'login' ? 'bg-white text-[#0F2A36] shadow-sm' : 'text-[#0F2A36]/50'
            }`}
          >
            Войти
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${
              mode === 'signup' ? 'bg-white text-[#0F2A36] shadow-sm' : 'text-[#0F2A36]/50'
            }`}
          >
            Регистрация
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block mb-1.5 text-sm font-semibold text-[#0F2A36] flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#3B5BFF]" />
                Имя
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="form-input"
                placeholder="Иван"
                autoComplete="given-name"
                disabled={submitting}
              />
            </div>
          )}

          <div>
            <label className="block mb-1.5 text-sm font-semibold text-[#0F2A36] flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-[#3B5BFF]" />
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="ivan@example.com"
              autoComplete="email"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block mb-1.5 text-sm font-semibold text-[#0F2A36] flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[#3B5BFF]" />
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="Минимум 6 символов"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="!py-3.5 !rounded-2xl !font-bold"
            disabled={submitting}
            loading={submitting}
            leftIcon={!submitting ? <CheckCircle2 className="w-5 h-5" /> : undefined}
          >
            {submitting ? 'Подождите...' : (mode === 'signup' ? 'Зарегистрироваться' : 'Войти')}
          </Button>
        </form>

        {/* Divider */}
        {telegramBotUsername && (
          <>
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[10px] uppercase tracking-widest text-[#0F2A36]/40 font-bold">или</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Open in Telegram deeplink */}
            <div className="text-center">
              <p className="text-xs text-[#0F2A36]/60 mb-2">Есть Telegram?</p>
              <a
                href={`https://t.me/${telegramBotUsername.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-2xl bg-[#229ED9] hover:bg-[#1B8AC0] text-white font-bold text-sm transition active:scale-[0.98]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.022c.243-.213-.054-.334-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.658-.643.135-.953l11.566-4.458c.534-.196 1.002.128.827.938z"/>
                </svg>
                Открыть в Telegram
              </a>
              <p className="text-[10px] text-[#0F2A36]/40 mt-2 leading-tight">
                В Telegram вход без регистрации
              </p>
            </div>
          </>
        )}

        {/* Footer */}
        <p className="text-[11px] text-[#0F2A36]/40 mt-6 text-center leading-relaxed">
          Регистрируясь, вы соглашаетесь с обработкой персональных данных
          в соответствии с законодательством РФ.
        </p>
      </div>
    </div>
  );
}
