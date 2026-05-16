import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';

export const AdminLogin: React.FC = () => {
  const { loginWithTelegram } = useAdmin();
  const [state, setState] = useState<'checking' | 'denied'>('checking');

  // Auth flow:
  //   1. mount → пробуем auto-login через Telegram initData
  //   2a. id в ADMIN_TELEGRAM_IDS → success → AdminApp монтирует панель
  //   2b. id отсутствует / не в списке → показываем "доступ только админам"
  // Старого password-gate больше нет (хеш в bundle = P1 уязвимость).
  useEffect(() => {
    loginWithTelegram().then(success => {
      if (!success) setState('denied');
    });
  }, [loginWithTelegram]);

  if (state === 'checking') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#3B5BFF] to-[#4F2FE6] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  // denied
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3B5BFF] to-[#4F2FE6] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-[#FFEAEA] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldX className="w-8 h-8 text-[#E63B3B]" />
        </div>
        <h1 className="text-xl font-semibold text-[#0F2A36] mb-2">Доступ запрещён</h1>
        <p className="text-[#0F2A36]/60 text-sm mb-6">
          Админка доступна только из Telegram-аккаунта администратора.
          Открой её через бота с админского аккаунта.
        </p>

        <div className="bg-[#F5F7FB] rounded-xl p-4 text-left">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#3B5BFF] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#0F2A36]/70 leading-relaxed">
              Если ты администратор — твой Telegram-ID должен быть в списке
              <code className="mx-1 px-1 py-0.5 bg-white rounded text-[10px]">VITE_ADMIN_TELEGRAM_IDS</code>
              на Vercel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
