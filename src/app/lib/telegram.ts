export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    chat_instance?: string;
    chat_type?: string;
    start_param?: string;
    auth_date: number;
    hash: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
    section_bg_color?: string;
    accent_text_color?: string;
    destructive_text_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  onEvent?: (event: string, handler: (...args: unknown[]) => void) => void;
  offEvent?: (event: string, handler: (...args: unknown[]) => void) => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    showProgress(leaveActive?: boolean): void;
    hideProgress(): void;
    setText(text: string): void;
    onClick(fn: () => void): void;
    offClick(fn: () => void): void;
  };
  BackButton: {
    isVisible: boolean;
    show(): void;
    hide(): void;
    onClick(fn: () => void): void;
    offClick(fn: () => void): void;
  };
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  ready(): void;
  expand(): void;
  close(): void;
  showAlert(message: string, callback?: () => void): void;
  showConfirm(message: string, callback: (confirmed: boolean) => void): void;
  openLink(url: string): void;
  openTelegramLink(url: string): void;
  sendData(data: string): void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function getTelegramUser(): TelegramUser | null {
  return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
}

export function getTelegramInitData(): string {
  return window.Telegram?.WebApp?.initData ?? '';
}

export function isTelegramWebApp(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;
}

export function initTelegramApp(): void {
  const tg = getTelegramWebApp();
  if (!tg) return;
  tg.ready();
  tg.expand();
  applyTelegramTheme();
  // Реагируем на смену темы пока мини-апп открыт
  tg.onEvent?.('themeChanged', applyTelegramTheme);
  tg.onEvent?.('viewportChanged', () => { /* trigger re-layout if needed */ });
}

// Прокидываем Telegram themeParams в CSS-переменные:
//   --tg-bg          → body background (внешняя «рамка» вокруг приложения)
//   --tg-text        → доступно компонентам если захотят синхронизироваться
//   --tg-link        → линки в светлой теме автоматически окрашиваются
// Само ядро приложения остаётся светлым (#F5F7FA) — брендовый выбор;
// в тёмном Telegram пользователь видит светлый app внутри dark chrome.
export function applyTelegramTheme(): void {
  const tg = getTelegramWebApp();
  if (!tg) return;
  const root = document.documentElement;
  const p = tg.themeParams ?? {};
  if (p.bg_color)            root.style.setProperty('--tg-bg', p.bg_color);
  if (p.text_color)          root.style.setProperty('--tg-text', p.text_color);
  if (p.link_color)          root.style.setProperty('--tg-link', p.link_color);
  if (p.button_color)        root.style.setProperty('--tg-button', p.button_color);
  if (p.button_text_color)   root.style.setProperty('--tg-button-text', p.button_text_color);
  if (p.secondary_bg_color)  root.style.setProperty('--tg-secondary-bg', p.secondary_bg_color);
  // data-атрибут чтобы CSS-селекторы могли тонко настраивать стили
  root.setAttribute('data-tg-theme', tg.colorScheme === 'dark' ? 'dark' : 'light');
}

export function haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' = 'light'): void {
  const tg = getTelegramWebApp();
  if (!tg) return;
  if (type === 'success' || type === 'error' || type === 'warning') {
    tg.HapticFeedback.notificationOccurred(type);
  } else {
    tg.HapticFeedback.impactOccurred(type);
  }
}

export function showBackButton(onClick: () => void): void {
  const tg = getTelegramWebApp();
  if (!tg) return;
  tg.BackButton.onClick(onClick);
  tg.BackButton.show();
}

export function hideBackButton(onClick?: () => void): void {
  const tg = getTelegramWebApp();
  if (!tg) return;
  if (onClick) tg.BackButton.offClick(onClick);
  tg.BackButton.hide();
}

// Включает подтверждение перед закрытием Telegram-окна. Защищает от потери
// данных в формах с черновиком (визовая анкета, бронь отеля/билета).
export function enableClosingConfirmation(): void {
  const tg = getTelegramWebApp();
  tg?.enableClosingConfirmation?.();
}

export function disableClosingConfirmation(): void {
  const tg = getTelegramWebApp();
  tg?.disableClosingConfirmation?.();
}

export function showMainButton(text: string, onClick: () => void): void {
  const tg = getTelegramWebApp();
  if (!tg) return;
  tg.MainButton.setText(text);
  tg.MainButton.onClick(onClick);
  tg.MainButton.show();
}

export function hideMainButton(onClick?: () => void): void {
  const tg = getTelegramWebApp();
  if (!tg) return;
  if (onClick) tg.MainButton.offClick(onClick);
  tg.MainButton.hide();
}

// Mock user for local development (outside Telegram)
export function getMockUser(): TelegramUser {
  return {
    id: 123456789,
    first_name: 'Тест',
    last_name: 'Пользователь',
    username: 'testuser',
    language_code: 'ru',
  };
}
