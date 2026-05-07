import React, { useEffect, useState } from 'react';
import { Save, Gift, Percent, Loader2, Settings as SettingsIcon, Package, CreditCard, Hotel, Plane, Plus, Trash2, GripVertical } from 'lucide-react';
import { getAppSettings, saveAppSettings, type AppSettings, type ExtraFormField } from '../../lib/db';

export const Settings: React.FC = () => {
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
      alert(`Не удалось сохранить: ${e instanceof Error ? e.message : String(e)}`);
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
          <h1 className="mb-1">Настройки</h1>
          <p className="text-sm text-gray-600">
            Глобальные параметры реферальной и бонусной систем (применяются ко всем юзерам)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && !saving && (
            <span className="text-xs text-emerald-600">✓ сохранено в {savedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-[#3B5BFF] hover:bg-[#4F2FE6] disabled:opacity-60 disabled:pointer-events-none text-white rounded-lg flex items-center gap-2 select-none"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Реферальная система */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-blue-100 rounded-lg"><Gift className="text-blue-600" size={20} /></div>
            <h3>Реферальная система</h3>
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
              label="Партнёрская комиссия по умолчанию (%)"
              hint="Используется если у конкретной визы не задан свой процент. Партнёры (is_influencer=true) получают этот процент от цены визы вместо фиксированной суммы."
              value={settings.partner_commission_pct_default}
              step={0.5}
              suffix="%"
              onChange={v => set('partner_commission_pct_default', v)}
            />
          </div>
        </div>

        {/* Бонусная система */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-emerald-100 rounded-lg"><Percent className="text-emerald-600" size={20} /></div>
            <h3>Бонусная система</h3>
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
                  type="number" min={0}
                  value={settings.max_bonus_usage_partner ?? 0}
                  onChange={e => set('max_bonus_usage_partner', parseInt(e.target.value, 10) || 0)}
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
        </div>

        {/* Доп. услуги — ссылка на отдельную страницу */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 lg:col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-amber-100 rounded-lg"><Package className="text-amber-600" size={20} /></div>
            <h3>Дополнительные услуги</h3>
          </div>
          <p className="text-sm text-gray-600">
            Цены на срочное оформление, бронь отеля, билеты и пр. редактируются на отдельной странице
            <span className="mx-1 px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">Доп. услуги</span>
            в боковом меню — там же можно добавлять новые услуги, скрывать ненужные и менять иконки.
          </p>
        </div>

        {/* Реквизиты оплаты */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 lg:col-span-2">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-purple-100 rounded-lg"><CreditCard className="text-purple-600" size={20} /></div>
            <h3>Реквизиты оплаты</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Используется на всех формах: визы, бронь отеля, бронь авиабилета. Изменения подтянутся клиентам сразу.
          </p>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Номер карты</label>
            <input
              type="text" value={settings.payment_card_number}
              onChange={e => set('payment_card_number', e.target.value)}
              placeholder="5536 9140 3834 6908"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-[#5C7BFF]/40 focus:border-[#5C7BFF]"
            />
            <p className="text-xs text-gray-500 mt-1">Можно с пробелами. Клиенты копируют без пробелов автоматически.</p>
          </div>
        </div>

        {/* Бронь отеля */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-[#EAF1FF] rounded-lg"><Hotel className="text-[#3B5BFF]" size={20} /></div>
            <h3>Бронь отеля</h3>
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
        </div>

        {/* Бронь билета */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-[#EAF1FF] rounded-lg"><Plane className="text-[#3B5BFF]" size={20} /></div>
            <h3>Бронь авиабилета</h3>
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
        </div>
      </div>

      {/* System Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 p-5 rounded-xl flex items-start gap-3">
        <SettingsIcon className="text-blue-600 mt-0.5 shrink-0" size={20} />
        <div>
          <p className="text-sm font-medium text-blue-900 mb-1">Где это применяется</p>
          <ul className="text-sm text-blue-800 space-y-1 list-disc pl-5">
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
        type="number" value={value} step={step} min={0}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
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
