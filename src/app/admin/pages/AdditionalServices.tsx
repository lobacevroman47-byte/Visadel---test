import React, { useState } from 'react';
import { Settings, Plus, Edit, Trash2, Save } from 'lucide-react';
import { defaultAdditionalServices, AdditionalService } from '../data/additionalServices';

const ServiceEditor: React.FC<{
  service: AdditionalService | null;
  onSave: (service: AdditionalService) => void;
  onCancel: () => void;
}> = ({ service, onSave, onCancel }) => {
  const [formData, setFormData] = useState<AdditionalService>(
    service || {
      id: `service-${Date.now()}`,
      name: '',
      icon: '',
      description: '',
      price: 0,
      enabled: true
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full">
        <div className="p-6 border-b border-gray-200">
          <h2>{service ? 'Редактировать услугу' : 'Добавить услугу'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">Название услуги *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
                placeholder="Срочное оформление"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Иконка (эмодзи) *</label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
                placeholder="⚡"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Описание</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              placeholder="Краткое описание услуги"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Стоимость (₽) *</label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 text-[#2196F3] rounded focus:ring-[#2196F3]"
            />
            <label htmlFor="enabled" className="text-sm text-gray-700 cursor-pointer">
              Включена (отображается пользователям)
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-lg transition-colors"
            >
              Сохранить
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const AdditionalServices: React.FC = () => {
  const [services, setServices] = useState<AdditionalService[]>(defaultAdditionalServices);
  const [editingService, setEditingService] = useState<AdditionalService | null>(null);

  const handleSaveService = (service: AdditionalService) => {
    const existingIndex = services.findIndex(s => s.id === service.id);
    
    if (existingIndex >= 0) {
      // Update existing service
      const newServices = [...services];
      newServices[existingIndex] = service;
      setServices(newServices);
    } else {
      // Add new service
      setServices([...services, service]);
    }
    
    setEditingService(null);
  };

  const handleDeleteService = (serviceId: string) => {
    if (confirm('Вы уверены, что хотите удалить эту услугу?')) {
      setServices(services.filter(s => s.id !== serviceId));
    }
  };

  const handleToggleEnabled = (serviceId: string) => {
    setServices(services.map(s => 
      s.id === serviceId ? { ...s, enabled: !s.enabled } : s
    ));
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1>Дополнительные услуги</h1>
          <p className="text-sm text-gray-600 mt-2">
            Управление дополнительными услугами для усиления заявок
          </p>
        </div>
        <button
          onClick={() => setEditingService({
            id: `service-${Date.now()}`,
            name: '',
            icon: '',
            description: '',
            price: 0,
            enabled: true
          })}
          className="px-6 py-3 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Добавить услугу
        </button>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {services.map((service) => (
          <div
            key={service.id}
            className={`bg-white rounded-xl border-2 transition-all h-full flex flex-col ${
              service.enabled 
                ? 'border-[#00C853] shadow-sm' 
                : 'border-gray-200 opacity-60'
            }`}
          >
            {/* Card Header - Fixed height */}
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl flex-shrink-0">{service.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium mb-1.5 leading-snug">{service.name}</p>
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{service.description}</p>
                </div>
              </div>

              <div className="mt-auto pt-3">
                <p className="text-xl text-[#2196F3] font-medium">{service.price.toLocaleString('ru-RU')} ₽</p>
              </div>
            </div>

            {/* Card Footer - Fixed Height */}
            <div className="p-5 pt-0 space-y-2.5">
              <button
                onClick={() => handleToggleEnabled(service.id)}
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  service.enabled
                    ? 'bg-[#00C853] text-white hover:bg-[#00A344] shadow-sm'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {service.enabled ? '✓ Включена' : 'Выключена'}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setEditingService(service)}
                  className="flex-1 px-3 py-2 bg-[#F5F7FA] hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Edit size={15} />
                  Редактировать
                </button>
                <button
                  onClick={() => handleDeleteService(service.id)}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info Block */}
      <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
        <div className="flex items-start gap-3">
          <Settings size={24} className="text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <p className="font-medium mb-2">Автоматическая синхронизация</p>
            <p className="text-sm text-gray-700">
              Все изменения автоматически отображаются в пользовательском интерфейсе. 
              Включенные услуги будут доступны при оформлении визы, выключенные — скрыты.
            </p>
          </div>
        </div>
      </div>

      {/* Service Editor Modal */}
      {editingService && (
        <ServiceEditor
          service={editingService}
          onSave={handleSaveService}
          onCancel={() => setEditingService(null)}
        />
      )}
    </div>
  );
};