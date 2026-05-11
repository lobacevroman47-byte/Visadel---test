/* eslint-disable */
// =======================================================================
// 🚧 TEMP: REMOVE AFTER TESTING 🚧
//
// Временная админ-кнопка «Создать тестовые черновики» — инжектит в
// localStorage драфты всех визовых анкет, продления Шри-Ланки и
// бронирований отель/билет. Чтобы удалить ВСЁ временное:
//   1) Удалить этот файл
//   2) В Dashboard.tsx убрать import DevSeedDrafts + компонент в JSX
//      (оба места помечены `// TEMP: REMOVE`)
// =======================================================================

import React, { useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/brand';
import type { VisaOption } from '../../App';

// ── Универсальные значения для всех драфтов ─────────────────────────────
const FIRST = 'Тест';
const LAST = 'Тестов';
const A = 'А';                          // односимвольная заглушка
const DATE = '2026-05-21';
const YES = 'Да';
const MARITAL = 'Холост/Не замужем';
const EMAIL = 'test@visadel.test';
const PHONE = '+7 999 999 99 99';
const TG = 'test_user';
const HOW_HEARD = ['tiktok'];
const SAVED_AT = new Date().toISOString();

const baseFormDataExtras = {
  additionalDocs: { hotelBooking: true, returnTicket: true, urgentProcessing: false },
  howHeard: HOW_HEARD,
  contactInfo: { email: EMAIL, phone: PHONE, telegram: TG },
  photos: { facePhoto: null, passportPhoto: null, additionalPhotos: {} },
};

const commonIdentity = { firstName: FIRST, lastName: LAST };

// ── basicData по странам ────────────────────────────────────────────────
const VISA_DATA: Array<{ visa: VisaOption; basicData: Record<string, any> }> = [
  {
    visa: { id: 'india-30d', country: 'Индия', type: 'E-VISA на 30 дней', duration: '30 дней', price: 5490, readinessTime: '1–3 дня' },
    basicData: {
      ...commonIdentity,
      citizenship: A, arrivalAirport: A, arrivalDate: DATE, previousName: A, birthCity: A,
      previousCitizenship: A, internalPassport: A, twoYearsResidence: YES,
      registrationAddress: A, residenceAddress: A, fatherInfo: A, motherInfo: A,
      maritalStatus: MARITAL, spouseInfo: A, employment: A, militaryService: A,
      visaRejection: A, placesToVisit: A, countriesVisited: A, previousIndiaVisit: YES,
      neighborCountries: A, hotelInfo: A, contactInIndia: A, emergencyContact: A,
    },
  },
  {
    visa: { id: 'vietnam-90d-single', country: 'Вьетнам', type: 'E-VISA на 90 дней однократная', duration: '90 дней', price: 5490, readinessTime: 'до 5 рабочих дней' },
    basicData: {
      ...commonIdentity,
      citizenship: A, birthCountry: A, secondCitizenship: A, violations: A, oldPassport: A,
      stayDates: DATE, registrationAddress: A, currentAddress: A, emergencyContact: A,
      employment: A, purpose: A, contacts: A, arrivalAirport: A, departureAirport: A,
      vietnamAddress: A, previousVisits: A, childInfo: A, insurance: A, expectedExpenses: '1000',
    },
  },
  {
    visa: { id: 'srilanka-30d-rf', country: 'Шри-Ланка', type: 'ETA на 30 дней (гражданам РФ)', duration: '30 дней', price: 2490, readinessTime: '1–3 дня' },
    basicData: {
      ...commonIdentity,
      citizenship: A, birthCountry: A, last14DaysCountry: A, arrivalDate: DATE,
      departureAirport: A, airline: A, homeAddress: A, sriLankaAddress: A,
      residentVisa: YES, onSriLanka: YES, multipleVisa: YES,
    },
  },
  {
    visa: { id: 'korea-3y', country: 'Южная Корея', type: 'K-ETA на 3 года', duration: '3 года', price: 3490, readinessTime: 'до 3-х дней' },
    basicData: {
      ...commonIdentity,
      purpose: A, previousVisit: YES, dualCitizenship: YES, criminalRecord: YES, diseases: YES,
      contactsInKorea: A, travelCompanions: A, employment: A, countriesVisited: A,
      travelDates: DATE, koreaAddress: A,
    },
  },
  {
    visa: { id: 'israel-2y', country: 'Израиль', type: 'ETA на 2 года', duration: '2 года', price: 3490, readinessTime: 'до 3-х дней' },
    basicData: {
      ...commonIdentity,
      citizenship: A, arrivalDate: DATE, arrivalAirport: A, biometricPassport: YES,
      secondCitizenship: YES, maritalStatus: MARITAL, fatherInfo: A, motherInfo: A,
      homeAddress: A,
    },
  },
  {
    visa: { id: 'pakistan-90d', country: 'Пакистан', type: 'E-VISA до 90 дней', duration: '90 дней', price: 6490, readinessTime: '1–3 дня' },
    basicData: {
      ...commonIdentity,
      stayDuration: '30', entryPort: A, exitPort: A, stayDate: DATE, maritalStatus: MARITAL,
      parentsInfo: A, employment: A, plannedAddress: A,
    },
  },
  {
    visa: { id: 'cambodia-30d', country: 'Камбоджа', type: 'E-VISA на 30 дней', duration: '30 дней', price: 6490, readinessTime: '3–5 дней' },
    basicData: {
      ...commonIdentity,
      entryDate: DATE, homeAddress: A, cambodiaAddress: A, entryPort: A,
    },
  },
  {
    visa: { id: 'kenya-90d', country: 'Кения', type: 'ETA на 90 дней', duration: '90 дней', price: 6490, readinessTime: '2–4 дня' },
    basicData: {
      ...commonIdentity,
      profession: A, emergencyContact: A, travelDates: DATE, entryPort: A, flightInfo: A,
      departureCountry: A, exitPort: A, exitFlightInfo: A, destinationCountry: A,
      kenyaAddress: A, birthCountry: A, criminalRecord: YES, entryDenied: YES,
      previousVisit: YES, currencyImport: A,
    },
  },
];

// ── Шри-Ланка продление (отдельная структура — application_type: 'extension') ──
const EXTENSION_VISA: VisaOption = {
  id: 'srilanka-ext-60d',
  country: 'Шри-Ланка',
  type: 'Первое продление на 60 дней',
  duration: '60 дней',
  price: 8990,
  readinessTime: '3–5 дней',
};
const EXTENSION_BASIC_DATA = {
  ...commonIdentity,
  homeAddress: A, arrivalDate: DATE, sriLankaAddress: A, phoneNumbers: PHONE,
};

// ── Seed logic ──────────────────────────────────────────────────────────
function seedDrafts(): { count: number; details: string[] } {
  const details: string[] = [];
  const visaDraftsArr: any[] = [];

  // Визовые драфты (8 стран)
  for (const { visa, basicData } of VISA_DATA) {
    const id = `draft_seed_${visa.id}`;
    const draft = {
      id,
      formData: { basicData, ...baseFormDataExtras },
      step: 4, // Step6Review — index 4 в STEPS массиве
      visa,
      urgent: false,
      savedAt: SAVED_AT,
    };
    localStorage.setItem(id, JSON.stringify(draft));
    visaDraftsArr.push(draft);
    details.push(`✓ ${visa.country}: ${visa.type}`);
  }

  // Шри-Ланка продление
  {
    const id = `draft_extension_${EXTENSION_VISA.id}`;
    const draft = {
      id,
      formData: { basicData: EXTENSION_BASIC_DATA, ...baseFormDataExtras },
      step: 4,
      visa: EXTENSION_VISA,
      urgent: false,
      application_type: 'extension' as const,
      savedAt: SAVED_AT,
    };
    localStorage.setItem(id, JSON.stringify(draft));
    visaDraftsArr.push(draft);
    details.push(`✓ Шри-Ланка продление`);
  }

  // visa_drafts массив (для ApplicationsTab + DraftPickerModal)
  const existing = JSON.parse(localStorage.getItem('visa_drafts') || '[]') as any[];
  const filtered = existing.filter(d => !String(d?.id ?? '').startsWith('draft_seed_') && !String(d?.id ?? '').startsWith('draft_extension_'));
  localStorage.setItem('visa_drafts', JSON.stringify([...filtered, ...visaDraftsArr]));

  // Hotel booking draft (singleton)
  localStorage.setItem('hotel_booking_draft', JSON.stringify({
    firstName: FIRST, lastName: LAST, country: A, city: A,
    checkIn: DATE, checkOut: DATE, guests: 1, hasChildren: 'no', children: [],
    email: EMAIL, phone: PHONE, telegramLogin: TG, extraValues: {},
    savedAt: SAVED_AT,
  }));
  details.push('✓ Бронь отеля');

  // Flight booking draft (singleton)
  localStorage.setItem('flight_booking_draft', JSON.stringify({
    firstName: FIRST, lastName: LAST, fromCity: A, toCity: A, bookingDate: DATE,
    email: EMAIL, phone: PHONE, telegramLogin: TG, extraValues: {},
    savedAt: SAVED_AT,
  }));
  details.push('✓ Бронь авиабилета');

  return { count: visaDraftsArr.length + 2, details };
}

function clearSeedDrafts(): number {
  let removed = 0;
  // Удаляем все ключи draft_seed_*
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('draft_seed_') || key.startsWith('draft_extension_srilanka-ext-')) {
      localStorage.removeItem(key);
      removed++;
    }
  }
  // Чистим visa_drafts массив
  const existing = JSON.parse(localStorage.getItem('visa_drafts') || '[]') as any[];
  const filtered = existing.filter(d => !String(d?.id ?? '').startsWith('draft_seed_') && !String(d?.id ?? '').startsWith('draft_extension_'));
  if (filtered.length !== existing.length) {
    localStorage.setItem('visa_drafts', JSON.stringify(filtered));
    removed += existing.length - filtered.length;
  }
  // Hotel + flight singletons
  if (localStorage.getItem('hotel_booking_draft')) { localStorage.removeItem('hotel_booking_draft'); removed++; }
  if (localStorage.getItem('flight_booking_draft')) { localStorage.removeItem('flight_booking_draft'); removed++; }
  return removed;
}

export const DevSeedDrafts: React.FC = () => {
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null);

  const handleSeed = () => {
    try {
      const { count, details } = seedDrafts();
      setResult({ ok: true, message: `Создано черновиков: ${count}`, details });
    } catch (e: any) {
      setResult({ ok: false, message: `Ошибка: ${e?.message ?? e}` });
    }
  };

  const handleClear = () => {
    try {
      const removed = clearSeedDrafts();
      setResult({ ok: true, message: `Удалено тестовых драфтов: ${removed}` });
    } catch (e: any) {
      setResult({ ok: false, message: `Ошибка: ${e?.message ?? e}` });
    }
  };

  return (
    <Card variant="flat" padding="lg" radius="xl" className="mb-8 border-2 border-dashed border-amber-400">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-amber-100">
          <Sparkles size={20} className="text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-[#0F2A36]">🚧 DEV: Тестовые черновики</h3>
          <p className="text-xs text-[#0F2A36]/60">Временная кнопка — удалить после тестов. Имя: «Тест Тестов», поля «А», источник TikTok, бронь отеля + билета включены.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={handleSeed}
          className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition"
        >
          Создать черновики
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-2 rounded-lg bg-gray-200 text-[#0F2A36] text-sm font-semibold hover:bg-gray-300 transition inline-flex items-center gap-2"
        >
          <Trash2 size={14} /> Удалить тестовые
        </button>
      </div>
      {result && (
        <div className={`text-sm p-3 rounded-lg ${result.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
          <p className="font-semibold">{result.message}</p>
          {result.details && (
            <ul className="mt-2 space-y-0.5 text-xs">
              {result.details.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
};

export default DevSeedDrafts;
