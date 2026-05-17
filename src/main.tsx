import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { ErrorBoundary } from "./app/components/ErrorBoundary";
import { DialogProvider } from "./app/components/shared/BrandDialog";
import "./styles/index.css";
import { installGlobalErrorHandlers } from "./app/lib/errorReporter";
import { initSentry } from "./app/lib/sentry";

// Sentry init — должен быть до createRoot, чтобы ловить ошибки из React-tree.
// No-op если VITE_SENTRY_DSN не задан.
initSentry();

// Один раз чистим у юзеров устаревшие локальные данные после ручной чистки
// БД 10 мая 2026 (удалили все тестовые users/applications/bonus_logs).
// Без этого юзеры видели бы старые черновики и кэшированный профиль которых
// уже нет на сервере → ошибки "user not found", "draft не загружается".
//
// При следующей чистке БД — bump эту константу (например '2026-06-15-cleanup'),
// и каждый юзер при первом заходе после деплоя получит свежий localStorage.
const DATA_VERSION = '2026-05-10-cleanup';
const STATIC_KEYS_TO_PURGE = [
  'userData', 'vd_user',
  'visa_drafts', 'applications',
  'flight_booking_draft', 'hotel_booking_draft',
  'tasks',
];
try {
  if (localStorage.getItem('vd_data_version') !== DATA_VERSION) {
    for (const k of STATIC_KEYS_TO_PURGE) localStorage.removeItem(k);
    // Динамические draft_<uuid> ключи — собираем сначала, потом удаляем
    // (нельзя мутировать localStorage пока итерируем).
    const dynamicDraftKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('draft_')) dynamicDraftKeys.push(k);
    }
    for (const k of dynamicDraftKeys) localStorage.removeItem(k);
    localStorage.setItem('vd_data_version', DATA_VERSION);
  }
} catch (e) {
  // localStorage может быть недоступен (private mode, отключен) — не ломаем загрузку
  console.warn('[main] localStorage cleanup skipped:', e);
}

installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <DialogProvider>
      <App />
    </DialogProvider>
  </ErrorBoundary>
);
