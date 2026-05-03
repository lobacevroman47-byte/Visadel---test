import React, { useState } from 'react';
import { Search, Eye, Upload, X, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { statusLabels, statusColors } from '../data/mockData';
import {
  useAdminApplications,
  updateApplicationStatus,
  uploadVisaFile,
  type AdminApplication as Application,
} from '../hooks/useAdminData';

interface ApplicationsProps {
  filter?: { filter?: 'all' | 'in_progress' };
}

// ── Human-readable field labels ───────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  // Common
  citizenship: 'Гражданство',
  birthCountry: 'Страна рождения',
  birthCity: 'Город рождения',
  previousName: 'Предыдущее имя/фамилия',
  previousCitizenship: 'Предыдущее гражданство',
  secondCitizenship: 'Второе гражданство',
  internalPassport: 'Внутренний паспорт',
  residedTwoYears: 'Проживал 2+ лет в стране оформления',
  registrationAddress: 'Адрес регистрации',
  residenceAddress: 'Адрес проживания',
  currentAddress: 'Текущий адрес',
  fatherData: 'Данные отца',
  motherData: 'Данные матери',
  maritalStatus: 'Семейное положение',
  spouseInfo: 'Данные супруга/супруги',
  workplace: 'Место работы',
  visaRefusal: 'Отказы в визе ранее',
  citiesInIndia: 'Города в Индии',
  countriesVisited: 'Посещённые страны',
  visitedIndiaBefore: 'Был ранее в Индии',
  prevVisaType: 'Тип предыдущей визы',
  prevVisaNumber: 'Номер предыдущей визы',
  prevEntryAirport: 'Аэропорт въезда (прошлый раз)',
  prevVisitDate: 'Дата предыдущего посещения',
  southAsiaVisits: 'Посещения Южной Азии',
  hotelInfo: 'Отель',
  emergencyContact: 'Контакт на экстренный случай',
  airport: 'Аэропорт прилёта',
  arrivalDate: 'Дата прилёта',
  // Vietnam
  vietnamViolations: 'Нарушения законов Вьетнама',
  oldPassport: 'Старый паспорт',
  plannedDateFrom: 'Дата въезда',
  plannedDateTo: 'Дата выезда',
  registrationAddress2: 'Адрес регистрации',
  visitPurpose: 'Цель визита',
  contactsInVietnam: 'Контакты во Вьетнаме',
  arrivalAirport: 'Аэропорт прилёта',
  departureAirport: 'Аэропорт вылета',
  addressInVietnam: 'Адрес во Вьетнаме',
  previousVietnamVisits: 'Предыдущие визиты во Вьетнам',
  childInfo: 'Данные ребёнка',
  insuranceInfo: 'Страховка',
  expectedExpenses: 'Ожидаемые расходы ($)',
  workOrStudy: 'Работа/учёба',
  // Sri Lanka
  lastCountry: 'Страна за 14 дней до вылета',
  arrivalDate2: 'Дата прибытия',
  airline: 'Авиакомпания',
  addressInSriLanka: 'Адрес на Шри-Ланке',
  hasResidentVisa: 'Резидентская виза',
  hasExtension: 'Продление разрешения',
  hasMultipleVisa: 'Многократная виза',
  // Korea
  tripPurpose: 'Цель поездки',
  beenToKorea: 'Был в Корее ранее',
  dualCitizenship: 'Двойное гражданство',
  hasCriminalRecord: 'Судимости',
  hasDiseases: 'Опасные заболевания',
  hasContacts: 'Знакомые в Корее',
  traveling: 'Сопровождающие',
  working: 'Работа',
  tripDateFrom: 'Дата въезда в Корею',
  tripDateTo: 'Дата выезда из Кореи',
  addressInKorea: 'Адрес в Корее',
  // Israel
  isBiometric: 'Биометрический паспорт',
  hasSecondCitizenship: 'Второе гражданство',
  fatherData2: 'Данные отца',
  motherData2: 'Данные матери',
  homeAddress: 'Домашний адрес',
  // Pakistan
  daysInPakistan: 'Дней в Пакистане',
  entryPort: 'Порт въезда',
  exitPort: 'Порт выезда',
  stayDateFrom: 'Дата въезда',
  stayDateTo: 'Дата выезда',
  parentsData: 'Данные родителей',
  workInfo: 'Место работы',
  plannedAddress: 'Адрес проживания',
  // Kenya
  profession: 'Профессия',
  arrivalDate3: 'Дата прилёта',
  departureDate: 'Дата вылета',
  fromCountry: 'Страна вылета в Кению',
  exitAirline: 'Авиакомпания при выезде',
  toCountry: 'Страна назначения при выезде',
  addressInKenya: 'Адрес в Кении',
  convicted: 'Судимости за 5 лет',
  deniedEntry: 'Отказ въезда в Кению',
  beenToKenya: 'Был в Кении ранее',
  bringCurrency: 'Ввоз валюты >5000$',
};

const HOW_HEARD_LABELS: Record<string, string> = {
  telegram: 'Telegram', youtube: 'YouTube', instagram: 'Instagram',
  tiktok: 'TikTok', vk: 'VK', rutube: 'RuTube',
  friends: 'Посоветовали друзья', repeat: 'Оформлял(-а) ранее',
};

const MARITAL_LABELS: Record<string, string> = {
  single: 'Холост/Не замужем', married: 'Женат/Замужем',
  divorced: 'Разведён(а)', widowed: 'Вдовец/Вдова',
};

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'maritalStatus') return MARITAL_LABELS[value as string] ?? String(value);
  if (key === 'residedTwoYears' || key === 'isBiometric' || key === 'hasSecondCitizenship' ||
      key === 'beenToKorea' || key === 'dualCitizenship' || key === 'hasCriminalRecord' ||
      key === 'hasDiseases' || key === 'hasResidentVisa' || key === 'hasExtension' ||
      key === 'hasMultipleVisa' || key === 'convicted' || key === 'deniedEntry' ||
      key === 'beenToKenya' || key === 'visitedIndiaBefore') {
    return value === 'yes' ? 'Да' : value === 'no' ? 'Нет' : String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    if (key === 'southAsiaVisits') {
      return (value as { country: string; year: string; count: string }[])
        .map(v => `${v.country}: ${v.year}г., ${v.count} раз`)
        .join('; ');
    }
    return value.join(', ');
  }
  return String(value);
}

const PHOTO_LABELS: Record<string, string> = {
  facePhoto: 'Фото лица',
  passportPhoto: 'Фото загранпаспорта',
  previousVisa: 'Предыдущая виза (Индия)',
  indiaStamps: 'Штампы Индии',
  secondPassport: 'Второй паспорт (Корея)',
  hotelFile: 'Бронирование отеля',
  ticketFile: 'Авиабилет',
};

function FilePreview({ url, label }: { url: string; label: string }) {
  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(url) || url.includes('photos/') || url.includes('payments/');
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
        <p className="text-xs font-medium text-gray-600">{label}</p>
        <a href={url} target="_blank" rel="noreferrer"
          className="text-xs text-blue-500 hover:underline flex items-center gap-1">
          Открыть <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      {isImage && (
        <div className="p-2 bg-white">
          <img src={url} alt={label} className="w-full max-h-48 object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}

// ── Full Form Data Renderer ───────────────────────────────────────────────────
const FormDataView: React.FC<{ app: Application }> = ({ app }) => {
  const fd = app.formData as {
    basicData?: Record<string, unknown>;
    contactInfo?: Record<string, string>;
    additionalDocs?: Record<string, boolean>;
    howHeard?: string[];
    photoUrls?: Record<string, string | null>;
  };

  const basicData = fd.basicData ?? {};
  const contactInfo = fd.contactInfo ?? {};
  const additionalDocs = fd.additionalDocs ?? {};
  const howHeard = fd.howHeard ?? [];
  const photoUrls = fd.photoUrls ?? {};

  const extras = [];
  if (additionalDocs.urgentProcessing) extras.push('Срочное оформление');
  if (additionalDocs.hotelBooking) extras.push('Подтверждение бронирования');
  if (additionalDocs.returnTicket) extras.push('Бронирование авиабилета');

  const photoEntries = Object.entries(photoUrls).filter(([, url]) => !!url);

  return (
    <div className="space-y-6">
      {/* Contact */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Контакты</h4>
        <div className="grid grid-cols-2 gap-2">
          {contactInfo.telegram && (
            <div className="col-span-2">
              <p className="text-xs text-gray-500">Telegram</p>
              <a href={`https://t.me/${contactInfo.telegram.replace('@', '')}`} target="_blank" rel="noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                @{contactInfo.telegram.replace('@', '')} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {contactInfo.phone && (
            <div><p className="text-xs text-gray-500">Телефон</p><p className="text-sm">{contactInfo.phone}</p></div>
          )}
          {contactInfo.email && (
            <div><p className="text-xs text-gray-500">Email</p><p className="text-sm">{contactInfo.email}</p></div>
          )}
        </div>
      </section>

      {/* Basic data */}
      {Object.keys(basicData).length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Анкетные данные</h4>
          <div className="space-y-2">
            {Object.entries(basicData).map(([key, value]) => {
              const label = FIELD_LABELS[key] ?? key;
              const formatted = formatValue(key, value);
              if (formatted === '—') return null;
              return (
                <div key={key} className="p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{formatted}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Extras */}
      {extras.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Дополнительные услуги</h4>
          <div className="flex flex-wrap gap-2">
            {extras.map(e => (
              <span key={e} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">{e}</span>
            ))}
          </div>
        </section>
      )}

      {/* How heard */}
      {howHeard.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Откуда узнали</h4>
          <p className="text-sm text-gray-700">{howHeard.map(v => HOW_HEARD_LABELS[v] ?? v).join(', ')}</p>
        </section>
      )}

      {/* Uploaded files / photos */}
      {photoEntries.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Загруженные файлы</h4>
          <div className="space-y-3">
            {photoEntries.map(([key, url]) => (
              <FilePreview key={key} url={url!} label={PHOTO_LABELS[key] ?? key} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// ── Application Modal ─────────────────────────────────────────────────────────
const ApplicationModal: React.FC<{ application: Application; onClose: () => void }> = ({ application, onClose }) => {
  const [status, setStatus] = useState(application.status);
  const [visaFile, setVisaFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'form' | 'payment'>('info');

  const tgUsername = (application.telegram ?? '').replace('@', '') ||
    ((application.formData as { contactInfo?: { telegram?: string } })?.contactInfo?.telegram ?? '').replace('@', '');

  const handleSave = async () => {
    setSaving(true);
    try {
      let visaUrl: string | undefined;
      if (visaFile && status === 'completed') {
        const url = await uploadVisaFile(visaFile);
        visaUrl = url ?? undefined;
      }
      await updateApplicationStatus(application.id, status, visaUrl);
      alert('Изменения сохранены');
      onClose();
    } catch {
      alert('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">{application.countryFlag}</span>
              <h2 className="text-lg font-semibold text-gray-800">Заявка {application.id}</h2>
            </div>
            {tgUsername ? (
              <a
                href={`https://t.me/${tgUsername}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-500 hover:underline flex items-center gap-1 mt-0.5"
              >
                @{tgUsername} <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <p className="text-sm text-gray-500 mt-0.5">{application.clientName}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 shrink-0">
          {(['info', 'form', 'payment'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition ${
                activeTab === tab ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'info' ? 'Основное' : tab === 'form' ? 'Анкета' : 'Оплата'}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-5">

          {/* ── Tab: Основное ── */}
          {activeTab === 'info' && (
            <div className="space-y-5">
              {/* Клиент */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">ФИО / имя</p>
                  <p className="text-sm font-medium">{application.clientName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Telegram</p>
                  {tgUsername ? (
                    <a href={`https://t.me/${tgUsername}`} target="_blank" rel="noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                      @{tgUsername} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : <p className="text-sm">—</p>}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Телефон</p>
                  <p className="text-sm">{application.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm">{application.email || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Дата подачи</p>
                  <p className="text-sm">{new Date(application.date).toLocaleDateString('ru-RU')}</p>
                </div>
              </div>

              {/* Оплата */}
              <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Стоимость</p>
                  <p className="text-xl text-blue-600 font-semibold">{application.cost.toLocaleString('ru-RU')} ₽</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Бонусы</p>
                  <p className="text-xl text-green-600 font-semibold">{application.bonusesUsed} ₽</p>
                </div>
              </div>

              {/* Статус */}
              <div>
                <label className="block text-sm text-gray-700 mb-2 font-medium">Статус заявки</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Application['status'])}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="draft">Черновик</option>
                  <option value="pending_payment">Ожидает оплаты</option>
                  <option value="pending_confirmation">Ожидает подтверждения</option>
                  <option value="in_progress">В работе</option>
                  <option value="completed">Готово</option>
                </select>
              </div>

              {/* Upload visa — only when status = completed */}
              {status === 'completed' && (
                <div>
                  <label className="block text-sm text-gray-700 mb-2 font-medium">Загрузить готовую визу</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center">
                    <Upload className="mx-auto mb-2 text-gray-400" size={28} />
                    <p className="text-sm text-gray-500 mb-2">Перетащите файл или нажмите для выбора</p>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setVisaFile(e.target.files?.[0] || null)}
                      className="hidden" id="visa-upload"
                    />
                    <label htmlFor="visa-upload"
                      className="inline-block px-4 py-2 bg-gray-100 text-sm rounded-lg cursor-pointer hover:bg-gray-200 transition">
                      Выбрать файл
                    </label>
                    {visaFile && <p className="text-sm text-green-600 mt-2">✓ {visaFile.name}</p>}
                  </div>
                </div>
              )}

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          )}

          {/* ── Tab: Анкета ── */}
          {activeTab === 'form' && (
            Object.keys(application.formData ?? {}).length > 0
              ? <FormDataView app={application} />
              : <p className="text-center text-gray-400 py-12 text-sm">Данные анкеты не сохранены</p>
          )}

          {/* ── Tab: Оплата ── */}
          {activeTab === 'payment' && (
            <div className="space-y-5">
              {/* Payment screenshot */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Скриншот оплаты</h4>
                {application.paymentProofUrl ? (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-600">Чек / скриншот перевода</p>
                      <a href={application.paymentProofUrl} target="_blank" rel="noreferrer"
                        className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                        Открыть <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="p-2 bg-white">
                      <img
                        src={application.paymentProofUrl}
                        alt="Скриншот оплаты"
                        className="w-full max-h-72 object-contain rounded-lg"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-400 text-center">
                    Скриншот оплаты не загружен
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Стоимость</span>
                  <span className="font-semibold text-blue-600">{application.cost.toLocaleString('ru-RU')} ₽</span>
                </div>
                {application.bonusesUsed > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Списано бонусов</span>
                    <span className="text-green-600">−{application.bonusesUsed} ₽</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-500">Итого к оплате</span>
                  <span className="font-bold text-gray-800">{(application.cost - application.bonusesUsed).toLocaleString('ru-RU')} ₽</span>
                </div>
              </div>

              {/* Ready visa */}
              {application.visaFileUrl && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Готовая виза</h4>
                  <a href={application.visaFileUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 p-3 bg-green-50 rounded-xl text-green-700 text-sm hover:bg-green-100 transition">
                    <ExternalLink className="w-4 h-4" /> Скачать / открыть визу
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Applications List ─────────────────────────────────────────────────────────
export const Applications: React.FC<ApplicationsProps> = ({ filter }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(filter?.filter === 'in_progress' ? 'in_progress' : 'all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  const { applications, loading, refetch } = useAdminApplications();
  const countries = Array.from(new Set(applications.map(app => app.country)));

  const filteredApplications = applications.filter(app => {
    const tg = ((app.formData as { contactInfo?: { telegram?: string } })?.contactInfo?.telegram ?? app.telegram ?? '').toLowerCase();
    const matchesSearch =
      app.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.phone.includes(searchQuery) ||
      app.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tg.includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesCountry = countryFilter === 'all' || app.country === countryFilter;
    return matchesSearch && matchesStatus && matchesCountry;
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1>Заявки</h1>
        <div className="flex items-center gap-3">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button onClick={refetch} className="p-2 hover:bg-gray-100 rounded-lg transition" title="Обновить">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
          <div className="text-sm text-gray-600">Всего: {filteredApplications.length} из {applications.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Поиск по имени, Telegram, телефону, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              />
            </div>
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]">
            <option value="all">Все статусы</option>
            <option value="draft">Черновик</option>
            <option value="pending_payment">Ожидает оплаты</option>
            <option value="pending_confirmation">Ожидает подтверждения</option>
            <option value="in_progress">В работе</option>
            <option value="completed">Готово</option>
          </select>
          <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]">
            <option value="all">Все страны</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
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
                <th className="px-6 py-3 text-left text-xs text-gray-600">Клиент / Telegram</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Телефон</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Стоимость</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Бонусы</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Статус</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Дата</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredApplications.map((app) => {
                const tgUser = ((app.formData as { contactInfo?: { telegram?: string } })?.contactInfo?.telegram ?? app.telegram ?? '').replace('@', '');
                return (
                  <tr key={app.id} className="hover:bg-[#F5F7FA]">
                    <td className="px-6 py-4 text-sm">{app.id}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="mr-1">{app.countryFlag}</span>{app.country}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div>{app.clientName}</div>
                      {tgUser && (
                        <a href={`https://t.me/${tgUser}`} target="_blank" rel="noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                          @{tgUser} <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">{app.phone}</td>
                    <td className="px-6 py-4 text-sm text-blue-600">{app.cost.toLocaleString('ru-RU')} ₽</td>
                    <td className="px-6 py-4 text-sm text-green-600">
                      {app.bonusesUsed > 0 ? `-${app.bonusesUsed} ₽` : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-2 py-1 rounded text-xs text-white"
                        style={{ backgroundColor: statusColors[app.status] }}>
                        {statusLabels[app.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(app.date).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button onClick={() => setSelectedApp(app)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition" title="Просмотр заявки">
                        <Eye size={18} className="text-[#2196F3]" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedApp && (
        <ApplicationModal application={selectedApp} onClose={() => setSelectedApp(null)} />
      )}
    </div>
  );
};
