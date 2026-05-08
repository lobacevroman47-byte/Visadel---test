// Единая шапка приложения — лого + admin button + profile button.
// Используется во всех main-tab экранах (Home, BookingsMenu, Flights,
// ComingSoon). Admin-кнопка показывается только если в TelegramCtx
// установлена adminRole — обычные юзеры её не видят.

import { User, Shield } from 'lucide-react';
import { useTelegram } from '../../App';

interface BrandHeaderProps {
  onOpenProfile?: () => void;
}

export default function BrandHeader({ onOpenProfile }: BrandHeaderProps) {
  const { openAdmin } = useTelegram();

  return (
    <div className="bg-white sticky top-0 z-10 border-b border-gray-100">
      <div className="px-5 pt-3 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M3 12 L9 18 L21 6" stroke="#5C7BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[#0F2A36] font-extrabold text-[18px] tracking-tight">VISADEL</span>
        </div>
        <div className="flex items-center gap-2">
          {openAdmin && (
            <button
              onClick={openAdmin}
              className="w-11 h-11 rounded-full vd-grad text-white flex items-center justify-center vd-shadow-cta transition active:scale-95"
              aria-label="Админ-панель"
            >
              <Shield className="w-4 h-4" />
            </button>
          )}
          {onOpenProfile && (
            <button
              onClick={onOpenProfile}
              className="w-11 h-11 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700 transition active:scale-95"
              aria-label="Профиль"
            >
              <User className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
