import React, { useState } from 'react';
import { Edit, X, Plus, Trash2 } from 'lucide-react';
import { countriesVisaData, CountryVisaData, VisaType } from '../data/countriesData';

const VisaEditModal: React.FC<{
  visa: VisaType | null;
  onClose: () => void;
  onSave: (visa: VisaType) => void;
}> = ({ visa, onClose, onSave }) => {
  const [formData, setFormData] = useState<VisaType>(
    visa || {
      id: `visa-${Date.now()}`,
      name: '',
      price: 0,
      processingTime: '',
      description: '',
      formFields: []
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2>{visa ? 'Редактировать визу' : 'Добавить визу'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-2">Название визы</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">Стоимость (₽)</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Срок готовности</label>
              <input
                type="text"
                value={formData.processingTime}
                onChange={(e) => setFormData({ ...formData, processingTime: e.target.value })}
                placeholder="3-5 дней"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Описание / Примечание</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              placeholder="Например: Пребывание - максимум 90 дней за раз"
            />
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
              onClick={onClose}
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

export const Countries: React.FC = () => {
  const [countriesData, setCountriesData] = useState<CountryVisaData[]>(countriesVisaData);
  const [editingVisa, setEditingVisa] = useState<{ countryId: string; visa: VisaType | null } | null>(null);
  const [addingCountry, setAddingCountry] = useState(false);
  const [newCountryData, setNewCountryData] = useState({ name: '', flag: '' });

  const handleSaveVisa = (visa: VisaType) => {
    if (!editingVisa) return;

    setCountriesData(prevData =>
      prevData.map(country => {
        if (country.id === editingVisa.countryId) {
          const existingIndex = country.visaTypes.findIndex(v => v.id === visa.id);
          if (existingIndex >= 0) {
            // Update existing visa
            const newVisas = [...country.visaTypes];
            newVisas[existingIndex] = visa;
            return { ...country, visaTypes: newVisas };
          } else {
            // Add new visa
            return { ...country, visaTypes: [...country.visaTypes, visa] };
          }
        }
        return country;
      })
    );
  };

  const handleDeleteVisa = (countryId: string, visaId: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту визу?')) return;

    setCountriesData(prevData =>
      prevData.map(country => {
        if (country.id === countryId) {
          return { ...country, visaTypes: country.visaTypes.filter(v => v.id !== visaId) };
        }
        return country;
      })
    );
  };

  const handleAddCountry = () => {
    setAddingCountry(true);
  };

  const handleSaveCountry = () => {
    if (!newCountryData.name || !newCountryData.flag) return;

    const newCountry: CountryVisaData = {
      id: `country-${Date.now()}`,
      name: newCountryData.name,
      flag: newCountryData.flag,
      visaTypes: []
    };

    setCountriesData(prevData => [...prevData, newCountry]);
    setAddingCountry(false);
    setNewCountryData({ name: '', flag: '' });
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1>Страны и визы</h1>
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-600">Всего стран: {countriesData.length}</p>
          <button
            onClick={handleAddCountry}
            className="px-6 py-3 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            Добавить страну
          </button>
        </div>
      </div>

      {/* Countries List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {countriesData.map((country) => (
          <div key={country.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-[#2196F3] to-[#1565C0]">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{country.flag}</span>
                <h3 className="text-white">{country.name}</h3>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm text-gray-600">Типы виз ({country.visaTypes.length})</h4>
                <button
                  onClick={() => setEditingVisa({ countryId: country.id, visa: null })}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Добавить визу"
                >
                  <Plus size={18} className="text-[#2196F3]" />
                </button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {country.visaTypes.map((visa) => (
                  <div
                    key={visa.id}
                    className="p-4 bg-[#F5F7FA] rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm">{visa.name}</p>
                        <p className="text-lg text-[#2196F3] mt-1">{visa.price.toLocaleString('ru-RU')} ₽</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingVisa({ countryId: country.id, visa })}
                          className="p-1 hover:bg-white rounded transition-colors"
                        >
                          <Edit size={14} className="text-[#2196F3]" />
                        </button>
                        <button
                          onClick={() => handleDeleteVisa(country.id, visa.id)}
                          className="p-1 hover:bg-white rounded transition-colors"
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    </div>
                    
                    {visa.description && (
                      <p className="text-xs text-gray-600 mb-2">{visa.description}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                      <span className="bg-white px-2 py-1 rounded">⏱️ {visa.processingTime}</span>
                      <span className="bg-white px-2 py-1 rounded">📝 {visa.formFields.length} полей</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Country Modal */}
      {addingCountry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2>Добавить страну</h2>
              <button onClick={() => setAddingCountry(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveCountry(); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Название страны</label>
                <input
                  type="text"
                  value={newCountryData.name}
                  onChange={(e) => setNewCountryData({ ...newCountryData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
                  placeholder="Например: Таиланд"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Флаг страны (эмодзи)</label>
                <input
                  type="text"
                  value={newCountryData.flag}
                  onChange={(e) => setNewCountryData({ ...newCountryData, flag: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
                  placeholder="🇹🇭"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-lg transition-colors"
                >
                  Добавить страну
                </button>
                <button
                  type="button"
                  onClick={() => setAddingCountry(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visa Edit Modal */}
      {editingVisa && (
        <VisaEditModal
          visa={editingVisa.visa}
          onClose={() => setEditingVisa(null)}
          onSave={handleSaveVisa}
        />
      )}
    </div>
  );
};