import { useState } from 'react';
import { IndiaVisaData } from '../../types/visa-forms';

interface IndiaFormProps {
  data: Partial<IndiaVisaData>;
  onChange: (data: Partial<IndiaVisaData>) => void;
  onNext: () => void;
}

export default function IndiaForm({ data, onChange, onNext }: IndiaFormProps) {
  const [currentStep, setCurrentStep] = useState(1);

  const handleNext = () => {
    // Validation would go here
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      onNext();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (currentStep === 1) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg text-gray-900">Основные данные (Индия E-VISA)</h3>
        
        <div>
          <label className="block text-sm mb-2 text-gray-700">
            Гражданство <span className="text-red-500">*</span>
          </label>
          <select
            value={data.citizenship || ''}
            onChange={(e) => onChange({ ...data, citizenship: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Выберите страну</option>
            <option value="RU">Россия</option>
            <option value="BY">Беларусь</option>
            <option value="KZ">Казахстан</option>
            <option value="UA">Украина</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-2 text-gray-700">
            Аэропорт прилёта <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.arrivalAirport || ''}
            onChange={(e) => onChange({ ...data, arrivalAirport: e.target.value })}
            placeholder="Если не знаете — примерный"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm mb-2 text-gray-700">
            Дата прилёта <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={data.arrivalDate || ''}
            onChange={(e) => onChange({ ...data, arrivalDate: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Можно указать примерную дату</p>
        </div>

        <div>
          <label className="block text-sm mb-2 text-gray-700">
            Предыдущие Фамилия и Имя
          </label>
          <input
            type="text"
            value={data.previousSurname || ''}
            onChange={(e) => onChange({ ...data, previousSurname: e.target.value })}
            placeholder="Если не менялись — пропустить"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm mb-2 text-gray-700">
            Город рождения <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.cityOfBirth || ''}
            onChange={(e) => onChange({ ...data, cityOfBirth: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm mb-2 text-gray-700">
            Предыдущее гражданство
          </label>
          <input
            type="text"
            value={data.previousCitizenship || ''}
            onChange={(e) => onChange({ ...data, previousCitizenship: e.target.value })}
            placeholder="Если не менялось — пропустить"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-2 text-gray-700">
              Серия внутреннего паспорта <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.internalPassportSeries || ''}
              onChange={(e) => onChange({ ...data, internalPassportSeries: e.target.value })}
              placeholder="12 34"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm mb-2 text-gray-700">
              Номер <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.internalPassportNumber || ''}
              onChange={(e) => onChange({ ...data, internalPassportNumber: e.target.value })}
              placeholder="567890"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-2 text-gray-700">
            Прожили не менее 2-х лет в стране, из которой оформляете визу? <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                checked={data.lived2YearsInCountry === true}
                onChange={() => onChange({ ...data, lived2YearsInCountry: true })}
                className="mr-2"
              />
              Да
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                checked={data.lived2YearsInCountry === false}
                onChange={() => onChange({ ...data, lived2YearsInCountry: false })}
                className="mr-2"
              />
              Нет
            </label>
          </div>
        </div>

        <div className="pt-4">
          <button
            onClick={handleNext}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl hover:opacity-90 transition-opacity"
          >
            Продолжить
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === 2) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg text-gray-900">Адрес и контакты</h3>
        
        <div>
          <label className="block text-sm mb-2 text-gray-700">
            Адрес регистрации <span className="text-red-500">*</span>
          </label>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Индекс"
              value={data.registrationAddress?.zip || ''}
              onChange={(e) => onChange({
                ...data,
                registrationAddress: { ...data.registrationAddress!, zip: e.target.value }
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Область/край"
              value={data.registrationAddress?.region || ''}
              onChange={(e) => onChange({
                ...data,
                registrationAddress: { ...data.registrationAddress!, region: e.target.value }
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Город"
              value={data.registrationAddress?.city || ''}
              onChange={(e) => onChange({
                ...data,
                registrationAddress: { ...data.registrationAddress!, city: e.target.value }
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Улица"
              value={data.registrationAddress?.street || ''}
              onChange={(e) => onChange({
                ...data,
                registrationAddress: { ...data.registrationAddress!, street: e.target.value }
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Дом/квартира"
              value={data.registrationAddress?.building || ''}
              onChange={(e) => onChange({
                ...data,
                registrationAddress: { ...data.registrationAddress!, building: e.target.value }
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-2 text-gray-700">
            Адрес проживания <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.residenceAddress || ''}
            onChange={(e) => onChange({ ...data, residenceAddress: e.target.value })}
            placeholder="Если совпадает с регистрацией — напишите 'тот же'"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="border-t border-gray-200 pt-4 mt-4">
          <h4 className="text-gray-900 mb-3">Данные отца <span className="text-red-500">*</span></h4>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Имя"
              value={data.fatherInfo?.name || ''}
              onChange={(e) => onChange({
                ...data,
                fatherInfo: { ...data.fatherInfo!, name: e.target.value }
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Гражданство"
              value={data.fatherInfo?.citizenship || ''}
              onChange={(e) => onChange({
                ...data,
                fatherInfo: { ...data.fatherInfo!, citizenship: e.target.value }
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Город рождения"
              value={data.fatherInfo?.cityOfBirth || ''}
              onChange={(e) => onChange({
                ...data,
                fatherInfo: { ...data.fatherInfo!, cityOfBirth: e.target.value }
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-gray-900 mb-3">Данные матери <span className="text-red-500">*</span></h4>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Имя"
              value={data.motherInfo?.name || ''}
              onChange={(e) => onChange({
                ...data,
                motherInfo: { ...data.motherInfo!, name: e.target.value }
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Гражданство"
              value={data.motherInfo?.citizenship || ''}
              onChange={(e) => onChange({
                ...data,
                motherInfo: { ...data.motherInfo!, citizenship: e.target.value }
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Город рождения"
              value={data.motherInfo?.cityOfBirth || ''}
              onChange={(e) => onChange({
                ...data,
                motherInfo: { ...data.motherInfo!, cityOfBirth: e.target.value }
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handlePrev}
            className="px-6 bg-gray-200 text-gray-700 py-4 rounded-xl hover:bg-gray-300 transition-colors"
          >
            Назад
          </button>
          <button
            onClick={handleNext}
            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl hover:opacity-90 transition-opacity"
          >
            Продолжить
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === 3) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg text-gray-900">Работа и поездка</h3>
        
        <div>
          <label className="block text-sm mb-2 text-gray-700">
            Семейное положение <span className="text-red-500">*</span>
          </label>
          <select
            value={data.maritalStatus || ''}
            onChange={(e) => onChange({ ...data, maritalStatus: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Выберите</option>
            <option value="single">Холост/Не замужем</option>
            <option value="married">Женат/Замужем</option>
            <option value="divorced">Разведён/Разведена</option>
            <option value="widowed">Вдовец/Вдова</option>
          </select>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-gray-900 mb-3">Место работы <span className="text-red-500">*</span></h4>
          <p className="text-sm text-gray-500 mb-3">Если безработный — напишите «нет работы»</p>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Наименование компании"
              value={data.workplace?.company || ''}
              onChange={(e) => onChange({
                ...data,
                workplace: { ...data.workplace!, company: e.target.value }
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Адрес"
              value={data.workplace?.address || ''}
              onChange={(e) => onChange({
                ...data,
                workplace: { ...data.workplace!, address: e.target.value }
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Должность"
              value={data.workplace?.position || ''}
              onChange={(e) => onChange({
                ...data,
                workplace: { ...data.workplace!, position: e.target.value }
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="tel"
              placeholder="Телефон"
              value={data.workplace?.phone || ''}
              onChange={(e) => onChange({
                ...data,
                workplace: { ...data.workplace!, phone: e.target.value }
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              placeholder="Email"
              value={data.workplace?.email || ''}
              onChange={(e) => onChange({
                ...data,
                workplace: { ...data.workplace!, email: e.target.value }
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-2 text-gray-700">
            Города/места планируемого посещения <span className="text-red-500">*</span>
          </label>
          <textarea
            value={data.plannedCities || ''}
            onChange={(e) => onChange({ ...data, plannedCities: e.target.value })}
            placeholder="Дели, Мумбаи, Гоа..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm mb-2 text-gray-700">
            Посещенные страны за последние 10 лет <span className="text-red-500">*</span>
          </label>
          <textarea
            value={data.visitedCountries10Years || ''}
            onChange={(e) => onChange({ ...data, visitedCountries10Years: e.target.value })}
            placeholder="Турция, ОАЭ, Таиланд..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handlePrev}
            className="px-6 bg-gray-200 text-gray-700 py-4 rounded-xl hover:bg-gray-300 transition-colors"
          >
            Назад
          </button>
          <button
            onClick={handleNext}
            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl hover:opacity-90 transition-opacity"
          >
            Продолжить
          </button>
        </div>
      </div>
    );
  }

  // Step 4: Hotel and contacts in India
  return (
    <div className="space-y-4">
      <h3 className="text-lg text-gray-900">Проживание и контакты в Индии</h3>
      
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-gray-900 mb-3">Данные отеля <span className="text-red-500">*</span></h4>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Название отеля"
            value={data.hotelInfo?.name || ''}
            onChange={(e) => onChange({
              ...data,
              hotelInfo: { ...data.hotelInfo!, name: e.target.value }
            })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Адрес"
            value={data.hotelInfo?.address || ''}
            onChange={(e) => onChange({
              ...data,
              hotelInfo: { ...data.hotelInfo!, address: e.target.value }
            })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="tel"
            placeholder="Телефон"
            value={data.hotelInfo?.phone || ''}
            onChange={(e) => onChange({
              ...data,
              hotelInfo: { ...data.hotelInfo!, phone: e.target.value }
            })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-gray-900 mb-3">Контактное лицо в Индии <span className="text-red-500">*</span></h4>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="ФИО"
            value={data.contactInIndia?.name || ''}
            onChange={(e) => onChange({
              ...data,
              contactInIndia: { ...data.contactInIndia!, name: e.target.value }
            })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Полный адрес"
            value={data.contactInIndia?.address || ''}
            onChange={(e) => onChange({
              ...data,
              contactInIndia: { ...data.contactInIndia!, address: e.target.value }
            })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="tel"
            placeholder="Телефон"
            value={data.contactInIndia?.phone || ''}
            onChange={(e) => onChange({
              ...data,
              contactInIndia: { ...data.contactInIndia!, phone: e.target.value }
            })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-gray-900 mb-3">
          Контакт для экстренных случаев (в стране гражданства) <span className="text-red-500">*</span>
        </h4>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="ФИО"
            value={data.emergencyContact?.name || ''}
            onChange={(e) => onChange({
              ...data,
              emergencyContact: { ...data.emergencyContact!, name: e.target.value }
            })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Полный адрес"
            value={data.emergencyContact?.address || ''}
            onChange={(e) => onChange({
              ...data,
              emergencyContact: { ...data.emergencyContact!, address: e.target.value }
            })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="tel"
            placeholder="Телефон"
            value={data.emergencyContact?.phone || ''}
            onChange={(e) => onChange({
              ...data,
              emergencyContact: { ...data.emergencyContact!, phone: e.target.value }
            })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          onClick={handlePrev}
          className="px-6 bg-gray-200 text-gray-700 py-4 rounded-xl hover:bg-gray-300 transition-colors"
        >
          Назад
        </button>
        <button
          onClick={handleNext}
          className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl hover:opacity-90 transition-opacity"
        >
          Продолжить к дополнительным документам
        </button>
      </div>
    </div>
  );
}
