// Брендовый модальный диалог — заменяет нативный alert/confirm в мини-аппе
// и в админке. Визуально совпадает с SuccessScreen (галочка/иконка + текст
// + brand-кнопки), но не fullscreen — рендерится поверх контента.
//
// Использование:
//   const dialog = useDialog();
//   await dialog.alert('Готово', 'Заявка отправлена');
//   const ok = await dialog.confirm('Удалить?', 'Действие нельзя отменить');
//   await dialog.error('Ошибка', e.message);
//
// Под капотом — глобальный портал, рендерится один раз. Promise resolve'ит
// когда юзер нажимает кнопку.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Check, AlertCircle, X, AlertTriangle, Info } from 'lucide-react';

type DialogKind = 'success' | 'error' | 'warning' | 'info' | 'confirm';

interface DialogConfig {
  kind: DialogKind;
  title: string;
  description?: ReactNode;
  primaryLabel?: string;
  secondaryLabel?: string;
}

interface ResolvedDialog extends DialogConfig {
  resolve: (ok: boolean) => void;
}

interface DialogApi {
  alert:   (title: string, description?: ReactNode) => Promise<void>;
  success: (title: string, description?: ReactNode) => Promise<void>;
  error:   (title: string, description?: ReactNode) => Promise<void>;
  warning: (title: string, description?: ReactNode) => Promise<void>;
  info:    (title: string, description?: ReactNode) => Promise<void>;
  confirm: (title: string, description?: ReactNode, opts?: { confirmLabel?: string; cancelLabel?: string }) => Promise<boolean>;
}

const DialogCtx = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const ctx = useContext(DialogCtx);
  if (!ctx) {
    // Fallback на нативный alert/confirm — для случаев когда DialogProvider
    // ещё не примонтирован (например в тестах или SSR).
    return {
      alert:   async (t, d) => { window.alert(`${t}\n\n${typeof d === 'string' ? d : ''}`.trim()); },
      success: async (t, d) => { window.alert(`${t}\n\n${typeof d === 'string' ? d : ''}`.trim()); },
      error:   async (t, d) => { window.alert(`${t}\n\n${typeof d === 'string' ? d : ''}`.trim()); },
      warning: async (t, d) => { window.alert(`${t}\n\n${typeof d === 'string' ? d : ''}`.trim()); },
      info:    async (t, d) => { window.alert(`${t}\n\n${typeof d === 'string' ? d : ''}`.trim()); },
      confirm: async (t, d) => window.confirm(`${t}\n\n${typeof d === 'string' ? d : ''}`.trim()),
    };
  }
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<ResolvedDialog | null>(null);

  const open = useCallback((cfg: DialogConfig): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      setDialog({ ...cfg, resolve });
    });
  }, []);

  const api: DialogApi = {
    alert:   (title, description) => open({ kind: 'info',    title, description }).then(() => undefined),
    success: (title, description) => open({ kind: 'success', title, description }).then(() => undefined),
    error:   (title, description) => open({ kind: 'error',   title, description }).then(() => undefined),
    warning: (title, description) => open({ kind: 'warning', title, description }).then(() => undefined),
    info:    (title, description) => open({ kind: 'info',    title, description }).then(() => undefined),
    confirm: (title, description, opts) => open({
      kind: 'confirm',
      title,
      description,
      primaryLabel:   opts?.confirmLabel ?? 'Подтвердить',
      secondaryLabel: opts?.cancelLabel  ?? 'Отмена',
    }),
  };

  const close = (ok: boolean) => {
    if (dialog) dialog.resolve(ok);
    setDialog(null);
  };

  // ESC — закрыть как «cancel»
  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  return (
    <DialogCtx.Provider value={api}>
      {children}
      {dialog && <DialogModal dialog={dialog} onClose={close} />}
    </DialogCtx.Provider>
  );
}

function DialogModal({ dialog, onClose }: { dialog: ResolvedDialog; onClose: (ok: boolean) => void }) {
  const { kind, title, description, primaryLabel, secondaryLabel } = dialog;
  const meta = KIND_META[kind];
  const Icon = meta.Icon;
  const isConfirm = kind === 'confirm';
  const primaryText   = primaryLabel ?? (isConfirm ? 'Да' : 'OK');
  const secondaryText = secondaryLabel;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-[fadeIn_0.15s_ease-out]"
      onClick={() => onClose(false)}
    >
      <div
        className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 shadow-xl animate-[slideUp_0.2s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${meta.iconBg}`}>
          <Icon className={`w-8 h-8 ${meta.iconColor}`} strokeWidth={2.5} />
        </div>
        <h3 className="text-center text-lg font-bold text-[#0F2A36] leading-tight mb-2">
          {title}
        </h3>
        {description && (
          <div className="text-center text-sm text-gray-600 leading-relaxed mb-5">
            {description}
          </div>
        )}
        {!description && <div className="mb-2" />}

        <div className="flex flex-col gap-2 mt-2">
          <button
            onClick={() => onClose(true)}
            className={`w-full py-3 rounded-xl text-sm font-semibold active:scale-[0.98] transition ${meta.primaryBtn}`}
          >
            {primaryText}
          </button>
          {(isConfirm || secondaryText) && (
            <button
              onClick={() => onClose(false)}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 active:scale-[0.98] transition"
            >
              {secondaryText ?? 'Отмена'}
            </button>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}

const KIND_META = {
  success: {
    Icon: Check,
    iconBg: 'vd-grad',
    iconColor: 'text-white',
    primaryBtn: 'vd-grad text-white vd-shadow-cta',
  },
  error: {
    Icon: X,
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    primaryBtn: 'bg-rose-600 hover:bg-rose-700 text-white',
  },
  warning: {
    Icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    primaryBtn: 'vd-grad text-white vd-shadow-cta',
  },
  info: {
    Icon: Info,
    iconBg: 'vd-grad',
    iconColor: 'text-white',
    primaryBtn: 'vd-grad text-white vd-shadow-cta',
  },
  confirm: {
    Icon: AlertCircle,
    iconBg: 'bg-blue-100',
    iconColor: 'text-[#3B5BFF]',
    primaryBtn: 'vd-grad text-white vd-shadow-cta',
  },
} as const;
