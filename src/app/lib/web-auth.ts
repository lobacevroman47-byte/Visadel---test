// Web-юзеры через Supabase Auth (email + пароль).
//
// Используется только когда юзер открыл сайт visadel-test.vercel.app в браузере
// (без Telegram WebApp initData). TG-юзеры идентифицируются через initData
// и обрабатываются в lib/db.ts:upsertUser — этот файл их не трогает.
//
// Flow:
//   1. signUpWithEmail(email, password) → Supabase отправляет confirmation email
//   2. Юзер кликает по ссылке в письме → редирект обратно на сайт с подтверждением
//   3. signInWithEmail(email, password) → получаем JWT-сессию
//   4. upsertWebUser() → создаём/обновляем запись в public.users со связью auth_id
//   5. App.tsx видит сессию и грузит юзера как обычно
//
// Локализация ПДн: фронт работает с Supabase (Tokyo) — формально нарушение
// 152-ФЗ для продакшена с реальными клиентами РФ. См. project_hosting_localization.md.

import { supabase, isSupabaseConfigured } from './supabase';
import type { AppUser } from './db';
import { apiFetch } from './apiFetch';

// ─── Auth API ────────────────────────────────────────────────────────────────

export interface WebAuthSession {
  authId: string;
  email: string;
  accessToken: string;
}

export async function getCurrentSession(): Promise<WebAuthSession | null> {
  if (!isSupabaseConfigured()) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user.id) return null;
  return {
    authId: session.user.id,
    email: session.user.email ?? '',
    accessToken: session.access_token,
  };
}

export async function signUpWithEmail(email: string, password: string, firstName?: string): Promise<{
  needsConfirmation: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { needsConfirmation: false, error: 'Supabase не настроен' };
  }
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      // После клика в email — куда редиректить (на наш сайт).
      // Supabase сам подставит token в URL fragment.
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: {
        first_name: firstName?.trim() || email.split('@')[0],
      },
    },
  });
  if (error) {
    return { needsConfirmation: false, error: humanizeAuthError(error.message) };
  }
  // Если у юзера ещё нет session — значит письмо отправлено, ждём confirmation
  const needsConfirmation = !data.session;
  return { needsConfirmation };
}

export async function signInWithEmail(email: string, password: string): Promise<{
  session: WebAuthSession | null;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { session: null, error: 'Supabase не настроен' };
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    return { session: null, error: humanizeAuthError(error.message) };
  }
  if (!data.session) {
    return { session: null, error: 'Нет сессии после входа' };
  }
  return {
    session: {
      authId: data.session.user.id,
      email: data.session.user.email ?? '',
      accessToken: data.session.access_token,
    },
  };
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.auth.signOut();
}

export async function resetPassword(email: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase не настроен' };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/auth/reset`,
  });
  if (error) return { error: humanizeAuthError(error.message) };
  return {};
}

// ─── Upsert web user (через наш backend endpoint) ────────────────────────────

export async function upsertWebUser(args: {
  firstName: string;
  lastName?: string;
  phone?: string;
  referredBy?: string | null;
  signupSource?: 'email' | 'google' | 'vk' | 'yandex' | 'apple';
}): Promise<AppUser | null> {
  const session = await getCurrentSession();
  if (!session) {
    console.warn('[upsertWebUser] no session — login required first');
    return null;
  }

  try {
    const res = await apiFetch('/api/web-user-upsert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        first_name: args.firstName,
        last_name: args.lastName ?? null,
        phone: args.phone ?? null,
        referred_by: args.referredBy ?? null,
        signup_source: args.signupSource ?? 'email',
      }),
    });
    if (!res.ok) {
      console.warn('[upsertWebUser] API error:', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json().catch(() => ({} as { user?: AppUser }));
    return data.user ?? null;
  } catch (e) {
    console.error('[upsertWebUser] exception:', e);
    return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Перевод Supabase Auth error messages на русский. Используется в UI.
function humanizeAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Неверный email или пароль';
  if (m.includes('email not confirmed')) return 'Подтвердите email — мы отправили ссылку на ваш ящик';
  if (m.includes('user already registered')) return 'Этот email уже зарегистрирован — попробуйте войти';
  if (m.includes('password should be at least')) return 'Пароль должен быть не короче 6 символов';
  if (m.includes('signup') && m.includes('disabled')) return 'Регистрация временно отключена. Попробуйте позже.';
  if (m.includes('email rate limit')) return 'Слишком много запросов. Подождите минуту.';
  if (m.includes('unable to validate email')) return 'Некорректный email';
  return msg; // fallback на оригинал
}
