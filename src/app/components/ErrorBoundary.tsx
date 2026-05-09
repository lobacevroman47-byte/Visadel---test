// Глобальный ErrorBoundary — ловит любую ошибку рендера и вместо
// «белого экрана» показывает понятный экран с кнопкой перезагрузки.
//
// Логика:
//   1. ChunkLoadError (стейл-кеш после деплоя) → автоматический
//      hard-reload с пометкой sessionStorage чтобы не зациклиться.
//   2. Любая другая ошибка → silent retry через 200ms (race condition'ы
//      типа TG WebApp API не готов).
//   3. Если retry тоже падает → экран «Что-то пошло не так».
//
// Это решает проблему «при первом заходе или открытии вкладки ошибка,
// при перезагрузке всё ок».

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  retried: boolean;
  /** При retry-проходе генерим новый key чтобы пересоздать дерево детей. */
  resetKey: number;
}

const RETRY_DELAY_MS = 200;
const RELOAD_GUARD_KEY = 'vd_chunk_reload_guard';

// Распознаём ошибку загрузки динамического чанка. После каждого деплоя
// Vite генерит файлы с новыми хэшами, и старая HTML-страница в кеше
// браузера ссылается на удалённые файлы. lazy() в этом случае получает
// ошибку «Failed to fetch dynamically imported module».
function isChunkLoadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message || '';
  const name = err.name || '';
  return (
    name === 'ChunkLoadError' ||
    /loading chunk/i.test(msg) ||
    /failed to fetch dynamically imported/i.test(msg) ||
    /importing a module script failed/i.test(msg) ||
    /load failed/i.test(msg) // Safari + lazy() иногда даёт generic «Load failed»
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retried: false, resetKey: 0 };
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Полный лог в консоль — видно в Telegram DevTools
    console.error('[ErrorBoundary] caught error:', error);
    console.error('[ErrorBoundary] error stack:', error.stack);
    console.error('[ErrorBoundary] component stack:', info.componentStack);

    // ── ChunkLoadError → hard-reload, но только один раз за сессию,
    //    чтобы не зациклиться, если файл реально 404-ит. ────────────────
    if (isChunkLoadError(error)) {
      const guarded = (() => { try { return sessionStorage.getItem(RELOAD_GUARD_KEY); } catch { return null; } })();
      if (!guarded) {
        try { sessionStorage.setItem(RELOAD_GUARD_KEY, '1'); } catch { /* noop */ }
        console.warn('[ErrorBoundary] chunk load error → reloading once');
        // Лёгкая задержка чтобы успело залогироваться
        setTimeout(() => window.location.reload(), 50);
        return;
      }
      console.warn('[ErrorBoundary] chunk load error повторно — показываем экран ошибки');
    }

    // Первая generic-ошибка → silent retry. Вторая → экран ошибки.
    if (!this.state.retried) {
      console.warn('[ErrorBoundary] auto-retrying once in', RETRY_DELAY_MS, 'ms');
      this.retryTimer = setTimeout(() => {
        this.setState(s => ({ error: null, retried: true, resetKey: s.resetKey + 1 }));
      }, RETRY_DELAY_MS);
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  handleReload = () => {
    try { sessionStorage.removeItem(RELOAD_GUARD_KEY); } catch { /* noop */ }
    window.location.reload();
  };

  handleHardReset = () => {
    try {
      // Чистим всё что могло сломаться: drafts, кэш user'а, reload guard
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.includes('draft') || k.startsWith('vd_') || k === 'userData') {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      sessionStorage.removeItem(RELOAD_GUARD_KEY);
    } catch { /* noop */ }
    window.location.reload();
  };

  render() {
    // Пока идёт retry-таймер ИЛИ chunk-reload — показываем спиннер
    // чтобы юзер не увидел error-UI на доли секунды.
    if (this.state.error && !this.state.retried) {
      return (
        <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#3B5BFF]/30 border-t-[#3B5BFF] rounded-full animate-spin" />
        </div>
      );
    }

    // Если ошибки нет — рендерим children с resetKey (форсит ремаунт после retry).
    if (!this.state.error) {
      return <div key={this.state.resetKey}>{this.props.children}</div>;
    }

    // Retried = true и снова error → реальная проблема, показываем экран.
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-5 py-10">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 flex items-center justify-center mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-lg font-bold text-[#0F2A36] mb-2">Что-то пошло не так</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-5">
            Приложение зависло из-за внутренней ошибки.<br />
            Попробуй перезагрузить.
          </p>
          <details className="text-left mb-5 text-[11px] text-gray-400 bg-gray-50 rounded-lg p-2">
            <summary className="cursor-pointer">Технические детали</summary>
            <pre className="overflow-x-auto mt-2 whitespace-pre-wrap break-all">
              {this.state.error.message}
              {this.state.error.stack && '\n\n' + this.state.error.stack}
            </pre>
          </details>
          <button
            onClick={this.handleReload}
            className="w-full vd-grad text-white py-3 rounded-xl text-sm font-semibold mb-2 active:scale-[0.98] transition vd-shadow-cta"
          >
            Перезагрузить
          </button>
          <button
            onClick={this.handleHardReset}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium active:scale-[0.98] transition"
          >
            Сбросить кэш и перезагрузить
          </button>
          <p className="text-[11px] text-gray-400 mt-3">
            «Сбросить кэш» удаляет черновики и временные данные. Сами заявки в БД не трогаются.
          </p>
        </div>
      </div>
    );
  }
}
