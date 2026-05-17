import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Search, Upload, X, Loader2, RefreshCw, ExternalLink, Download, ArrowUp, ArrowDown, ArrowUpDown, FileDown, Flame, Filter, Clock, ChevronRight, Check, Trash2 } from 'lucide-react';
import { statusLabels, statusChipClass } from '../data/mockData';
import {
  useAdminApplications,
  updateApplicationStatus,
  updateApplicationUsdRate,
  updateApplicationTaxPct,
  uploadVisaFile,
  getStatusLog,
  type AdminApplication as Application,
  type StatusLogEntry,
} from '../hooks/useAdminData';
import { payReferralBonus } from '../../lib/db';
import { apiFetch } from '../../lib/apiFetch';
import { auditLog } from '../lib/audit';
import { useAdmin } from '../contexts/AdminContext';
import { useDialog } from '../../components/shared/BrandDialog';
import { Modal } from '../../components/ui/brand';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface ApplicationsProps {
  filter?: { filter?: 'all' | 'in_progress' };
}

// ── Per-country field order + Russian labels — derived from the canonical
//    country definitions in src/app/admin/data/countriesData.ts so labels are
//    EXACTLY what the customer saw in the form (1-for-1, same order). ──────
const ANKETA_BY_COUNTRY: Record<string, Array<{ key: string; label: string }>> = {
  'Индия': [
    { key: 'citizenship', label: 'Гражданство' },
    { key: 'arrivalAirport', label: 'Аэропорт прилёта' },
    { key: 'arrivalDate', label: 'Дата прилёта' },
    { key: 'previousName', label: 'Предыдущие Фамилия и Имя (пропустить, если не менялись)' },
    { key: 'birthCity', label: 'ГОРОД рождения' },
    { key: 'previousCitizenship', label: 'Предыдущее гражданство (пропустить, если не менялось)' },
    { key: 'internalPassport', label: 'Серия и номер внутреннего паспорта' },
    { key: 'twoYearsResidence', label: 'Вы прожили не менее 2-х лет в стране, из которой оформляете сейчас визу?' },
    { key: 'registrationAddress', label: 'Адрес регистрации' },
    { key: 'residenceAddress', label: 'Адрес проживания (пишите "тот же", если по месту регистрации)' },
    { key: 'fatherInfo', label: 'Данные отца (даже если нет в живых)' },
    { key: 'motherInfo', label: 'Данные матери (даже если нет в живых)' },
    { key: 'maritalStatus', label: 'Семейное положение' },
    { key: 'spouseInfo', label: 'Информация о супруге (если не состоите в браке, пропускайте)' },
    { key: 'employment', label: 'Место работы (пишите "нет работы", если безработный)' },
    { key: 'militaryService', label: 'Служили в армии/полиции? (Пишите "нет", если не служили)' },
    { key: 'visaRejection', label: 'Если Вам когда-нибудь отказывали в оформлении или в продлении индийской визы, укажите детали' },
    { key: 'placesToVisit', label: 'Какие города/места в Индии планируете посетить?' },
    { key: 'countriesVisited', label: 'Какие страны посещали за последние 10 лет?' },
    { key: 'previousIndiaVisit', label: 'Посещали ли вы ранее Индию?' },
    { key: 'neighborCountries', label: 'Посещали ли Вы Бангладеш, Бутан, Мальдивы, Непал, Пакистан, Шри-Ланку, Афганистан за последние 3 года?' },
    { key: 'hotelInfo', label: 'Наименования отеля / адрес / номер телефона' },
    { key: 'contactInIndia', label: 'Контактное лицо в Индии' },
    { key: 'emergencyContact', label: 'Контактное лицо в стране гражданства (на экстренный случай)' },
  ],
  'Вьетнам': [
    { key: 'citizenship', label: 'Гражданство' },
    { key: 'birthCountry', label: 'Страна рождения' },
    { key: 'secondCitizenship', label: 'Если имеете второе гражданство, укажите его (если нет, пропустить)' },
    { key: 'violations', label: 'Нарушения законов Вьетнама в прошлом' },
    { key: 'oldPassport', label: 'Пользовались ли другими паспортами для въезда во Вьетнам?' },
    { key: 'stayDates', label: 'Предполагаемые даты пребывания' },
    { key: 'registrationAddress', label: 'Адрес регистрации/прописки' },
    { key: 'currentAddress', label: 'Адрес текущего проживания (если отличается)' },
    { key: 'emergencyContact', label: 'Контактное лицо на экстренный случай' },
    { key: 'employment', label: 'Если работаете или учитесь, укажите наименование, адрес, телефон организации и свою позицию' },
    { key: 'purpose', label: 'Цель визита' },
    { key: 'contacts', label: 'Контакт с агентствами/организациями/частными лицами во Вьетнаме' },
    { key: 'arrivalAirport', label: 'Аэропорт прилёта во Вьетнам' },
    { key: 'departureAirport', label: 'Предполагаемый аэропорт вылета из Вьетнама' },
    { key: 'vietnamAddress', label: 'Адрес проживания во Вьетнаме' },
    { key: 'previousVisits', label: 'Если уже были во Вьетнаме за последний год, укажите даты и цель визита' },
    { key: 'childInfo', label: 'Инфо о ребёнке, если он вписан в Ваш паспорт' },
    { key: 'insurance', label: 'Если приобрели страховку, укажите информацию по ней' },
    { key: 'expectedExpenses', label: 'Какую сумму в $ Вы ожидаете потратить во Вьетнаме?' },
  ],
  'Шри-Ланка': [
    { key: 'citizenship', label: 'Гражданство' },
    { key: 'birthCountry', label: 'Страна рождения' },
    { key: 'last14DaysCountry', label: 'Страна нахождения в последние 14 дней перед вылетом в Шри-Ланку' },
    { key: 'arrivalDate', label: 'Предполагаемая дата прибытия' },
    { key: 'departureAirport', label: 'Аэропорт вылета (если пока не знаете, оставляйте пустым)' },
    { key: 'airline', label: 'Авиакомпания/судно (если пока не знаете, оставляйте пустым)' },
    { key: 'homeAddress', label: 'Адрес проживания' },
    { key: 'sriLankaAddress', label: 'Адрес проживания на Шри-Ланке (если пока не знаете, оставляйте пустым)' },
    { key: 'residentVisa', label: 'Есть ли у Вас действующая резидентская виза на Шри-Ланку?' },
    { key: 'onSriLanka', label: 'Находитесь ли Вы уже на Шри-Ланке по действующему разрешению или получили его продление?' },
    { key: 'multipleVisa', label: 'Есть ли у Вас многократная виза на Шри-Ланку?' },
  ],
  'Южная Корея': [
    { key: 'purpose', label: 'Цель поездки' },
    { key: 'previousVisit', label: 'Были ранее в Корее?' },
    { key: 'dualCitizenship', label: 'У Вас двойное гражданство?' },
    { key: 'criminalRecord', label: 'Есть ли судимости в какой-либо из стран?' },
    { key: 'diseases', label: 'Есть ли опасные заболевания? (Эбола, COVID)' },
    { key: 'contactsInKorea', label: 'Есть ли знакомые в Корее?' },
    { key: 'travelCompanions', label: 'Сопровождает ли Вас кто-то в поездке?' },
    { key: 'employment', label: 'Работаете ли Вы?' },
    { key: 'countriesVisited', label: 'Какое количество стран посетили за всё время?' },
    { key: 'travelDates', label: 'Даты поездки в Корею' },
    { key: 'koreaAddress', label: 'Адрес проживания в Корее' },
  ],
  'Израиль': [
    { key: 'citizenship', label: 'Гражданство' },
    { key: 'arrivalDate', label: 'Дата прилёта' },
    { key: 'arrivalAirport', label: 'Аэропорт прилёта' },
    { key: 'biometricPassport', label: 'Ваш загранпаспорт - биометрический?' },
    { key: 'secondCitizenship', label: 'Есть ли у вас второе гражданство?' },
    { key: 'maritalStatus', label: 'Семейное положение' },
    { key: 'fatherInfo', label: 'Данные отца (даже если нет в живых)' },
    { key: 'motherInfo', label: 'Данные матери (даже если нет в живых)' },
    { key: 'homeAddress', label: 'Домашний адрес' },
  ],
  'Пакистан': [
    { key: 'stayDuration', label: 'Сколько дней планируете находиться в Пакистане?' },
    { key: 'entryPort', label: 'Планируемый порт въезда' },
    { key: 'exitPort', label: 'Планируемый порт выезда' },
    { key: 'stayDate', label: 'Дата пребывания' },
    { key: 'maritalStatus', label: 'Семейное положение' },
    { key: 'parentsInfo', label: 'Укажите данные отца и матери по структуре, указанной ниже' },
    { key: 'employment', label: 'Укажите информацию о месте работы по образцу комментария ниже' },
    { key: 'plannedAddress', label: 'Планируемый адрес проживания' },
  ],
  'Камбоджа': [
    { key: 'entryDate', label: 'Ожидаемая дата въезда' },
    { key: 'homeAddress', label: 'Адрес проживания' },
    { key: 'cambodiaAddress', label: 'Предполагаемый адрес проживания в Камбодже' },
    { key: 'entryPort', label: 'Порт въезда' },
  ],
  'Кения': [
    { key: 'profession', label: 'Профессия' },
    { key: 'emergencyContact', label: 'Контакт на экстренный случай' },
    { key: 'travelDates', label: 'Дата прилета и вылета' },
    { key: 'entryPort', label: 'Порт въезда в страну' },
    { key: 'flightInfo', label: 'Авиакомпания и номер рейса' },
    { key: 'departureCountry', label: 'Страна, из которой прилетаете в Кению' },
    { key: 'exitPort', label: 'Порт выезда из Кении' },
    { key: 'exitFlightInfo', label: 'Авиакомпания и номер рейса при выезде из Кении' },
    { key: 'destinationCountry', label: 'В какую страну вылетаете/выезжаете из Кении?' },
    { key: 'kenyaAddress', label: 'Планируемый адрес проживания в Кении' },
    { key: 'birthCountry', label: 'Страна рождения' },
    { key: 'criminalRecord', label: 'Были ли Вы осуждены за какое-либо правонарушение за последние 5 лет?' },
    { key: 'entryDenied', label: 'Было ли Вам когда-либо отказано во въезде в Кению?' },
    { key: 'previousVisit', label: 'Были ранее в Кении?' },
    { key: 'currencyImport', label: 'Будете ли ввозить в Кению какую-либо валюту, сумма которой превышает 5000$?' },
  ],
  'Филиппины': [
    { key: 'citizenship', label: 'Гражданство' },
    { key: 'birthCountry', label: 'Страна рождения' },
    { key: 'working', label: 'Вы работаете?' },
    { key: 'residenceAddress', label: 'Адрес проживания' },
    { key: 'visitPurpose', label: 'Цель приезда на Филиппины' },
    { key: 'flightNumber', label: 'Номер рейса и название авиакомпании' },
    { key: 'departureAirport', label: 'Аэропорт вылета' },
    { key: 'stayDateFrom', label: 'Даты пребывания на Филиппинах' },
    { key: 'transit', label: 'Если будет транзит, укажите страну и аэропорт' },
    { key: 'hotelAddress', label: 'Адрес отеля на Филиппинах' },
    { key: 'companions', label: 'Сопровождает ли кто-то?' },
    { key: 'firstTimePhilippines', label: 'Первый раз на Филиппинах?' },
  ],
};

// Legacy block kept for backwards compat but not used — see ANKETA_BY_COUNTRY above.
const _LEGACY_ANKETA_DEPRECATED: Record<string, Array<{ key: string; label: string }>> = {
  'Индия': [
    { key: 'citizenship', label: 'Гражданство' },
    { key: 'arrivalAirport', label: 'Аэропорт прилёта' },
    { key: 'arrivalDate', label: 'Дата прилёта' },
    { key: 'previousName', label: 'Предыдущие Фамилия и Имя' },
    { key: 'birthCity', label: 'Город рождения' },
    { key: 'previousCitizenship', label: 'Предыдущее гражданство' },
    { key: 'passportSeries', label: 'Серия и номер внутреннего паспорта РФ' },
    { key: 'regPostalCode', label: 'Индекс' },
    { key: 'regRegion', label: 'Область' },
    { key: 'regCity', label: 'Город' },
    { key: 'regStreet', label: 'Улица' },
    { key: 'regHouse', label: 'Дом' },
    { key: 'liveAddress', label: 'Адрес проживания' },
    { key: 'fatherName', label: 'Имя отца' },
    { key: 'fatherCitizenship', label: 'Гражданство отца' },
    { key: 'fatherBirthCity', label: 'Город рождения отца' },
    { key: 'motherName', label: 'Имя матери' },
    { key: 'motherCitizenship', label: 'Гражданство матери' },
    { key: 'motherBirthCity', label: 'Город рождения матери' },
    { key: 'maritalStatus', label: 'Семейное положение' },
    { key: 'spouseName', label: 'ФИО супруга/супруги' },
    { key: 'spouseBirthDate', label: 'Дата рождения супруга/супруги' },
    { key: 'spouseCitizenship', label: 'Гражданство супруга/супруги' },
    { key: 'companyName', label: 'Наименование компании' },
    { key: 'companyAddress', label: 'Адрес компании' },
    { key: 'position', label: 'Должность' },
    { key: 'companyPhone', label: 'Телефон компании' },
    { key: 'companyEmail', label: 'Email компании' },
    { key: 'militaryService', label: 'Служили в армии/полиции' },
    { key: 'planedCities', label: 'Города/места планируемого посещения в Индии' },
    { key: 'visitedCountries', label: 'Страны, которые посещали за последние 10 лет' },
    { key: 'visitedIndia', label: 'Посещали ранее Индию' },
    { key: 'indiaVisitDates', label: 'Когда посещали Индию' },
    { key: 'hotelName', label: 'Название отеля' },
    { key: 'hotelAddress', label: 'Адрес отеля' },
    { key: 'hotelPhone', label: 'Телефон отеля' },
    { key: 'contactIndiaName', label: 'ФИО контакта в Индии' },
    { key: 'contactIndiaAddress', label: 'Адрес контакта в Индии' },
    { key: 'contactIndiaPhone', label: 'Телефон контакта в Индии' },
    { key: 'emergencyContactName', label: 'Контакт на экстренный случай — ФИО' },
    { key: 'emergencyContactAddress', label: 'Контакт на экстренный случай — адрес' },
    { key: 'emergencyContactPhone', label: 'Контакт на экстренный случай — телефон' },
    { key: 'howHeard', label: 'Как вы о нас узнали' },
  ],
  'Вьетнам': [
    { key: 'citizenship', label: 'Гражданство' },
    { key: 'birthCountry', label: 'Страна рождения' },
    { key: 'secondCitizenship', label: 'Второе гражданство' },
    { key: 'lawViolations', label: 'Нарушения законов Вьетнама' },
    { key: 'otherPassports', label: 'Использовали другие паспорта для въезда во Вьетнам' },
    { key: 'stayDateFrom', label: 'Предполагаемые даты пребывания' },
    { key: 'registrationAddress', label: 'Адрес регистрации/прописки' },
    { key: 'liveAddress', label: 'Адрес проживания' },
    { key: 'emergencyContactName', label: 'Контакт на экстренный случай — ФИО' },
    { key: 'emergencyContactPhone', label: 'Контакт на экстренный случай — телефон' },
    { key: 'occupation', label: 'Работа/учёба' },
    { key: 'visitPurpose', label: 'Цель визита' },
    { key: 'vietnamContacts', label: 'Контакт с агентствами/организациями во Вьетнаме' },
    { key: 'arrivalAirport', label: 'Аэропорт прилёта' },
    { key: 'departureAirport', label: 'Аэропорт вылета' },
    { key: 'vietnamAddress', label: 'Адрес проживания во Вьетнаме' },
    { key: 'vietnamPreviousVisits', label: 'Если были во Вьетнаме за последний год' },
    { key: 'howHeard', label: 'Как вы о нас узнали' },
  ],
  'Южная Корея': [
    { key: 'visitPurpose', label: 'Цель поездки' },
    { key: 'visitedKoreaBefore', label: 'Были ранее в Корее' },
    { key: 'dualCitizenship', label: 'Двойное гражданство' },
    { key: 'criminalRecord', label: 'Судимости' },
    { key: 'diseases', label: 'Опасные заболевания' },
    { key: 'koreaContacts', label: 'Знакомые в Корее' },
    { key: 'companions', label: 'Сопровождающие лица' },
    { key: 'companyName', label: 'Название компании' },
    { key: 'position', label: 'Должность' },
    { key: 'companyPhone', label: 'Телефон компании' },
    { key: 'salary', label: 'Зарплата (примерно)' },
    { key: 'countriesVisited', label: 'Количество стран, посещённых за всё время' },
    { key: 'tripDateFrom', label: 'Даты поездки в Корею' },
    { key: 'koreaPostalCode', label: 'Индекс в Корее' },
    { key: 'koreaPhone', label: 'Телефон в Корее' },
    { key: 'hotelName', label: 'Название отеля' },
    { key: 'howHeard', label: 'Как вы о нас узнали' },
  ],
  'Израиль': [
    { key: 'citizenship', label: 'Гражданство' },
    { key: 'arrivalDate', label: 'Дата прилёта' },
    { key: 'arrivalAirport', label: 'Аэропорт прилёта' },
    { key: 'biometricPassport', label: 'Загранпаспорт биометрический' },
    { key: 'secondCitizenship', label: 'Второе гражданство' },
    { key: 'maritalStatus', label: 'Семейное положение' },
    { key: 'fatherName', label: 'Имя отца' },
    { key: 'motherName', label: 'Имя матери' },
    { key: 'homeAddress', label: 'Домашний адрес' },
    { key: 'howHeard', label: 'Как вы о нас узнали' },
  ],
  'Камбоджа': [
    { key: 'entryDate', label: 'Ожидаемая дата въезда' },
    { key: 'liveAddress', label: 'Адрес проживания' },
    { key: 'cambodiaAddress', label: 'Предполагаемый адрес проживания в Камбодже' },
    { key: 'entryPort', label: 'Порт въезда' },
    { key: 'howHeard', label: 'Как вы о нас узнали' },
  ],
  'Кения': [
    { key: 'profession', label: 'Профессия' },
    { key: 'emergencyContactName', label: 'Контакт на экстренный случай — ФИО' },
    { key: 'emergencyContactPhone', label: 'Контакт на экстренный случай — телефон' },
    { key: 'arrivalDate', label: 'Дата прилёта' },
    { key: 'departureDate', label: 'Дата вылета' },
    { key: 'entryPort', label: 'Порт въезда' },
    { key: 'arrivalFlight', label: 'Авиакомпания и номер рейса' },
    { key: 'arrivalCountry', label: 'Страна прилёта' },
    { key: 'exitPort', label: 'Порт выезда' },
    { key: 'departureFlight', label: 'Авиакомпания и номер рейса при выезде' },
    { key: 'departureCountry', label: 'Страна вылета' },
    { key: 'kenyaAddress', label: 'Планируемый адрес проживания' },
    { key: 'birthCountry', label: 'Страна рождения' },
    { key: 'criminalRecord', label: 'Судимости за последние 5 лет' },
    { key: 'entryRefusal', label: 'Отказы во въезде в Кению' },
    { key: 'visitedBefore', label: 'Были ранее в Кении' },
    { key: 'largeCurrency', label: 'Валюта более $5000' },
    { key: 'howHeard', label: 'Как вы о нас узнали' },
  ],
  'Пакистан': [
    { key: 'stayDays', label: 'Сколько дней планируете находиться' },
    { key: 'entryPort', label: 'Планируемый порт въезда' },
    { key: 'exitPort', label: 'Планируемый порт выезда' },
    { key: 'stayDateFrom', label: 'Дата пребывания' },
    { key: 'maritalStatus', label: 'Семейное положение' },
    { key: 'fatherName', label: 'Имя отца' },
    { key: 'motherName', label: 'Имя матери' },
    { key: 'companyName', label: 'Название компании' },
    { key: 'position', label: 'Должность' },
    { key: 'companyAddress', label: 'Адрес компании' },
    { key: 'pakistanAddress', label: 'Планируемый адрес проживания' },
    { key: 'howHeard', label: 'Как вы о нас узнали' },
  ],
  'Шри-Ланка': [
    { key: 'citizenship', label: 'Гражданство' },
    { key: 'birthCountry', label: 'Страна рождения' },
    { key: 'lastCountry', label: 'Страна пребывания последние 14 дней' },
    { key: 'arrivalDate', label: 'Предполагаемая дата прибытия' },
    { key: 'departureAirport', label: 'Аэропорт вылета' },
    { key: 'airline', label: 'Авиакомпания/судно' },
    { key: 'liveAddress', label: 'Адрес проживания' },
    { key: 'sriLankaAddress', label: 'Адрес проживания на Шри-Ланке' },
    { key: 'residentVisa', label: 'Действующая резидентская виза' },
    { key: 'alreadyInSriLanka', label: 'Уже на Шри-Ланке по действующему разрешению' },
    { key: 'multipleVisa', label: 'Многократная виза' },
    { key: 'homeAddress', label: 'Домашний адрес (прописка/последнее место проживания)' },
    { key: 'arrivalDateSL', label: 'Дата прилёта на Шри-Ланку' },
    { key: 'phoneRussia', label: 'Мобильный телефон РФ' },
    { key: 'phoneSriLanka', label: 'Мобильный телефон Шри-Ланка' },
    { key: 'howHeard', label: 'Как вы о нас узнали' },
  ],
};

// ── Generic fallback labels (used when country lookup fails OR for keys
//    not in ANKETA_BY_COUNTRY[country]). All canonical keys from
//    countriesData.ts are guaranteed to be here so admin never sees a raw
//    technical code regardless of which country the application is for. ────
const FIELD_LABELS: Record<string, string> = {
  // ── Canonical keys from src/app/admin/data/countriesData.ts ─────────────
  airline: 'Авиакомпания / судно',
  arrivalAirport: 'Аэропорт прилёта',
  arrivalDate: 'Дата прилёта',
  biometricPassport: 'Загранпаспорт биометрический',
  birthCity: 'Город рождения',
  birthCountry: 'Страна рождения',
  cambodiaAddress: 'Адрес проживания в Камбодже',
  childInfo: 'Данные ребёнка (если вписан в паспорт)',
  citizenship: 'Гражданство',
  contactInIndia: 'Контактное лицо в Индии',
  contacts: 'Контакт с агентствами/организациями во Вьетнаме',
  contactsInKorea: 'Знакомые в Корее',
  countriesVisited: 'Посещённые страны',
  criminalRecord: 'Судимости',
  currencyImport: 'Ввоз валюты в Кению свыше 5000 $',
  currentAddress: 'Адрес текущего проживания',
  departureAirport: 'Аэропорт вылета',
  departureCountry: 'Страна, из которой прилетаете',
  destinationCountry: 'Страна вылета из Кении',
  diseases: 'Опасные заболевания',
  dualCitizenship: 'Двойное гражданство',
  emergencyContact: 'Контактное лицо на экстренный случай',
  employment: 'Место работы',
  entryDate: 'Ожидаемая дата въезда',
  entryDenied: 'Отказ во въезде',
  entryPort: 'Планируемый порт въезда',
  exitFlightInfo: 'Авиакомпания и номер рейса при выезде',
  exitPort: 'Планируемый порт выезда',
  expectedExpenses: 'Ожидаемая сумма расходов ($)',
  fatherInfo: 'Данные отца',
  flightInfo: 'Авиакомпания и номер рейса',
  homeAddress: 'Адрес проживания',
  hotelInfo: 'Отель: название / адрес / телефон',
  insurance: 'Информация по страховке',
  internalPassport: 'Серия и номер внутреннего паспорта',
  kenyaAddress: 'Адрес проживания в Кении',
  koreaAddress: 'Адрес проживания в Корее',
  maritalStatus: 'Семейное положение',
  militaryService: 'Служили в армии/полиции',
  motherInfo: 'Данные матери',
  multipleVisa: 'Многократная виза',
  neighborCountries: 'Посещения соседних стран за 3 года',
  oldPassport: 'Использовали другие паспорта для въезда',
  onSriLanka: 'Уже на Шри-Ланке по действующему разрешению',
  parentsInfo: 'Данные родителей',
  phoneNumbers: 'Мобильный телефон РФ / Шри-Ланка',
  placesToVisit: 'Города/места планируемого посещения',
  plannedAddress: 'Планируемый адрес проживания',
  previousCitizenship: 'Предыдущее гражданство',
  previousIndiaVisit: 'Посещали ранее Индию',
  previousName: 'Предыдущие Фамилия и Имя',
  previousVisit: 'Были ранее в стране',
  previousVisits: 'Предыдущие визиты',
  profession: 'Профессия',
  purpose: 'Цель поездки',
  registrationAddress: 'Адрес регистрации',
  residenceAddress: 'Адрес проживания',
  residentVisa: 'Действующая резидентская виза',
  secondCitizenship: 'Второе гражданство',
  spouseInfo: 'Информация о супруге',
  sriLankaAddress: 'Адрес проживания на Шри-Ланке',
  stayDate: 'Дата пребывания',
  stayDates: 'Предполагаемые даты пребывания',
  stayDuration: 'Сколько дней планируете находиться',
  travelCompanions: 'Сопровождающие в поездке',
  travelDates: 'Даты поездки',
  twoYearsResidence: 'Прожили 2+ лет в стране оформления',
  vietnamAddress: 'Адрес проживания во Вьетнаме',
  violations: 'Нарушения законов в прошлом',
  visaRejection: 'Отказы в визе ранее',

  // ── Philippines-specific keys ────────────────────────────────────────────
  working: 'Вы работаете?',
  visitPurpose: 'Цель приезда',
  flightNumber: 'Номер рейса и название авиакомпании',
  stayDateFrom: 'Даты пребывания',
  transit: 'Транзит — страна и аэропорт',
  hotelAddress: 'Адрес отеля',
  companions: 'Сопровождает ли кто-то',
  firstTimePhilippines: 'Первый раз на Филиппинах?',

  // ── Pre-existing legacy labels (kept for backwards compat) ───────────────
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

  // ── Universal / cross-country additions ──────────────────────────────────
  firstName: 'Имя',
  lastName: 'Фамилия',
  middleName: 'Отчество',
  firstNameLat: 'Имя (латиницей)',
  lastNameLat: 'Фамилия (латиницей)',
  firstNameEn: 'Имя на английском',
  lastNameEn: 'Фамилия на английском',
  patronymic: 'Отчество',
  birthDate: 'Дата рождения',
  gender: 'Пол',
  passportNumber: 'Номер паспорта',
  passportSeries: 'Серия и номер паспорта',
  passportIssueDate: 'Дата выдачи паспорта',
  passportExpiry: 'Срок действия паспорта',
  passportExpiryDate: 'Срок действия паспорта',
  passportIssuedBy: 'Кем выдан паспорт',
  liveAddress: 'Адрес проживания',
  homeAddress: 'Домашний адрес',
  registrationAddress: 'Адрес регистрации',
  registrationAddress2: 'Адрес регистрации',
  regCity: 'Город регистрации',
  regRegion: 'Регион регистрации',
  regStreet: 'Улица регистрации',
  regHouse: 'Дом регистрации',
  regPostalCode: 'Индекс регистрации',
  phoneRussia: 'Телефон в России',
  phoneSriLanka: 'Телефон на Шри-Ланке',
  arrivalCountry: 'Страна прилёта',
  arrivalFlight: 'Номер рейса (прилёт)',
  arrivalDateSL: 'Дата прибытия на Шри-Ланку',
  departureCountry: 'Страна вылета',
  departureFlight: 'Номер рейса (вылет)',
  entryDate: 'Дата въезда',
  stayDays: 'Количество дней пребывания',

  // Family
  fatherName: 'Имя отца',
  fatherBirthCity: 'Город рождения отца',
  fatherCitizenship: 'Гражданство отца',
  motherName: 'Имя матери',
  motherBirthCity: 'Город рождения матери',
  motherCitizenship: 'Гражданство матери',
  spouseName: 'Имя супруга/супруги',
  spouseBirthDate: 'Дата рождения супруга/супруги',
  spouseCitizenship: 'Гражданство супруга/супруги',

  // Work / company
  companyName: 'Название компании',
  companyAddress: 'Адрес компании',
  companyPhone: 'Телефон компании',
  companyEmail: 'Email компании',
  position: 'Должность',
  occupation: 'Род занятий',
  salary: 'Зарплата',

  // Hotel / contacts in destination
  hotelName: 'Название отеля',
  hotelAddress: 'Адрес отеля',
  hotelPhone: 'Телефон отеля',
  cambodiaAddress: 'Адрес в Камбодже',
  vietnamAddress: 'Адрес во Вьетнаме',
  pakistanAddress: 'Адрес в Пакистане',
  kenyaAddress: 'Адрес в Кении',
  sriLankaAddress: 'Адрес на Шри-Ланке',
  vietnamContacts: 'Контакты во Вьетнаме',
  vietnamPreviousVisits: 'Предыдущие визиты во Вьетнам',
  koreaContacts: 'Контакты в Корее',
  koreaPhone: 'Телефон в Корее',
  koreaPostalCode: 'Индекс в Корее',
  contactIndiaName: 'Имя контактного лица в Индии',
  contactIndiaAddress: 'Адрес контактного лица в Индии',
  contactIndiaPhone: 'Телефон контактного лица в Индии',
  emergencyContactName: 'Контакт на экстренный случай — имя',
  emergencyContactAddress: 'Контакт на экстренный случай — адрес',
  emergencyContactPhone: 'Контакт на экстренный случай — телефон',

  // Visits / history
  visitedBefore: 'Был в стране ранее',
  visitedIndia: 'Был в Индии',
  visitedKoreaBefore: 'Был в Корее',
  visitedCountries: 'Посещённые страны',
  indiaVisitDates: 'Даты предыдущих посещений Индии',
  planedCities: 'Планируемые города',

  // Misc
  alreadyInSriLanka: 'Уже на Шри-Ланке',
  multipleVisa: 'Многократная виза',
  residentVisa: 'Резидентская виза',
  biometricPassport: 'Биометрический паспорт',
  criminalRecord: 'Судимости',
  diseases: 'Опасные заболевания',
  dualCitizenship: 'Двойное гражданство',
  entryRefusal: 'Отказ во въезде',
  largeCurrency: 'Ввоз валюты >5000$',
  currencyAmount: 'Сумма валюты',
  lawViolations: 'Нарушения законов',
  militaryService: 'Военная служба',
  otherPassports: 'Другие паспорта',
  lived2Years: 'Проживал 2+ лет в стране оформления',
  companions: 'Сопровождающие',
  howHeard: 'Откуда узнали о нас',

  // ── Bookings: Hotel ──────────────────────────────────────────────────────
  country: 'Страна',
  city: 'Город',
  checkIn: 'Дата заезда',
  checkOut: 'Дата выезда',
  guests: 'Количество гостей',
  hasChildren: 'Есть дети',
  children: 'Возраст детей',
  childrenCount: 'Количество детей',

  // ── Bookings: Flight ─────────────────────────────────────────────────────
  fromCity: 'Город вылета',
  toCity: 'Город прибытия',
  bookingDate: 'Дата бронирования',

  // ── Bookings: common files / contacts ────────────────────────────────────
  passport: 'Скан паспорта',
  passportPhoto: 'Фото загранпаспорта',
  facePhoto: 'Фото лица',
  paymentScreenshot: 'Скриншот оплаты',
  telegramLogin: 'Telegram',

  // ── Extension Sri Lanka ─────────────────────────────────────────────────
  phoneRussia: 'Телефон в РФ',
  phoneSriLanka: 'Телефон на Шри-Ланке',
};

const HOW_HEARD_LABELS: Record<string, string> = {
  telegram: 'Telegram', youtube: 'YouTube', instagram: 'Instagram',
  tiktok: 'TikTok', vk: 'ВКонтакте', rutube: 'RuTube',
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

// ── Form Data (Анкета tab) ────────────────────────────────────────────────────
function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5">
      <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F2A36]/50">{label}</p>
      <p className="text-sm text-[#0F2A36] font-semibold mt-0.5 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

const FormDataView: React.FC<{ app: Application }> = ({ app }) => {
  const fd = app.formData as {
    basicData?: Record<string, unknown>;
    contactInfo?: Record<string, string>;
    additionalDocs?: {
      urgentProcessing?: boolean;
      hotelBooking?: boolean;
      returnTicket?: boolean;
      hotelDetails?: {
        country?: string; city?: string; checkIn?: string; checkOut?: string;
        guests?: number; hasChildren?: 'yes' | 'no'; childrenCount?: number;
        extra_fields?: Record<string, string>;
      };
      flightDetails?: {
        fromCity?: string; toCity?: string; bookingDate?: string;
        extra_fields?: Record<string, string>;
      };
    };
    howHeard?: string[];
  };

  const basicData = fd.basicData ?? {};
  const contactInfo = fd.contactInfo ?? {};
  const additionalDocs = fd.additionalDocs ?? {};
  const howHeard = fd.howHeard ?? [];

  const extras: string[] = [];
  if (additionalDocs.urgentProcessing) extras.push('Срочное оформление');
  if (additionalDocs.hotelBooking) extras.push('Бронь отеля для визы');
  if (additionalDocs.returnTicket) extras.push('Бронь обратного билета');

  const fmtBookingDate = (s?: string) => s ? new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const hotelDetails = additionalDocs.hotelDetails;
  const flightDetails = additionalDocs.flightDetails;
  const hasHotelDetails = hotelDetails && Object.values(hotelDetails).some(v => v !== undefined && v !== '' && v !== null);
  const hasFlightDetails = flightDetails && Object.values(flightDetails).some(v => v !== undefined && v !== '' && v !== null);

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

      {/* Basic data — render in the same order as the user-facing form for app.country */}
      {Object.keys(basicData).length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Анкетные данные</h4>
          <div className="space-y-2">
            {(() => {
              // Match country name leniently (trim, ignore case, strip flag emojis if any)
              const normalizedCountry = (app.country ?? '').trim().toLowerCase();
              const matchedKey = Object.keys(ANKETA_BY_COUNTRY).find(
                k => k.toLowerCase() === normalizedCountry,
              );
              const ordered = matchedKey ? ANKETA_BY_COUNTRY[matchedKey] : [];
              const orderedKeys = new Set(ordered.map(o => o.key));
              const rows: React.ReactNode[] = [];

              // First — fields in form order with form labels
              for (const { key, label } of ordered) {
                const formatted = formatValue(key, basicData[key]);
                if (formatted === '—') continue;
                rows.push(
                  <div key={key} className="p-2 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{formatted}</p>
                  </div>,
                );
              }

              // Then — any extras: prefer FIELD_LABELS (Russian).
              // Fallback humanizeKey() для незнакомых ключей —
              // camelCase → «Camel case» (лучше чем raw camelCase).
              for (const [key, value] of Object.entries(basicData)) {
                if (orderedKeys.has(key)) continue;
                const formatted = formatValue(key, value);
                if (formatted === '—') continue;
                const russianLabel = FIELD_LABELS[key];
                const humanized = !russianLabel
                  ? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
                  : null;
                rows.push(
                  <div key={key} className="p-2 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">{russianLabel ?? humanized}</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{formatted}</p>
                  </div>,
                );
              }
              return rows.length > 0 ? rows : <p className="text-xs text-gray-400">Анкета не заполнена</p>;
            })()}
          </div>
        </section>
      )}

      {extras.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Доп. услуги</h4>
          <div className="flex flex-wrap gap-2">
            {extras.map(e => <span key={e} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">{e}</span>)}
          </div>
        </section>
      )}

      {hasHotelDetails && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">🏨 Бронь отеля для визы — детали поездки</h4>
          <div className="grid grid-cols-2 gap-2">
            {hotelDetails!.country && <DetailItem label="Страна назначения" value={hotelDetails!.country} />}
            {hotelDetails!.city && <DetailItem label="Город" value={hotelDetails!.city} />}
            {hotelDetails!.checkIn && <DetailItem label="Дата заезда" value={fmtBookingDate(hotelDetails!.checkIn)} />}
            {hotelDetails!.checkOut && <DetailItem label="Дата выезда" value={fmtBookingDate(hotelDetails!.checkOut)} />}
            {hotelDetails!.guests !== undefined && <DetailItem label="Количество гостей" value={String(hotelDetails!.guests)} />}
            {hotelDetails!.hasChildren && (
              <DetailItem
                label="Есть ли дети"
                value={hotelDetails!.hasChildren === 'yes'
                  ? `Да${hotelDetails!.childrenCount ? ` · ${hotelDetails!.childrenCount}` : ''}`
                  : 'Нет'}
              />
            )}
            {hotelDetails!.extra_fields && Object.entries(hotelDetails!.extra_fields).map(([k, v]) => v && (
              <DetailItem key={`hex_${k}`} label={k} value={String(v)} />
            ))}
          </div>
        </section>
      )}

      {hasFlightDetails && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">✈️ Бронь обратного билета — детали</h4>
          <div className="grid grid-cols-2 gap-2">
            {flightDetails!.fromCity && <DetailItem label="Из какого города" value={flightDetails!.fromCity} />}
            {flightDetails!.toCity && <DetailItem label="В какой город" value={flightDetails!.toCity} />}
            {flightDetails!.bookingDate && <DetailItem label="Дата бронирования" value={fmtBookingDate(flightDetails!.bookingDate)} />}
            {flightDetails!.extra_fields && Object.entries(flightDetails!.extra_fields).map(([k, v]) => v && (
              <DetailItem key={`fex_${k}`} label={k} value={String(v)} />
            ))}
          </div>
        </section>
      )}

      {howHeard.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Откуда узнали</h4>
          <p className="text-sm text-gray-700">{howHeard.map(v => HOW_HEARD_LABELS[v] ?? v).join(', ')}</p>
        </section>
      )}
    </div>
  );
};

// ── Files tab (Файлы) ────────────────────────────────────────────────────────

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, '_blank');
  }
}

const FilesView: React.FC<{ app: Application }> = ({ app }) => {
  const fd = app.formData as { photoUrls?: Record<string, string | null> };
  const photoUrls = fd.photoUrls ?? {};
  const entries = Object.entries(photoUrls).filter(([, url]) => !!url) as [string, string][];

  if (entries.length === 0) {
    return (
      <div className="py-16 text-center space-y-2">
        <p className="text-gray-400 text-sm">Файлы не загружены</p>
        <p className="text-gray-300 text-xs">
          Фотографии сохраняются начиная с новых заявок.
          Старые заявки не содержат прикреплённых фото.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map(([key, url]) => {
        const label = PHOTO_LABELS[key] ?? key;
        const isPdf = /\.pdf$/i.test(url);
        const ext = url.split('.').pop() ?? 'file';
        const filename = `${label.replace(/\s+/g, '_')}.${ext}`;
        return (
          <div key={key} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 flex items-center justify-between border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">{label}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadFile(url, filename)}
                  className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 transition"
                  title="Скачать"
                >
                  <Download className="w-3.5 h-3.5" /> Скачать
                </button>
                <a href={url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
                  {isPdf ? 'Открыть PDF' : 'Открыть'} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            {/* Preview */}
            {!isPdf ? (
              <div className="p-2 bg-white">
                <img
                  src={url}
                  alt={label}
                  className="w-full max-h-72 object-contain rounded-lg"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            ) : (
              <div className="p-4 text-center text-gray-400 text-sm">
                PDF-файл — нажмите «Открыть PDF» для просмотра
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Status History Component ──────────────────────────────────────────────────
const STATUS_LABELS_RU: Record<string, string> = {
  draft: 'Черновик',
  pending_payment: 'Ожидает оплаты',
  pending_confirmation: 'Ожидает подтверждения',
  in_progress: 'В работе',
  completed: 'Готово',
  ready: 'Готово',
};

// Стиль 1-в-1 с BookingStatusHistory (Bookings.tsx) — единый формат
// timeline в админке. Иконка Clock (text-[#3B5BFF]), точки timeline-а
// (синяя для первой записи, emerald для последующих), без рамки на
// wrapper'е, цвета текста через brand-токены (#0F2A36).
const StatusHistory: React.FC<{
  createdAt: string;
  log: StatusLogEntry[];
  loading: boolean;
}> = ({ createdAt, log, loading }) => {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  // Объединяем «создание заявки» + status changes в один timeline
  const entries: Array<{ key: string; date: string; transition: React.ReactNode; admin?: string | null }> = [
    { key: 'created', date: createdAt, transition: <><span className="text-[#0F2A36]/60">Заявка создана</span> · <span className="font-bold">ожидает подтверждения</span></> },
    ...log.map(entry => ({
      key: entry.id,
      date: entry.created_at,
      transition: (
        <>
          <span className="text-[#0F2A36]/60">{STATUS_LABELS_RU[entry.from_status ?? ''] ?? entry.from_status ?? '?'}</span>
          {' → '}
          <span className="font-bold">{STATUS_LABELS_RU[entry.to_status] ?? entry.to_status}</span>
        </>
      ),
      admin: entry.changed_by_name,
    })),
  ];

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-[#3B5BFF]" />
        <p className="text-sm font-semibold text-[#0F2A36]">История изменений</p>
      </div>
      {loading ? (
        <p className="text-xs text-gray-400">Загружаем…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Статус ещё не менялся</p>
      ) : (
        <div className="space-y-3">
          {entries.map((e, i) => (
            <div key={e.key} className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                {i < entries.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
              </div>
              <div className="flex-1 pb-2">
                <p className="text-xs text-gray-500">{fmt(e.date)}</p>
                <p className="text-sm text-[#0F2A36] mt-0.5">{e.transition}</p>
                {e.admin && (
                  <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> Администратор {e.admin}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Application Modal ─────────────────────────────────────────────────────────
const ApplicationModal: React.FC<{ application: Application; onClose: () => void }> = ({ application, onClose }) => {
  const { currentUser } = useAdmin();
  const dialog = useDialog();
  const [status, setStatus] = useState(application.status);
  // Hold finance inputs as strings so user can fully clear the field while editing.
  // Parse to number on save and for the live tax preview.
  const [usdRateStr, setUsdRateStr] = useState(application.usdRateRub != null ? String(application.usdRateRub) : '');
  const [taxPctStr, setTaxPctStr] = useState(String(application.taxPct));
  const usdRate = parseFloat(usdRateStr);
  const taxPct = parseFloat(taxPctStr);
  // Курс обязателен при переводе в "В работе" / "Готово" — без него
  // финансы не посчитаются (себестоимость = USD × курс).
  const STATUSES_REQUIRING_RATE: Application['status'][] = ['in_progress', 'completed'];
  const rateMissing = !Number.isFinite(usdRate) || usdRate <= 0;
  const blockedByRate = STATUSES_REQUIRING_RATE.includes(status) && rateMissing;
  const [visaFile, setVisaFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'form' | 'files' | 'payment'>('info');
  const [statusLog, setStatusLog] = useState<StatusLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const saveGuard = useRef(false); // prevent double-execution

  const tgUsername = (application.telegram ?? '').replace('@', '') ||
    ((application.formData as { contactInfo?: { telegram?: string } })?.contactInfo?.telegram ?? '').replace('@', '');

  // Load status history
  useEffect(() => {
    let cancelled = false;
    setLogLoading(true);
    getStatusLog(application.id)
      .then(log => { if (!cancelled) setStatusLog(log); })
      .finally(() => { if (!cancelled) setLogLoading(false); });
    return () => { cancelled = true; };
  }, [application.id]);

  // Returns: 'sent' | 'skipped' — throws on error
  const sendNotify = async (overrideStatus?: string): Promise<'sent' | 'skipped'> => {
    const s = overrideStatus ?? application.status;
    const res = await apiFetch('/api/notify-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: application.telegramId,
        status: s,
        country: application.country,
        visa_type: application.visaType,
        application_id: application.id,
        // application_type='extension' → бэкенд использует STATUS_MESSAGES.ext_*
        // («Продление в работе» вместо «Виза оформляется» и т.д.).
        application_type: application.applicationType,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data.skipped ? 'skipped' : 'sent';
  };

  const handleSave = async () => {
    if (saveGuard.current) return; // hard guard — no double execution
    if (blockedByRate) {
      await dialog.error(
        'Укажите курс USD',
        'Без курса нельзя перевести заявку в «В работе» или «Готово» — финансы не посчитаются. Заполните поле «Курс USD на момент оплаты» в блоке «Финансы заявки» выше.',
      );
      return;
    }
    saveGuard.current = true;
    setSaving(true);
    try {
      let visaUrl: string | undefined;
      if (visaFile) {
        const url = await uploadVisaFile(visaFile);
        visaUrl = url ?? undefined;
      }
      const prevStatus = application.status;
      const tgId = (() => {
        try { return (window as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } } }).Telegram?.WebApp?.initDataUnsafe?.user?.id ?? 0; }
        catch { return 0; }
      })();
      const adminInfo = currentUser
        ? { id: tgId, name: `${currentUser.name}${currentUser.telegram ? ' ' + currentUser.telegram : ''}`.trim() }
        : undefined;
      await updateApplicationStatus(
        application.id, status, visaUrl,
        application.telegramId, application.country, application.visaType,
        prevStatus, adminInfo,
      );

      if (prevStatus !== status) {
        void auditLog('application.status_change', {
          target_type: 'application', target_id: application.id,
          details: { from: prevStatus, to: status, country: application.country, visa: application.visaType, visa_uploaded: !!visaUrl },
        });
      }
      if (visaUrl) {
        void auditLog('application.visa_uploaded', {
          target_type: 'application', target_id: application.id,
          details: { url: visaUrl },
        });
      }

      // Persist USD rate / tax % if admin changed them (used in finance reports).
      // Skip silently if input is empty / invalid — preserves the snapshot.
      if (Number.isFinite(usdRate) && usdRate > 0 && usdRate !== application.usdRateRub) {
        await updateApplicationUsdRate(application.id, usdRate);
        void auditLog('application.usd_rate_change', {
          target_type: 'application', target_id: application.id,
          details: { from: application.usdRateRub, to: usdRate },
        });
      }
      if (Number.isFinite(taxPct) && taxPct >= 0 && taxPct !== application.taxPct) {
        await updateApplicationTaxPct(application.id, taxPct);
        void auditLog('application.tax_pct_change', {
          target_type: 'application', target_id: application.id,
          details: { from: application.taxPct, to: taxPct },
        });
      }

      // Refresh log if status actually changed
      if (prevStatus !== status) {
        getStatusLog(application.id).then(setStatusLog).catch(() => {});
      }

      // Pay referral bonus to the referrer when admin confirms payment.
      // — Regular referrer: flat 500₽
      // — Partner referrer: % of this order's price (per-product partner_commission_pct)
      // Срабатывает на любом «paid» статусе — админ может пропустить in_progress
      // и перевести сразу в ready/completed. Идемпотентность через dedupe_key
      // защищает от повторного начисления при переключениях статуса.
      const PAID_STATUSES = ['in_progress', 'ready', 'completed'];
      if (PAID_STATUSES.includes(status) && application.telegramId) {
        payReferralBonus(application.telegramId, application.id).catch(e => console.warn('referral bonus error', e));
      }

      // Send Telegram notification for all statuses except draft
      if (status !== 'draft' && application.telegramId) {
        try {
          const notifyResult = await sendNotify(status);
          if (notifyResult === 'sent') {
            await dialog.success(visaUrl ? 'Виза загружена' : 'Статус обновлён', 'Уведомление отправлено в Telegram.');
          } else {
            // skipped by dedup (duplicate within 1 min) — changes saved, no double send
            await dialog.success('Изменения сохранены');
          }
        } catch (notifyErr) {
          // Push best-effort: «chat not found» (юзер не /start'ил бота),
          // network ошибки и т.п. — НЕ показываем это как warning, изменения
          // в БД успешно сохранены, для founder'а это нерелевантный шум.
          // Тихо логируем в консоль.
          console.warn('[admin/applications] notify-status failed (non-fatal):', notifyErr);
          await dialog.success('Изменения сохранены');
        }
      } else {
        await dialog.success('Изменения сохранены');
      }
      onClose();
    } catch {
      await dialog.error('Ошибка сохранения');
    } finally {
      setSaving(false);
      saveGuard.current = false;
    }
  };

  return (
    <Modal open onClose={onClose} size="lg">

        {/* Header — same brand pattern as Брони */}
        <div className="vd-grad-soft px-5 pt-5 pb-4 sticky top-0 z-10 border-b border-blue-100 shrink-0">
          <div className="flex items-center justify-between mb-2 pr-10">
            <p className="text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold flex items-center gap-1.5">
              <span>{application.countryFlag}</span>
              <span>{application.country} · {application.visaType}</span>
            </p>
          </div>
          <h2 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36]">{application.clientName || 'Без имени'}</h2>
          <div className="flex items-center gap-3 text-xs text-[#0F2A36]/60 mt-1 flex-wrap">
            <span>Подана {new Date(application.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            {tgUsername && (
              <a
                href={`https://t.me/${tgUsername}`}
                target="_blank"
                rel="noreferrer"
                className="text-[#3B5BFF] hover:underline flex items-center gap-1"
              >
                @{tgUsername} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 shrink-0">
          {(['info', 'form', 'files', 'payment'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition ${
                activeTab === tab ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'info' ? 'Основное' : tab === 'form' ? 'Анкета' : tab === 'files' ? 'Файлы' : 'Оплата'}
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
                  <p className="text-xs text-[#0F2A36]/60">Заявитель</p>
                  <p className="text-sm font-semibold text-[#0F2A36]">{application.clientName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-[#0F2A36]/60">Telegram</p>
                  {tgUsername ? (
                    <a href={`https://t.me/${tgUsername}`} target="_blank" rel="noreferrer"
                      className="text-sm font-semibold text-[#3B5BFF] hover:underline inline-flex items-center gap-1">
                      @{tgUsername} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : <p className="text-sm font-semibold text-[#0F2A36]">—</p>}
                </div>
                <div>
                  <p className="text-xs text-[#0F2A36]/60">Телефон</p>
                  <p className="text-sm font-semibold text-[#0F2A36]">{application.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-[#0F2A36]/60">Email</p>
                  <p className="text-sm font-semibold text-[#0F2A36] break-all">{application.email || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-[#0F2A36]/60">Дата подачи</p>
                  <p className="text-sm font-semibold text-[#0F2A36]">{new Date(application.date).toLocaleDateString('ru-RU')}</p>
                </div>
              </div>

              {/* Оплата */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Итого к оплате</p>
                  <p className="text-xl text-blue-600 font-semibold">
                    {(application.cost - application.bonusesUsed).toLocaleString('ru-RU')} ₽
                  </p>
                </div>
                {application.bonusesUsed > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <p className="text-gray-400">Полная сумма</p>
                    <p className="text-gray-400">{application.cost.toLocaleString('ru-RU')} ₽</p>
                  </div>
                )}
                {application.bonusesUsed > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <p className="text-green-600">Списано бонусов</p>
                    <p className="text-green-600 font-medium">−{application.bonusesUsed} ₽</p>
                  </div>
                )}
              </div>

              {/* Финансы заявки — снапшот курса + налог + live превью прибыли */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
                <p className="text-xs font-medium text-amber-800 uppercase tracking-wider">Финансы заявки</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">
                      Курс USD на момент оплаты
                      {rateMissing && <span className="text-red-600 ml-1">*</span>}
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">1$ =</span>
                      <input
                        type="number" value={usdRateStr} step="0.01" min={0}
                        placeholder="не задан"
                        onChange={(e) => setUsdRateStr(e.target.value)}
                        className={`flex-1 px-2 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 text-sm ${rateMissing ? 'border-red-400 focus:ring-red-400' : 'border-amber-300 focus:ring-amber-400'}`}
                      />
                      <span className="text-xs text-gray-500">₽</span>
                    </div>
                    {rateMissing && (
                      <p className="text-[11px] text-red-600 mt-1">Без курса нельзя перевести заявку в «В работе» или «Готово»</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Налог (%)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" value={taxPctStr} step="0.5" min={0} max={100}
                        onChange={(e) => setTaxPctStr(e.target.value)}
                        onBlur={() => { if (taxPctStr.trim() === '' || !Number.isFinite(parseFloat(taxPctStr))) setTaxPctStr(String(application.taxPct)); }}
                        className="flex-1 px-2 py-2 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Курс и налог влияют на расчёт прибыли в «Финансах». Налог считается от полной цены ({application.cost.toLocaleString('ru-RU')} ₽ × {Number.isFinite(taxPct) ? taxPct : 0}% = {Math.round(application.cost * (Number.isFinite(taxPct) ? taxPct : 0) / 100).toLocaleString('ru-RU')} ₽).
                </p>
              </div>

              {/* Статус */}
              <div>
                <label className="block text-sm text-gray-700 mb-2 font-medium">Статус заявки</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Application['status'])}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {/* Те же 4 статуса что у броней — единый язык в админке.
                      'draft' и 'pending_payment' убраны из dropdown'а: черновик
                      создаётся юзером (не админом), а оплата подтверждается
                      переходом в pending_confirmation после прикрепления скрина. */}
                  <option value="pending_confirmation">Ожидает подтверждения</option>
                  <option value="in_progress">В работе</option>
                  <option value="completed">Готово</option>
                </select>
              </div>

              {/* Visa file — when status = completed.
                  Стиль 1-в-1 с подтверждением брони (Bookings.tsx) — единый
                  паттерн загрузки файла-результата в админке. */}
              {status === 'completed' && (
                <div>
                  <p className="text-xs font-semibold text-[#0F2A36]/65 mb-2">Готовая виза</p>

                  {/* Existing file — small green pill above the dropzone */}
                  {application.visaFileUrl && !visaFile && (
                    <div className="vd-grad-soft border border-blue-100 rounded-xl p-2.5 flex items-center gap-2 mb-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={3} />
                      <p className="text-xs font-semibold text-[#0F2A36] flex-1">Виза отправлена клиенту</p>
                      <a href={application.visaFileUrl} target="_blank" rel="noreferrer"
                        className="text-xs text-[#3B5BFF] hover:underline shrink-0">Открыть файл</a>
                    </div>
                  )}

                  {/* Dropzone — всегда виден (как в Bookings VisaUploadBlock).
                      Сначала прикрепи файл, потом переводи в Готово. */}
                  <label htmlFor="visa-upload" className="block border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-[#5C7BFF] hover:bg-[#EAF1FF] transition text-center">
                    <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-[#0F2A36]">
                      {visaFile ? visaFile.name : application.visaFileUrl ? 'Загрузить другой файл' : 'Загрузить файл визы'}
                    </p>
                    <p className="text-[10px] text-[#0F2A36]/55 mt-0.5">
                      {application.visaFileUrl
                        ? 'PDF/JPG/PNG · заменит уже отправленный файл'
                        : 'PDF/JPG/PNG · после загрузки клиент сможет скачать в кабинете'}
                    </p>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                      id="visa-upload"
                      className="hidden"
                      onChange={(e) => setVisaFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              )}

              {/* Resend notification for already-completed apps.
                  Стиль 1-в-1 с Bookings StatusSelector → handleResend. */}
              {application.status === 'completed' && (
                <button
                  type="button"
                  onClick={async () => {
                    setNotifying(true);
                    try {
                      await sendNotify();
                      await dialog.success('Уведомление отправлено');
                    } catch (e) {
                      await dialog.error('Ошибка', String(e));
                    } finally {
                      setNotifying(false);
                    }
                  }}
                  disabled={notifying}
                  aria-busy={notifying}
                  className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition"
                >
                  {notifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>📨</span>}
                  {notifying ? 'Отправляем…' : 'Отправить уведомление повторно'}
                </button>
              )}

              {/* Save — стиль 1-в-1 с Bookings (синяя с Check-иконкой). */}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || blockedByRate}
                aria-busy={saving}
                title={blockedByRate ? 'Сначала укажите курс USD' : undefined}
                className="w-full py-3 bg-[#3B5BFF] hover:bg-[#4F2FE6] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Сохраняем…' : blockedByRate ? 'Укажите курс USD' : 'Сохранить изменения'}
              </button>

              {/* Status history */}
              <StatusHistory
                createdAt={application.date}
                log={statusLog}
                loading={logLoading}
              />
            </div>
          )}

          {/* ── Tab: Анкета ── */}
          {activeTab === 'form' && (
            Object.keys(application.formData ?? {}).length > 0
              ? <FormDataView app={application} />
              : <p className="text-center text-gray-400 py-12 text-sm">Данные анкеты не сохранены</p>
          )}

          {/* ── Tab: Файлы ── */}
          {activeTab === 'files' && <FilesView app={application} />}

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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => downloadFile(application.paymentProofUrl!, 'payment_proof.jpg')}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 transition"
                        >
                          <Download className="w-3.5 h-3.5" /> Скачать
                        </button>
                        <a href={application.paymentProofUrl} target="_blank" rel="noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                          Открыть <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
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
    </Modal>
  );
};

// ── Applications List ─────────────────────────────────────────────────────────
type SortField = 'date' | 'price' | 'country' | 'status';
type SortDir = 'asc' | 'desc';

function exportToCsv(rows: Application[]) {
  const head = ['ID', 'Страна', 'Тип', 'Клиент', 'Telegram', 'Телефон', 'Email', 'Сумма', 'Бонусы', 'Статус', 'Дата', 'Срочно'];
  const escape = (v: unknown) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[,";\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [head.join(',')];
  for (const a of rows) {
    const tg = ((a.formData as { contactInfo?: { telegram?: string } })?.contactInfo?.telegram ?? a.telegram ?? '').replace('@', '');
    lines.push([
      a.id, a.country, a.visaType, a.clientName, tg, a.phone, a.email,
      a.cost, a.bonusesUsed, statusLabels[a.status],
      new Date(a.date).toLocaleDateString('ru-RU'),
      a.urgent ? 'да' : 'нет',
    ].map(escape).join(','));
  }
  // Excel-friendly: BOM + CRLF
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `applications_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export const Applications: React.FC<ApplicationsProps> = ({ filter }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(filter?.filter === 'in_progress' ? 'in_progress' : 'all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const dialog = useDialog();

  const { applications, loading, refetch } = useAdminApplications();

  // Soft-delete заявки — UPDATE deleted_at = now() вместо DELETE.
  // Запись остаётся в БД и может быть восстановлена через SQL:
  //   UPDATE applications SET deleted_at = NULL WHERE id = '<uuid>';
  // status_log не трогаем — он остаётся как полная история (по
  // application_id всё ещё JOIN'ится).
  const handleDeleteApplication = async (app: Application) => {
    const ok = await dialog.confirm(
      `Удалить заявку${app.clientName ? ` ${app.clientName}` : ''}?`,
      'Заявка будет скрыта из админки. Данные остаются в БД и могут быть восстановлены при необходимости.',
      { confirmLabel: 'Удалить', cancelLabel: 'Отмена' },
    );
    if (!ok) return;
    if (!isSupabaseConfigured()) return;

    // P0-1: soft-delete через /api/admin-update-application (service_key)
    const r = await apiFetch('/api/admin-update-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: app.id, patch: { deleted_at: new Date().toISOString() } }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      await dialog.error('Не удалось удалить', `Ошибка ${r.status}: ${body}`);
      return;
    }

    if (selectedApp?.id === app.id) setSelectedApp(null);
    void refetch();
  };
  const countries = useMemo(() => Array.from(new Set(applications.map(app => app.country))), [applications]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86_400_000 : null; // include "to" day
    return applications.filter(app => {
      if (statusFilter !== 'all' && app.status !== statusFilter) return false;
      if (countryFilter !== 'all' && app.country !== countryFilter) return false;
      if (urgentOnly && !app.urgent) return false;
      const ts = new Date(app.date).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts >= toTs) return false;
      if (q) {
        const tg = ((app.formData as { contactInfo?: { telegram?: string } })?.contactInfo?.telegram ?? app.telegram ?? '').toLowerCase();
        const hay = `${app.clientName} ${app.phone} ${app.id} ${tg} ${app.email ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [applications, searchQuery, statusFilter, countryFilter, urgentOnly, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':    cmp = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
        case 'price':   cmp = (a.cost - a.bonusesUsed) - (b.cost - b.bonusesUsed); break;
        case 'country': cmp = a.country.localeCompare(b.country, 'ru'); break;
        case 'status':  cmp = a.status.localeCompare(b.status); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const totalRevenue = useMemo(
    () => sorted.filter(a => a.status !== 'draft').reduce((s, a) => s + (a.cost - a.bonusesUsed), 0),
    [sorted]
  );

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || countryFilter !== 'all' || urgentOnly || dateFrom || dateTo;
  const resetFilters = () => {
    setSearchQuery(''); setStatusFilter('all'); setCountryFilter('all');
    setUrgentOnly(false); setDateFrom(''); setDateTo('');
  };
  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('desc'); }
  };
  const sortIcon = (f: SortField) =>
    sortField !== f ? <ArrowUpDown className="w-3 h-3 inline ml-1 text-gray-400" /> :
    sortDir === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1 text-blue-500" /> :
    <ArrowDown className="w-3 h-3 inline ml-1 text-blue-500" />;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h1>Заявки</h1>
          <p className="text-xs text-gray-500 mt-1">
            {sorted.length} из {applications.length} · сумма: {totalRevenue.toLocaleString('ru-RU')} ₽
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button
            onClick={() => exportToCsv(sorted)}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition flex items-center gap-1.5 text-sm"
            title="Экспорт CSV"
          >
            <FileDown size={16} /> CSV
          </button>
          <button onClick={refetch} className="p-2 hover:bg-gray-100 rounded-lg transition" title="Обновить">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Quick tabs: Все / Срочные — самый частый сценарий, поэтому на верхнем уровне */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setUrgentOnly(false)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition active:scale-95 ${
            !urgentOnly ? 'vd-grad text-white shadow-md vd-shadow-cta' : 'bg-white border border-gray-200 text-[#0F2A36]/70 hover:bg-gray-50'
          }`}
        >
          Все ({applications.length})
        </button>
        <button
          type="button"
          onClick={() => setUrgentOnly(true)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition active:scale-95 ${
            urgentOnly
              ? 'bg-red-500 text-white shadow-md'
              : 'bg-white border border-gray-200 text-[#0F2A36]/70 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
          }`}
        >
          <Flame size={14} /> Срочные ({applications.filter(a => a.urgent).length})
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 mb-5 space-y-3">
        {/* Row 1: search + status + country */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="ID, имя, Telegram, телефон, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B5BFF] text-sm">
            <option value="all">Все статусы</option>
            <option value="draft">Черновик</option>
            <option value="pending_payment">Ожидает оплаты</option>
            <option value="pending_confirmation">Ожидает подтверждения</option>
            <option value="in_progress">В работе</option>
            <option value="completed">Готово</option>
          </select>
          <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B5BFF] text-sm">
            <option value="all">Все страны</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Row 2: date range + urgent toggle + reset */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Filter size={14} className="text-gray-400" /> Период:
          </div>
          <input
            type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]"
            title="С"
          />
          <span className="text-gray-400 text-xs">—</span>
          <input
            type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]"
            title="По"
          />
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="ml-auto px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-xs transition flex items-center gap-1"
            >
              <X size={12} /> Сбросить
            </button>
          )}
        </div>
      </div>

      {/* Sort row — компактные пилюли как в Брони */}
      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
        <span className="text-gray-500">Сортировка:</span>
        {([
          { f: 'date',    label: 'Дата'      },
          { f: 'price',   label: 'Сумма'     },
          { f: 'country', label: 'Страна'    },
          { f: 'status',  label: 'Статус'    },
        ] as const).map(({ f, label }) => {
          const active = sortField === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => toggleSort(f)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 transition active:scale-95 ${
                active ? 'bg-[#EAF1FF] border-[#3B5BFF]/30 text-[#3B5BFF]' : 'bg-white border-gray-200 text-[#0F2A36]/70 hover:bg-gray-50'
              }`}
            >
              {label}{sortIcon(f)}
            </button>
          );
        })}
      </div>

      {/* Card list — same shape as Брони */}
      {sorted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="flex justify-center mb-3"><FileDown className="w-12 h-12 text-gray-300" /></div>
          <p className="text-sm text-gray-500">
            {applications.length === 0 ? 'Заявок пока нет' : 'По выбранным фильтрам ничего не найдено'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((app) => {
            const tgUser = ((app.formData as { contactInfo?: { telegram?: string } })?.contactInfo?.telegram ?? app.telegram ?? '').replace('@', '');
            return (
              <div
                key={app.id}
                className={`w-full bg-white rounded-xl border hover:shadow-md transition flex items-center gap-2 pr-2 ${app.urgent ? 'border-red-200 bg-red-50/30' : 'border-gray-100'}`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedApp(app)}
                  className="flex-1 min-w-0 active:scale-[0.99] transition p-4 flex items-center gap-4 text-left"
                  title="Открыть заявку"
                >
                  <div className="w-11 h-11 rounded-xl vd-grad-soft border border-blue-100 flex items-center justify-center text-2xl shrink-0">
                    {app.countryFlag ?? '🌍'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[#0F2A36]">{app.clientName || 'Без имени'}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${statusChipClass[app.status]}`}>
                        {statusLabels[app.status]}
                      </span>
                      {/* Бэдж «Продление» удалён — тип заявки понятен из
                          visa_type («Шри-Ланка · Первое продление...»),
                          бэдж был визуальным шумом. */}
                      {app.urgent && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-700">
                          <Flame className="w-3 h-3" /> Срочно
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-[#3B5BFF]">
                        {(app.cost - app.bonusesUsed).toLocaleString('ru-RU')} ₽
                      </span>
                      {app.bonusesUsed > 0 && (
                        <span className="text-[10px] text-emerald-600 font-semibold">
                          −{app.bonusesUsed} ₽ бонусом
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#0F2A36]/60 mt-0.5 truncate">
                      {app.country} · {app.visaType}
                      {tgUser && <> · <span className="text-[#3B5BFF]" onClick={(e) => { e.stopPropagation(); window.open(`https://t.me/${tgUser}`, '_blank'); }}>@{tgUser}</span></>}
                      {app.phone && <> · {app.phone}</>}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(app.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void handleDeleteApplication(app); }}
                  className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition active:scale-95 shrink-0"
                  title="Удалить заявку"
                  aria-label="Удалить заявку"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedApp && (
        <ApplicationModal application={selectedApp} onClose={() => setSelectedApp(null)} />
      )}
    </div>
  );
};
