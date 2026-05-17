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
  /** @deprecated Password-gate убран. Только Telegram-id check. Оставлено для обратной совместимости. */
  login: (password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithTelegram: () => Promise<boolean>;
  logout: () => void;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
  onBackToApp?: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

// ─── Auth model ───────────────────────────────────────────────────────────────
// Раньше был двойной gate: пароль (хеш в bundle через VITE_ADMIN_PASSWORD_HASH)
// + Telegram-id check. Хеш в bundle — это P1 уязвимость: видно всем, можно
// brute-force оффлайн. Сейчас оставили ТОЛЬКО Telegram-id check —
// это и так был реальный gate (бэк проверяет `requireAdminUser` по
// ADMIN_TELEGRAM_IDS env, password ни на что не влиял на сервере).
//
// Список админов: VITE_ADMIN_TELEGRAM_IDS на клиенте (для UI gate) +
// ADMIN_TELEGRAM_IDS на сервере (для API requireAdminUser).
// Обе env обязательны.

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

// ─── Telegram helpers ─────────────────────────────────────────────────────────

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

  // Deprecated. Password-gate убран (хеш в bundle = P1).
  // Оставлено для обратной совместимости с AdminLogin.tsx — всегда возвращает
  // ошибку "не настроено". Реальный auth flow — loginWithTelegram.
  const login = useCallback(async (_password: string): Promise<{ success: boolean; error?: string }> => {
    return {
      success: false,
      error: 'Вход по паролю отключён. Открой админку из Telegram-аккаунта администратора.',
    };
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
