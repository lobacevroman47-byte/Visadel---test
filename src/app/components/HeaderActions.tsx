// Универсальные правые кнопки header'а — показываются во всех кабинетах
// (Профиль, Админка, Партнёрский кабинет). Кружочки 36px с иконкой.
//
// Порядок слева направо: [Партнёр] [Админка] [Профиль]
//   • Профиль ВСЕГДА последний (самая правая позиция — главный CTA)
//   • Админка слева от Профиля (если adminRole)
//   • Партнёр самый левый (если is_influencer или admin)
//
// Логика отображения:
//   • Профиль   — всегда (если openProfile задан и не на странице профиля)
//   • Админка   — если adminRole задан И не на админке
//   • Партнёр   — если openPartner задан (юзер партнёр или админ) И не на партнёрском кабинете
//
// Цвета сочетаются с brand-палитрой:
//   • Профиль:  серый круг (нейтральная навигация)
//   • Админка:  тёмно-синий vd-grad (премиум-доступ)
//   • Партнёр:  янтарный (как корона партнёра в дизайне)

import { useTelegram } from '../App';
import { User, Crown, Shield } from 'lucide-react';

export function HeaderActions() {
  const { adminRole, openAdmin, openProfile, openPartner, currentScreenName } = useTelegram();

  const showProfile = openProfile && currentScreenName !== 'profile';
  const showAdmin   = adminRole && openAdmin && currentScreenName !== 'admin';
  const showPartner = openPartner && currentScreenName !== 'partner_dashboard';

  // Если ничего не показываем — рендерим spacer той же ширины что было
  // (w-9), чтобы flexbox с justify-between не съезжал.
  if (!showProfile && !showAdmin && !showPartner) {
    return <span className="w-9" aria-hidden />;
  }

  // Order LEFT → RIGHT: [Партнёр] [Админка] [Профиль].
  // Профиль самый правый — главный CTA.
  return (
    <div className="flex items-center gap-1.5">
      {showPartner && (
        <button
          onClick={openPartner}
          className="w-9 h-9 rounded-full bg-amber-100 hover:bg-amber-200 flex items-center justify-center text-amber-700 transition active:scale-95"
          aria-label="Партнёрский кабинет"
          title="Партнёрский кабинет"
        >
          <Crown className="w-4 h-4" />
        </button>
      )}
      {showAdmin && (
        <button
          onClick={openAdmin}
          className="w-9 h-9 rounded-full vd-grad flex items-center justify-center text-white transition active:scale-95 vd-shadow-cta"
          aria-label="Админка"
          title="Админка"
        >
          <Shield className="w-4 h-4" />
        </button>
      )}
      {showProfile && (
        <button
          onClick={openProfile}
          className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition active:scale-95"
          aria-label="Личный кабинет"
          title="Личный кабинет"
        >
          <User className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
