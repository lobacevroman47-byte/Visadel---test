import { ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';
import type { FormData } from '../ApplicationForm';
import type { VisaOption } from '../../App';

interface Step6Props {
  formData: FormData;
  visa: VisaOption;
  urgent: boolean;
  totalPrice: number;
  onNext: () => void;
  onPrev: () => void;
}

export default function Step6Review({ formData, visa, urgent, totalPrice, onNext, onPrev }: Step6Props) {
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
                const label = getFieldLabel(key);
                const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                return (
                  <div key={key} className="grid grid-cols-3 gap-2">
                    <span className="text-gray-600 col-span-1">{label}:</span>
                    <span className="text-gray-800 col-span-2 break-words">{displayValue}</span>
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
                  Подтверждение проживания (+1000₽)
                </div>
              )}
              {formData.additionalDocs.returnTicket && (
                <div className="flex items-center gap-2 text-gray-800">
                  <span className="text-green-600">✓</span>
                  Подтверждение обратного билета (+2000₽)
                </div>
              )}
            </div>
          </div>
        )}

        {/* How Heard */}
        {formData.howHeard.length > 0 && (
          <div className="border-b pb-4">
            <h3 className="text-gray-700 mb-3">Как узнали о нас</h3>
            <div className="flex flex-wrap gap-2">
              {formData.howHeard.map(source => (
                <span key={source} className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full">
                  {source}
                </span>
              ))}
            </div>
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
                <span className="text-gray-800">+1000₽</span>
              </div>
            )}
            {formData.additionalDocs.hotelBooking && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Подтверждение бронирования жилья:</span>
                <span className="text-gray-800">+1000₽</span>
              </div>
            )}
            {formData.additionalDocs.returnTicket && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Бронирование авиабилета:</span>
                <span className="text-gray-800">+2000₽</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center border-t pt-3">
            <span className="text-gray-700">Итого:</span>
            <span className="text-2xl text-[#2196F3]">{totalPrice}₽</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onPrev}
          className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-xl hover:bg-gray-200 transition flex items-center justify-center gap-2"
        >
          <ChevronLeft className="w-5 h-5" />
          Назад
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-[#2196F3] text-white py-4 rounded-[16px] hover:bg-[#1E88E5] transition flex items-center justify-center gap-2"
        >
          Подтвердить
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function getFieldLabel(key: string): string {
  const labels: Record<string, string> = {
    // Common
    citizenship: 'Гражданство',
    birthCountry: 'Страна рождения',
    birthCity: 'Город рождения',
    
    // India
    airport: 'Аэропорт прилёта',
    arrivalDate: 'Дата прилёта',
    previousName: 'Предыдущие Ф.И.О',
    previousCitizenship: 'Предыдущее гражданство',
    internalPassport: 'Внутренний паспорт',
    residedTwoYears: 'Прожили 2 года в стране',
    registrationAddress: 'Адрес регистрации',
    residenceAddress: 'Адрес проживания',
    fatherData: 'Данные отца',
    motherData: 'Данные матери',
    maritalStatus: 'Семейное положение',
    spouseInfo: 'Информация о супруге',
    workplace: 'Место работы',
    militaryService: 'Служба в армии/полиции',
    visaRefusal: 'Отказы в визе',
    citiesInIndia: 'Города в Индии',
    countriesVisited: 'Посещённые страны',
    visitedIndiaBefore: 'Были в Индии',
    southAsiaVisits: 'Визиты в Южную Азию',
    hotelInfo: 'Информация об отеле',
    contactInIndia: 'Контакт в Индии',
    emergencyContact: 'Экстренный контакт',
    
    // Vietnam
    secondCitizenship: 'Второе гражданство',
    vietnamViolations: 'Нарушения во Вьетнаме',
    oldPassport: 'Старый паспорт',
    plannedDates: 'Планируемые даты',
    plannedDateFrom: 'Дата начала',
    plannedDateTo: 'Дата окончания',
    currentAddress: 'Текущий адрес',
    workOrStudy: 'Работа/учёба',
    visitPurpose: 'Цель визита',
    contactsInVietnam: 'Контакты во Вьетнаме',
    arrivalAirport: 'Аэропорт прилёта',
    departureAirport: 'Аэропорт вылета',
    addressInVietnam: 'Адрес во Вьетнаме',
    previousVietnamVisits: 'Предыдущие визиты',
    childInfo: 'Информация о ребёнке',
    insuranceInfo: 'Страховка',
    expectedExpenses: 'Ожидаемые расходы',
    
    // Sri Lanka
    lastCountry: 'Последняя страна',
    airline: 'Авиакомпания',
    addressInSriLanka: 'Адрес в Шри-Ланке',
    hasResidentVisa: 'Резидентская виза',
    hasExtension: 'Продление',
    hasMultipleVisa: 'Многократная виза',
    
    // Korea
    tripPurpose: 'Цель поездки',
    beenToKorea: 'Были в Корее',
    dualCitizenship: 'Двойное гражданство',
    hasCriminalRecord: 'Судимости',
    hasDiseases: 'Опасные заболевания',
    hasContacts: 'Знакомые в Корее',
    traveling: 'Сопровождающие',
    working: 'Работа',
    tripDates: 'Даты поездки',
    tripDateFrom: 'Дата начала',
    tripDateTo: 'Дата окончания',
    addressInKorea: 'Адрес в Корее',
    
    // Israel
    arrivalAirport: 'Аэропорт прилёта',
    isBiometric: 'Биометрический паспорт',
    hasSecondCitizenship: 'Второе гражданство',
    homeAddress: 'Домашний адрес',
    
    // Pakistan
    daysInPakistan: 'Дней в Пакистане',
    entryPort: 'Порт въезда',
    exitPort: 'Порт выезда',
    stayDates: 'Даты пребывания',
    stayDateFrom: 'Дата начала',
    stayDateTo: 'Дата окончания',
    parentsData: 'Данные родителей',
    workInfo: 'Информация о работе',
    plannedAddress: 'Планируемый адрес',
    
    // Cambodia
    expectedEntryDate: 'Дата въезда',
    addressInCambodia: 'Адрес в Камбодже',
    
    // Kenya
    profession: 'Профессия',
    travelDates: 'Даты поездки',
    fromCountry: 'Страна вылета',
    exitAirline: 'Авиакомпания (вылет)',
    toCountry: 'Страна назначения',
    addressInKenya: 'Адрес в Кении',
    convicted: 'Судимости',
    deniedEntry: 'Отказы во въезде',
    beenToKenya: 'Были в Кении',
    bringCurrency: 'Ввоз валюты',
    
    // Photos
    previousVisa: 'Предыдущая виза',
    indiaStamps: 'Штампы Индии',
    secondPassport: 'Второй паспорт',
    hotelFile: 'Бронь отеля',
    ticketFile: 'Билет',
  };
  
  return labels[key] || key;
}