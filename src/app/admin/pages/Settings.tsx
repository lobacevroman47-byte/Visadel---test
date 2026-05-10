import React, { useEffect, useState } from 'react';
import { Save, Gift, Percent, Loader2, Settings as SettingsIcon, Package, CreditCard, Hotel, Plane, Plus, Trash2, GripVertical } from 'lucide-react';
import { getAppSettings, saveAppSettings, type AppSettings, type ExtraFormField } from '../../lib/db';
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
            <div>
              <label className="flex items-center justify-between text-sm text-gray-700 mb-1">
                <span>Макс. списание бонусов на заявку (партнёр)</span>
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={settings.max_bonus_usage_partner === null}
                    onChange={e => set('max_bonus_usage_partner', e.target.checked ? null : 1000)}
                    className="accent-emerald-500"
                  />
                  без лимита (100%)
                </label>
              </label>
              {settings.max_bonus_usage_partner !== null && (
                <input
                  type="text" inputMode="numeric" pattern="[0-9]*"
                  value={(settings.max_bonus_usage_partner ?? 0) === 0 ? '' : settings.max_bonus_usage_partner}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '');
                    set('max_bonus_usage_partner', v === '' ? 0 : parseInt(v, 10));
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              )}
              <p className="text-xs text-gray-500 mt-1">
                {settings.max_bonus_usage_partner === null
                  ? 'Партнёры могут применить весь свой баланс — до 100% от цены визы'
                  : `Партнёр может применить максимум ${settings.max_bonus_usage_partner ?? 0}₽ на заявку`}
              </p>
            </div>
            <NumberRow
              label="Срок жизни бонусов (дней)"
              hint="Через сколько дней бонусы сгорают. ⚠️ В коде сейчас expiration не реализован — это поле для будущего."
              value={settings.bonus_expiration_days}
              onChange={v => set('bonus_expiration_days', v)}
            />
          </div>
        </Card>

        {/* Доп. услуги — ссылка на отдельную страницу */}
        <Card variant="flat" padding="lg" radius="xl" className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-amber-100 rounded-lg"><Package className="text-amber-600" size={20} /></div>
            <h3 className="text-base font-bold text-[#0F2A36]">Дополнительные услуги</h3>
          </div>
          <p className="text-sm text-[#0F2A36]/65">
            Цены на срочное оформление, бронь отеля, билеты и пр. редактируются на отдельной странице
            <span className="mx-1 px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">Доп. услуги</span>
            в боковом меню — там же можно добавлять новые услуги, скрывать ненужные и менять иконки.
          </p>
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
        </Card>

        {/* Бронь отеля */}
        <Card variant="flat" padding="lg" radius="xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-[#EAF1FF] rounded-lg"><Hotel className="text-[#3B5BFF]" size={20} /></div>
            <h3 className="text-base font-bold text-[#0F2A36]">Бронь отеля</h3>
          </div>
          <NumberRow
            label="Цена услуги"
            hint="Стоимость, которую клиент платит за подтверждение брони отеля. По умолчанию 1000 ₽."
            value={settings.hotel_booking_price}
            onChange={v => set('hotel_booking_price', v)}
          />
          <ExtraFieldsEditor
            title="Дополнительные поля анкеты"
            value={settings.hotel_extra_fields ?? []}
            onChange={v => set('hotel_extra_fields', v)}
          />
        </Card>

        {/* Бронь билета */}
        <Card variant="flat" padding="lg" radius="xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-[#EAF1FF] rounded-lg"><Plane className="text-[#3B5BFF]" size={20} /></div>
            <h3 className="text-base font-bold text-[#0F2A36]">Бронь авиабилета</h3>
          </div>
          <NumberRow
            label="Цена услуги"
            hint="Стоимость, которую клиент платит за подтверждение брони рейса"
            value={settings.flight_booking_price}
            onChange={v => set('flight_booking_price', v)}
          />
          <ExtraFieldsEditor
            title="Дополнительные поля анкеты"
            value={settings.flight_extra_fields ?? []}
            onChange={v => set('flight_extra_fields', v)}
          />
        </Card>
      </div>

      {/* System Info */}
      <div className="mt-6 bg-[#EAF1FF] border border-[#5C7BFF]/30 p-5 rounded-xl flex items-start gap-3">
        <SettingsIcon className="text-[#3B5BFF] mt-0.5 shrink-0" size={20} />
        <div>
          <p className="text-sm font-medium text-[#0F2A36] mb-1">Где это применяется</p>
          <ul className="text-sm text-[#0F2A36]/70 space-y-1 list-disc pl-5">
            <li>Welcome-бонус — при создании нового юзера через реферальную ссылку</li>
            <li>Бонус реферреру — когда админ переводит заявку реферала в «В работе»</li>
            <li>Партнёрская % — для виз без своего <code className="text-xs bg-white px-1 rounded">partner_commission_pct</code></li>
            <li>Лимиты бонусов на заявку — на странице оплаты визы</li>
          </ul>
        </div>
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

const ExtraFieldsEditor: React.FC<{
  title: string;
  value: ExtraFormField[];
  onChange: (v: ExtraFormField[]) => void;
}> = ({ title, value, onChange }) => {
  const addField = () => {
    onChange([
      ...value,
      { id: Math.random().toString(36).slice(2, 10), label: '', type: 'text', required: false },
    ]);
  };

  const updateField = (idx: number, patch: Partial<ExtraFormField>) => {
    onChange(value.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeField = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= value.length) return;
    const arr = [...value];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    onChange(arr);
  };

  return (
    <div className="mt-5 pt-5 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        <span className="text-xs text-gray-400">{value.length} {value.length === 1 ? 'поле' : 'полей'}</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Эти поля появятся внизу анкеты у клиента, перед оплатой.
      </p>

      {value.length === 0 ? (
        <div className="text-center py-5 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-xs text-gray-400 mb-2">Пока нет дополнительных полей</p>
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((f, idx) => {
            const needsOptions = f.type === 'select' || f.type === 'radio';
            return (
            <div key={f.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-start gap-2 mb-2">
                <div className="flex flex-col gap-0.5 pt-1.5">
                  <button type="button" onClick={() => moveField(idx, -1)} disabled={idx === 0}
                    className="text-gray-400 hover:text-[#3B5BFF] disabled:opacity-30 disabled:cursor-not-allowed">
                    <GripVertical size={14} />
                  </button>
                </div>
                <input
                  type="text"
                  value={f.label}
                  onChange={e => updateField(idx, { label: e.target.value })}
                  placeholder="Название поля (например: Авиакомпания)"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#5C7BFF]"
                />
                <button type="button" onClick={() => removeField(idx)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap pl-6">
                <select
                  value={f.type}
                  onChange={e => updateField(idx, { type: e.target.value as ExtraFormField['type'] })}
                  className="px-2 py-1 text-xs border border-gray-200 rounded-md bg-white"
                >
                  <option value="text">Текст</option>
                  <option value="textarea">Длинный текст</option>
                  <option value="number">Число</option>
                  <option value="date">Дата</option>
                  <option value="select">Выпадающий список</option>
                  <option value="radio">Радио-кнопки</option>
                  <option value="checkbox">Чекбокс (да/нет)</option>
                  <option value="file">Файл</option>
                </select>
                {f.type !== 'checkbox' && f.type !== 'file' && (
                  <input
                    type="text"
                    value={f.placeholder ?? ''}
                    onChange={e => updateField(idx, { placeholder: e.target.value })}
                    placeholder="Подсказка"
                    className="flex-1 min-w-[120px] px-2 py-1 text-xs border border-gray-200 rounded-md"
                  />
                )}
                <label className="text-xs text-gray-600 flex items-center gap-1 select-none">
                  <input
                    type="checkbox" checked={f.required}
                    onChange={e => updateField(idx, { required: e.target.checked })}
                    className="accent-[#3B5BFF]"
                  />
                  Обязательное
                </label>
              </div>
              {needsOptions && (
                <div className="mt-2 pl-6">
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Варианты (по одному в строке)</label>
                  <textarea
                    value={(f.options ?? []).join('\n')}
                    onChange={e => updateField(idx, { options: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                    rows={3}
                    placeholder="Эконом&#10;Бизнес&#10;Первый класс"
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white resize-none focus:outline-none focus:border-[#5C7BFF]"
                  />
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      <button type="button" onClick={addField}
        className="mt-3 w-full py-2 border-2 border-dashed border-gray-200 hover:border-[#5C7BFF] hover:bg-[#EAF1FF] text-sm text-[#3B5BFF] font-semibold rounded-lg transition flex items-center justify-center gap-1">
        <Plus size={14} strokeWidth={2.5} />
        Добавить поле
      </button>
    </div>
  );
};
