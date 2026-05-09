// Глобальный ErrorBoundary — ловит любую ошибку рендера и вместо
// «белого экрана» показывает понятный экран с кнопкой перезагрузки и
// очистки локального стейта (часто crash вызывает повреждённый
// localStorage от прерванного upload или draft).

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHardReset = () => {
    try {
      // Чистим всё что могло сломаться: drafts, кэш user'а
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.includes('draft') || k.startsWith('vd_') || k === 'userData') {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch { /* noop */ }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

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
