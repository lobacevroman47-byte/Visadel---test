// Полная база данных стран, виз и анкет для Visadel Agency

export interface PhotoRequirement {
  id: string;
  label: string;
  key: string;
  required: boolean;
  requirements?: string;
  formats?: string;
  maxSize?: string;
  hideIfServiceSelected?: string; // ID дополнительной услуги
}

export interface FormField {
  id: string;
  label: string;
  key: string;
  type: 'text' | 'email' | 'tel' | 'date' | 'file' | 'select' | 'textarea' | 'radio';
  required: boolean;
  placeholder?: string;
  comment?: string;
  options?: string[];
  warning?: string;
}

export interface VisaType {
  id: string;
  name: string;
  price: number;
  description?: string;
  processingTime: string;
  formFields: FormField[];
  photoRequirements?: PhotoRequirement[];
}

export interface CountryVisaData {
  id: string;
  name: string;
  flag: string;
  visaTypes: VisaType[];
}

// Анкета для E-VISA в Индию
const indiaFormFields: FormField[] = [
  { id: 'india-1', label: 'Гражданство:', key: 'citizenship', type: 'text', required: true },
  { id: 'india-2', label: 'Аэропорт прилёта:', key: 'arrivalAirport', type: 'text', required: true, comment: 'если не знаете точно, укажите примерный' },
  { id: 'india-3', label: 'Дата прилёта:', key: 'arrivalDate', type: 'date', required: true, comment: 'можно примерную' },
  { id: 'india-4', label: 'Предыдущие Фамилия и Имя (пропустить, если не менялись)', key: 'previousName', type: 'text', required: false },
  { id: 'india-5', label: 'ГОРОД рождения:', key: 'birthCity', type: 'text', required: true },
  { id: 'india-6', label: 'Предыдущее гражданство: (пропустить, если не менялось)', key: 'previousCitizenship', type: 'text', required: false },
  { id: 'india-7', label: 'Серия и номер внутреннего паспорта:', key: 'internalPassport', type: 'text', required: true },
  { id: 'india-8', label: 'Вы прожили не менее 2-х лет в стране, из которой оформляете сейчас визу?', key: 'twoYearsResidence', type: 'radio', required: true, options: ['Да', 'Нет'] },
  { id: 'india-9', label: 'Адрес регистрации:', key: 'registrationAddress', type: 'textarea', required: true, comment: 'индекс / область (край, регион) / город (ПГТ/село и т.д.) / улица / дом' },
  { id: 'india-10', label: 'Адрес проживания (пишите "тот же", если по месту регистрации):', key: 'residenceAddress', type: 'textarea', required: true, comment: 'индекс / область (край, регион) / город (ПГТ/село и т.д.) / улица / дом' },
  { id: 'india-11', label: 'Данные отца (даже если нет в живых):', key: 'fatherInfo', type: 'textarea', required: true, comment: 'имя / гражданство / ГОРОД рождения' },
  { id: 'india-12', label: 'Данные матери (даже если нет в живых):', key: 'motherInfo', type: 'textarea', required: true, comment: 'имя / гражданство / ГОРОД рождения' },
  { id: 'india-13', label: 'Семейное положение:', key: 'maritalStatus', type: 'select', required: true, options: ['Холост/Не замужем', 'Женат/Замужем', 'Разведён/Разведена', 'Вдовец/Вдова'] },
  { id: 'india-14', label: 'Информация о супруге (если не состоите в браке, пропускайте):', key: 'spouseInfo', type: 'textarea', required: false, comment: 'ФИО / страна, город рождения' },
  { id: 'india-15', label: 'Место работы (пишите "нет работы", если безработный):', key: 'employment', type: 'textarea', required: true, comment: 'наименование компании / адрес / должность / номер и e-mail компании' },
  { id: 'india-16', label: 'Служили в армии/полиции? (Пишите "нет", если не служили):', key: 'militaryService', type: 'textarea', required: true, comment: 'название организации, номер в/ч / должность / звание / местонахождение' },
  { id: 'india-17', label: 'Если Вам когда-нибудь отказывали в оформлении или в продлении индийской визы, укажите детали (когда, кем выдан отказ, уточните номер и дату): (пропустите, если нет)', key: 'visaRejection', type: 'textarea', required: false },
  { id: 'india-18', label: 'Какие города/места в Индии планируете посетить?', key: 'placesToVisit', type: 'textarea', required: true },
  { id: 'india-19', label: 'Какие страны посещали за последние 10 лет?', key: 'countriesVisited', type: 'textarea', required: true },
  { id: 'india-20', label: 'Посещали ли вы ранее Индию?', key: 'previousIndiaVisit', type: 'text', required: true },
  { id: 'india-21', label: 'Посещали ли Вы Бангладеш, Бутан, Мальдивы, Непал, Пакистан, Шри-Ланку, Афганистан за последние 3 года? (если были, указать страну, год посещения и количество посещений; можно пропустить, если не были)', key: 'neighborCountries', type: 'textarea', required: false },
  { id: 'india-22', label: 'Наименования отеля/ адрес / номер телефона', key: 'hotelInfo', type: 'textarea', required: true },
  { id: 'india-23', label: 'Контактное лицо в Индии', key: 'contactInIndia', type: 'textarea', required: true, comment: 'ИМЯ / ПОЛНЫЙ АДРЕС/ ТЕЛЕФОН' },
  { id: 'india-24', label: 'Контактное лицо в стране гражданства (на экстренный случай):', key: 'emergencyContact', type: 'textarea', required: true, comment: 'ИМЯ / ПОЛНЫЙ АДРЕС/ ТЕЛЕФОН' }
];

// Анкета для E-VISA во Вьетнам
const vietnamFormFields: FormField[] = [
  { id: 'vietnam-1', label: 'Гражданство:', key: 'citizenship', type: 'text', required: true },
  { id: 'vietnam-2', label: 'Страна рождения:', key: 'birthCountry', type: 'text', required: true },
  { id: 'vietnam-3', label: 'Если имеете второе гражданство, укажите его: (если нет, пропустить)', key: 'secondCitizenship', type: 'text', required: false },
  { id: 'vietnam-4', label: 'Если нарушали законы Вьетнама в прошлом и получали наказание, укажите: нарушение / дату / примененную санкцию / лицо, вынесшее наказание (пропустить, если нет)', key: 'violations', type: 'textarea', required: false },
  { id: 'vietnam-5', label: 'Пользовались ли вы когда-нибудь другими паспортами для въезда во Вьетнам? Если да, укажите номер этого старого паспорта', key: 'oldPassport', type: 'text', required: false },
  { id: 'vietnam-6', label: 'Предполагаемые даты пребывания:', key: 'stayDates', type: 'text', required: true, comment: '❗с начальной даты будет действовать виза, ❗не более 90 дней' },
  { id: 'vietnam-7', label: 'Адрес регистрации/прописки:', key: 'registrationAddress', type: 'textarea', required: true, comment: 'город / улица / дом / квартира' },
  { id: 'vietnam-8', label: 'Адрес текущего проживания: (указать, если отличается)', key: 'currentAddress', type: 'textarea', required: false },
  { id: 'vietnam-9', label: 'Контактное лицо (на экстренный случай):', key: 'emergencyContact', type: 'textarea', required: true, comment: 'полное имя / место проживания / номер телефона / степень родства' },
  { id: 'vietnam-10', label: 'Если работаете или учитесь, укажите наименование, адрес, телефон организации и свою позицию там. Если безработный - напишите.', key: 'employment', type: 'textarea', required: true },
  { id: 'vietnam-11', label: 'Цель визита:', key: 'purpose', type: 'text', required: true, warning: '❗Указывая целью "туризм", вы соглашаетесь с вьетнамским законодательством, что не будете работать или открывать бизнес. Иностранцы, приезжающие во Вьетнам, должны соответствовать цели въезда' },
  { id: 'vietnam-12', label: 'Есть ли какие-либо агентства/организации/частные лица, с которыми предполагается контакт при въезде во Вьетнам?', key: 'contacts', type: 'textarea', required: true, comment: 'если ДА — указать наименование/имя, адрес, номер телефона, цель встреч' },
  { id: 'vietnam-13', label: 'Аэропорт прилёта во Вьетнам:', key: 'arrivalAirport', type: 'text', required: true, comment: '❗именно через него Вы должны будете въехать' },
  { id: 'vietnam-14', label: 'Предполагаемый аэропорт вылета из Вьетнама:', key: 'departureAirport', type: 'text', required: true },
  { id: 'vietnam-15', label: 'Адрес проживания во Вьетнаме:', key: 'vietnamAddress', type: 'textarea', required: true, comment: 'если адрес неизвестен, укажите город' },
  { id: 'vietnam-16', label: 'Если уже были во Вьетнаме за последний год, укажите даты и цель визита: (пропустить, если не были)', key: 'previousVisits', type: 'textarea', required: false },
  { id: 'vietnam-17', label: 'Инфо о ребёнке, если он вписан в Ваш паспорт (номер свидетельства, имя и фамилия, дата рождения, файл с фото ребёнка прикрепите со своим) (если нет, нужна отдельная виза)', key: 'childInfo', type: 'textarea', required: false },
  { id: 'vietnam-18', label: 'Если приобрели страховку, укажите информацию по ней: (если нет страховки, пропускайте)', key: 'insurance', type: 'textarea', required: false },
  { id: 'vietnam-19', label: 'Какую сумму в $ Вы ожидаете потратить во Вьетнаме?', key: 'expectedExpenses', type: 'text', required: true }
];

// Анкета на ETA в Шри-Ланку
const sriLankaFormFields: FormField[] = [
  { id: 'srilanka-1', label: 'Гражданство:', key: 'citizenship', type: 'text', required: true },
  { id: 'srilanka-2', label: 'Страна рождения:', key: 'birthCountry', type: 'text', required: true, comment: 'если СССР, пишите - Россия' },
  { id: 'srilanka-3', label: 'Страна нахождения в последние 14 дней перед вылетом в Шри-Ланку:', key: 'last14DaysCountry', type: 'text', required: true },
  { id: 'srilanka-4', label: 'Предполагаемая дата прибытия:', key: 'arrivalDate', type: 'date', required: true },
  { id: 'srilanka-5', label: 'Аэропорт вылета: (если пока не знаете, оставляйте пустым)', key: 'departureAirport', type: 'text', required: false },
  { id: 'srilanka-6', label: 'Авиакомпания/судно: (если пока не знаете, оставляйте пустым)', key: 'airline', type: 'text', required: false },
  { id: 'srilanka-7', label: 'Адрес проживания:', key: 'homeAddress', type: 'textarea', required: true, comment: 'город / улица / дом / квартира' },
  { id: 'srilanka-8', label: 'Адрес проживания на Шри-Ланке: (если пока не знаете, оставляйте пустым)', key: 'sriLankaAddress', type: 'textarea', required: false },
  { id: 'srilanka-9', label: 'Есть ли у Вас действующая резидентская виза на Шри-Ланку?', key: 'residentVisa', type: 'radio', required: true, options: ['Да', 'Нет'] },
  { id: 'srilanka-10', label: 'Находитесь ли Вы уже на Шри-Ланке по действующему разрешению или получили его продление?', key: 'onSriLanka', type: 'radio', required: true, options: ['Да', 'Нет'] },
  { id: 'srilanka-11', label: 'Есть ли у Вас многократная виза на Шри-Ланку?', key: 'multipleVisa', type: 'radio', required: true, options: ['Да', 'Нет'] }
];

// Анкета для продления пребывания в Шри-Ланке
const sriLankaExtensionFormFields: FormField[] = [
  { id: 'srilanka-ext-1', label: 'Домашний адрес (прописка/последнее место проживания)', key: 'homeAddress', type: 'textarea', required: true },
  { id: 'srilanka-ext-2', label: 'Дата прилёта на Шри-Ланку', key: 'arrivalDate', type: 'date', required: true },
  { id: 'srilanka-ext-3', label: 'Адрес проживания на Шри-Ланке', key: 'sriLankaAddress', type: 'textarea', required: true },
  { id: 'srilanka-ext-4', label: 'Мобильный номер телефона в РФ и на Шри-Ланке', key: 'phoneNumbers', type: 'text', required: true },
  { id: 'srilanka-ext-5', label: 'Фото загранпаспорта (без бликов, пальцев)', key: 'passportPhoto', type: 'file', required: true },
  { id: 'srilanka-ext-6', label: 'Фото Ваше на светлом фоне (как на паспорт)', key: 'personalPhoto', type: 'file', required: true }
];

// Анкета для K-ETA в Южную Корею
const southKoreaFormFields: FormField[] = [
  { id: 'korea-1', label: 'Цель поездки:', key: 'purpose', type: 'text', required: true },
  { id: 'korea-2', label: 'Были ранее в Корее?', key: 'previousVisit', type: 'radio', required: true, options: ['Да', 'Нет'] },
  { id: 'korea-3', label: 'У Вас двойное гражданство?', key: 'dualCitizenship', type: 'radio', required: true, options: ['Да', 'Нет'], comment: 'если да — загрузить фото второго паспорта в нужной графе в конце анкеты' },
  { id: 'korea-4', label: 'Есть ли судимости в какой-либо из стран?', key: 'criminalRecord', type: 'radio', required: true, options: ['Да', 'Нет'] },
  { id: 'korea-5', label: 'Есть ли опасные заболевания? (Эбола, COVID)', key: 'diseases', type: 'radio', required: true, options: ['Да', 'Нет'] },
  { id: 'korea-6', label: 'Есть ли знакомые в Корее?', key: 'contactsInKorea', type: 'text', required: true, comment: 'если да — указать ФИО и телефон' },
  { id: 'korea-7', label: 'Сопровождает ли Вас кто-то в поездке?', key: 'travelCompanions', type: 'text', required: true, comment: 'если да — указать Фамилию и Имя на английском, дату рождения, степень родства' },
  { id: 'korea-8', label: 'Работаете ли Вы?', key: 'employment', type: 'textarea', required: true, comment: 'если да — указать название компании, должность, телефон, з/п в $' },
  { id: 'korea-9', label: 'Какое количество стран посетили за всё время?', key: 'countriesVisited', type: 'text', required: true },
  { id: 'korea-10', label: 'Даты поездки в Корею:', key: 'travelDates', type: 'text', required: true },
  { id: 'korea-11', label: 'Адрес проживания в Корее:', key: 'koreaAddress', type: 'textarea', required: true, comment: 'индекс, телефон, название отеля' }
];

// Анкета для ETA в Израиль
const israelFormFields: FormField[] = [
  { id: 'israel-1', label: 'Гражданство:', key: 'citizenship', type: 'text', required: true },
  { id: 'israel-2', label: 'Дата прилёта:', key: 'arrivalDate', type: 'date', required: true },
  { id: 'israel-3', label: 'Аэропорт прилёта:', key: 'arrivalAirport', type: 'text', required: true },
  { id: 'israel-4', label: 'Ваш загранпаспорт - биометрический?', key: 'biometricPassport', type: 'radio', required: true, options: ['Да', 'Нет'] },
  { id: 'israel-5', label: 'Есть ли у вас второе гражданство?', key: 'secondCitizenship', type: 'radio', required: true, options: ['Да', 'Нет'] },
  { id: 'israel-6', label: 'Семейное положение:', key: 'maritalStatus', type: 'select', required: true, options: ['Холост/Не замужем', 'Женат/Замужем', 'Разведён/Разведена', 'Вдовец/Вдова'] },
  { id: 'israel-7', label: 'Данные отца (даже если нет в живых):', key: 'fatherInfo', type: 'text', required: true, comment: 'Имя Фамилия' },
  { id: 'israel-8', label: 'Данные матери (даже если нет в живых):', key: 'motherInfo', type: 'text', required: true, comment: 'Имя Фамилия' },
  { id: 'israel-9', label: 'Домашний адрес:', key: 'homeAddress', type: 'text', required: true, comment: 'Страна/Город' }
];

// Анкета для E-VISA в Пакистан
const pakistanFormFields: FormField[] = [
  { id: 'pakistan-1', label: 'Сколько дней планируете находиться в Пакистане?', key: 'stayDuration', type: 'text', required: true },
  { id: 'pakistan-2', label: 'Планируемый порт въезда:', key: 'entryPort', type: 'text', required: true },
  { id: 'pakistan-3', label: 'Планируемый порт выезда:', key: 'exitPort', type: 'text', required: true },
  { id: 'pakistan-4', label: 'Дата пребывания:', key: 'stayDate', type: 'date', required: true, comment: 'укажите планируемую дату. Это не значит, что виза будет доступна только в эти сроки' },
  { id: 'pakistan-5', label: 'Семейное положение:', key: 'maritalStatus', type: 'select', required: true, options: ['Холост/Не замужем', 'Женат/Замужем', 'Разведён/Разведена', 'Вдовец/Вдова'] },
  { id: 'pakistan-6', label: 'Укажите данные отца и матери по структуре, указанной ниже:', key: 'parentsInfo', type: 'textarea', required: true, comment: 'имя и фамилия / гражданство' },
  { id: 'pakistan-7', label: 'Укажите информацию о месте работы по образцу комментария ниже:', key: 'employment', type: 'textarea', required: true, comment: 'дата трудоустройства / должность / название компании / e-mail компании / номер телефона компании / адрес / то же самое о прошлых местах' },
  { id: 'pakistan-8', label: 'Планируемый адрес проживания:', key: 'plannedAddress', type: 'textarea', required: true, comment: 'адрес / контактный номер' }
];

// Анкета для E-VISA в Камбоджу
const cambodiaFormFields: FormField[] = [
  { id: 'cambodia-1', label: 'Ожидаемая дата въезда:', key: 'entryDate', type: 'date', required: true },
  { id: 'cambodia-2', label: 'Адрес проживания:', key: 'homeAddress', type: 'textarea', required: true },
  { id: 'cambodia-3', label: 'Предполагаемый адрес проживания в Камбодже:', key: 'cambodiaAddress', type: 'textarea', required: true },
  { id: 'cambodia-4', label: 'Порт въезда:', key: 'entryPort', type: 'text', required: true }
];

// Анкета для ETA в Кению
const kenyaFormFields: FormField[] = [
  { id: 'kenya-1', label: 'Профессия:', key: 'profession', type: 'text', required: true, comment: 'если безработный, так и пишите' },
  { id: 'kenya-2', label: 'Контакт на экстренный случай:', key: 'emergencyContact', type: 'text', required: true, comment: 'имя и номер телефона' },
  { id: 'kenya-3', label: 'Дата прилета и вылета:', key: 'travelDates', type: 'text', required: true },
  { id: 'kenya-4', label: 'Порт въезда в страну:', key: 'entryPort', type: 'text', required: true, comment: 'название аэропорта/морского порта' },
  { id: 'kenya-5', label: 'Авиакомпания и номер рейса:', key: 'flightInfo', type: 'text', required: true },
  { id: 'kenya-6', label: 'Страна, из которой прилетаете в Кению:', key: 'departureCountry', type: 'text', required: true },
  { id: 'kenya-7', label: 'Порт выезда из Кении:', key: 'exitPort', type: 'text', required: true, comment: 'название аэропорта/морского порта' },
  { id: 'kenya-8', label: 'Авиакомпания и номер рейса при выезде из Кении:', key: 'exitFlightInfo', type: 'text', required: true },
  { id: 'kenya-9', label: 'В какую страну вылетаете/выезжаете из Кении?', key: 'destinationCountry', type: 'text', required: true },
  { id: 'kenya-10', label: 'Планируемый адрес проживания в Кении:', key: 'kenyaAddress', type: 'textarea', required: true },
  { id: 'kenya-11', label: 'Страна рождения:', key: 'birthCountry', type: 'text', required: true },
  { id: 'kenya-12', label: 'Были ли Вы осуждены за какое-либо правонарушение за последние 5 лет?', key: 'criminalRecord', type: 'radio', required: true, options: ['Да', 'Нет'] },
  { id: 'kenya-13', label: 'Было ли Вам когда-либо отказано во въезде в Кению?', key: 'entryDenied', type: 'radio', required: true, options: ['Да', 'Нет'] },
  { id: 'kenya-14', label: 'Были ранее в Кении?', key: 'previousVisit', type: 'radio', required: true, options: ['Да', 'Нет'] },
  { id: 'kenya-15', label: 'Будете ли ввозить в Кению какую-либо валюту, сумма которой превышает 5000$?', key: 'currencyImport', type: 'text', required: true, comment: 'если да — указать валюту и сумму' }
];

// ИНДИЯ - визы
const indiaVisaTypes: VisaType[] = [
  {
    id: 'india-30d',
    name: 'E-VISA на 30 дней',
    price: 5490,
    processingTime: 'Готовность 1–3 дня (Возможны задержки до 10 дней)',
    formFields: indiaFormFields
  },
  {
    id: 'india-1y',
    name: 'E-VISA на 1 год',
    price: 7490,
    processingTime: 'Готовность 1–3 дня (Возможны задержки до 10 дней)',
    formFields: indiaFormFields
  },
  {
    id: 'india-5y',
    name: 'E-VISA на 5 лет',
    price: 11490,
    description: 'Пребывание - максимум 90 дней за раз, 180 дней в год',
    processingTime: 'Готовность 1–3 дня (Возможны задержки до 10 дней)',
    formFields: indiaFormFields
  }
];

// ВЬЕТНАМ - визы
const vietnamVisaTypes: VisaType[] = [
  {
    id: 'vietnam-90d-single',
    name: 'E-VISA на 90 дней однократная',
    price: 5490,
    processingTime: 'до 5 рабочих дней',
    formFields: vietnamFormFields
  },
  {
    id: 'vietnam-90d-multiple',
    name: 'E-VISA на 90 дней многократная',
    price: 8490,
    processingTime: 'до 5 рабочих дней',
    formFields: vietnamFormFields
  },
  // Срочные визы
  {
    id: 'vietnam-3d-single',
    name: 'Срочная виза 3 дня — однократная',
    price: 6990,
    processingTime: '3 дня',
    formFields: vietnamFormFields
  },
  {
    id: 'vietnam-3d-multiple',
    name: 'Срочная виза 3 дня — многократная',
    price: 9990,
    processingTime: '3 дня',
    formFields: vietnamFormFields
  },
  {
    id: 'vietnam-2d-single',
    name: 'Срочная виза 2 дня — однократная',
    price: 7990,
    processingTime: '2 дня',
    formFields: vietnamFormFields
  },
  {
    id: 'vietnam-2d-multiple',
    name: 'Срочная виза 2 дня — многократная',
    price: 10990,
    processingTime: '2 дня',
    formFields: vietnamFormFields
  },
  {
    id: 'vietnam-1d-single',
    name: 'Срочная виза 1 день — однократная',
    price: 8990,
    processingTime: '1 день',
    formFields: vietnamFormFields
  },
  {
    id: 'vietnam-1d-multiple',
    name: 'Срочная виза 1 день — многократная',
    price: 11990,
    processingTime: '1 день',
    formFields: vietnamFormFields
  },
  {
    id: 'vietnam-4h-single',
    name: 'Срочная виза 4 часа — однократная',
    price: 9990,
    processingTime: '4 часа',
    formFields: vietnamFormFields
  },
  {
    id: 'vietnam-4h-multiple',
    name: 'Срочная виза 4 часа — многократная',
    price: 12990,
    processingTime: '4 часа',
    formFields: vietnamFormFields
  },
  {
    id: 'vietnam-2h-single',
    name: 'Срочная виза 2 часа — однократная',
    price: 11990,
    processingTime: '2 часа',
    formFields: vietnamFormFields
  },
  {
    id: 'vietnam-2h-multiple',
    name: 'Срочная виза 2 часа — многократная',
    price: 13990,
    processingTime: '2 часа',
    formFields: vietnamFormFields
  }
];

// ШРИ-ЛАНКА - визы
const sriLankaVisaTypes: VisaType[] = [
  {
    id: 'srilanka-30d-rf',
    name: 'ETA на 30 дней (гражданам РФ)',
    price: 2490,
    processingTime: '1–3 дня',
    formFields: sriLankaFormFields
  },
  {
    id: 'srilanka-30d-other',
    name: 'ETA на 30 дней (остальные страны)',
    price: 8490,
    processingTime: '1–3 дня',
    formFields: sriLankaFormFields
  },
  // Продление пребывания
  {
    id: 'srilanka-ext-60d',
    name: 'Первое продление на 60 дней',
    price: 8990,
    processingTime: '3–5 дней',
    formFields: sriLankaExtensionFormFields
  },
  {
    id: 'srilanka-ext-90d-2',
    name: 'Второе продление до 90 дней',
    price: 18990,
    processingTime: '3–5 дней',
    formFields: sriLankaExtensionFormFields
  },
  {
    id: 'srilanka-ext-90d-3',
    name: 'Третье продление до 90 дней',
    price: 23990,
    processingTime: '3–5 дней',
    formFields: sriLankaExtensionFormFields
  }
];

// ЮЖНАЯ КОРЕЯ - визы
const southKoreaVisaTypes: VisaType[] = [
  {
    id: 'korea-3y',
    name: 'K-ETA на 3 года (Пребывание 60+30 дней за полгода)',
    price: 3490,
    processingTime: 'до 3-х дней',
    formFields: southKoreaFormFields
  }
];

// ИЗРАИЛЬ - визы
const israelVisaTypes: VisaType[] = [
  {
    id: 'israel-2y',
    name: 'ETA на 2 года (Пребывание 90 дней за полгода)',
    price: 3490,
    processingTime: 'до 3-х дней',
    formFields: israelFormFields
  }
];

// ПАКИСТАН - визы
const pakistanVisaTypes: VisaType[] = [
  {
    id: 'pakistan-90d',
    name: 'E-VISA до 90 дней',
    price: 2490,
    processingTime: '1–3 дня',
    formFields: pakistanFormFields
  }
];

// КАМБОДЖА - визы
const cambodiaVisaTypes: VisaType[] = [
  {
    id: 'cambodia-30d',
    name: 'E-VISA на 30 дней',
    price: 6490,
    processingTime: '3–5 дней',
    formFields: cambodiaFormFields
  }
];

// КЕНИЯ - визы
const kenyaVisaTypes: VisaType[] = [
  {
    id: 'kenya-90d',
    name: 'ETA на 90 дней',
    price: 6490,
    processingTime: '2–4 дня',
    formFields: kenyaFormFields
  }
];

// Экспорт всех стран с визами
export const countriesVisaData: CountryVisaData[] = [
  {
    id: 'india',
    name: 'Индия',
    flag: '🇮🇳',
    visaTypes: indiaVisaTypes
  },
  {
    id: 'vietnam',
    name: 'Вьетнам',
    flag: '🇻🇳',
    visaTypes: vietnamVisaTypes
  },
  {
    id: 'sri-lanka',
    name: 'Шри-Ланка',
    flag: '🇱🇰',
    visaTypes: sriLankaVisaTypes
  },
  {
    id: 'south-korea',
    name: 'Южная Корея',
    flag: '🇰🇷',
    visaTypes: southKoreaVisaTypes
  },
  {
    id: 'israel',
    name: 'Израиль',
    flag: '🇮🇱',
    visaTypes: israelVisaTypes
  },
  {
    id: 'pakistan',
    name: 'Пакистан',
    flag: '🇵🇰',
    visaTypes: pakistanVisaTypes
  },
  {
    id: 'cambodia',
    name: 'Камбоджа',
    flag: '🇰🇭',
    visaTypes: cambodiaVisaTypes
  },
  {
    id: 'kenya',
    name: 'Кения',
    flag: '🇰🇪',
    visaTypes: kenyaVisaTypes
  }
];