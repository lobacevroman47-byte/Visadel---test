import { ChevronRight, ChevronLeft, AlertTriangle, FileText, User, Sparkles, Megaphone, Mail, Camera, CheckCircle2 } from 'lucide-react';
import type { FormData } from '../ApplicationForm';
import type { VisaOption } from '../../App';
import { Button } from '../ui/brand';

interface Step6Props {
  formData: FormData;
  visa: VisaOption;
  urgent: boolean;
  totalPrice: number;
  addonPrices: { urgent: number; hotel: number; ticket: number };
  onNext: () => void;
  onPrev: () => void;
}

// Карточка-секция в стиле Step7Payment: белый фон, иконка с brand-градиентом
// в квадрате слева, заголовок справа, контент ниже.
function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl vd-grad flex items-center justify-center text-white shadow-md flex-shrink-0">
          {icon}
        </div>
        <h3 className="text-[#0F2A36] font-bold text-sm pt-2.5">{title}</h3>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

// Одна строка «Лейбл / Значение» внутри SectionCard — grid 50/50 с переносом
// длинных строк (min-w-0 break-words не даёт label наезжать на value).
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <span className="text-[#0F2A36]/60 min-w-0 break-words">{label}</span>
      <span className="text-[#0F2A36] font-medium min-w-0 break-words">{value}</span>
    </div>
  );
}

export default function Step6Review({ formData, visa, totalPrice, addonPrices, onNext, onPrev }: Step6Props) {
  const howHeardValue = formData.basicData.howHeard || formData.howHeard[0];
  const howHeardLabel = howHeardValue ? (HOW_HEARD_LABELS[String(howHeardValue)] ?? String(howHeardValue)) : null;

  const additionalPhotoKeys = Object.keys(formData.photos.additionalPhotos)
    .filter(key => formData.photos.additionalPhotos[key]);

  // Срочные Вьетнамские визы — аддон не суммируется (уже в цене).
  const isVietnamUrgentVisa = visa.country === 'Вьетнам' && /^vietnam-(3d|2d|1d|4h|2h)-/.test(visa.id);

  return (
    <div className="bg-[#F5F7FA] rounded-2xl shadow-lg p-6">
      {/* Header — единый шапочный шаблон с Step7Payment */}
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold">Финал · Шаг 5 из 6</p>
        <h2 className="text-[26px] font-extrabold tracking-tight text-[#0F2A36] mt-1">Проверка</h2>
        <p className="text-sm text-[#0F2A36]/60 mt-1">Проверьте данные перед оплатой</p>
      </div>

      {/* Warning — мягче чем раньше: тот же тон что в Step7 trust-strip */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-900 leading-relaxed">
          Внимательно проверьте все данные. Фото должно быть свежим. Любые ошибки могут привести к отказу в выдаче визы.
        </p>
      </div>

      <div className="space-y-3 mb-4">
        {/* Информация о визе */}
        <SectionCard icon={<FileText className="w-5 h-5" />} title="Информация о визе">
          <Row label="Страна" value={visa.country} />
          <Row label="Тип визы" value={visa.type} />
          <Row label="Срочное оформление" value={formData.additionalDocs.urgentProcessing ? 'Да' : 'Нет'} />
        </SectionCard>

        {/* Основные данные (country-specific) */}
        {Object.keys(formData.basicData).length > 0 && (
          <SectionCard icon={<User className="w-5 h-5" />} title="Основные данные">
            {Object.entries(formData.basicData).map(([key, value]) => {
              if (!value || value === '') return null;
              if (key === 'howHeard') return null;
              const label = getFieldLabel(key);
              const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
              return <Row key={key} label={label} value={displayValue} />;
            })}
          </SectionCard>
        )}

        {/* Усиление заявки */}
        {(formData.additionalDocs.hotelBooking || formData.additionalDocs.returnTicket) && (
          <SectionCard icon={<Sparkles className="w-5 h-5" />} title="Усиление заявки">
            {formData.additionalDocs.hotelBooking && (
              <div className="flex items-center gap-2 text-sm text-[#0F2A36]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Подтверждение проживания <span className="text-[#0F2A36]/60">(+{addonPrices.hotel}₽)</span></span>
              </div>
            )}
            {formData.additionalDocs.returnTicket && (
              <div className="flex items-center gap-2 text-sm text-[#0F2A36]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Подтверждение обратного билета <span className="text-[#0F2A36]/60">(+{addonPrices.ticket}₽)</span></span>
              </div>
            )}
          </SectionCard>
        )}

        {/* Как узнали о нас */}
        {howHeardLabel && (
          <SectionCard icon={<Megaphone className="w-5 h-5" />} title="Как узнали о нас">
            <span className="inline-block bg-[#EAF1FF] text-[#3B5BFF] text-xs font-semibold px-3 py-1.5 rounded-full">
              {howHeardLabel}
            </span>
          </SectionCard>
        )}

        {/* Контактные данные */}
        <SectionCard icon={<Mail className="w-5 h-5" />} title="Контактные данные">
          <Row label="Email" value={formData.contactInfo.email || '—'} />
          <Row label="Телефон" value={formData.contactInfo.phone || '—'} />
          <Row label="Telegram" value={formData.contactInfo.telegram ? `@${formData.contactInfo.telegram}` : '—'} />
        </SectionCard>

        {/* Загруженные фото */}
        <SectionCard icon={<Camera className="w-5 h-5" />} title="Загруженные фото">
          <div className="flex items-center gap-2 text-sm text-[#0F2A36]">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Фото лица{formData.photos.facePhoto ? <span className="text-[#0F2A36]/60"> ({formData.photos.facePhoto.name})</span> : null}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#0F2A36]">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Фото загранпаспорта{formData.photos.passportPhoto ? <span className="text-[#0F2A36]/60"> ({formData.photos.passportPhoto.name})</span> : null}</span>
          </div>
          {additionalPhotoKeys.map(key => (
            <div key={key} className="flex items-center gap-2 text-sm text-[#0F2A36]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{getFieldLabel(key)}{formData.photos.additionalPhotos[key] ? <span className="text-[#0F2A36]/60"> ({formData.photos.additionalPhotos[key]!.name})</span> : null}</span>
            </div>
          ))}
        </SectionCard>
      </div>

      {/* Итого — той же визуальной природы что и в Step7Payment */}
      <div className="vd-grad-soft rounded-2xl p-5 mb-4 border border-blue-100/60">
        <p className="text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold mb-3">Детали оплаты</p>
        <div className="space-y-2.5 mb-3">
          <div className="flex items-start justify-between gap-3 text-sm">
            <span className="text-[#0F2A36]/70 leading-snug min-w-0 break-words">Стоимость визы</span>
            <span className="text-[#0F2A36] font-semibold whitespace-nowrap shrink-0 tabular-nums">{visa.price.toLocaleString('ru-RU')} ₽</span>
          </div>
          {formData.additionalDocs.urgentProcessing && !isVietnamUrgentVisa && (
            <div className="flex items-start justify-between gap-3 text-sm">
              <span className="text-[#0F2A36]/70 leading-snug min-w-0 break-words">Срочное оформление</span>
              <span className="text-[#0F2A36] font-semibold whitespace-nowrap shrink-0 tabular-nums">+{addonPrices.urgent.toLocaleString('ru-RU')} ₽</span>
            </div>
          )}
          {formData.additionalDocs.hotelBooking && (
            <div className="flex items-start justify-between gap-3 text-sm">
              <span className="text-[#0F2A36]/70 leading-snug min-w-0 break-words">Подтверждение бронирования жилья</span>
              <span className="text-[#0F2A36] font-semibold whitespace-nowrap shrink-0 tabular-nums">+{addonPrices.hotel.toLocaleString('ru-RU')} ₽</span>
            </div>
          )}
          {formData.additionalDocs.returnTicket && (
            <div className="flex items-start justify-between gap-3 text-sm">
              <span className="text-[#0F2A36]/70 leading-snug min-w-0 break-words">Бронирование авиабилета</span>
              <span className="text-[#0F2A36] font-semibold whitespace-nowrap shrink-0 tabular-nums">+{addonPrices.ticket.toLocaleString('ru-RU')} ₽</span>
            </div>
          )}
        </div>
        <div className="border-t border-blue-200/60 pt-3 flex items-baseline justify-between gap-3">
          <span className="text-[#0F2A36] font-bold">Итого</span>
          <span className="text-2xl vd-grad-text font-extrabold tracking-tight whitespace-nowrap shrink-0 tabular-nums">
            {totalPrice.toLocaleString('ru-RU')} ₽
          </span>
        </div>
      </div>

      {/* Кнопки — те же варианты что в Step7 (primary CTA + secondary назад) */}
      <div className="space-y-3">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="!py-4 !rounded-2xl !font-bold"
          onClick={onNext}
          rightIcon={<ChevronRight className="w-5 h-5" />}
        >
          К оплате
        </Button>
        <Button
          variant="secondary"
          size="md"
          fullWidth
          className="!py-3 !rounded-2xl !bg-gray-100 !border-0 !text-[#0F2A36]/70 hover:!bg-gray-200"
          onClick={onPrev}
          leftIcon={<ChevronLeft className="w-4 h-4" />}
        >
          Назад
        </Button>
      </div>
    </div>
  );
}

// Маппинг значений источника трафика (howHeard) → человеческое название.
const HOW_HEARD_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  vk: 'ВКонтакте',
  rutube: 'RuTube',
  friends: 'Посоветовали друзья',
  repeat: 'Оформлял(-а) ранее',
};

// Универсальный словарь русских лейблов для всех ключей в form_data.
// Покрывает: 9 визовых стран + продление + контакты + брони + динамические
// поля визовых форм. Если в БД лежит запись со старыми/новыми именами ключей —
// все мапируется здесь в одно место.
//
// Если ключа нет — fallback humanizeKey() пытается разбить camelCase на слова
// (firstTimePhilippines → «First time philippines»). Это не идеально, но
// лучше чем raw camelCase.
const FIELD_LABELS: Record<string, string> = {
  // ── Universal / identity ────────────────────────────────────────────────
  firstName: 'Имя',
  lastName: 'Фамилия',
  middleName: 'Отчество',
  patronymic: 'Отчество',
  fullName: 'ФИО',
  email: 'Email',
  phone: 'Телефон',
  phoneRussia: 'Телефон в РФ',
  phoneSriLanka: 'Телефон на Шри-Ланке',
  telegram: 'Telegram',
  telegramLogin: 'Telegram',
  birthDate: 'Дата рождения',
  gender: 'Пол',
  passportNumber: 'Номер паспорта',
  passportSeries: 'Серия и номер паспорта',
  homeAddress: 'Домашний адрес',
  registrationAddress: 'Адрес регистрации',
  residenceAddress: 'Адрес проживания',
  currentAddress: 'Текущий адрес',
  plannedAddress: 'Планируемый адрес',
  citizenship: 'Гражданство',
  secondCitizenship: 'Второе гражданство',
  hasSecondCitizenship: 'Второе гражданство',
  previousCitizenship: 'Предыдущее гражданство',
  dualCitizenship: 'Двойное гражданство',
  birthCountry: 'Страна рождения',
  birthCity: 'Город рождения',
  maritalStatus: 'Семейное положение',
  spouseInfo: 'Информация о супруге',
  fatherData: 'Данные отца',
  fatherInfo: 'Данные отца',
  motherData: 'Данные матери',
  motherInfo: 'Данные матери',
  parentsData: 'Данные родителей',
  parentsInfo: 'Данные родителей',
  childInfo: 'Информация о ребёнке',
  workplace: 'Место работы',
  workInfo: 'Информация о работе',
  workOrStudy: 'Работа / учёба',
  working: 'Работаете',
  employment: 'Работа',
  profession: 'Профессия',
  previousName: 'Предыдущие Ф.И.О',
  internalPassport: 'Серия и номер внутреннего паспорта',
  isBiometric: 'Биометрический паспорт',
  biometricPassport: 'Биометрический паспорт',
  countriesVisited: 'Посещённые страны',
  emergencyContact: 'Экстренный контакт',
  howHeard: 'Откуда узнали о нас',
  militaryService: 'Служба в армии/полиции',
  oldPassport: 'Старый паспорт',
  expectedExpenses: 'Ожидаемые расходы',
  insuranceInfo: 'Страховка',
  insurance: 'Страховка',
  bringCurrency: 'Ввоз валюты',
  currencyImport: 'Ввоз валюты (>5000$)',

  // ── Dates / travel logistics ───────────────────────────────────────────
  arrivalDate: 'Дата прилёта',
  departureDate: 'Дата вылета',
  arrivalAirport: 'Аэропорт прилёта',
  departureAirport: 'Аэропорт вылета',
  airline: 'Авиакомпания',
  exitAirline: 'Авиакомпания (вылет)',
  flightNumber: 'Номер рейса',
  airport: 'Аэропорт прилёта',
  entryPort: 'Порт въезда',
  exitPort: 'Порт выезда',
  fromCountry: 'Страна, откуда прилетаете',
  toCountry: 'Страна назначения',
  transit: 'Транзит (страна / аэропорт)',
  travelDates: 'Даты поездки',
  plannedDates: 'Планируемые даты',
  plannedDateFrom: 'Дата начала',
  plannedDateTo: 'Дата окончания',
  stayDates: 'Даты пребывания',
  stayDateFrom: 'Дата начала пребывания',
  stayDateTo: 'Дата окончания пребывания',
  tripDates: 'Даты поездки',
  tripDateFrom: 'Дата начала поездки',
  tripDateTo: 'Дата окончания поездки',
  expectedEntryDate: 'Ожидаемая дата въезда',
  entryDate: 'Ожидаемая дата въезда',
  dateRange: 'Даты поездки',
  dateStart: 'Дата начала',
  dateEnd: 'Дата окончания',
  daysInPakistan: 'Дней в Пакистане',
  stayDuration: 'Сколько дней пребывания',
  stayDate: 'Дата пребывания',
  residedTwoYears: 'Прожили 2 года в стране',
  twoYearsResidence: 'Прожили 2 года в стране',

  // ── Trip purpose / visit ────────────────────────────────────────────────
  purpose: 'Цель поездки',
  visitPurpose: 'Цель визита',
  tripPurpose: 'Цель поездки',
  previousVisit: 'Были ранее в стране',
  visaRefusal: 'Отказы в визе',
  visaRejection: 'Отказы в визе',
  prevVisaType: 'Тип предыдущей визы',
  prevVisaNumber: 'Номер предыдущей визы',
  prevEntryAirport: 'Аэропорт предыдущего въезда',
  prevVisitDate: 'Дата предыдущего визита',

  // ── Country-specific addresses ─────────────────────────────────────────
  addressInVietnam: 'Адрес во Вьетнаме',
  vietnamAddress: 'Адрес во Вьетнаме',
  addressInSriLanka: 'Адрес на Шри-Ланке',
  sriLankaAddress: 'Адрес на Шри-Ланке',
  addressInKorea: 'Адрес в Корее',
  koreaAddress: 'Адрес в Корее',
  addressInCambodia: 'Адрес в Камбодже',
  cambodiaAddress: 'Адрес в Камбодже',
  addressInKenya: 'Адрес в Кении',
  kenyaAddress: 'Адрес в Кении',
  pakistanAddress: 'Адрес в Пакистане',
  hotelAddress: 'Адрес отеля',
  hotelInfo: 'Информация об отеле',

  // ── India ──────────────────────────────────────────────────────────────
  citiesInIndia: 'Города в Индии',
  placesToVisit: 'Места/города в Индии',
  visitedIndiaBefore: 'Были в Индии',
  previousIndiaVisit: 'Были в Индии ранее',
  southAsiaVisits: 'Визиты в Южную Азию',
  neighborCountries: 'Соседние страны (за 3 года)',
  contactInIndia: 'Контакт в Индии',
  indiaStamps: 'Штампы Индии',

  // ── Vietnam ────────────────────────────────────────────────────────────
  vietnamViolations: 'Нарушения во Вьетнаме',
  violations: 'Нарушения во Вьетнаме',
  contactsInVietnam: 'Контакты во Вьетнаме',
  contacts: 'Контакты во Вьетнаме',
  previousVietnamVisits: 'Предыдущие визиты во Вьетнам',
  previousVisits: 'Предыдущие визиты',

  // ── Sri Lanka ──────────────────────────────────────────────────────────
  lastCountry: 'Последняя страна',
  last14DaysCountry: 'Страны посещения за 14 дней',
  hasResidentVisa: 'Резидентская виза',
  residentVisa: 'Резидентская виза',
  hasExtension: 'Продление получено',
  hasMultipleVisa: 'Многократная виза',
  multipleVisa: 'Многократная виза',
  onSriLanka: 'Сейчас на Шри-Ланке',

  // ── Korea ──────────────────────────────────────────────────────────────
  beenToKorea: 'Были в Корее',
  hasCriminalRecord: 'Судимости',
  criminalRecord: 'Судимости',
  convicted: 'Судимости',
  hasDiseases: 'Опасные заболевания',
  diseases: 'Опасные заболевания',
  hasContacts: 'Знакомые в Корее',
  contactsInKorea: 'Знакомые в Корее',
  traveling: 'Сопровождающие',
  travelCompanions: 'Сопровождающие',
  companions: 'Сопровождающие',

  // ── Kenya ──────────────────────────────────────────────────────────────
  deniedEntry: 'Отказы во въезде в Кению',
  entryDenied: 'Отказы во въезде в Кению',
  beenToKenya: 'Были в Кении',
  flightInfo: 'Авиакомпания и номер рейса',
  exitFlightInfo: 'Авиакомпания и номер рейса (вылет)',
  departureCountry: 'Страна вылета',
  destinationCountry: 'Страна назначения',

  // ── Sri Lanka extension ────────────────────────────────────────────────
  phoneNumbers: 'Мобильный телефон РФ и Шри-Ланка',
  personalPhoto: 'Личное фото',

  // ── Philippines ────────────────────────────────────────────────────────
  firstTimePhilippines: 'Впервые на Филиппинах',

  // ── Bookings: Hotel ────────────────────────────────────────────────────
  country: 'Страна назначения',
  city: 'Город',
  checkIn: 'Дата заезда',
  checkOut: 'Дата выезда',
  guests: 'Количество гостей',
  hasChildren: 'Есть дети',
  children: 'Возраст детей',
  childrenCount: 'Количество детей',

  // ── Bookings: Flight ───────────────────────────────────────────────────
  fromCity: 'Город вылета',
  toCity: 'Город прибытия',
  bookingDate: 'Дата бронирования',

  // ── Files / photos ─────────────────────────────────────────────────────
  passport: 'Скан паспорта',
  passportPhoto: 'Фото загранпаспорта',
  facePhoto: 'Фото лица',
  paymentScreenshot: 'Скриншот оплаты',
  previousVisa: 'Предыдущая виза',
  secondPassport: 'Второй паспорт',
  hotelFile: 'Бронь отеля',
  ticketFile: 'Билет',

  // ── Extension-specific ─────────────────────────────────────────────────
  // (Большинство overlap с universal — firstName, homeAddress, arrivalDate)
};

// Fallback: если ключа нет в словаре — преобразовать camelCase в нормальный
// текст (например `firstTimePhilippines` → «First time philippines»).
// Не идеально, но лучше чем raw camelCase.
function humanizeKey(key: string): string {
  // camelCase → split words → lowercase, capitalize first
  const split = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim();
  return split.charAt(0).toUpperCase() + split.slice(1).toLowerCase();
}

function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] || humanizeKey(key);
}