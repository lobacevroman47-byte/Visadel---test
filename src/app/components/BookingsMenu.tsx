import { User, ChevronRight, Hotel, Plane, Clock } from 'lucide-react';

interface BookingsMenuProps {
  onOpenProfile?: () => void;
  onOpenHotelBooking: () => void;
}

export default function BookingsMenu({ onOpenProfile, onOpenHotelBooking }: BookingsMenuProps) {
  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-24">
      {/* Header — same shape as Home */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 pt-3 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M3 12 L9 18 L21 6" stroke="#5C7BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[#0F2A36] font-extrabold text-[18px] tracking-tight">VISADEL</span>
          </div>
          {onOpenProfile && (
            <button
              onClick={onOpenProfile}
              className="w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700 transition active:scale-95"
              aria-label="Профиль"
            >
              <User className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Hero */}
        <div className="vd-grad-soft px-5 pt-7 pb-6">
          <p className="text-center text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold">📋 Раздел</p>
          <h1 className="text-center text-[28px] leading-[1.05] tracking-tight font-extrabold text-[#0F2A36] mt-1">
            Брони <span className="vd-grad-text">для визы</span>
          </h1>
          <p className="text-center text-[13px] text-[#0F2A36]/65 mt-3 max-w-sm mx-auto leading-snug">
            Подтверждения бронирований для подачи документов в посольство
          </p>
        </div>

        {/* Services list */}
        <div className="px-4 py-5 space-y-3">
          {/* Hotel — active */}
          <button
            onClick={onOpenHotelBooking}
            className="w-full bg-white rounded-2xl border border-gray-100 hover:shadow-md active:scale-[0.99] transition-all p-4 flex items-center gap-4 text-left"
          >
            <div className="w-12 h-12 rounded-xl vd-grad flex items-center justify-center text-white shrink-0 shadow-md">
              <Hotel className="w-6 h-6" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-[#0F2A36]">Бронь отеля</p>
              <p className="text-[12px] text-[#0F2A36]/60 mt-0.5">Подтверждение для визы — приходит на email</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
          </button>

          {/* Flight ticket — coming soon */}
          <div className="w-full bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 opacity-60">
            <div className="w-12 h-12 rounded-xl bg-[#EAF1FF] flex items-center justify-center text-[#3B5BFF] shrink-0">
              <Plane className="w-6 h-6" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-[#0F2A36]">Бронь авиабилета</p>
              <p className="text-[12px] text-[#0F2A36]/60 mt-0.5">Подтверждение брони рейса для визы</p>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#3B5BFF]/60 shrink-0 flex items-center gap-1">
              <Clock className="w-3 h-3" /> скоро
            </span>
          </div>

          {/* Combo — coming soon */}
          <div className="w-full bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 opacity-60">
            <div className="w-12 h-12 rounded-xl bg-[#EAF1FF] flex items-center justify-center text-[#3B5BFF] shrink-0 text-xl">
              ⚡
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-[#0F2A36]">Срочный комплект</p>
              <p className="text-[12px] text-[#0F2A36]/60 mt-0.5">Отель + билет за час — для горящей визы</p>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#3B5BFF]/60 shrink-0 flex items-center gap-1">
              <Clock className="w-3 h-3" /> скоро
            </span>
          </div>
        </div>

        {/* Info card */}
        <div className="px-4">
          <div className="vd-grad-soft border border-blue-100 rounded-2xl px-4 py-4">
            <p className="text-[11px] uppercase tracking-widest text-[#3B5BFF] font-bold">Как это работает</p>
            <ol className="mt-2 space-y-1 text-sm text-[#0F2A36]/80 list-decimal list-inside">
              <li>Заполняешь короткую анкету</li>
              <li>Прикрепляешь скан загранпаспорта</li>
              <li>Получаешь подтверждение брони на email</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
