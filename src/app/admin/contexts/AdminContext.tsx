import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type UserRole = 'owner' | 'admin' | 'manager';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  telegram: string;
  role: UserRole;
}

interface AdminContextType {
  currentUser: AdminUser | null;
  login: (password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithTelegram: () => Promise<boolean>;
  logout: () => void;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
  onBackToApp?: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

// ─── Config from Vercel environment variables ────────────────────────────────
// VITE_ADMIN_PASSWORD_HASH — SHA-256 hash of your password (see README)
// VITE_ADMIN_TELEGRAM_IDS  — comma-separated allowed Telegram IDs, e.g. "123456789,987654321"

const PASSWORD_HASH = import.meta.env.VITE_ADMIN_PASSWORD_HASH ?? '';
const ALLOWED_TG_IDS: string[] = (import.meta.env.VITE_ADMIN_TELEGRAM_IDS ?? '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);

// ─── Session ──────────────────────────────────────────────────────────────────

const SESSION_KEY = 'vd_admin_session';
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours

interface Session {
  user: AdminUser;
  expires: number;
}

function readSession(): AdminUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s: Session = JSON.parse(raw);
    if (Date.now() > s.expires) { localStorage.removeItem(SESSION_KEY); return null; }
    return s.user;
  } catch {
    return null;
  }
}

function writeSession(user: AdminUser) {
  const s: Session = { user, expires: Date.now() + SESSION_TTL };
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Brute-force protection ───────────────────────────────────────────────────

const ATTEMPT_KEY = 'vd_admin_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 60 * 1000;

interface Attempts { count: number; lockedUntil: number }

function getAttempts(): Attempts {
  try { return JSON.parse(localStorage.getItem(ATTEMPT_KEY) ?? '{"count":0,"lockedUntil":0}'); }
  catch { return { count: 0, lockedUntil: 0 }; }
}

function recordAttempt(success: boolean) {
  if (success) { localStorage.removeItem(ATTEMPT_KEY); return; }
  const a = getAttempts();
  const count = a.count + 1;
  const lockedUntil = count >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : a.lockedUntil;
  localStorage.setItem(ATTEMPT_KEY, JSON.stringify({ count, lockedUntil }));
}

// ─── Crypto ───────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getTelegramUserId(): string | null {
  try {
    const id = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    return id ? String(id) : null;
  } catch { return null; }
}

function getTelegramUsername(): string {
  try {
    const u = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    return u?.username ? `@${u.username}` : u?.first_name ?? 'Администратор';
  } catch { return 'Администратор'; }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AdminProvider: React.FC<{ children: ReactNode; onBackToApp?: () => void }> = ({ children, onBackToApp }) => {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(readSession);

  const makeUser = (telegram = ''): AdminUser => ({
    id: '1',
    name: 'Администратор',
    email: '',
    telegram,
    role: 'owner',
  });

  const loginWithTelegram = useCallback(async (): Promise<boolean> => {
    const tgId = getTelegramUserId();
    if (!tgId || !ALLOWED_TG_IDS.includes(tgId)) return false;
    const user = makeUser(getTelegramUsername());
    writeSession(user);
    setCurrentUser(user);
    return true;
  }, []);

  const login = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    const a = getAttempts();
    if (a.lockedUntil > Date.now()) {
      const mins = Math.ceil((a.lockedUntil - Date.now()) / 60000);
      return { success: false, error: `Слишком много попыток. Подождите ${mins} мин.` };
    }

    if (!PASSWORD_HASH) {
      return { success: false, error: 'Пароль не настроен. Добавьте VITE_ADMIN_PASSWORD_HASH в Vercel.' };
    }

    const hash = await sha256(password);
    if (hash !== PASSWORD_HASH) {
      recordAttempt(false);
      const remaining = MAX_ATTEMPTS - (getAttempts().count);
      return { success: false, error: `Неверный пароль. Осталось попыток: ${remaining}` };
    }

    recordAttempt(true);
    const tgName = getTelegramUsername();
    const user = makeUser(tgName !== 'Администратор' ? tgName : '');
    writeSession(user);
    setCurrentUser(user);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setCurrentUser(null);
    onBackToApp?.();
  }, [onBackToApp]);

  // RBAC: реальная проверка роли. Раньше игнорировала аргумент и возвращала
  // true для любого залогиненного юзера — это означало что 'manager' имел
  // тот же доступ что 'owner'. Теперь сверяем с currentUser.role.
  //
  // Hierarchy: owner > admin > manager. Если требуется конкретный список,
  // проверяем точное вхождение.
  const hasPermission = useCallback((requiredRole: UserRole | UserRole[]): boolean => {
    if (!currentUser) return false;
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return roles.includes(currentUser.role);
  }, [currentUser]);

  return (
    <AdminContext.Provider value={{ currentUser, login, loginWithTelegram, logout, hasPermission, onBackToApp }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
};
