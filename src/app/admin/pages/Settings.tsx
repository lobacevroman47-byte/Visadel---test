import React, { useState } from 'react';
import { Save, Download, DollarSign, Gift, Percent, Settings as SettingsIcon } from 'lucide-react';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState({
    // Бонус новому пользователю за регистрацию
    newUserReferralBonus: 500,
    // Бонус пользователю за каждого приглашённого
    regularUserReferralBonus: 300,
    // Бонус партнёру за приглашённого
    partnerReferralBonus: 700,
    // Максимальное использование бонусов для пользователя
    maxBonusUsageRegular: 1000,
    // Максимальное использование бонусов для партнёра
    maxBonusUsagePartner: 2000,
    bonusExpirationDays: 365,
    urgentProcessingPrice: 3000,
    hotelConfirmationPrice: 1500,
    flightBookingPrice: 2000,
  });

  const handleSave = () => {
    alert('Настройки сохранены');
  };

  const handleExport = () => {
    alert('Экспорт заявок в Excel...');
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="mb-2">Настройки</h1>
          <p className="text-sm text-gray-600">
            Общие параметры системы (доступно только владельцу)
          </p>
        </div>
        <button
          onClick={handleSave}
          className="px-6 py-3 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Save size={20} />
          Сохранить все изменения
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Referral Settings */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-[#2196F3] bg-opacity-10 rounded-lg">
              <Gift className="text-[#2196F3]" size={24} />
            </div>
            <h3>Реферальная система</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Бонус новому пользователю за регистрацию по реферальной ссылке (₽)
              </label>
              <input
                type="number"
                value={settings.newUserReferralBonus}
                onChange={(e) => setSettings({ ...settings, newUserReferralBonus: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Новый пользователь получит {settings.newUserReferralBonus} ₽ на свой бонусный счет
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Бонус пользователю за каждого приглашённого (₽)
              </label>
              <input
                type="number"
                value={settings.regularUserReferralBonus}
                onChange={(e) => setSettings({ ...settings, regularUserReferralBonus: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Пользователь получает {settings.regularUserReferralBonus} ₽ за каждого приглашённого
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Бонус партнёру за каждого приглашённого (₽)
              </label>
              <input
                type="number"
                value={settings.partnerReferralBonus}
                onChange={(e) => setSettings({ ...settings, partnerReferralBonus: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Партнёр получает {settings.partnerReferralBonus} ₽ за каждого приглашённого
              </p>
            </div>
          </div>
        </div>

        {/* Bonus Settings */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-[#00C853] bg-opacity-10 rounded-lg">
              <Percent className="text-[#00C853]" size={24} />
            </div>
            <h3>Бонусная система</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Максимальное использование бонусов для пользователя (₽)
              </label>
              <input
                type="number"
                value={settings.maxBonusUsageRegular}
                onChange={(e) => setSettings({ ...settings, maxBonusUsageRegular: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Пользователь может использовать максимум {settings.maxBonusUsageRegular} ₽ бонусов за одну операцию
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Максимальное использование бонусов для партнёра (₽)
              </label>
              <input
                type="number"
                value={settings.maxBonusUsagePartner}
                onChange={(e) => setSettings({ ...settings, maxBonusUsagePartner: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Партнёр может использовать максимум {settings.maxBonusUsagePartner} ₽ бонусов за одну операцию
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Срок действия бонусов (дней)
              </label>
              <input
                type="number"
                value={settings.bonusExpirationDays}
                onChange={(e) => setSettings({ ...settings, bonusExpirationDays: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              />
            </div>
          </div>
        </div>

        {/* Additional Services Pricing */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-[#FFC400] bg-opacity-20 rounded-lg">
              <DollarSign className="text-[#FFC400]" size={24} />
            </div>
            <h3>Дополнительные услуги</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                ⚡ Срочное оформление (₽)
              </label>
              <input
                type="number"
                value={settings.urgentProcessingPrice}
                onChange={(e) => setSettings({ ...settings, urgentProcessingPrice: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">
                🏨 Подтверждение бронирования жилья (₽)
              </label>
              <input
                type="number"
                value={settings.hotelConfirmationPrice}
                onChange={(e) => setSettings({ ...settings, hotelConfirmationPrice: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">
                ✈️ Бронирование авиабилета (₽)
              </label>
              <input
                type="number"
                value={settings.flightBookingPrice}
                onChange={(e) => setSettings({ ...settings, flightBookingPrice: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              />
            </div>
          </div>
        </div>

        {/* Export */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-[#00C853] bg-opacity-10 rounded-lg">
              <Download className="text-[#00C853]" size={24} />
            </div>
            <h3>Экспорт данных</h3>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Выгрузка всех заявок в формате Excel или CSV для анализа и отчётности
              </p>
              <button
                onClick={handleExport}
                className="w-full px-6 py-3 bg-[#00C853] hover:bg-[#00A344] text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Download size={20} />
                Экспортировать все заявки
              </button>
            </div>

            <div className="p-4 bg-[#F5F7FA] rounded-lg">
              <p className="text-xs text-gray-600">
                <strong>Включает:</strong>
              </p>
              <ul className="text-xs text-gray-600 mt-2 space-y-1">
                <li>• ID заявки, дата и время</li>
                <li>• Данные клиента</li>
                <li>• Страна и тип визы</li>
                <li>• Стоимость и использованные бонусы</li>
                <li>• Статус обработки</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="mt-6 bg-gradient-to-br from-[#2196F3] to-[#1565C0] p-6 rounded-xl text-white">
        <h3 className="mb-4 text-white">Информация о системе</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm opacity-90 mb-1">Версия системы</p>
            <p className="text-xl">v1.0.0</p>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-1">База данных</p>
            <p className="text-xl">Active</p>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-1">Последнее обновление</p>
            <p className="text-xl">01.12.2025</p>
          </div>
        </div>
      </div>

      {/* Sync Info */}
      <div className="mt-6 bg-blue-50 p-6 rounded-xl border border-blue-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <SettingsIcon size={20} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium mb-2 text-blue-900">Автоматическая синхронизация данных</p>
            <p className="text-sm text-blue-700">
              Все изменения в админ-панели (страны, типы виз, анкеты, дополнительные услуги, бонусы и лимиты) 
              автоматически применяются и синхронизируются в основном приложении без необходимости ручного дублирования данных.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};