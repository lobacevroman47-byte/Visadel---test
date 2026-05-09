import { useState, useEffect, useRef } from 'react';
import { ChevronRight, Plus, X, Loader2, User } from 'lucide-react';
import { CITIZENSHIP_OPTIONS, WORLD_COUNTRIES, SOUTH_ASIA_COUNTRIES } from '../../lib/countries';
import { getFormFields, type VisaFormField } from '../../lib/db';
import LatinNotice from '../shared/LatinNotice';
import { useDialog } from '../shared/BrandDialog';

interface Step1Props {
  country: string;
  visaId?: string;
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
  onNext: () => void;
}

export default function Step1BasicData({ country, visaId, data, onChange, onNext }: Step1Props) {
  const dialog = useDialog();
  const [formData, setFormData] = useState(data);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // DB-driven fields. While loading or empty, fall back to hardcoded per-country forms.
  const [dbFields, setDbFields] = useState<VisaFormField[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    getFormFields(country, visaId)
      .then(f => { if (alive) setDbFields(f); })
      .catch(e => console.warn('form fields load error', e))
      .finally(() => { if (alive) setDbLoaded(true); });
    return () => { alive = false; };
  }, [country, visaId]);

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

  const validateAndNext = async () => {
    // If DB is the source of truth, derive required fields from there
    const requiredFields = dbFields.length > 0
      ? ['firstName', 'lastName', ...dbFields.filter(f => f.required).map(f => f.field_key)]
      : getRequiredFields(country);
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
      await dialog.warning('Заполните все обязательные поля');
      return;
    }

    onNext();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      {/* Тот же паттерн что и в HotelBookingForm / FlightBookingForm:
          👤 иконка + "Личные данные" + LatinNotice. Один визуальный
          язык для всех анкет (визы + брони). */}
      <div className="flex items-center gap-2 mb-1.5">
        <User className="w-5 h-5 text-[#3B5BFF]" />
        <h3 className="text-sm font-bold text-[#0F2A36]">Личные данные</h3>
      </div>
      <LatinNotice className="mb-5" />

      {/* Universal name fields — рендерим только если их нет в БД (иначе будет дубль:
          DynamicForm рендерит свои firstName/lastName из visa_form_fields). */}
      {!dbFields.some(f => f.field_key === 'firstName' || f.field_key === 'lastName') && (
        <div className="space-y-4 mb-6 pb-6 border-b border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Имя" required error={errors.firstName}>
              <input
                type="text"
                value={formData.firstName || ''}
                onChange={(e) => updateField('firstName', e.target.value.toUpperCase())}
                placeholder="IVAN"
                className="form-input uppercase"
                autoComplete="given-name"
              />
            </FormField>
            <FormField label="Фамилия" required error={errors.lastName}>
              <input
                type="text"
                value={formData.lastName || ''}
                onChange={(e) => updateField('lastName', e.target.value.toUpperCase())}
                placeholder="IVANOV"
                className="form-input uppercase"
                autoComplete="family-name"
              />
            </FormField>
          </div>
        </div>
      )}

      {/* While DB load is in flight, show a spinner. After it settles, prefer DB-driven
          DynamicForm; fall back to legacy hardcoded country form only if DB has nothing
          for this country/visa. Once admin runs «Импортировать из кода» in FormBuilder,
          the legacy path goes away naturally. */}
      {!dbLoaded ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : dbFields.length > 0 ? (
        <DynamicForm fields={dbFields} formData={formData} updateField={updateField} errors={errors} />
      ) : (
        <>
          {country === 'Индия' && <IndiaForm formData={formData} updateField={updateField} errors={errors} />}
          {country === 'Вьетнам' && <VietnamForm formData={formData} updateField={updateField} errors={errors} />}
          {country === 'Шри-Ланка' && <SriLankaForm formData={formData} updateField={updateField} errors={errors} />}
          {country === 'Южная Корея' && <KoreaForm formData={formData} updateField={updateField} errors={errors} />}
          {country === 'Израиль' && <IsraelForm formData={formData} updateField={updateField} errors={errors} />}
          {country === 'Пакистан' && <PakistanForm formData={formData} updateField={updateField} errors={errors} />}
          {country === 'Камбоджа' && <CambodiaForm formData={formData} updateField={updateField} errors={errors} />}
          {country === 'Кения' && <KenyaForm formData={formData} updateField={updateField} errors={errors} />}
          {country === 'Филиппины' && <PhilippinesForm formData={formData} updateField={updateField} errors={errors} />}
        </>
      )}

      <div className="mt-6">
        <label className="block mb-2 text-gray-700">
          Как вы о нас узнали?
        </label>
        <select
          value={formData.howHeard || ''}
          onChange={(e) => updateField('howHeard', e.target.value)}
          className="form-input bg-white"
        >
          <option value="">Выберите вариант</option>
          <option value="telegram">Telegram</option>
          <option value="instagram">Instagram</option>
          <option value="youtube">YouTube</option>
          <option value="tiktok">TikTok</option>
          <option value="vk">ВКонтакте</option>
          <option value="rutube">RuTube</option>
          <option value="friends">Посоветовали друзья</option>
          <option value="repeat">Оформлял(-а) визу ранее</option>
        </select>
      </div>

      <button
        onClick={validateAndNext}
        className="w-full mt-6 vd-grad text-white py-4 rounded-2xl active:scale-[0.98] transition font-bold tracking-wide vd-shadow-cta flex items-center justify-center gap-2"
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
              'workplace', 'citiesInIndia', 'visitedIndiaBefore',
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
    'Филиппины': ['citizenship', 'birthCountry', 'working', 'residenceAddress', 'visitPurpose',
                  'flightNumber', 'departureAirport', 'stayDates', 'hotelAddress', 'companions',
                  'firstTimePhilippines'],
  };

  // Universal name fields apply to every country
  const universal = ['firstName', 'lastName'];
  return [...universal, ...(commonFields[country] || [])];
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

// ─── Date Input Component ──────────────────────────────────────────────────

function DateInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const toDisplay = (v: string) => {
    if (!v) return '';
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}.${m[2]}.${m[1]}`;
    return v;
  };

  const [display, setDisplay] = useState(() => toDisplay(value));

  useEffect(() => {
    const converted = toDisplay(value);
    if (converted !== display) setDisplay(converted);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = digits.slice(0, 2) + '.' + digits.slice(2, 4) + '.' + digits.slice(4);
    } else if (digits.length > 2) {
      formatted = digits.slice(0, 2) + '.' + digits.slice(2);
    }
    setDisplay(formatted);
    if (digits.length === 8) {
      const d = digits.slice(0, 2), mo = digits.slice(2, 4), y = digits.slice(4, 8);
      onChange(`${y}-${mo}-${d}`);
    } else {
      onChange('');
    }
  };

  // Reliable iOS WebView pattern: a transparent native <input type="date">
  // overlays the right edge where the 📅 icon sits. Tapping that area hits
  // the native input directly → native picker opens. Manual typing in the
  // visible text field still works because the date input is constrained to
  // a narrow right strip and sits above the 📅 icon (which is pointer-events:none).
  const dateIsoValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder={placeholder || 'дд.мм.гггг'}
        maxLength={10}
        className="form-input pr-12"
      />
      {/* 📅 icon — purely visual, taps pass through to the date input above */}
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base pointer-events-none select-none z-10">
        📅
      </span>
      {/* Native date picker — invisible but interactable, occupies the icon area */}
      <input
        type="date"
        value={dateIsoValue}
        onChange={(e) => {
          const iso = e.target.value;
          onChange(iso);
          setDisplay(toDisplay(iso));
        }}
        aria-label="Календарь"
        className="absolute right-0 top-0 bottom-0 w-12 opacity-0 cursor-pointer z-20"
        style={{ WebkitAppearance: 'none', appearance: 'none' }}
      />
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
        <DateInput
          value={formData.arrivalDate || ''}
          onChange={(v) => updateField('arrivalDate', v)}
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

      <FormField label="Какие страны посещали за последние 10 лет?" hint="необязательно">
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

      {formData.visitedIndiaBefore === 'yes' && (
        <div className="bg-blue-50 rounded-xl p-4 space-y-4 border border-blue-100">
          <p className="text-xs text-blue-600 font-medium">Данные предыдущего посещения (необязательно)</p>

          <FormField label="Тип предыдущей визы">
            <select
              value={formData.prevVisaType || ''}
              onChange={(e) => updateField('prevVisaType', e.target.value)}
              className="form-input"
            >
              <option value="">Выберите тип визы...</option>
              <option value="e_tourist">e-Tourist Visa (электронная туристическая)</option>
              <option value="e_business">e-Business Visa (электронная бизнес)</option>
              <option value="e_medical">e-Medical Visa (электронная медицинская)</option>
              <option value="e_conference">e-Conference Visa (электронная конференция)</option>
              <option value="sticker">Обычная стикерная виза</option>
              <option value="other">Другой тип</option>
            </select>
          </FormField>

          <FormField label="Номер предыдущей визы">
            <input
              type="text"
              value={formData.prevVisaNumber || ''}
              onChange={(e) => updateField('prevVisaNumber', e.target.value)}
              className="form-input"
              placeholder="Введите номер визы"
            />
          </FormField>

          <FormField label="Аэропорт въезда в Индию">
            <input
              type="text"
              value={formData.prevEntryAirport || ''}
              onChange={(e) => updateField('prevEntryAirport', e.target.value)}
              className="form-input"
              placeholder="Например: DEL, BOM, MAA"
            />
          </FormField>

          <FormField label="Дата посещения Индии">
            <DateInput
              value={formData.prevVisitDate || ''}
              onChange={(v) => updateField('prevVisitDate', v)}
            />
          </FormField>
        </div>
      )}

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
          <DateInput
            value={formData.plannedDateFrom || ''}
            onChange={(v) => updateField('plannedDateFrom', v)}
            placeholder="С дд.мм.гггг"
          />
          <DateInput
            value={formData.plannedDateTo || ''}
            onChange={(v) => updateField('plannedDateTo', v)}
            placeholder="По дд.мм.гггг"
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
        <DateInput
          value={formData.arrivalDate || ''}
          onChange={(v) => updateField('arrivalDate', v)}
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
          <DateInput
            value={formData.tripDateFrom || ''}
            onChange={(v) => updateField('tripDateFrom', v)}
            placeholder="С дд.мм.гггг"
          />
          <DateInput
            value={formData.tripDateTo || ''}
            onChange={(v) => updateField('tripDateTo', v)}
            placeholder="По дд.мм.гггг"
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
        <DateInput
          value={formData.arrivalDate || ''}
          onChange={(v) => updateField('arrivalDate', v)}
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
          <DateInput
            value={formData.stayDateFrom || ''}
            onChange={(v) => updateField('stayDateFrom', v)}
            placeholder="С дд.мм.гггг"
          />
          <DateInput
            value={formData.stayDateTo || ''}
            onChange={(v) => updateField('stayDateTo', v)}
            placeholder="По дд.мм.гггг"
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
        <DateInput
          value={formData.expectedEntryDate || ''}
          onChange={(v) => updateField('expectedEntryDate', v)}
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
          <DateInput
            value={formData.arrivalDate || ''}
            onChange={(v) => updateField('arrivalDate', v)}
            placeholder="Прилет"
          />
          <DateInput
            value={formData.departureDate || ''}
            onChange={(v) => updateField('departureDate', v)}
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

// Philippines Form Component
function PhilippinesForm({ formData, updateField, errors }: any) {
  return (
    <div className="space-y-4">
      <FormField label="Гражданство" required error={errors.citizenship}>
        <CitizenshipSelect value={formData.citizenship || ''} onChange={(v) => updateField('citizenship', v)} error={errors.citizenship} />
      </FormField>

      <FormField label="Страна рождения" required error={errors.birthCountry}>
        <CitizenshipSelect value={formData.birthCountry || ''} onChange={(v) => updateField('birthCountry', v)} error={errors.birthCountry} />
      </FormField>

      <FormField
        label="Вы работаете?"
        required
        hint="если да, укажите название компании и должность"
        error={errors.working}
      >
        <textarea
          value={formData.working || ''}
          onChange={(e) => updateField('working', e.target.value)}
          className="form-input min-h-20"
          placeholder="Нет / ООО «Компания», менеджер"
        />
      </FormField>

      <FormField
        label="Адрес проживания"
        required
        hint="индекс / область / город / улица / дом"
        error={errors.residenceAddress}
      >
        <textarea
          value={formData.residenceAddress || ''}
          onChange={(e) => updateField('residenceAddress', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Цель приезда на Филиппины"
        required
        error={errors.visitPurpose}
      >
        <input
          type="text"
          value={formData.visitPurpose || ''}
          onChange={(e) => updateField('visitPurpose', e.target.value)}
          className="form-input"
          placeholder="Туризм"
        />
      </FormField>

      <FormField
        label="Номер рейса и название авиакомпании"
        required
        error={errors.flightNumber}
      >
        <input
          type="text"
          value={formData.flightNumber || ''}
          onChange={(e) => updateField('flightNumber', e.target.value)}
          className="form-input"
          placeholder="SU 270 / Aeroflot"
        />
      </FormField>

      <FormField
        label="Аэропорт вылета"
        required
        error={errors.departureAirport}
      >
        <input
          type="text"
          value={formData.departureAirport || ''}
          onChange={(e) => updateField('departureAirport', e.target.value)}
          className="form-input"
          placeholder="SVO / Москва Шереметьево"
        />
      </FormField>

      <FormField
        label="Даты пребывания на Филиппинах"
        required
        hint="с какого по какое число"
        error={errors.stayDates}
      >
        <div className="grid grid-cols-2 gap-3">
          <DateInput
            value={formData.stayDateFrom || ''}
            onChange={(v) => updateField('stayDateFrom', v)}
            placeholder="С дд.мм.гггг"
          />
          <DateInput
            value={formData.stayDateTo || ''}
            onChange={(v) => updateField('stayDateTo', v)}
            placeholder="По дд.мм.гггг"
          />
        </div>
      </FormField>

      <FormField
        label="Если будет транзит, укажите страну и аэропорт"
        hint="пропустите, если нет"
      >
        <input
          type="text"
          value={formData.transit || ''}
          onChange={(e) => updateField('transit', e.target.value)}
          className="form-input"
          placeholder="Нет / Сингапур, Changi Airport"
        />
      </FormField>

      <FormField
        label="Адрес отеля на Филиппинах"
        required
        hint="наименование / адрес / телефон"
        error={errors.hotelAddress}
      >
        <textarea
          value={formData.hotelAddress || ''}
          onChange={(e) => updateField('hotelAddress', e.target.value)}
          className="form-input min-h-20"
        />
      </FormField>

      <FormField
        label="Сопровождает ли кто-то?"
        required
        hint="если да — укажите ФИО и данные"
        error={errors.companions}
      >
        <textarea
          value={formData.companions || ''}
          onChange={(e) => updateField('companions', e.target.value)}
          className="form-input min-h-20"
          placeholder="Нет"
        />
      </FormField>

      <FormField
        label="Первый раз на Филиппинах?"
        required
        error={errors.firstTimePhilippines}
      >
        <select
          value={formData.firstTimePhilippines || ''}
          onChange={(e) => updateField('firstTimePhilippines', e.target.value)}
          className="form-input"
        >
          <option value="">Выберите...</option>
          <option value="yes">Да, первый раз</option>
          <option value="no">Нет, был(а) раньше</option>
        </select>
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
// ─── Generic DB-driven form renderer ──────────────────────────────────────────
// Used when admin has populated visa_form_fields in DB (via FormBuilder).
// Dispatches by field_type to existing widgets so we keep the same visual style.
function DynamicForm({
  fields, formData, updateField, errors,
}: {
  fields: VisaFormField[];
  formData: Record<string, any>;
  updateField: (k: string, v: any) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      {fields.map(f => (
        <DynamicField
          key={f.id}
          field={f}
          value={formData[f.field_key]}
          onChange={(v) => updateField(f.field_key, v)}
          error={errors[f.field_key]}
        />
      ))}
    </div>
  );
}

function DynamicField({
  field, value, onChange, error,
}: {
  field: VisaFormField;
  value: any;
  onChange: (v: any) => void;
  error?: string;
}) {
  const { field_type, label, required, placeholder, comment, options, warning } = field;
  const placeholderStr = placeholder ?? "";

  let input: React.ReactNode;
  switch (field_type) {
    case "citizenship":
      input = <CitizenshipSelect value={value || ""} onChange={onChange} error={error} />;
      break;
    case "countries-multi":
      input = <CountriesMultiSelect value={value || []} onChange={onChange} />;
      break;
    case "south-asia-visits":
      input = <SouthAsiaVisitsSelect value={value || []} onChange={onChange} />;
      break;
    case "date":
      input = <DateInput value={value || ""} onChange={onChange} />;
      break;
    case "textarea":
      input = (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholderStr}
          className="form-input min-h-[80px]"
          rows={3}
        />
      );
      break;
    case "select":
      input = (
        <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="form-input">
          <option value="">Выберите...</option>
          {(options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
      break;
    case "radio":
      input = (
        <div className="space-y-2">
          {(options ?? []).map(o => (
            <label key={o} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name={field.id} value={o} checked={value === o} onChange={() => onChange(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      );
      break;
    case "file":
      input = (
        <input type="file" onChange={(e) => onChange(e.target.files?.[0] || null)} className="form-input" />
      );
      break;
    default: {
      // firstName / lastName forced to uppercase (passport convention)
      const isNameField = field.field_key === "firstName" || field.field_key === "lastName";
      input = (
        <input
          type={field_type}
          value={value || ""}
          onChange={(e) => onChange(isNameField ? e.target.value.toUpperCase() : e.target.value)}
          placeholder={placeholderStr}
          className={`form-input ${isNameField ? "uppercase" : ""}`}
          autoComplete={field.field_key === "firstName" ? "given-name" : field.field_key === "lastName" ? "family-name" : undefined}
        />
      );
    }
  }

  return (
    <FormField label={label} required={required} hint={comment ?? undefined} error={error}>
      {input}
      {warning && <p className="text-sm text-amber-600 mt-1">{warning}</p>}
    </FormField>
  );
}
