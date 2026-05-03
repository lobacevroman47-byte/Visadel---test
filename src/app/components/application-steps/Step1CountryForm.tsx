import { ApplicationData } from '../ApplicationForm';
import IndiaForm from '../country-forms/IndiaForm';

interface Step1Props {
  country: string;
  data: ApplicationData;
  onChange: (data: ApplicationData) => void;
  onNext: () => void;
}

export default function Step1CountryForm({ country, data, onChange, onNext }: Step1Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!data.fullName || !data.birthDate || !data.passportNumber || 
        !data.passportIssueDate || !data.passportExpireDate) {
      alert('Пожалуйста, заполните обязательные поля');
      return;
    }
    
    onNext();
  };

  // If India, use India-specific form
  if (country === 'Индия') {
    return (
      <div>
        {/* Basic passport info first */}
        <div className="space-y-4 mb-6 pb-6 border-b border-gray-200">
          <h3 className="text-lg text-gray-900">Данные загранпаспорта</h3>
          
          <div>
            <label className="block text-sm mb-2 text-gray-700">
              ФИО (латиницей) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.fullName}
              onChange={(e) => onChange({ ...data, fullName: e.target.value })}
              placeholder="IVANOV IVAN IVANOVICH"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-700">
              Дата рождения <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={data.birthDate}
              onChange={(e) => onChange({ ...data, birthDate: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-700">
              Номер загранпаспорта <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.passportNumber}
              onChange={(e) => onChange({ ...data, passportNumber: e.target.value })}
              placeholder="12 3456789"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2 text-gray-700">
                Дата выдачи <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={data.passportIssueDate}
                onChange={(e) => onChange({ ...data, passportIssueDate: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm mb-2 text-gray-700">
                Действителен до <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={data.passportExpireDate}
                onChange={(e) => onChange({ ...data, passportExpireDate: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Должен быть действителен ≥6 месяцев</p>
            </div>
          </div>
        </div>

        <IndiaForm
          data={data.countrySpecificData}
          onChange={(countryData) => onChange({ ...data, countrySpecificData: countryData })}
          onNext={onNext}
        />
      </div>
    );
  }

  // For other countries, use simplified form
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl mb-4 text-gray-900">Данные для визы {country}</h2>
        <p className="text-sm text-gray-500 mb-6">
          Пожалуйста, заполните данные в точности как в загранпаспорте
        </p>
      </div>

      <div>
        <label className="block text-sm mb-2 text-gray-700">
          ФИО (латиницей) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.fullName}
          onChange={(e) => onChange({ ...data, fullName: e.target.value })}
          placeholder="IVANOV IVAN IVANOVICH"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm mb-2 text-gray-700">
          Дата рождения <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={data.birthDate}
          onChange={(e) => onChange({ ...data, birthDate: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm mb-2 text-gray-700">
          Номер загранпаспорта <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.passportNumber}
          onChange={(e) => onChange({ ...data, passportNumber: e.target.value })}
          placeholder="12 3456789"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-2 text-gray-700">
            Дата выдачи <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={data.passportIssueDate}
            onChange={(e) => onChange({ ...data, passportIssueDate: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm mb-2 text-gray-700">
            Действителен до <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={data.passportExpireDate}
            onChange={(e) => onChange({ ...data, passportExpireDate: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Должен быть действителен ≥6 месяцев</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-900">
          💡 После нажатия "Продолжить" вы сможете добавить дополнительные документы и услуги
        </p>
      </div>

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl hover:opacity-90 transition-opacity"
      >
        Продолжить
      </button>
    </form>
  );
}
