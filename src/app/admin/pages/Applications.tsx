import React, { useState, useEffect } from 'react';
import { Search, Eye, Upload, X } from 'lucide-react';
import { mockApplications, statusLabels, statusColors, Application } from '../data/mockData';

interface ApplicationsProps {
  filter?: {
    filter?: 'all' | 'in_progress';
  };
}

const ApplicationModal: React.FC<{
  application: Application;
  onClose: () => void;
}> = ({ application, onClose }) => {
  const [status, setStatus] = useState(application.status);
  const [visaFile, setVisaFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const handleSendToUser = () => {
    setSending(true);
    setTimeout(() => {
      alert(`Виза отправлена пользователю ${application.clientName}. Статус изменён на "Готово".`);
      setStatus('completed');
      setSending(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <div>
            <h2>Заявка {application.id}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {application.countryFlag} {application.country}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Client Info */}
          <div>
            <h3 className="mb-4">Информация о клиенте</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">ФИО</p>
                <p>{application.clientName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Телефон</p>
                <p>{application.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p>{application.email || 'Не указан'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Дата подачи</p>
                <p>{new Date(application.date).toLocaleDateString('ru-RU')}</p>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Стоимость</p>
              <p className="text-xl text-[#2196F3]">{application.cost.toLocaleString('ru-RU')} ₽</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Использовано бонусов</p>
              <p className="text-xl text-[#00C853]">{application.bonusesUsed} ₽</p>
            </div>
          </div>

          {/* Files */}
          <div>
            <h3 className="mb-4">Загруженные файлы</h3>
            <div className="space-y-2">
              {application.passportFile && (
                <div className="flex items-center justify-between p-3 bg-[#F5F7FA] rounded-lg">
                  <span className="text-sm">📄 Паспорт: {application.passportFile}</span>
                  <button className="text-[#2196F3] text-sm hover:underline">
                    Скачать
                  </button>
                </div>
              )}
              {application.photoFile && (
                <div className="flex items-center justify-between p-3 bg-[#F5F7FA] rounded-lg">
                  <span className="text-sm">📸 Фото: {application.photoFile}</span>
                  <button className="text-[#2196F3] text-sm hover:underline">
                    Скачать
                  </button>
                </div>
              )}
              {application.paymentScreenshot && (
                <div className="flex items-center justify-between p-3 bg-[#F5F7FA] rounded-lg">
                  <span className="text-sm">💳 Скриншот оплаты: {application.paymentScreenshot}</span>
                  <button className="text-[#2196F3] text-sm hover:underline">
                    Скачать
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm text-gray-700 mb-2">Статус заявки</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Application['status'])}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
            >
              <option value="draft">Черновик</option>
              <option value="pending_payment">Ожидает оплаты</option>
              <option value="pending_confirmation">Ожидает подтверждения</option>
              <option value="in_progress">В работе</option>
              <option value="completed">Готово</option>
            </select>
          </div>

          {/* Upload Visa */}
          {status === 'in_progress' && (
            <div>
              <label className="block text-sm text-gray-700 mb-2">Загрузить готовую визу</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="mx-auto mb-2 text-gray-400" size={32} />
                <p className="text-sm text-gray-600 mb-2">
                  Перетащите файл сюда или нажмите для выбора
                </p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setVisaFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="visa-upload"
                />
                <label
                  htmlFor="visa-upload"
                  className="inline-block px-4 py-2 bg-[#F5F7FA] text-sm rounded-lg cursor-pointer hover:bg-gray-200 transition-colors"
                >
                  Выбрать файл
                </label>
                {visaFile && (
                  <p className="text-sm text-[#00C853] mt-2">
                    Выбран файл: {visaFile.name}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                alert('Статус обновлён');
                onClose();
              }}
              className="flex-1 px-6 py-3 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-lg transition-colors"
            >
              Сохранить изменения
            </button>
            {visaFile && status === 'in_progress' && (
              <button
                onClick={handleSendToUser}
                disabled={sending}
                className="flex-1 px-6 py-3 bg-[#00C853] hover:bg-[#00A344] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {sending ? 'Отправка...' : 'Отправить пользователю'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const Applications: React.FC<ApplicationsProps> = ({ filter }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  // Применяем фильтр из Dashboard при первой загрузке
  useEffect(() => {
    if (filter?.filter === 'in_progress') {
      setStatusFilter('in_progress');
    } else if (filter?.filter === 'all') {
      setStatusFilter('all');
    }
  }, [filter]);

  const countries = Array.from(new Set(mockApplications.map(app => app.country)));

  const filteredApplications = mockApplications.filter(app => {
    const matchesSearch = app.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         app.phone.includes(searchQuery) ||
                         app.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesCountry = countryFilter === 'all' || app.country === countryFilter;
    return matchesSearch && matchesStatus && matchesCountry;
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1>Заявки</h1>
        <div className="text-sm text-gray-600">
          Всего: {filteredApplications.length} из {mockApplications.length}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Поиск по имени, телефону, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
            >
              <option value="all">Все статусы</option>
              <option value="draft">Черновик</option>
              <option value="pending_payment">Ожидает оплаты</option>
              <option value="pending_confirmation">Ожидает подтверждения</option>
              <option value="in_progress">В работе</option>
              <option value="completed">Готово</option>
            </select>
          </div>

          {/* Country Filter */}
          <div>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
            >
              <option value="all">Все страны</option>
              {countries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F7FA]">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-600">ID</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Страна</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Клиент</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Телефон</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Стоимость</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Бонусы</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Статус</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Дата</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredApplications.map((app) => (
                <tr key={app.id} className="hover:bg-[#F5F7FA]">
                  <td className="px-6 py-4 text-sm">{app.id}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="mr-2">{app.countryFlag}</span>
                    {app.country}
                  </td>
                  <td className="px-6 py-4 text-sm">{app.clientName}</td>
                  <td className="px-6 py-4 text-sm">{app.phone}</td>
                  <td className="px-6 py-4 text-sm">{app.cost.toLocaleString('ru-RU')} ₽</td>
                  <td className="px-6 py-4 text-sm text-[#00C853]">
                    {app.bonusesUsed > 0 ? `-${app.bonusesUsed} ₽` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className="px-2 py-1 rounded text-xs text-white"
                      style={{ backgroundColor: statusColors[app.status] }}
                    >
                      {statusLabels[app.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(app.date).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => setSelectedApp(app)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Просмотр заявки"
                    >
                      <Eye size={18} className="text-[#2196F3]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {selectedApp && (
        <ApplicationModal
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
        />
      )}
    </div>
  );
};