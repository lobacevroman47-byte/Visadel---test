import { ApplicationData } from '../ApplicationForm';

interface Step1Props {
  data: ApplicationData;
  onChange: (data: ApplicationData) => void;
  onNext: () => void;
}

export default function Step1Personal({ data, onChange, onNext }: Step1Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simple validation
    if (!data.fullName || !data.birthDate || !data.passportNumber || 
        !data.passportIssueDate || !data.passportExpireDate || !data.citizenship) {
      alert('Пожалуйста, заполните все поля');
      return;
    }
    
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl mb-4 text-gray-900">Личные данные</h2>
        <p className="text-sm text-gray-500 mb-6">
          Пожалуйста, заполните данные в точности как в загранпаспорте
        </p>
      </div>

      <div>
        <label className="block text-sm mb-2 text-gray-700">ФИО (латиницей)</label>
        <input
          type="text"
          value={data.fullName}
          onChange={(e) => onChange({ ...data, fullName: e.target.value })}
          placeholder="IVANOV IVAN IVANOVICH"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm mb-2 text-gray-700">Дата рождения</label>
        <input
          type="date"
          value={data.birthDate}
          onChange={(e) => onChange({ ...data, birthDate: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm mb-2 text-gray-700">Номер загранпаспорта</label>
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
          <label className="block text-sm mb-2 text-gray-700">Дата выдачи</label>
          <input
            type="date"
            value={data.passportIssueDate}
            onChange={(e) => onChange({ ...data, passportIssueDate: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm mb-2 text-gray-700">Действителен до</label>
          <input
            type="date"
            value={data.passportExpireDate}
            onChange={(e) => onChange({ ...data, passportExpireDate: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm mb-2 text-gray-700">Гражданство</label>
        <select
          value={data.citizenship}
          onChange={(e) => onChange({ ...data, citizenship: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Выберите страну</option>
          <option value="RU">Россия</option>
          <option value="BY">Беларусь</option>
          <option value="KZ">Казахстан</option>
          <option value="UA">Украина</option>
          <option value="OTHER">Другое</option>
        </select>
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
