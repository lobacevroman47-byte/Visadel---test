import React, { useState } from 'react';
import { Plus, GripVertical, Edit, Trash2, Save, Settings, Image } from 'lucide-react';
import { countriesVisaData, FormField, VisaType, CountryVisaData, PhotoRequirement } from '../data/countriesData';
import { defaultAdditionalServices, AdditionalService } from '../data/additionalServices';
import { countryPhotoRequirements } from '../data/photoRequirements';

const PhotoEditor: React.FC<{
  photo: PhotoRequirement | null;
  onSave: (photo: PhotoRequirement) => void;
  onCancel: () => void;
}> = ({ photo, onSave, onCancel }) => {
  const [formData, setFormData] = useState<PhotoRequirement>(
    photo || {
      id: `photo-${Date.now()}`,
      label: '',
      key: '',
      required: false,
      requirements: '',
      formats: 'JPG/PNG/PDF',
      maxSize: '5MB'
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2>{photo ? 'Редактировать фотографию' : 'Добавить фотографию'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-2">Название поля *</label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              placeholder="Фото лица"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Ключ (для базы данных) *</label>
            <input
              type="text"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              placeholder="face_photo"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Требования / Описание</label>
            <textarea
              value={formData.requirements || ''}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              placeholder="Светлый фон, можно на телефон, ~80% лица, без очков"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">Форматы файлов</label>
              <input
                type="text"
                value={formData.formats || ''}
                onChange={(e) => setFormData({ ...formData, formats: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
                placeholder="JPG/PNG/PDF"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Макс. размер</label>
              <input
                type="text"
                value={formData.maxSize || ''}
                onChange={(e) => setFormData({ ...formData, maxSize: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
                placeholder="5MB"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Скрывать при выборе услуги (ID)</label>
            <input
              type="text"
              value={formData.hideIfServiceSelected || ''}
              onChange={(e) => setFormData({ ...formData, hideIfServiceSelected: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              placeholder="hotel-booking"
            />
            <p className="text-xs text-gray-500 mt-1">
              Если заполнено, поле скрывается при выборе указанной дополнительной услуги
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="photo-required"
              checked={formData.required}
              onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
              className="w-4 h-4 text-[#2196F3] rounded focus:ring-[#2196F3]"
            />
            <label htmlFor="photo-required" className="text-sm text-gray-700 cursor-pointer">
              Обязательное поле
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

const FieldEditor: React.FC<{
  field: FormField | null;
  onSave: (field: FormField) => void;
  onCancel: () => void;
}> = ({ field, onSave, onCancel }) => {
  const [formData, setFormData] = useState<FormField>(
    field || {
      id: `field-${Date.now()}`,
      label: '',
      key: '',
      type: 'text',
      required: false,
      placeholder: '',
      comment: ''
    }
  );

  const [optionInput, setOptionInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleAddOption = () => {
    if (optionInput.trim()) {
      setFormData({
        ...formData,
        options: [...(formData.options || []), optionInput.trim()]
      });
      setOptionInput('');
    }
  };

  const handleRemoveOption = (index: number) => {
    setFormData({
      ...formData,
      options: formData.options?.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2>{field ? 'Редактировать поле' : 'Добавить поле'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-2">Название поля *</label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              placeholder="Например: Гражданство:"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">Ключ поля *</label>
              <input
                type="text"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value.replace(/\s/g, '_') })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
                placeholder="field_name"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Тип поля *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as FormField['type'] })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              >
                <option value="text">Текст</option>
                <option value="email">Email</option>
                <option value="tel">Телефон</option>
                <option value="date">Дата</option>
                <option value="file">Файл</option>
                <option value="select">Выбор из списка (select)</option>
                <option value="radio">Переключатель (radio)</option>
                <option value="textarea">Многострочный текст</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="required"
              checked={formData.required}
              onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
              className="w-4 h-4 text-[#2196F3] rounded focus:ring-[#2196F3]"
            />
            <label htmlFor="required" className="text-sm text-gray-700 cursor-pointer">
              Обязательное поле
            </label>
          </div>

          {formData.type !== 'file' && formData.type !== 'select' && formData.type !== 'radio' && (
            <div>
              <label className="block text-sm text-gray-700 mb-2">Placeholder</label>
              <input
                type="text"
                value={formData.placeholder || ''}
                onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
                placeholder="Подсказка для пользователя"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-700 mb-2">Комментарий / Подсказка</label>
            <textarea
              value={formData.comment || ''}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              placeholder="Дополнительная информация для пользователя"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Предупреждение (если требуется)</label>
            <textarea
              value={formData.warning || ''}
              onChange={(e) => setFormData({ ...formData, warning: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              placeholder="Например: ❗Важное предупреждение для пользователя"
            />
          </div>

          {(formData.type === 'select' || formData.type === 'radio') && (
            <div>
              <label className="block text-sm text-gray-700 mb-2">Варианты выбора</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOption();
                    }
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
                  placeholder="Введите вариант"
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="px-4 py-2 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-lg transition-colors"
                >
                  Добавить
                </button>
              </div>
              <div className="space-y-1">
                {formData.options?.map((option, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-[#F5F7FA] rounded"
                  >
                    <span className="text-sm">{option}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                    >
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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

export const FormBuilder: React.FC = () => {
  const [countries, setCountries] = useState<CountryVisaData[]>(countriesVisaData);
  const [selectedCountry, setSelectedCountry] = useState(countriesVisaData[0]);
  const [selectedVisaType, setSelectedVisaType] = useState<VisaType>(countriesVisaData[0].visaTypes[0]);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<PhotoRequirement | null>(null);
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null);
  const [photoRequirements, setPhotoRequirements] = useState<PhotoRequirement[]>(
    countryPhotoRequirements[selectedCountry.id] || []
  );

  const currentFields = selectedVisaType.formFields;

  const handleSaveField = (field: FormField) => {
    setCountries(prevCountries =>
      prevCountries.map(country => {
        if (country.id === selectedCountry.id) {
          return {
            ...country,
            visaTypes: country.visaTypes.map(visa => {
              if (visa.id === selectedVisaType.id) {
                const existingIndex = visa.formFields.findIndex(f => f.id === field.id);
                let newFields;
                
                if (existingIndex >= 0) {
                  // Update existing field
                  newFields = [...visa.formFields];
                  newFields[existingIndex] = field;
                } else {
                  // Add new field
                  newFields = [...visa.formFields, field];
                }
                
                const updatedVisa = { ...visa, formFields: newFields };
                
                // Update selectedVisaType
                setSelectedVisaType(updatedVisa);
                
                return updatedVisa;
              }
              return visa;
            })
          };
        }
        return country;
      })
    );
    
    setEditingField(null);
  };

  const handleDeleteField = (fieldId: string) => {
    if (confirm('Вы уверены, что хотите удалить это поле?')) {
      setCountries(prevCountries =>
        prevCountries.map(country => {
          if (country.id === selectedCountry.id) {
            return {
              ...country,
              visaTypes: country.visaTypes.map(visa => {
                if (visa.id === selectedVisaType.id) {
                  const newFields = visa.formFields.filter(f => f.id !== fieldId);
                  const updatedVisa = { ...visa, formFields: newFields };
                  setSelectedVisaType(updatedVisa);
                  return updatedVisa;
                }
                return visa;
              })
            };
          }
          return country;
        })
      );
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === index) return;

    setCountries(prevCountries =>
      prevCountries.map(country => {
        if (country.id === selectedCountry.id) {
          return {
            ...country,
            visaTypes: country.visaTypes.map(visa => {
              if (visa.id === selectedVisaType.id) {
                const newFields = [...visa.formFields];
                const draggedField = newFields[draggedIndex];
                
                // Remove from old position
                newFields.splice(draggedIndex, 1);
                
                // Insert at new position
                newFields.splice(index, 0, draggedField);
                
                const updatedVisa = { ...visa, formFields: newFields };
                setSelectedVisaType(updatedVisa);
                
                return updatedVisa;
              }
              return visa;
            })
          };
        }
        return country;
      })
    );
    
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleCountryChange = (country: CountryVisaData) => {
    setSelectedCountry(country);
    setSelectedVisaType(country.visaTypes[0]);
    setPhotoRequirements(countryPhotoRequirements[country.id] || []);
  };

  const handleVisaTypeChange = (visa: VisaType) => {
    setSelectedVisaType(visa);
  };

  const handleSavePhoto = (photo: PhotoRequirement) => {
    const existingIndex = photoRequirements.findIndex(p => p.id === photo.id);
    
    if (existingIndex >= 0) {
      // Update existing photo
      const newPhotos = [...photoRequirements];
      newPhotos[existingIndex] = photo;
      setPhotoRequirements(newPhotos);
    } else {
      // Add new photo
      setPhotoRequirements([...photoRequirements, photo]);
    }
    
    setEditingPhoto(null);
  };

  const handleDeletePhoto = (photoId: string) => {
    if (confirm('Вы уверены, что хотите удалить это требование к фотографии?')) {
      setCountries(prevCountries =>
        prevCountries.map(country => {
          if (country.id === selectedCountry.id) {
            return {
              ...country,
              visaTypes: country.visaTypes.map(visa => {
                if (visa.id === selectedVisaType.id) {
                  const newPhotos = visa.photoRequirements.filter(p => p.id !== photoId);
                  const updatedVisa = { ...visa, photoRequirements: newPhotos };
                  setSelectedVisaType(updatedVisa);
                  return updatedVisa;
                }
                return visa;
              })
            };
          }
          return country;
        })
      );
    }
  };

  const handlePhotoDragStart = (index: number) => {
    setDraggedPhotoIndex(index);
  };

  const handlePhotoDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    
    if (draggedPhotoIndex === null || draggedPhotoIndex === index) return;

    setPhotoRequirements(prevPhotos => {
      const newPhotos = [...prevPhotos];
      const draggedPhoto = newPhotos[draggedPhotoIndex];
      
      // Remove from old position
      newPhotos.splice(draggedPhotoIndex, 1);
      
      // Insert at new position
      newPhotos.splice(index, 0, draggedPhoto);
      
      return newPhotos;
    });
    
    setDraggedPhotoIndex(index);
  };

  const handlePhotoDragEnd = () => {
    setDraggedPhotoIndex(null);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1>Конструктор анкет</h1>
        <button
          onClick={() => alert('Все изменения сохранены!')}
          className="px-6 py-3 bg-[#00C853] hover:bg-[#00A344] text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Save size={20} />
          Сохранить все изменения
        </button>
      </div>

      {/* Country Selector */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 mb-6">
        <h3 className="mb-4">Выберите страну</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {countries.map((country) => (
            <button
              key={country.id}
              onClick={() => handleCountryChange(country)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedCountry.id === country.id
                  ? 'border-[#2196F3] bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{country.flag}</span>
                <span className="text-sm">{country.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Visa Type Selector */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 mb-6">
        <h3 className="mb-4">Выберите тип визы</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {selectedCountry.visaTypes.map((visa) => (
            <button
              key={visa.id}
              onClick={() => handleVisaTypeChange(visa)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedVisaType.id === visa.id
                  ? 'border-[#2196F3] bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-sm mb-1">{visa.name}</p>
              <p className="text-xs text-gray-600">{visa.price.toLocaleString('ru-RU')} ₽</p>
              <p className="text-xs text-gray-500 mt-1">{visa.formFields.length} полей</p>
            </button>
          ))}
        </div>
      </div>

      {/* Form Fields */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3>Поля анкеты: {selectedCountry.flag} {selectedCountry.name}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {selectedVisaType.name} • Перетаскивайте поля для изменения порядка
            </p>
          </div>
          <button
            onClick={() => setEditingField({
              id: `field-${Date.now()}`,
              label: '',
              key: '',
              type: 'text',
              required: false
            })}
            className="px-4 py-2 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            Добавить поле
          </button>
        </div>

        <div className="p-6">
          {currentFields.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-4">Нет полей в анкете</p>
              <button
                onClick={() => setEditingField({
                  id: `field-${Date.now()}`,
                  label: '',
                  key: '',
                  type: 'text',
                  required: false
                })}
                className="px-6 py-3 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-lg transition-colors"
              >
                Добавить первое поле
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {currentFields.map((field, index) => (
                <div
                  key={field.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`p-4 bg-[#F5F7FA] rounded-lg flex items-start gap-4 cursor-move hover:bg-gray-100 transition-colors ${
                    draggedIndex === index ? 'opacity-50' : ''
                  }`}
                >
                  <GripVertical size={20} className="text-gray-400 flex-shrink-0 mt-1" />
                  
                  <div className="flex-1">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1">
                        <p className="text-sm mb-1">{field.label}</p>
                        {field.required && (
                          <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded mr-2">
                            Обязательное поле
                          </span>
                        )}
                        <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded">
                          {field.type}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-1 text-xs text-gray-600">
                      {field.comment && (
                        <p className="bg-blue-50 px-2 py-1 rounded">💡 {field.comment}</p>
                      )}
                      {field.warning && (
                        <p className="bg-yellow-50 px-2 py-1 rounded">⚠️ {field.warning}</p>
                      )}
                      {field.placeholder && (
                        <p className="bg-white px-2 py-1 rounded">Placeholder: {field.placeholder}</p>
                      )}
                      {field.options && field.options.length > 0 && (
                        <p className="bg-white px-2 py-1 rounded">
                          Варианты: {field.options.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setEditingField(field)}
                      className="p-2 hover:bg-white rounded-lg transition-colors"
                    >
                      <Edit size={18} className="text-[#2196F3]" />
                    </button>
                    <button
                      onClick={() => handleDeleteField(field.id)}
                      className="p-2 hover:bg-white rounded-lg transition-colors"
                    >
                      <Trash2 size={18} className="text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Photo Requirements Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Image size={24} className="text-[#2196F3]" />
              <h3>Требования к фотографиям: {selectedCountry.flag} {selectedCountry.name}</h3>
            </div>
            <p className="text-sm text-gray-600">
              Управление обязательными и дополнительными фотографиями • Перетаскивайте для изменения порядка
            </p>
          </div>
          <button
            onClick={() => setEditingPhoto({
              id: `photo-${Date.now()}`,
              label: '',
              key: '',
              required: false,
              requirements: '',
              formats: 'JPG/PNG/PDF',
              maxSize: '5MB'
            })}
            className="px-4 py-2 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            Добавить фото
          </button>
        </div>

        <div className="p-6">
          {photoRequirements.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-4">Нет требований к фотографиям</p>
              <button
                onClick={() => setEditingPhoto({
                  id: `photo-${Date.now()}`,
                  label: '',
                  key: '',
                  required: false,
                  requirements: '',
                  formats: 'JPG/PNG/PDF',
                  maxSize: '5MB'
                })}
                className="px-6 py-3 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-lg transition-colors"
              >
                Добавить первое требование
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {photoRequirements.map((photo, index) => (
                <div
                  key={photo.id}
                  draggable
                  onDragStart={() => handlePhotoDragStart(index)}
                  onDragOver={(e) => handlePhotoDragOver(e, index)}
                  onDragEnd={handlePhotoDragEnd}
                  className={`p-4 bg-[#F5F7FA] rounded-lg flex items-start gap-4 cursor-move hover:bg-gray-100 transition-colors ${
                    draggedPhotoIndex === index ? 'opacity-50' : ''
                  }`}
                >
                  <GripVertical size={20} className="text-gray-400 flex-shrink-0 mt-1" />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm font-medium">{photo.label}</p>
                      {photo.required && (
                        <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">
                          Обязательное
                        </span>
                      )}
                      {photo.hideIfServiceSelected && (
                        <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                          Условное
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-1 text-xs text-gray-600">
                      {photo.requirements && (
                        <p className="bg-blue-50 px-2 py-1 rounded">📋 {photo.requirements}</p>
                      )}
                      <div className="flex gap-2">
                        {photo.formats && (
                          <span className="bg-white px-2 py-1 rounded">Форматы: {photo.formats}</span>
                        )}
                        {photo.maxSize && (
                          <span className="bg-white px-2 py-1 rounded">Макс: {photo.maxSize}</span>
                        )}
                      </div>
                      {photo.hideIfServiceSelected && (
                        <p className="bg-orange-50 px-2 py-1 rounded">
                          ⚠️ Скрывается при услуге: {photo.hideIfServiceSelected}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setEditingPhoto(photo)}
                      className="p-2 hover:bg-white rounded-lg transition-colors"
                    >
                      <Edit size={18} className="text-[#2196F3]" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Удалить это требование к фотографии?')) {
                          setPhotoRequirements(photoRequirements.filter(p => p.id !== photo.id));
                        }
                      }}
                      className="p-2 hover:bg-white rounded-lg transition-colors"
                    >
                      <Trash2 size={18} className="text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>💡 Автоматическая синхронизация:</strong> Все изменения требований к фотографиям автоматически отображаются 
              в пользовательском интерфейсе при заполнении анкеты. Условные поля автоматически скрываются при выборе соответствующих услуг.
            </p>
          </div>
        </div>
      </div>

      {/* Field Editor Modal */}
      {editingField !== null && (
        <FieldEditor
          field={editingField}
          onSave={handleSaveField}
          onCancel={() => setEditingField(null)}
        />
      )}

      {/* Photo Editor Modal */}
      {editingPhoto !== null && (
        <PhotoEditor
          photo={editingPhoto}
          onSave={handleSavePhoto}
          onCancel={() => setEditingPhoto(null)}
        />
      )}
    </div>
  );
};