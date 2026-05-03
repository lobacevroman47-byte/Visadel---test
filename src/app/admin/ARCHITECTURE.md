# 🏗️ Архитектура админ-панели Visadel Agency

## 📐 Общая структура

```
┌─────────────────────────────────────────┐
│         Visadel Agency System           │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │   Mini App   │  │  Админ-панель   │ │
│  │  (Telegram)  │  │   (Desktop)     │ │
│  └──────────────┘  └─────────────────┘ │
│         │                   │           │
│         └───────────┬───────┘           │
│                     │                   │
│              ┌──────▼──────┐            │
│              │   Backend   │            │
│              │   (Future)  │            │
│              └─────────────┘            │
└─────────────────────────────────────────┘
```

---

## 🔐 Система авторизации

```
┌─────────────────────────────────────┐
│        AdminContext Provider        │
├─────────────────────────────────────┤
│                                     │
│  • currentUser: AdminUser | null    │
│  • login(email, password)           │
│  • logout()                         │
│  • hasPermission(role)              │
│                                     │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│         localStorage                │
├─────────────────────────────────────┤
│  key: "adminUser"                   │
│  value: { id, name, email, role }   │
└─────────────────────────────────────┘
```

### Уровни доступа

```
Owner (3)
  │
  ├─ Полный доступ
  ├─ Управление администраторами
  ├─ Настройки системы
  └─ Все функции Admin

Admin (2)
  │
  ├─ Заявки + Пользователи
  ├─ Страны + Конструктор
  └─ Без настроек и управления ролями

Manager (1)
  │
  └─ Только заявки
```

---

## 🧩 Компоненты

### Иерархия компонентов

```
AdminApp
  │
  └─ AdminProvider
       │
       ├─ AdminLogin (если не авторизован)
       │
       └─ AdminLayout (если авторизован)
            │
            ├─ AdminSidebar
            │    ├─ Logo
            │    ├─ UserInfo
            │    ├─ Navigation
            │    └─ Logout
            │
            └─ Content (динамический)
                 ├─ Dashboard
                 ├─ Applications
                 ├─ Users
                 ├─ Countries
                 ├─ FormBuilder
                 ├─ Administrators
                 └─ Settings
```

---

## 📊 Поток данных

### Авторизация

```
1. User → AdminLogin
         ↓
2. AdminLogin → AdminContext.login(email, password)
         ↓
3. AdminContext → проверка в MOCK_USERS
         ↓
4. Успех → сохранить в localStorage
         ↓
5. Перерендер → AdminLayout
```

### Обработка заявки

```
1. Manager → Applications
         ↓
2. Клик на заявку → ApplicationModal
         ↓
3. Изменение статуса → setState
         ↓
4. Загрузка визы → File input
         ↓
5. "Отправить" → Уведомление (Future: API)
         ↓
6. Статус = "Готово"
```

### Управление бонусами

```
1. Admin → Users
         ↓
2. Клик "Управление" → UserModal
         ↓
3. Ввод суммы → input
         ↓
4. +/- бонусы → setState
         ↓
5. Сохранить → обновить mockUsers
```

---

## 🎨 UI слои

```
┌──────────────────────────────────────────┐
│           Application Layer              │ ← AdminApp
├──────────────────────────────────────────┤
│          Authentication Layer            │ ← AdminContext
├──────────────────────────────────────────┤
│            Layout Layer                  │ ← AdminLayout
│  ┌────────────┬─────────────────────┐    │
│  │  Sidebar   │      Content        │    │
│  └────────────┴─────────────────────┘    │
├──────────────────────────────────────────┤
│            Component Layer               │ ← Pages, Modals
├──────────────────────────────────────────┤
│              Data Layer                  │ ← mockData
└──────────────────────────────────────────┘
```

---

## 🔄 Состояние приложения

### AdminContext State

```typescript
interface AdminContextState {
  currentUser: {
    id: string
    name: string
    email: string
    telegram: string
    role: 'owner' | 'admin' | 'manager'
  } | null
}
```

### Page State (пример Applications)

```typescript
interface ApplicationsState {
  searchQuery: string
  statusFilter: string
  countryFilter: string
  selectedApp: Application | null
}
```

---

## 🗄️ Структура данных

### Application (Заявка)

```typescript
{
  id: string
  country: string
  countryFlag: string
  clientName: string
  phone: string
  cost: number
  bonusesUsed: number
  status: 'draft' | 'pending_payment' | 'pending_confirmation' | 'in_progress' | 'completed'
  date: string
  email?: string
  passportFile?: string
  photoFile?: string
  paymentScreenshot?: string
  visaFile?: string
}
```

### User (Пользователь)

```typescript
{
  id: string
  name: string
  telegram: string
  phone: string
  email: string
  bonusBalance: number
  status: 'regular' | 'partner'
  registrationDate: string
  applicationsCount: number
}
```

### Country (Страна)

```typescript
{
  id: string
  name: string
  flag: string
  visaType: string
  price: number
  validity: string
  processingTime: string
  active: boolean
}
```

---

## 🚀 Lifecycle приложения

```
1. Загрузка AdminApp
   ↓
2. Инициализация AdminProvider
   ↓
3. Проверка localStorage
   ↓
4. Есть сессия?
   │
   ├─ Да → AdminLayout → Показать Dashboard
   │
   └─ Нет → AdminLogin → Форма входа
              ↓
         Успешный вход
              ↓
         Сохранить в localStorage
              ↓
         AdminLayout → Dashboard
```

---

## 📡 Будущая интеграция с Backend

### API Endpoints (Planned)

```
POST   /api/auth/login          # Авторизация
POST   /api/auth/logout         # Выход
GET    /api/auth/me             # Текущий пользователь

GET    /api/applications        # Список заявок
GET    /api/applications/:id    # Детали заявки
PATCH  /api/applications/:id    # Обновить заявку
POST   /api/applications/:id/visa  # Загрузить визу

GET    /api/users               # Список пользователей
PATCH  /api/users/:id/bonuses   # Изменить бонусы
PATCH  /api/users/:id/status    # Изменить статус

GET    /api/countries           # Список стран
POST   /api/countries           # Создать страну
PATCH  /api/countries/:id       # Обновить страну

GET    /api/forms/:countryId    # Поля анкеты
PATCH  /api/forms/:countryId    # Обновить анкету

GET    /api/admins              # Список администраторов
POST   /api/admins              # Добавить администратора
PATCH  /api/admins/:id          # Обновить роль
DELETE /api/admins/:id          # Удалить администратора

GET    /api/settings            # Настройки
PATCH  /api/settings            # Обновить настройки
```

### WebSocket Events (Planned)

```
new_application         # Новая заявка
application_updated     # Заявка обновлена
visa_ready             # Виза готова
user_registered        # Новый пользователь
```

---

## 🔒 Безопасность

### Текущая реализация

```
┌────────────────────────────────┐
│  Frontend-only Security        │
├────────────────────────────────┤
│  • localStorage для сессии     │
│  • Проверка роли в UI          │
│  • Disabled кнопки без прав    │
│  • Mock-данные локально        │
└────────────────────────────────┘
```

### Production реализация

```
┌────────────────────────────────┐
│  Full-stack Security           │
├────────────────────────────────┤
│  • JWT токены                  │
│  • HTTPS only                  │
│  • Backend проверка прав       │
│  • Rate limiting               │
│  • Логирование действий        │
│  • 2FA (опционально)           │
└────────────────────────────────┘
```

---

## 📦 Файловая структура

```
/admin/
│
├── AdminApp.tsx               # Главный компонент
│
├── contexts/
│   └── AdminContext.tsx      # Контекст авторизации
│
├── components/
│   ├── AdminSidebar.tsx      # Боковая навигация
│   └── AdminLayout.tsx       # Layout с роутингом
│
├── pages/
│   ├── AdminLogin.tsx        # Страница входа
│   ├── Dashboard.tsx         # Главная
│   ├── Applications.tsx      # Заявки
│   ├── Users.tsx             # Пользователи
│   ├── Countries.tsx         # Страны
│   ├── FormBuilder.tsx       # Конструктор
│   ├── Administrators.tsx    # Администраторы
│   └── Settings.tsx          # Настройки
│
└── data/
    └── mockData.ts           # Mock данные
```

---

## 🎯 Принципы дизайна

### Component Design

- **Модульность**: Каждый компонент независим
- **Переиспользование**: Общие компоненты выделены
- **Single Responsibility**: Один компонент = одна задача

### State Management

- **Context API**: Для глобального состояния (auth)
- **Local State**: Для компонент-специфичного состояния
- **Props**: Для передачи данных вниз

### Code Organization

- **Разделение по фичам**: Каждый раздел = отдельная страница
- **Типизация**: TypeScript для всех интерфейсов
- **Константы**: Централизованные в mockData.ts

---

## 🔮 Расширяемость

### Добавление нового раздела

1. Создать компонент в `/admin/pages/`
2. Добавить маршрут в `AdminLayout.tsx`
3. Добавить пункт в `AdminSidebar.tsx`
4. Настроить права доступа

### Добавление новой роли

1. Обновить тип `UserRole` в `AdminContext.tsx`
2. Добавить в `ROLE_HIERARCHY`
3. Обновить проверки `hasPermission`
4. Добавить в UI (labels, colors)

### Интеграция с API

1. Создать API клиент (`/admin/api/`)
2. Заменить mock данные на API calls
3. Добавить обработку ошибок
4. Добавить loading states

---

Эта архитектура обеспечивает:
- ✅ Простоту поддержки
- ✅ Легкость расширения
- ✅ Безопасность на уровне UI
- ✅ Готовность к интеграции с backend
