import React, { useEffect, useState } from 'react';
import { Save, Gift, Percent, Loader2, CreditCard, Hotel, Plane, Wrench } from 'lucide-react';
import { getAppSettings, saveAppSettings, type AppSettings } from '../../lib/db';
import { useDialog } from '../../components/shared/BrandDialog';
import { Button, Card } from '../../components/ui/brand';

export const Settings: React.FC = () => {
  const dialog = useDialog();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    getAppSettings()
      .then(s => { if (alive) setSettings(s); })
      .catch(e => { console.warn('settings load error', e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => {
    setSettings(prev => prev ? { ...prev, [k]: v } : prev);
  };

  const handleSave = async () => {
    if (!settings || saving) return;
    setSaving(true);
    try {
      const { id: _id, updated_at: _ts, ...rest } = settings;
      void _id; void _ts;
      await saveAppSettings(rest);
      setSavedAt(new Date());
    } catch (e) {
      await dialog.error('Не удалось сохранить', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-8">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36] mb-1">Настройки</h1>
          <p className="text-sm text-[#0F2A36]/65">
            Глобальные параметры реферальной и бонусной систем (применяются ко всем юзерам)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && !saving && (
            <span className="text-xs text-emerald-600">✓ сохранено в {savedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSave}
            loading={saving}
            leftIcon={!saving ? <Save size={18} /> : undefined}
          >
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Реферальная система */}
        <Card variant="flat" padding="lg" radius="xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-[#EAF1FF] rounded-lg"><Gift className="text-[#3B5BFF]" size={20} /></div>
            <h3 className="text-base font-bold text-[#0F2A36]">Реферальная система</h3>
          </div>
          <div className="space-y-4">
            <NumberRow
              label="Welcome-бонус новичку (по реф. ссылке)"
              hint="Сколько ₽ зачисляется юзеру когда он регистрируется по реферальной ссылке"
              value={settings.new_user_welcome_bonus}
              onChange={v => set('new_user_welcome_bonus', v)}
            />
            <NumberRow
              label="Бонус реферреру (обычный, фикс)"
              hint="Сколько ₽ получает обычный реферрер за приглашённого, когда тот оплатит первую визу"
              value={settings.referrer_regular_bonus}
              onChange={v => set('referrer_regular_bonus', v)}
            />
            <NumberRow
              label="Партнёрская комиссия с виз по умолчанию (%)"
              hint="Используется если у конкретной визы не задан свой процент. Партнёры (is_influencer=true) получают этот процент от цены визы вместо фиксированной суммы."
              value={settings.partner_commission_pct_default}
              step={0.5}
              suffix="%"
              onChange={v => set('partner_commission_pct_default', v)}
            />
            <NumberRow
              label="Партнёрская комиссия с броней отелей (%)"
              hint="Применяется к hotel_bookings когда админ переводит бронь в «Готово». Используется если у конкретной брони не задан свой процент."
              value={settings.hotel_partner_pct_default ?? 20}
              step={0.5}
              suffix="%"
              onChange={v => set('hotel_partner_pct_default', v)}
            />
            <NumberRow
              label="Партнёрская комиссия с броней авиабилетов (%)"
              hint="Применяется к flight_bookings когда админ переводит бронь в «Готово»."
              value={settings.flight_partner_pct_default ?? 10}
              step={0.5}
              suffix="%"
              onChange={v => set('flight_partner_pct_default', v)}
            />
          </div>
        </Card>

        {/* Бонусная система */}
        <Card variant="flat" padding="lg" radius="xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-emerald-100 rounded-lg"><Percent className="text-emerald-600" size={20} /></div>
            <h3 className="text-base font-bold text-[#0F2A36]">Бонусная система</h3>
          </div>
          <div className="space-y-4">
            <NumberRow
              label="Макс. списание бонусов на одну заявку (обычный юзер)"
              hint="Сколько ₽ максимум юзер может применить как скидку при оплате визы. Базовый лимит, апгрейдится через уровни рефералки."
              value={settings.max_bonus_usage_regular}
              onChange={v => set('max_bonus_usage_regular', v)}
            />
            <PartnerBonusLimitRow
              value={settings.max_bonus_usage_partner}
              onChange={v => set('max_bonus_usage_partner', v)}
            />
          </div>
        </Card>

        {/* Реквизиты оплаты */}
        <Card variant="flat" padding="lg" radius="xl" className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-purple-100 rounded-lg"><CreditCard className="text-purple-600" size={20} /></div>
            <h3 className="text-base font-bold text-[#0F2A36]">Реквизиты оплаты</h3>
          </div>
          <p className="text-sm text-[#0F2A36]/65 mb-4">
            Используется на всех формах: визы, бронь отеля, бронь авиабилета. Изменения подтянутся клиентам сразу.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#0F2A36] mb-1">Номер карты</label>
              <input
                type="text" value={settings.payment_card_number}
                onChange={e => set('payment_card_number', e.target.value)}
                placeholder="5536 9140 3834 6908"
                className="w-full px-3 py-2.5 border border-[#E1E5EC] rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]/20 focus:border-[#3B5BFF]"
              />
              <p className="text-xs text-[#0F2A36]/45 mt-1">Можно с пробелами. Клиенты копируют без пробелов автоматически.</p>
            </div>
            <div>
              <label className="block text-sm text-[#0F2A36] mb-1">ФИО получателя</label>
              <input
                type="text" value={settings.payment_card_holder ?? ''}
                onChange={e => set('payment_card_holder', e.target.value)}
                placeholder="Иван И."
                className="w-full px-3 py-2.5 border border-[#E1E5EC] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]/20 focus:border-[#3B5BFF]"
              />
              <p className="text-xs text-[#0F2A36]/45 mt-1">Имя и инициал — как в банке. Если пусто — клиенту покажется только номер карты.</p>
            </div>
          </div>
        </Card>

        {/* Бронь отеля */}
        <Card variant="flat" padding="lg" radius="xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-[#EAF1FF] rounded-lg"><Hotel className="text-[#3B5BFF]" size={20} /></div>
            <h3 className="text-base font-bold text-[#0F2A36]">Бронь отеля (внутри визы)</h3>
          </div>
          <NumberRow
            label="Цена услуги"
            hint="Стоимость, которую клиент платит за подтверждение брони отеля как доп. услуги к визе. По умолчанию 1000 ₽."
            value={settings.hotel_booking_price}
            onChange={v => set('hotel_booking_price', v)}
          />
          <FormBuilderHint />
        </Card>

        {/* Бронь билета */}
        <Card variant="flat" padding="lg" radius="xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-[#EAF1FF] rounded-lg"><Plane className="text-[#3B5BFF]" size={20} /></div>
            <h3 className="text-base font-bold text-[#0F2A36]">Бронь авиабилета (внутри визы)</h3>
          </div>
          <NumberRow
            label="Цена услуги"
            hint="Стоимость, которую клиент платит за подтверждение брони рейса как доп. услуги к визе."
            value={settings.flight_booking_price}
            onChange={v => set('flight_booking_price', v)}
          />
          <FormBuilderHint />
        </Card>
      </div>
    </div>
  );
};

const NumberRow: React.FC<{
  label: string;
  hint?: string;
  value: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}> = ({ label, hint, value, step = 1, suffix = '₽', onChange }) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label}</label>
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode={step < 1 ? 'decimal' : 'numeric'}
        value={value === 0 ? '' : value}
        onChange={e => {
          const v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
          onChange(v === '' ? 0 : parseFloat(v) || 0);
        }}
        placeholder="0"
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <span className="text-sm text-gray-500 w-6 text-center">{suffix}</span>
    </div>
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
);

const PartnerBonusLimitRow: React.FC<{
  value: number | null;
  onChange: (v: number | null) => void;
}> = ({ value, onChange }) => {
  const unlimited = value === null;
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-2">Макс. списание бонусов на заявку (партнёр)</label>
      <div className="flex items-stretch rounded-lg border border-gray-300 overflow-hidden mb-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => onChange(value ?? 1000)}
          className={`flex-1 py-2 transition ${!unlimited ? 'bg-[#3B5BFF] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
        >
          Установить лимит
        </button>
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`flex-1 py-2 transition ${unlimited ? 'bg-emerald-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
        >
          Без лимита (100%)
        </button>
      </div>
      {!unlimited && (
        <div className="flex items-center gap-2">
          <input
            type="text" inputMode="numeric" pattern="[0-9]*"
            value={(value ?? 0) === 0 ? '' : value ?? ''}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '');
              onChange(v === '' ? 0 : parseInt(v, 10));
            }}
            placeholder="0"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
          />
          <span className="text-sm text-gray-500 w-6 text-center">₽</span>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-1">
        {unlimited
          ? 'Партнёры могут применить весь свой баланс — до 100% от цены визы'
          : `Партнёр может применить максимум ${value ?? 0}₽ на заявку`}
      </p>
    </div>
  );
};

const FormBuilderHint: React.FC = () => (
  <div className="mt-4 flex items-start gap-2 bg-[#EAF1FF] border border-[#5C7BFF]/25 rounded-lg p-3">
    <Wrench className="w-4 h-4 text-[#3B5BFF] mt-0.5 shrink-0" />
    <p className="text-xs text-[#0F2A36]/75 leading-relaxed">
      Поля анкеты, переименование и видимость стандартных полей — редактируются в разделе{' '}
      <span className="font-semibold text-[#3B5BFF]">«Конструктор форм»</span> в боковом меню.
    </p>
  </div>
);
