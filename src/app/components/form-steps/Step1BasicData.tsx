import { useState, useEffect } from 'react';
import { ChevronRight, Plus, X } from 'lucide-react';
import { CITIZENSHIP_OPTIONS, WORLD_COUNTRIES, SOUTH_ASIA_COUNTRIES } from '../../lib/countries';

interface Step1Props {
  country: string;
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
  onNext: () => void;
}

export default function Step1BasicData({ country, data, onChange, onNext }: Step1Props) {
  const [formData, setFormData] = useState(data);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    onChange(formData);
  }, [formData]);

  const updateField = (field: string, value: any) => {
    setFormData((prev: Record<string, any>) => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateAndNext = () => {
    const requiredFields = getRequiredFields(country);
    const newErrors: Record<string, string> = {};

    requiredFields.forEach(field => {
      // Special handling for compound date fields
      if (field === 'plannedDates') {
        if (!formData.plannedDateFrom || !formData.plannedDateTo) {
          newErrors[field] = 'Укажите обе даты';
        }
      } else if (field === 'tripDates') {
        if (!formData.tripDateFrom || !formData.tripDateTo) {
          newErrors[field] = 'Укажите обе даты';
        }
      } else if (field === 'stayDates') {
        if (!formData.stayDateFrom || !formData.stayDateTo) {
          newErrors[field] = 'Укажите обе даты';
        }
      } else if (field === 'travelDates') {
        if (!formData.travelDateFrom || !formData.travelDateTo) {
          newErrors[field] = 'Укажите обе даты';
        }
      } else {
        // Regular field validation
        const value = formData[field];
        if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
          newErrors[field] = 'Это поле обязательно';
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      alert('Пожалуйста, заполните все обязательные поля');
      return;
    }

    onNext();
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-2xl mb-6 text-gray-800">Основные данные</h2>
      
      {country === 'Индия' && <IndiaForm formData={formData} updateField={updateField} errors={errors} />}
      {country === 'Вьетнам' && <VietnamForm formData={formData} updateField={updateField} errors={errors} />}
      {country === 'Шри-Ланка' && <SriLankaForm formData={formData} updateField={updateField} errors={errors} />}
      {country === 'Южная Корея' && <KoreaForm formData={formData} updateField={updateField} errors={errors} />}
      {country === 'Израиль' && <IsraelForm formData={formData} updateField={updateField} errors={errors} />}
      {country === 'Пакистан' && <PakistanForm formData={formData} updateField={updateField} errors={errors} />}
      {country === 'Камбоджа' && <CambodiaForm formData={formData} updateField={updateField} errors={errors} />}
      {country === 'Кения' && <KenyaForm formData={formData} updateField={updateField} errors={errors} />}

      <button
        onClick={validateAndNext}
        className="w-full mt-6 bg-[#2196F3] text-white py-4 rounded-[16px] hover:bg-[#1E88E5] transition flex items-center justify-center gap-2"
      >
        Далее
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

function getRequiredFields(country: string): string[] {
  const commonFields: Record<string, string[]> = {
    'Индия': ['citizenship', 'airport', 'arrivalDate', 'birthCity', 'internalPassport', 'residedTwoYears',
              'registrationAddress', 'residenceAddress', 'fatherData', 'motherData', 'maritalStatus',
              'workplace', 'citiesInIndia', 'countriesVisited', 'visitedIndiaBefore',
              'hotelInfo', 'emergencyContact'],
    'Вьетнам': ['citizenship', 'birthCountry', 'plannedDates', 'registrationAddress', 'emergencyContact', 
                'workOrStudy', 'visitPurpose', 'contactsInVietnam', 'arrivalAirport', 'departureAirport', 
                'addressInVietnam', 'expectedExpenses'],
    'Шри-Ланка': ['citizenship', 'birthCountry', 'lastCountry', 'arrivalDate', 'residenceAddress', 
                  'hasResidentVisa', 'hasExtension', 'hasMultipleVisa'],
    'Южная Корея': ['tripPurpose', 'beenToKorea', 'dualCitizenship', 'hasCriminalRecord', 'hasDiseases', 
                    'hasContacts', 'traveling', 'working', 'countriesVisited', 'tripDates', 'addressInKorea'],
    'Израиль': ['citizenship', 'arrivalDate', 'arrivalAirport', 'isBiometric', 'hasSecondCitizenship', 
                'maritalStatus', 'fatherData', 'motherData', 'homeAddress'],
    'Пакистан': ['daysInPakistan', 'entryPort', 'exitPort', 'stayDates', 'maritalStatus', 'parentsData', 
                 'workInfo', 'plannedAddress'],
    'Камбоджа': ['expectedEntryDate', 'residenceAddress', 'addressInCambodia', 'entryPort'],
    'Кения': ['profession', 'emergencyContact', 'travelDates', 'entryPort', 'airline', 'fromCountry', 
              'exitPort', 'exitAirline', 'toCountry', 'addressInKenya', 'birthCountry', 'convicted', 
              'deniedEntry', 'beenToKenya', 'bringCurrency'],
  };

  return commonFields[country] || [];
}

// ─── Reusable Select Components ────────────────────────────────────────────

function CitizenshipSelect({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`form-input ${error ? 'border-red-500' : ''}`}
    >
      <option value="">Выберите страну...</option>
      {CITIZENSHIP_OPTIONS.map(c => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );
}

function CountriesMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const selected: string[] = Array.isArray(value) ? value : [];
  const [search, setSearch] = useState('');

  const filtered = WORLD_COUNTRIES.filter(c =>
    c.toLowerCase().includes(search.toLowerCase()) && !selected.includes(c)
  );

  const add = (country: string) => { onChange([...selected, country]); setSearch(''); };
  const remove = (country: string) => onChange(selected.filter(c => c !== country));

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(c => (
            <span key={c} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              {c}
              <button type="button" onClick={() => remove(c)}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        placeholder="Начните вводить страну..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="form-input text-sm"
      />
      {search.length > 0 && filtered.length > 0 && (
        <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto bg-white shadow-sm">
          {filtered.slice(0, 20).map(c => (
            <button
              key={c}
              type="button"
              onClick={() => add(c)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
            >
              <Plus className="w-3 h-3 text-blue-500" />{c}
            </button>
          ))}
        </div>
      )}
      {selected.length === 0 && <p className="text-xs text-gray-400">Не выбрано ни одной страны</p>}
    </div>
  );
}

interface SouthAsiaVisit { country: string; year: string; count: string }

function SouthAsiaVisitsSelect({ value, onChange }: { value: SouthAsiaVisit[]; onChange: (v: SouthAsiaVisit[]) => void }) {
  const visits: SouthAsiaVisit[] = Array.isArray(value) ? value : [];

  const addVisit = () => onChange([...visits, { country: '', year: '', count: '' }]);
  const removeVisit = (i: number) => onChange(visits.filter((_, idx) => idx !== i));
  const updateVisit = (i: number, field: keyof SouthAsiaVisit, val: string) => {
    const updated = visits.map((v, idx) => idx === i ? { ...v, [field]: val } : v);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {visits.map((visit, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Посещение {i + 1}</span>
            <button type="button" onClick={() => removeVisit(i)} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <select value={visit.country} onChange={(e) => updateVisit(i, 'country', e.target.value)} className="form-input text-sm">
            <option value="">Выберите страну...</option>
            {SOUTH_ASIA_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Год (напр. 2023)" value={visit.year}
              onChange={(e) => updateVisit(i, 'year', e.target.value)} className="form-input text-sm" min="2000" max="2025" />
            <input type="number" placeholder="Кол-во раз" value={visit.count}
              onChange={(e) => updateVisit(i, 'count', e.target.value)} className="form-input text-sm" min="1" />
          </div>
        </div>
      ))}
      <button type="button" onClick={addVisit}
        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" /> Добавить страну
      </button>
    </div>
  );
}

// ─── India Form ─────────────────────────────────────────────────────────────

function IndiaForm({ formData, updateField, errors }: any) {
  return (
    <div className="space-y-4">
      <FormField label="Гражданство" required error={errors.citizenship}>
        <CitizenshipSelect value={formData.citizenship || ''} onChange={(v) => updateField('citizenship', v)} error={errors.citizenship} />
      </FormField>

      <FormField label="Аэропорт прилёта"
        required
        hint="если не знаете точно, укажите примерный"
        error={errors.airport}
      >
        <input
          type="text"
          value={formData.airport || ''}
          onChange={(e) => updateField('airport', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Дата прилёта"
        required
        hint="можно примерную"
        error={errors.arrivalDate}
      >
        <input
          type="date"
          value={formData.arrivalDate || ''}
          onChange={(e) => updateField('arrivalDate', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Предыдущие Фамилия и Имя"
        hint="пропустить, если не менялись"
      >
        <input
          type="text"
          value={formData.previousName || ''}
          onChange={(e) => updateField('previousName', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="ГОРОД рождения"
        required
        error={errors.birthCity}
      >
        <input
          type="text"
          value={formData.birthCity || ''}
          onChange={(e) => updateField('birthCity', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField label="Предыдущее гражданство" hint="пропустить, если не менялось">
        <CitizenshipSelect value={formData.previousCitizenship || ''} onChange={(v) => updateField('previousCitizenship', v)} />
      </FormField>

      <FormField label="Серия и номер внутреннего паспорта" required error={errors.internalPassport}>
        <input type="text" value={formData.internalPassport || ''}
          onChange={(e) => updateField('internalPassport', e.target.value)} className="form-input" />
        <p className="text-xs text-gray-400 mt-1">для других стран — ID</p>
      </FormField>

      <FormField
        label="Вы прожили не менее 2-х лет в стране, из которой оформляете сейчас визу?"
        required
        error={errors.residedTwoYears}
      >
        <select
          value={formData.residedTwoYears || ''}
          onChange={(e) => updateField('residedTwoYears', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="yes">Да</option>
          <option value="no">Нет</option>
        </select>
      </FormField>

      <FormField
        label="Адрес регистрации"
        required
        hint="индекс / область (край, регион) / город (ПГТ/село и т.д.) / улица / дом"
        error={errors.registrationAddress}
      >
        <textarea
          value={formData.registrationAddress || ''}
          onChange={(e) => updateField('registrationAddress', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Адрес проживания"
        required
        hint='пишите "тот же", если по месту регистрации'
        error={errors.residenceAddress}
      >
        <textarea
          value={formData.residenceAddress || ''}
          onChange={(e) => updateField('residenceAddress', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Данные отца (даже если нет в живых)"
        required
        hint="имя / гражданство / ГОРОД рождения"
        error={errors.fatherData}
      >
        <textarea
          value={formData.fatherData || ''}
          onChange={(e) => updateField('fatherData', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Данные матери (даже если нет в живых)"
        required
        hint="имя / гражданство / ГОРОД рождения"
        error={errors.motherData}
      >
        <textarea
          value={formData.motherData || ''}
          onChange={(e) => updateField('motherData', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Семейное положение"
        required
        error={errors.maritalStatus}
      >
        <select
          value={formData.maritalStatus || ''}
          onChange={(e) => updateField('maritalStatus', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="single">Холост/Не замужем</option>
          <option value="married">Женат/Замужем</option>
          <option value="divorced">Разведен(а)</option>
          <option value="widowed">Вдовец/Вдова</option>
        </select>
      </FormField>

      <FormField
        label="Информация о супруге (если не состоите в браке, пропускайте)"
        hint="ФИО / страна, город рождения"
      >
        <textarea
          value={formData.spouseInfo || ''}
          onChange={(e) => updateField('spouseInfo', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Место работы"
        required
        hint='пишите "нет работы", если безработный. наименование компании / адрес / должность / номер и e-mail компании'
        error={errors.workplace}
      >
        <textarea
          value={formData.workplace || ''}
          onChange={(e) => updateField('workplace', e.target.value)}
          className="form-input min-h-24"
        />
      </FormField>

      <FormField
        label="Если Вам когда-нибудь отказывали в оформлении или в продлении индийской визы, укажите детали"
        hint="пропустите, если нет. когда, кем выдан отказ, уточните номер и дату"
      >
        <textarea
          value={formData.visaRefusal || ''}
          onChange={(e) => updateField('visaRefusal', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Какие города/места в Индии планируете посетить?"
        required
        error={errors.citiesInIndia}
      >
        <textarea
          value={formData.citiesInIndia || ''}
          onChange={(e) => updateField('citiesInIndia', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField label="Какие страны посещали за последние 10 лет?" required error={errors.countriesVisited}>
        <CountriesMultiSelect
          value={formData.countriesVisited || []}
          onChange={(v) => updateField('countriesVisited', v)}
        />
      </FormField>

      <FormField
        label="Посещали ли вы ранее Индию?"
        required
        error={errors.visitedIndiaBefore}
      >
        <select
          value={formData.visitedIndiaBefore || ''}
          onChange={(e) => updateField('visitedIndiaBefore', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="yes">Да</option>
          <option value="no">Нет</option>
        </select>
      </FormField>

      <FormField label="Посещали ли Вы Бангладеш, Бутан, Мальдивы, Непал, Пакистан, Шри-Ланку, Афганистан за последние 3 года?">
        <SouthAsiaVisitsSelect
          value={formData.southAsiaVisits || []}
          onChange={(v) => updateField('southAsiaVisits', v)}
        />
      </FormField>

      <FormField
        label="Наименования отеля/ адрес / номер телефона"
        required
        error={errors.hotelInfo}
      >
        <textarea
          value={formData.hotelInfo || ''}
          onChange={(e) => updateField('hotelInfo', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Контактное лицо в стране гражданства (на экстренный случай)"
        required
        hint="ИМЯ / ПОЛНЫЙ АДРЕС/ ТЕЛЕФОН"
        error={errors.emergencyContact}
      >
        <textarea
          value={formData.emergencyContact || ''}
          onChange={(e) => updateField('emergencyContact', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>
    </div>
  );
}

// Vietnam Form Component
function VietnamForm({ formData, updateField, errors }: any) {
  return (
    <div className="space-y-4">
      <FormField label="Гражданство" required error={errors.citizenship}>
        <CitizenshipSelect value={formData.citizenship || ''} onChange={(v) => updateField('citizenship', v)} error={errors.citizenship} />
      </FormField>

      <FormField label="Страна рождения" required error={errors.birthCountry}>
        <CitizenshipSelect value={formData.birthCountry || ''} onChange={(v) => updateField('birthCountry', v)} error={errors.birthCountry} />
      </FormField>

      <FormField
        label="Если имеете второе гражданство, укажите его"
        hint="если нет, пропустите"
      >
        <CitizenshipSelect value={formData.secondCitizenship || ''} onChange={(v) => updateField('secondCitizenship', v)} />
      </FormField>

      <FormField
        label="Если нарушали законы Вьетнама в прошлом и получали наказание, укажите детали"
        hint="нарушение / дату /примененную санкцию / лицо, вынесшее наказание. пропустите, если нет"
      >
        <textarea
          value={formData.vietnamViolations || ''}
          onChange={(e) => updateField('vietnamViolations', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Пользовались ли вы когда-нибудь другими паспортами для въезда во Вьетнам?"
        hint="Если да, укажите номер этого старого паспорта"
      >
        <input
          type="text"
          value={formData.oldPassport || ''}
          onChange={(e) => updateField('oldPassport', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Предполагаемые даты пребывания"
        required
        hint="❗с начальной даты будет действовать виза ❗не более 90 дней"
        error={errors.plannedDates}
      >
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={formData.plannedDateFrom || ''}
            onChange={(e) => updateField('plannedDateFrom', e.target.value)}
            className="form-input"
            placeholder="С"
          />
          <input
            type="date"
            value={formData.plannedDateTo || ''}
            onChange={(e) => updateField('plannedDateTo', e.target.value)}
            className="form-input"
            placeholder="По"
          />
        </div>
      </FormField>

      <FormField
        label="Адрес регистрации/прописки"
        required
        hint="город / улица / дом / квартира"
        error={errors.registrationAddress}
      >
        <textarea
          value={formData.registrationAddress || ''}
          onChange={(e) => updateField('registrationAddress', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Адрес текущего проживания"
        hint="укажите, если отличается"
      >
        <textarea
          value={formData.currentAddress || ''}
          onChange={(e) => updateField('currentAddress', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Контактное лицо (на экстренный случай)"
        required
        hint="полное имя / место проживания / номер телефона / степень родства"
        error={errors.emergencyContact}
      >
        <textarea
          value={formData.emergencyContact || ''}
          onChange={(e) => updateField('emergencyContact', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Если работаете или учитесь, укажите детали"
        required
        hint="наименование, адрес, телефон организации и свою позицию там. Если безработный - напишите"
        error={errors.workOrStudy}
      >
        <textarea
          value={formData.workOrStudy || ''}
          onChange={(e) => updateField('workOrStudy', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Цель визита"
        required
        hint="❗Указывая целью туризм, вы соглашаетесь с вьетнамским законодательством, что не будете работать или открывать бизнес"
        error={errors.visitPurpose}
      >
        <input
          type="text"
          value={formData.visitPurpose || ''}
          onChange={(e) => updateField('visitPurpose', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Есть ли какие-либо агентства/организации/частные лица, с которыми предполагается контакт при въезде во Вьетнам?"
        required
        hint="если ДА, то укажите наменование/имя, адрес, номер телефона, цель встреч"
        error={errors.contactsInVietnam}
      >
        <textarea
          value={formData.contactsInVietnam || ''}
          onChange={(e) => updateField('contactsInVietnam', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Аэропорт прилёта во Вьетнам"
        required
        hint="❗именно через него Вы должны будете въехать"
        error={errors.arrivalAirport}
      >
        <input
          type="text"
          value={formData.arrivalAirport || ''}
          onChange={(e) => updateField('arrivalAirport', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Предполагаемый аэропорт вылета из Вьетнама"
        required
        error={errors.departureAirport}
      >
        <input
          type="text"
          value={formData.departureAirport || ''}
          onChange={(e) => updateField('departureAirport', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Адрес проживания во Вьетнаме"
        required
        hint="если адрс неизвестен, укажите город"
        error={errors.addressInVietnam}
      >
        <textarea
          value={formData.addressInVietnam || ''}
          onChange={(e) => updateField('addressInVietnam', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Если уже были во Вьетнаме за последний год, укажите даты и цель визита"
        hint="пропустите, если не были"
      >
        <textarea
          value={formData.previousVietnamVisits || ''}
          onChange={(e) => updateField('previousVietnamVisits', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Инфо о ребёнке, если он вписан в Ваш паспорт"
        hint="номер свидетельства, имя и фамилия, дата рождения, файл с фото ребёнка прикрепите со своим"
      >
        <textarea
          value={formData.childInfo || ''}
          onChange={(e) => updateField('childInfo', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Если приобрели страховку, укажите информацию по ней"
        hint="если нет страховки, пропускайте"
      >
        <textarea
          value={formData.insuranceInfo || ''}
          onChange={(e) => updateField('insuranceInfo', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Какую сумму в $ Вы ожидаете потратить во Вьетнаме?"
        required
        error={errors.expectedExpenses}
      >
        <input
          type="number"
          value={formData.expectedExpenses || ''}
          onChange={(e) => updateField('expectedExpenses', e.target.value)}
          className="form-input"
        />
      </FormField>
    </div>
  );
}

// Sri Lanka Form Component
function SriLankaForm({ formData, updateField, errors }: any) {
  return (
    <div className="space-y-4">
      <FormField label="Гражданство" required error={errors.citizenship}>
        <CitizenshipSelect value={formData.citizenship || ''} onChange={(v) => updateField('citizenship', v)} error={errors.citizenship} />
      </FormField>

      <FormField
        label="Страна рождения"
        required
        hint="если СССР, пишите - Россия"
        error={errors.birthCountry}
      >
        <CitizenshipSelect value={formData.birthCountry || ''} onChange={(v) => updateField('birthCountry', v)} error={errors.birthCountry} />
      </FormField>

      <FormField
        label="Страна нахождения в последние 14 дней перед вылетом в Шри-Ланку"
        required
        error={errors.lastCountry}
      >
        <CitizenshipSelect value={formData.lastCountry || ''} onChange={(v) => updateField('lastCountry', v)} error={errors.lastCountry} />
      </FormField>

      <FormField
        label="Предполагаемая дата прибытия"
        required
        error={errors.arrivalDate}
      >
        <input
          type="date"
          value={formData.arrivalDate || ''}
          onChange={(e) => updateField('arrivalDate', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Аэропорт вылета"
        hint="если пока не знаете, оставляйте пустым"
      >
        <input
          type="text"
          value={formData.departureAirport || ''}
          onChange={(e) => updateField('departureAirport', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Авиакомпания/судно"
        hint="если пока не знаете, оставляйте пустым"
      >
        <input
          type="text"
          value={formData.airline || ''}
          onChange={(e) => updateField('airline', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Адрес проживания"
        required
        hint="город / улица / дом / квартира"
        error={errors.residenceAddress}
      >
        <textarea
          value={formData.residenceAddress || ''}
          onChange={(e) => updateField('residenceAddress', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Адрес проживания на Шри-Ланке"
        hint="если пока не знаете, оставляйте пустым"
      >
        <textarea
          value={formData.addressInSriLanka || ''}
          onChange={(e) => updateField('addressInSriLanka', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Есть ли у Вас действующая резидентская виза на Шри-Ланку?"
        required
        error={errors.hasResidentVisa}
      >
        <select
          value={formData.hasResidentVisa || ''}
          onChange={(e) => updateField('hasResidentVisa', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="yes">Да</option>
          <option value="no">Нет</option>
        </select>
      </FormField>

      <FormField
        label="Находитесь ли Вы уже на Шри-Ланке по действующему разрешению или получили его продление?"
        required
        error={errors.hasExtension}
      >
        <select
          value={formData.hasExtension || ''}
          onChange={(e) => updateField('hasExtension', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="yes">Да</option>
          <option value="no">Нет</option>
        </select>
      </FormField>

      <FormField
        label="Есть ли у Вас многократная виза на Шри-Ланку?"
        required
        error={errors.hasMultipleVisa}
      >
        <select
          value={formData.hasMultipleVisa || ''}
          onChange={(e) => updateField('hasMultipleVisa', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="yes">Да</option>
          <option value="no">Нет</option>
        </select>
      </FormField>
    </div>
  );
}

// Korea Form Component
function KoreaForm({ formData, updateField, errors }: any) {
  return (
    <div className="space-y-4">
      <FormField label="Цель поездки" required error={errors.tripPurpose}>
        <input
          type="text"
          value={formData.tripPurpose || ''}
          onChange={(e) => updateField('tripPurpose', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField label="Были ранее в Корее?" required error={errors.beenToKorea}>
        <select
          value={formData.beenToKorea || ''}
          onChange={(e) => updateField('beenToKorea', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="yes">Да</option>
          <option value="no">Нет</option>
        </select>
      </FormField>

      <FormField
        label="У Вас двойное гражданство?"
        required
        error={errors.dualCitizenship}
      >
        <select
          value={formData.dualCitizenship || ''}
          onChange={(e) => updateField('dualCitizenship', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="yes">Да</option>
          <option value="no">Нет</option>
        </select>
      </FormField>

      <FormField
        label="Есть ли судимости в какой-либо из стран?"
        required
        error={errors.hasCriminalRecord}
      >
        <select
          value={formData.hasCriminalRecord || ''}
          onChange={(e) => updateField('hasCriminalRecord', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="yes">Да</option>
          <option value="no">Нет</option>
        </select>
      </FormField>

      <FormField
        label="Есть ли опасные заболевания? (Эбола, COVID)"
        required
        error={errors.hasDiseases}
      >
        <select
          value={formData.hasDiseases || ''}
          onChange={(e) => updateField('hasDiseases', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="yes">Да</option>
          <option value="no">Нет</option>
        </select>
      </FormField>

      <FormField
        label="Есть ли знакомые в Корее?"
        required
        hint="если да, укажите ФИО и телефон"
        error={errors.hasContacts}
      >
        <textarea
          value={formData.hasContacts || ''}
          onChange={(e) => updateField('hasContacts', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Сопровождает ли Вас кто-то в поездке?"
        required
        hint="если да, укажите Фамилию и Имя на английском, дату рождения, степень родства"
        error={errors.traveling}
      >
        <textarea
          value={formData.traveling || ''}
          onChange={(e) => updateField('traveling', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Работаете ли Вы?"
        required
        hint="если да, укажите название компании, должность, телефон, з/п в $"
        error={errors.working}
      >
        <textarea
          value={formData.working || ''}
          onChange={(e) => updateField('working', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Какое количество стран посетили за всё время?"
        required
        error={errors.countriesVisited}
      >
        <input
          type="number"
          value={formData.countriesVisited || ''}
          onChange={(e) => updateField('countriesVisited', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Даты поездки в Корею"
        required
        error={errors.tripDates}
      >
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={formData.tripDateFrom || ''}
            onChange={(e) => updateField('tripDateFrom', e.target.value)}
            className="form-input"
            placeholder="С"
          />
          <input
            type="date"
            value={formData.tripDateTo || ''}
            onChange={(e) => updateField('tripDateTo', e.target.value)}
            className="form-input"
            placeholder="По"
          />
        </div>
      </FormField>

      <FormField
        label="Адрес проживания в Корее"
        required
        hint="индекс, телефон, название отеля"
        error={errors.addressInKorea}
      >
        <textarea
          value={formData.addressInKorea || ''}
          onChange={(e) => updateField('addressInKorea', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>
    </div>
  );
}

// Israel Form Component
function IsraelForm({ formData, updateField, errors }: any) {
  return (
    <div className="space-y-4">
      <FormField label="Гражданство" required error={errors.citizenship}>
        <CitizenshipSelect value={formData.citizenship || ''} onChange={(v) => updateField('citizenship', v)} error={errors.citizenship} />
      </FormField>

      <FormField label="Дата прилёта" required error={errors.arrivalDate}>
        <input
          type="date"
          value={formData.arrivalDate || ''}
          onChange={(e) => updateField('arrivalDate', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField label="Аэропорт прилёта" required error={errors.arrivalAirport}>
        <input
          type="text"
          value={formData.arrivalAirport || ''}
          onChange={(e) => updateField('arrivalAirport', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Ваш загранпаспорт - биометрический?"
        required
        error={errors.isBiometric}
      >
        <select
          value={formData.isBiometric || ''}
          onChange={(e) => updateField('isBiometric', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="yes">Да</option>
          <option value="no">Нет</option>
        </select>
      </FormField>

      <FormField
        label="Есть ли у вас второе гражданство?"
        required
        error={errors.hasSecondCitizenship}
      >
        <select
          value={formData.hasSecondCitizenship || ''}
          onChange={(e) => updateField('hasSecondCitizenship', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="yes">Да</option>
          <option value="no">Нет</option>
        </select>
      </FormField>

      <FormField label="Семейное положение" required error={errors.maritalStatus}>
        <select
          value={formData.maritalStatus || ''}
          onChange={(e) => updateField('maritalStatus', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="single">Холост/Не замужем</option>
          <option value="married">Женат/Замужем</option>
          <option value="divorced">Разведен(а)</option>
          <option value="widowed">Вдовец/Вдова</option>
        </select>
      </FormField>

      <FormField
        label="Данные отца (даже если нет в живых)"
        required
        hint="Имя Фамилия"
        error={errors.fatherData}
      >
        <input
          type="text"
          value={formData.fatherData || ''}
          onChange={(e) => updateField('fatherData', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Данные матери (даже если нет в живых)"
        required
        hint="Имя Фамилия"
        error={errors.motherData}
      >
        <input
          type="text"
          value={formData.motherData || ''}
          onChange={(e) => updateField('motherData', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Домашний адрес"
        required
        hint="Страна/Город"
        error={errors.homeAddress}
      >
        <input
          type="text"
          value={formData.homeAddress || ''}
          onChange={(e) => updateField('homeAddress', e.target.value)}
          className="form-input"
        />
      </FormField>
    </div>
  );
}

// Pakistan Form Component
function PakistanForm({ formData, updateField, errors }: any) {
  return (
    <div className="space-y-4">
      <FormField
        label="Сколько дней планируете находиться в Пакистане?"
        required
        error={errors.daysInPakistan}
      >
        <input
          type="number"
          value={formData.daysInPakistan || ''}
          onChange={(e) => updateField('daysInPakistan', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField label="Планируемый порт въезда" required error={errors.entryPort}>
        <input
          type="text"
          value={formData.entryPort || ''}
          onChange={(e) => updateField('entryPort', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField label="Планируемый порт выезда" required error={errors.exitPort}>
        <input
          type="text"
          value={formData.exitPort || ''}
          onChange={(e) => updateField('exitPort', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Дата пребывания"
        required
        hint="укажите планируемую дату. Это не значит, что виза будет доступна только в эти сроки"
        error={errors.stayDates}
      >
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={formData.stayDateFrom || ''}
            onChange={(e) => updateField('stayDateFrom', e.target.value)}
            className="form-input"
            placeholder="С"
          />
          <input
            type="date"
            value={formData.stayDateTo || ''}
            onChange={(e) => updateField('stayDateTo', e.target.value)}
            className="form-input"
            placeholder="По"
          />
        </div>
      </FormField>

      <FormField label="Семейное положение" required error={errors.maritalStatus}>
        <select
          value={formData.maritalStatus || ''}
          onChange={(e) => updateField('maritalStatus', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="single">Холост/Не замужем</option>
          <option value="married">Женат/Замужем</option>
          <option value="divorced">Разведен(а)</option>
          <option value="widowed">Вдовец/Вдова</option>
        </select>
      </FormField>

      <FormField
        label="Укажите данные отца и матери"
        required
        hint="имя и фамилия / гражданство"
        error={errors.parentsData}
      >
        <textarea
          value={formData.parentsData || ''}
          onChange={(e) => updateField('parentsData', e.target.value)}
          className="form-input min-h-24"
        />
      </FormField>

      <FormField
        label="Укажите информацию о месте работы"
        required
        hint="дата трудоустройства / должность / название компании / e-mail компании / номер телефона компании / адрес / то же самое о прошлых местах"
        error={errors.workInfo}
      >
        <textarea
          value={formData.workInfo || ''}
          onChange={(e) => updateField('workInfo', e.target.value)}
          className="form-input min-h-24"
        />
      </FormField>

      <FormField
        label="Планируемый адрес проживания"
        required
        hint="адрес / контактный номер"
        error={errors.plannedAddress}
      >
        <textarea
          value={formData.plannedAddress || ''}
          onChange={(e) => updateField('plannedAddress', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>
    </div>
  );
}

// Cambodia Form Component
function CambodiaForm({ formData, updateField, errors }: any) {
  return (
    <div className="space-y-4">
      <FormField
        label="Ожидаемая дата въезда"
        required
        error={errors.expectedEntryDate}
      >
        <input
          type="date"
          value={formData.expectedEntryDate || ''}
          onChange={(e) => updateField('expectedEntryDate', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField label="Адрес проживания" required error={errors.residenceAddress}>
        <textarea
          value={formData.residenceAddress || ''}
          onChange={(e) => updateField('residenceAddress', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Предполагаемый адрес проживания в Камбодже"
        required
        error={errors.addressInCambodia}
      >
        <textarea
          value={formData.addressInCambodia || ''}
          onChange={(e) => updateField('addressInCambodia', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField label="Порт въезда" required error={errors.entryPort}>
        <input
          type="text"
          value={formData.entryPort || ''}
          onChange={(e) => updateField('entryPort', e.target.value)}
          className="form-input"
        />
      </FormField>
    </div>
  );
}

// Kenya Form Component
function KenyaForm({ formData, updateField, errors }: any) {
  return (
    <div className="space-y-4">
      <FormField
        label="Профессия"
        required
        hint='если безработный, так и пишите'
        error={errors.profession}
      >
        <input
          type="text"
          value={formData.profession || ''}
          onChange={(e) => updateField('profession', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Контакт на экстренный случай"
        required
        hint="имя и номер телефона"
        error={errors.emergencyContact}
      >
        <input
          type="text"
          value={formData.emergencyContact || ''}
          onChange={(e) => updateField('emergencyContact', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField label="Дата прилета и вылета" required error={errors.travelDates}>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={formData.arrivalDate || ''}
            onChange={(e) => updateField('arrivalDate', e.target.value)}
            className="form-input"
            placeholder="Прилет"
          />
          <input
            type="date"
            value={formData.departureDate || ''}
            onChange={(e) => updateField('departureDate', e.target.value)}
            className="form-input"
            placeholder="Вылет"
          />
        </div>
      </FormField>

      <FormField
        label="Порт въезда в страну"
        required
        hint="название аэропорта/морского порта"
        error={errors.entryPort}
      >
        <input
          type="text"
          value={formData.entryPort || ''}
          onChange={(e) => updateField('entryPort', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Авиакомпания и номер рейса"
        required
        error={errors.airline}
      >
        <input
          type="text"
          value={formData.airline || ''}
          onChange={(e) => updateField('airline', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Страна, из которой прилетаете в Кению"
        required
        error={errors.fromCountry}
      >
        <input
          type="text"
          value={formData.fromCountry || ''}
          onChange={(e) => updateField('fromCountry', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Порт выезда из Кении"
        required
        hint="название аэропорта/морского порта"
        error={errors.exitPort}
      >
        <input
          type="text"
          value={formData.exitPort || ''}
          onChange={(e) => updateField('exitPort', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Авиакомпания и номер рейса при выезде из Кении"
        required
        error={errors.exitAirline}
      >
        <input
          type="text"
          value={formData.exitAirline || ''}
          onChange={(e) => updateField('exitAirline', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="В какую страну вылетаете/выезжаете из Кении?"
        required
        error={errors.toCountry}
      >
        <input
          type="text"
          value={formData.toCountry || ''}
          onChange={(e) => updateField('toCountry', e.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Планируемый адрес проживания в Кении"
        required
        error={errors.addressInKenya}
      >
        <textarea
          value={formData.addressInKenya || ''}
          onChange={(e) => updateField('addressInKenya', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField label="Страна рождения" required error={errors.birthCountry}>
        <CitizenshipSelect value={formData.birthCountry || ''} onChange={(v) => updateField('birthCountry', v)} error={errors.birthCountry} />
      </FormField>

      <FormField
        label="Были ли Вы осуждены за какое-либо правонарушение за последние 5 лет?"
        required
        error={errors.convicted}
      >
        <select
          value={formData.convicted || ''}
          onChange={(e) => updateField('convicted', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="yes">Да</option>
          <option value="no">Нет</option>
        </select>
      </FormField>

      <FormField
        label="Было ли Вам когда-либо отказано во въезде в Кению?"
        required
        error={errors.deniedEntry}
      >
        <select
          value={formData.deniedEntry || ''}
          onChange={(e) => updateField('deniedEntry', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="yes">Да</option>
          <option value="no">Нет</option>
        </select>
      </FormField>

      <FormField label="Были ранее в Кении?" required error={errors.beenToKenya}>
        <select
          value={formData.beenToKenya || ''}
          onChange={(e) => updateField('beenToKenya', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="yes">Да</option>
          <option value="no">Нет</option>
        </select>
      </FormField>

      <FormField
        label="Будете ли ввозить в Кению какую-либо валюту, сумма которой превышает 5000$?"
        required
        hint="если да, то укажите эту валюту и сумму"
        error={errors.bringCurrency}
      >
        <textarea
          value={formData.bringCurrency || ''}
          onChange={(e) => updateField('bringCurrency', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>
    </div>
  );
}

// Reusable FormField Component
function FormField({ 
  label, 
  required, 
  hint, 
  error, 
  children 
}: { 
  label: string; 
  required?: boolean; 
  hint?: string; 
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block mb-2 text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {hint && <p className="text-sm text-gray-500 mb-2">{hint}</p>}
      {children}
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}