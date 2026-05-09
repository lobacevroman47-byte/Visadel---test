// Единая шапка приложения — лого + универсальные кнопки навигации справа.
// Используется во всех main-tab экранах (Home, BookingsMenu, Flights,
// ComingSoon — визы, отели, авиа, экскурсии, e-SIM и т.д.).
//
// Правая часть: <HeaderActions> читает TelegramContext и рендерит:
//   • 👤 Профиль (всегда)
//   • 👑 Партнёрский кабинет (если юзер партнёр или админ)
//   • 🛡️ Админка (если юзер админ)
//
// Кнопка текущей страницы автоматически скрывается. На main-tab экранах
// (когда currentScreenName=null) — все кнопки видны.

import { HeaderActions } from '../HeaderActions';

// onOpenProfile prop оставлен для backwards-совместимости с существующими
// вызовами, но больше НЕ используется — навигация идёт через TelegramContext.
// Можно безопасно удалить когда callers будут refactor'нуты.
interface BrandHeaderProps {
  onOpenProfile?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function BrandHeader(_props: BrandHeaderProps) {
  return (
    <div className="bg-white sticky top-0 z-10 border-b border-gray-100">
      <div className="px-5 pt-3 pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
            <path d="M3 12 L9 18 L21 6" stroke="#5C7BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[#0F2A36] font-extrabold text-[18px] tracking-tight truncate">VISADEL</span>
        </div>
        <HeaderActions />
      </div>
    </div>
  );
}
