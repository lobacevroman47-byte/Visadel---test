import React, { useEffect, useState } from 'react';
import { Save, Gift, Percent, Loader2, Settings as SettingsIcon, Package } from 'lucide-react';
import { getAppSettings, saveAppSettings, type AppSettings } from '../../lib/db';

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
