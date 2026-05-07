export interface Application {
  id: string;
  country: string;
  countryFlag: string;
  clientName: string;
  phone: string;
  cost: number;
  bonusesUsed: number;
  status: 'draft' | 'pending_payment' | 'pending_confirmation' | 'in_progress' | 'completed';
  date: string;
  email?: string;
  passportFile?: string;
  photoFile?: string;
  paymentScreenshot?: string;
  visaFile?: string;
}

export interface User {
  id: string;
  name: string;
  telegram: string;
  phone: string;
  email: string;
  bonusBalance: number;
  status: 'regular' | 'partner';
  registrationDate: string;
  registeredAt: string; // ISO datetime string
  applicationsCount: number;
}

export interface Country {
  id: string;
  name: string;
  flag: string;
  visaType: string;
  price: number;
  validity: string;
  processingTime: string;
  active: boolean;
}

export interface Administrator {
  id: string;
  name: string;
  telegram: string;
  role: 'owner' | 'admin' | 'manager';
  addedDate: string;
  status: 'active' | 'blocked';
}

export const mockApplications: Application[] = [
  {
    id: 'APP001',
    country: 'Таиланд',
    countryFlag: '🇹🇭',
    clientName: 'Иванов Иван Иванович',
    phone: '+7 (999) 123-45-67',
    cost: 15000,
    bonusesUsed: 500,
    status: 'in_progress',
    date: '2025-11-28',
    email: 'ivanov@example.com',
    passportFile: 'passport_001.pdf',
    photoFile: 'photo_001.jpg',
    paymentScreenshot: 'payment_001.jpg'
  },
  {
    id: 'APP002',
    country: 'ОАЭ',
    countryFlag: '🇦🇪',
    clientName: 'Петрова Мария Сергеевна',
    phone: '+7 (999) 234-56-78',
    cost: 12000,
    bonusesUsed: 0,
    status: 'pending_confirmation',
    date: '2025-11-29',
    email: 'petrova@example.com',
    paymentScreenshot: 'payment_002.jpg'
  },
  {
    id: 'APP003',
    country: 'Турция',
    countryFlag: '🇹🇷',
    clientName: 'Сидоров Петр Алексеевич',
    phone: '+7 (999) 345-67-89',
    cost: 8000,
    bonusesUsed: 200,
    status: 'completed',
    date: '2025-11-25',
    email: 'sidorov@example.com',
    visaFile: 'visa_003.pdf'
  },
  {
    id: 'APP004',
    country: 'Шри-Ланка',
    countryFlag: '🇱🇰',
    clientName: 'Кузнецова Анна Дмитриевна',
    phone: '+7 (999) 456-78-90',
    cost: 9000,
    bonusesUsed: 0,
    status: 'pending_payment',
    date: '2025-11-30',
    email: 'kuznetsova@example.com'
  },
  {
    id: 'APP005',
    country: 'Египет',
    countryFlag: '🇪🇬',
    clientName: 'Смирнов Алексей Владимирович',
    phone: '+7 (999) 567-89-01',
    cost: 7000,
    bonusesUsed: 300,
    status: 'draft',
    date: '2025-12-01',
    email: 'smirnov@example.com'
  }
];

export const mockUsers: User[] = [
  {
    id: 'USR001',
    name: 'Иванов Иван Иванович',
    telegram: '@ivanov_ivan',
    phone: '+7 (999) 123-45-67',
    email: 'ivanov@example.com',
    bonusBalance: 1500,
    status: 'partner',
    registrationDate: '2025-10-15',
    registeredAt: '2025-10-15T10:00:00Z',
    applicationsCount: 5
  },
  {
    id: 'USR002',
    name: 'Петрова Мария Сергеевна',
    telegram: '@petrova_maria',
    phone: '+7 (999) 234-56-78',
    email: 'petrova@example.com',
    bonusBalance: 500,
    status: 'regular',
    registrationDate: '2025-11-01',
    registeredAt: '2025-11-01T11:00:00Z',
    applicationsCount: 2
  },
  {
    id: 'USR003',
    name: 'Сидоров Петр Алексеевич',
    telegram: '@sidorov_petr',
    phone: '+7 (999) 345-67-89',
    email: 'sidorov@example.com',
    bonusBalance: 2000,
    status: 'partner',
    registrationDate: '2025-09-20',
    registeredAt: '2025-09-20T12:00:00Z',
    applicationsCount: 8
  },
  {
    id: 'USR004',
    name: 'Кузнецова Анна Дмитриевна',
    telegram: '@kuznetsova_anna',
    phone: '+7 (999) 456-78-90',
    email: 'kuznetsova@example.com',
    bonusBalance: 0,
    status: 'regular',
    registrationDate: '2025-11-28',
    registeredAt: '2025-11-28T13:00:00Z',
    applicationsCount: 1
  },
  // Новые пользователи за последние 24 часа
  {
    id: 'USR005',
    name: 'Новиков Дмитрий Сергеевич',
    telegram: '@novikov_dmitry',
    phone: '+7 (999) 567-89-12',
    email: 'novikov@example.com',
    bonusBalance: 500,
    status: 'regular',
    registrationDate: '2025-12-01',
    registeredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 часа назад
    applicationsCount: 0
  },
  {
    id: 'USR006',
    name: 'Волкова Екатерина Петровна',
    telegram: '@volkova_katya',
    phone: '+7 (999) 678-90-23',
    email: 'volkova@example.com',
    bonusBalance: 500,
    status: 'regular',
    registrationDate: '2025-12-01',
    registeredAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 часов назад
    applicationsCount: 0
  },
  {
    id: 'USR007',
    name: 'Морозов Андрей Владимирович',
    telegram: '@morozov_andrey',
    phone: '+7 (999) 789-01-34',
    email: 'morozov@example.com',
    bonusBalance: 700,
    status: 'partner',
    registrationDate: '2025-12-01',
    registeredAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), // 10 часов назад
    applicationsCount: 0
  },
  {
    id: 'USR008',
    name: 'Соколова Ольга Николаевна',
    telegram: '@sokolova_olga',
    phone: '+7 (999) 890-12-45',
    email: 'sokolova@example.com',
    bonusBalance: 500,
    status: 'regular',
    registrationDate: '2025-12-01',
    registeredAt: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(), // 15 часов назад
    applicationsCount: 0
  }
];

export const mockCountries: Country[] = [
  {
    id: 'CNT001',
    name: 'Таиланд',
    flag: '🇹🇭',
    visaType: 'Туристическая виза',
    price: 15000,
    validity: '60 дней',
    processingTime: '5-7 дней',
    active: true
  },
  {
    id: 'CNT002',
    name: 'ОАЭ',
    flag: '🇦🇪',
    visaType: 'Туристическая виза',
    price: 12000,
    validity: '30 дней',
    processingTime: '3-5 дней',
    active: true
  },
  {
    id: 'CNT003',
    name: 'Турция',
    flag: '🇹🇷',
    visaType: 'Электронная виза',
    price: 8000,
    validity: '180 дней',
    processingTime: '1-2 дня',
    active: true
  },
  {
    id: 'CNT004',
    name: 'Египет',
    flag: '🇪🇬',
    visaType: 'Туристическая виза',
    price: 7000,
    validity: '30 дней',
    processingTime: '3-5 дней',
    active: true
  },
  {
    id: 'CNT005',
    name: 'Шри-Ланка',
    flag: '🇱🇰',
    visaType: 'Электронная виза ETA',
    price: 9000,
    validity: '30 дней',
    processingTime: '2-3 дня',
    active: true
  },
  {
    id: 'CNT006',
    name: 'Южная Корея',
    flag: '🇰🇷',
    visaType: 'K-ETA',
    price: 11000,
    validity: '2 года',
    processingTime: '1-3 дня',
    active: true
  },
  {
    id: 'CNT007',
    name: 'Вьетнам',
    flag: '🇻🇳',
    visaType: 'Электронная виза',
    price: 10000,
    validity: '30 дней',
    processingTime: '3-5 дней',
    active: true
  },
  {
    id: 'CNT008',
    name: 'Индия',
    flag: '🇮🇳',
    visaType: 'Электронная виза e-Visa',
    price: 13000,
    validity: '60 дней',
    processingTime: '4-7 дней',
    active: true
  }
];

export const mockAdministrators: Administrator[] = [
  {
    id: 'ADM001',
    name: 'Владелец',
    telegram: '@owner',
    role: 'owner',
    addedDate: '2025-01-01',
    status: 'active'
  },
  {
    id: 'ADM002',
    name: 'Администратор',
    telegram: '@admin',
    role: 'admin',
    addedDate: '2025-02-15',
    status: 'active'
  },
  {
    id: 'ADM003',
    name: 'Менеджер Ольга',
    telegram: '@manager_olga',
    role: 'manager',
    addedDate: '2025-03-20',
    status: 'active'
  },
  {
    id: 'ADM004',
    name: 'Менеджер Андрей',
    telegram: '@manager_andrey',
    role: 'manager',
    addedDate: '2025-04-10',
    status: 'active'
  }
];

export const statusLabels: Record<Application['status'], string> = {
  draft: 'Черновик',
  pending_payment: 'Ожидает оплаты',
  pending_confirmation: 'Ожидает подтверждения',
  in_progress: 'В работе',
  completed: 'Готово'
};

export const statusColors: Record<Application['status'], string> = {
  draft: '#9E9E9E',
  pending_payment: '#FFC400',
  pending_confirmation: '#FF9800',
  in_progress: '#3B5BFF',
  completed: '#10B981'
};

// Tailwind chip classes for status badges — matches the Bookings admin page,
// so visa applications and hotel/flight bookings look visually consistent.
export const statusChipClass: Record<Application['status'], string> = {
  draft:                'bg-gray-100 text-gray-700',
  pending_payment:      'bg-yellow-100 text-yellow-700',
  pending_confirmation: 'bg-[#EAF1FF] text-[#3B5BFF]',
  in_progress:          'bg-amber-100 text-amber-700',
  completed:            'bg-emerald-100 text-emerald-700',
};

export const roleLabels: Record<'owner' | 'admin' | 'manager', string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  manager: 'Менеджер'
};