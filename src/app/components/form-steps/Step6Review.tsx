import { ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';
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

export default function Step6Review({ formData, visa, urgent, totalPrice, addonPrices, onNext, onPrev }: Step6Props) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl mb-2 text-gray-800">Проверка данных</h2>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800">
            Пожалуйста, внимательно проверьте все данные. Фото должно быть свежим. Любые ошибки могут привести к отказу в выдаче визы.
          </p>
        </div>
      </div>

      <div className="space-y-6 mb-6">
        {/* Visa Info */}
        <div className="border-b pb-4">
          <h3 className="text-gray-700 mb-3">Информация о визе</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Страна:</span>
              <span className="text-gray-800">{visa.country}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Тип визы:</span>
              <span className="text-gray-800">{visa.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Срочное оформление:</span>
              <span className="text-gray-800">{formData.additionalDocs.urgentProcessing ? 'Да' : 'Нет'}</span>
            </div>
          </div>
        </div>

        {/* Basic Data - Country Specific */}
        {Object.keys(formData.basicData).length > 0 && (
          <div className="border-b pb-4">
            <h3 className="text-gray-700 mb-3">Основные данные</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(formData.basicData).map(([key, value]) => {
                if (!value || value === '') return null;
                if (key === 'howHeard') return null;
                const label = getFieldLabel(key);
                const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                return (
                  <div key={key} className="grid grid-cols-2 gap-3">
                    <span className="text-gray-600 min-w-0 break-words">{label}:</span>
                    <span className="text-gray-800 min-w-0 break-words">{displayValue}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Additional Docs */}
        {(formData.additionalDocs.hotelBooking || formData.additionalDocs.returnTicket) && (
          <div className="border-b pb-4">
            <h3 className="text-gray-700 mb-3">Усиление заявки</h3>
            <div className="space-y-2 text-sm">
              {formData.additionalDocs.hotelBooking && (
                <div className="flex items-center gap-2 text-gray-800">
                  <span className="text-green-600">✓</span>
                  Подтверждение проживания (+{addonPrices.hotel}₽)
                </div>
              )}
              {formData.additionalDocs.returnTicket && (
                <div className="flex items-center gap-2 text-gray-800">
                  <span className="text-green-600">✓</span>
                  Подтверждение обратного билета (+{addonPrices.ticket}₽)
                </div>
              )}
            </div>
          </div>
        )}

        {/* How Heard */}
        {(formData.basicData.howHeard || formData.howHeard.length > 0) && (
          <div className="border-b pb-4">
            <h3 className="text-gray-700 mb-3">Как узнали о нас</h3>
            <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full">
              {HOW_HEARD_LABELS[String(formData.basicData.howHeard || formData.howHeard[0])] ?? (formData.basicData.howHeard || formData.howHeard[0])}
            </span>
          </div>
        )}

        {/* Contact Info */}
        <div className="border-b pb-4">
          <h3 className="text-gray-700 mb-3">Контактные данные</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="text-gray-800">{formData.contactInfo.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Телефон:</span>
              <span className="text-gray-800">{formData.contactInfo.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Telegram:</span>
              <span className="text-gray-800">@{formData.contactInfo.telegram}</span>
            </div>
          </div>
        </div>

        {/* Photos */}
        <div className="border-b pb-4">
          <h3 className="text-gray-700 mb-3">Загруженные фото</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-800">
              <span className="text-green-600">✓</span>
              Фото лица {formData.photos.facePhoto && `(${formData.photos.facePhoto.name})`}
            </div>
            <div className="flex items-center gap-2 text-gray-800">
              <span className="text-green-600">✓</span>
              Фото загранпаспорта {formData.photos.passportPhoto && `(${formData.photos.passportPhoto.name})`}
            </div>
            {Object.keys(formData.photos.additionalPhotos).filter(key => formData.photos.additionalPhotos[key]).map(key => (
              <div key={key} className="flex items-center gap-2 text-gray-800">
                <span className="text-green-600">✓</span>
                {getFieldLabel(key)} {formData.photos.additionalPhotos[key] && `(${formData.photos.additionalPhotos[key]!.name})`}
              </div>
            ))}
          </div>
        </div>

        {/* Total Price */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4">
          <div className="space-y-2 mb-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Стоимость визы:</span>
              <span className="text-gray-800">{visa.price}₽</span>
            </div>
            {formData.additionalDocs.urgentProcessing && visa.country !== 'Вьетнам' && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Срочное оформление:</span>
                <span className="text-gray-800">+{addonPrices.urgent}₽</span>
              </div>
            )}
            {formData.additionalDocs.hotelBooking && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Подтверждение бронирования жилья:</span>
                <span className="text-gray-800">+{addonPrices.hotel}₽</span>
              </div>
            )}
            {formData.additionalDocs.returnTicket && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Бронирование авиабилета:</span>
                <span className="text-gray-800">+{addonPrices.ticket}₽</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center border-t pt-3">
            <span className="text-gray-700">Итого:</span>
            <span className="text-2xl text-[#3B5BFF]">{totalPrice}₽</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          className="!py-4"
          onClick={onPrev}
          leftIcon={<ChevronLeft className="w-5 h-5" />}
        >
          Назад
        </Button>
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
  plannedAddress: 'Планируемый адрес проживания',
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