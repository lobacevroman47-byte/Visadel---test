import { Send, X } from 'lucide-react';
import { Button } from '../ui/brand';

// Имя бота из env. На test = Visadel_test_bot, на prod = Visadel_agency_bot.
const BOT_USERNAME = (import.meta.env.VITE_TG_BOT_USERNAME as string | undefined) || 'Visadel_test_bot';
const MINI_APP_NAME = (import.meta.env.VITE_TG_MINI_APP_NAME as string | undefined) || 'app';

interface OpenInTelegramModalProps {
  open: boolean;
  onClose: () => void;
  /** Что именно недоступно — для контекстного заголовка («Оформление визы», «Бронь отеля»). */
  feature?: string;
}

/**
 * Модалка-gate для веб-юзеров: показывает CTA «Откройте в Telegram» с
 * deeplink в бот. Используется когда веб-юзер пытается оформить визу /
 * бронь отеля / открыть профиль — функционал требует Telegram WebApp.
 *
 * Авиабилеты работают через веб без gate — для них модалка НЕ показывается.
 */
export default function OpenInTelegramModal({ open, onClose, feature = 'Эта функция' }: OpenInTelegramModalProps) {
  if (!open) return null;

  const tgDeeplink = `https://t.me/${BOT_USERNAME}/${MINI_APP_NAME}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4 text-[#0F2A36]/60" />
        </button>

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl vd-grad flex items-center justify-center text-white shadow-md mb-4">
          <Send className="w-7 h-7" />
        </div>

        {/* Title + description */}
        <h3 className="text-[20px] font-extrabold tracking-tight text-[#0F2A36] mb-2">
          {feature} доступна в Telegram
        </h3>
        <p className="text-sm text-[#0F2A36]/65 leading-relaxed mb-5">
          Оформление и оплата происходят через нашего Telegram-бота — там безопасный платёж,
          бонусы и push-уведомления о статусе заявки.
        </p>

        {/* CTA */}
        <a
          href={tgDeeplink}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="!py-4 !rounded-2xl !font-bold"
            leftIcon={<Send className="w-5 h-5" />}
          >
            Открыть в Telegram
          </Button>
        </a>

        <button
          onClick={onClose}
          className="w-full mt-3 py-2.5 text-sm text-[#0F2A36]/60 hover:text-[#0F2A36] transition"
        >
          Назад к каталогу
        </button>

        <p className="text-[11px] text-[#0F2A36]/45 text-center mt-3">
          Бронь авиабилетов доступна прямо на сайте — без Telegram.
        </p>
      </div>
    </div>
  );
}
