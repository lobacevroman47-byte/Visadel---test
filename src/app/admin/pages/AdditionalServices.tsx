import React, { useEffect, useMemo, useState } from 'react';
import {
  Package, Plus, Edit2, Trash2, Save, Loader2, RefreshCw, Eye, EyeOff, Hotel,
} from 'lucide-react';
import {
  getAdditionalServices, upsertAdditionalService, deleteAdditionalService,
  getAppSettings, type AdditionalService, type AppSettings,
} from '../../lib/db';
import { auditLog } from '../lib/audit';
import { useDialog } from '../../components/shared/BrandDialog';
import { Button, Modal } from '../../components/ui/brand';
import { BookingProductEditor, VISA_ADDON_BOOKING_TYPES, STANDALONE_BOOKING_TYPES } from './FormBuilder';

// IDs для каждого scope (миграция 027 — split):
//   * visa-аддоны (внутри визы):  hotel-booking, flight-booking
//   * standalone (главное меню):  standalone-hotel-booking, standalone-flight-booking
// Префиксы ID для разделения visa-аддонов и standalone:
//   * standalone-* — самостоятельные брони (Каталог → Брони + главное меню)
//   * не standalone — visa-аддоны и обычные доп. услуги
type Mode = 'addons' | 'bookings';

// All services live in one list — visa addons (Подтверждение проживания /
// Обратный билет / Срочное оформление) plus any custom rows the admin adds.
//
// Mode определяет:
//   * 'addons'   — Конструктор → Доп. услуги (visa-аддоны: visa-аддон цены/полей)
//   * 'bookings' — Каталог → Брони (standalone-брони: отдельный booking-flow)
// Visa-аддоны и standalone-брони — независимые сущности (миграция 027),
// изменения в одной не влияют на другую.
export const AdditionalServices: React.FC<{
  mode?: Mode;
  /** Скрыть кнопку «Добавить» (если этот же экран уже доступен в другом
   *  месте — напр. Конструктор → Доп. услуги делегирует add в Каталог. */
  hideAddButton?: boolean;
}> = ({ mode = 'addons', hideAddButton = false }) => {
  const dialog = useDialog();
  const [services, setServices] = useState<AdditionalService[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdditionalService | null>(null);
  const [adding, setAdding] = useState(false);

  const isBookings = mode === 'bookings';

  const load = async () => {
    setLoading(true);
    try {
      const [s, st] = await Promise.all([getAdditionalServices(), getAppSettings()]);
      setServices(s);
      setSettings(st);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Какой набор BOOKING_TYPES подсовывать BookingProductEditor'у — зависит
  // от mode. В addons mode visa-aддоны, в bookings mode standalone.
  // Это критично для split: открывая Бронь отеля в Доп. услугах редактируем
  // hotel-booking, а в Брони — standalone-hotel-booking. Полностью разные
  // записи в additional_services.
  const bookingTypesForMode = isBookings ? STANDALONE_BOOKING_TYPES : VISA_ADDON_BOOKING_TYPES;
  const editingBookingType = useMemo(
    () => editing ? bookingTypesForMode.find(bt => bt.serviceId === editing.id) : null,
    [editing, bookingTypesForMode],
  );


  const visible = useMemo(() => {
    if (isBookings) {
      // Каталог → Брони: показываем все записи с префиксом standalone-
      // (включая дефолтные standalone-hotel-booking / standalone-flight-booking
      // и любые добавленные админом custom standalone-XXX).
      return services.filter(s => s.id.startsWith('standalone-'));
    }
    // Конструктор → Доп. услуги (mode='addons'): показываем все обычные
    // visa-аддоны (hotel-booking / flight-booking / urgent-processing /
    // custom). НО скрываем standalone-* — их место только в Брони,
    // т.к. это самостоятельный flow в главном меню Mini App, а не
    // visa-аддон.
    return services.filter(s => !s.id.startsWith('standalone-'));
  }, [services, isBookings]);
  const totalEnabled = useMemo(() => visible.filter(s => s.enabled).length, [visible]);
  const HEADER_ICON = isBookings ? <Hotel className="w-5 h-5" /> : <Package className="w-5 h-5" />;
  const HEADER_TITLE = isBookings ? 'Брони' : 'Дополнительные услуги';
  const HEADER_HINT = isBookings
    ? `${visible.length} ${visible.length === 1 ? 'услуга' : 'услуг'} · ${totalEnabled} активных · отдельная страница в мини-аппе`
    : `${visible.length} ${visible.length === 1 ? 'услуга' : 'услуг'} · ${totalEnabled} активных · применяются при оформлении виз`;

  const handleToggle = async (s: AdditionalService) => {
    await upsertAdditionalService({ ...s, enabled: !s.enabled });
    setServices(prev => prev.map(x => x.id === s.id ? { ...x, enabled: !s.enabled } : x));
    void auditLog('service.toggle', {
      target_type: 'additional_service', target_id: s.id,
      details: { name: s.name, from: s.enabled, to: !s.enabled },
    });
  };

  const handleDelete = async (s: AdditionalService) => {
    const ok = await dialog.confirm(`Удалить «${s.name}»?`, 'Это действие нельзя отменить.', { confirmLabel: 'Удалить', cancelLabel: 'Отмена' });
    if (!ok) return;
    await deleteAdditionalService(s.id);
    setServices(prev => prev.filter(x => x.id !== s.id));
    void auditLog('service.delete', {
      target_type: 'additional_service', target_id: s.id,
      details: { name: s.name, price: s.price },
    });
  };

  return (
    <div className="p-4 md:p-8">
      {/* Hero — same brand pattern as cabinet/admin Bookings */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl vd-grad flex items-center justify-center text-white shadow-md shrink-0">
            {HEADER_ICON}
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36]">{HEADER_TITLE}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{HEADER_HINT}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          {!hideAddButton && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="px-4 py-2.5 vd-grad text-white rounded-xl flex items-center gap-1.5 text-sm font-bold select-none shadow-md vd-shadow-cta active:scale-[0.98] transition"
            >
              <Plus size={16} strokeWidth={2.5} /> {isBookings ? 'Добавить бронь' : 'Добавить услугу'}
            </button>
          )}
          <button onClick={load} className="w-10 h-10 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center transition active:scale-95" title="Обновить">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {!loading && visible.length === 0 && !isBookings && (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl vd-grad-soft border border-blue-100 flex items-center justify-center text-3xl mx-auto mb-4">
            📦
          </div>
          <h3 className="text-[18px] font-extrabold tracking-tight text-[#0F2A36] mb-1">Пока пусто</h3>
          <p className="text-sm text-[#0F2A36]/60 mb-5">
            {hideAddButton
              ? 'Добавь первую услугу через раздел Каталог продуктов → Доп. услуги'
              : 'Добавь первую услугу — она появится в калькуляторе на странице визы'}
          </p>
          {!hideAddButton && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="px-5 py-2.5 vd-grad text-white rounded-xl inline-flex items-center gap-2 select-none shadow-md vd-shadow-cta font-bold active:scale-[0.98] transition"
            >
              <Plus size={16} strokeWidth={2.5} /> Добавить услугу
            </button>
          )}
        </div>
      )}

      {!loading && visible.length === 0 && isBookings && (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl vd-grad-soft border border-blue-100 flex items-center justify-center text-3xl mx-auto mb-4">
            🏨
          </div>
          <h3 className="text-[18px] font-extrabold tracking-tight text-[#0F2A36] mb-1">Брони ещё не созданы</h3>
          <p className="text-sm text-[#0F2A36]/60">Запусти SQL-миграцию <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">027_split_standalone_bookings.sql</code> — она создаст записи <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">standalone-hotel-booking</code> и <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">standalone-flight-booking</code>.</p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="space-y-2.5">
          {visible.map(s => {
            const restricted = Array.isArray(s.countries) && s.countries.length > 0;
            return (
              <div
                key={s.id}
                className={`bg-white rounded-2xl border border-gray-100 hover:shadow-md transition p-4 flex flex-wrap items-start gap-3 ${!s.enabled ? 'opacity-55' : ''}`}
              >
                {/* Brand soft icon block */}
                <div className="w-12 h-12 rounded-xl vd-grad-soft border border-blue-100 flex items-center justify-center text-2xl shrink-0">
                  {s.icon ?? '⭐'}
                </div>

                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[15px] font-bold text-[#0F2A36]">{s.name || <span className="text-gray-400 italic font-normal">Без названия</span>}</p>
                    {!s.enabled && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-500">Скрыта</span>
                    )}
                  </div>
                  {s.description && <p className="text-xs text-[#0F2A36]/65 mt-0.5">{s.description}</p>}
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{s.id}</span>
                    {restricted && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#3B5BFF] bg-[#EAF1FF] px-1.5 py-0.5 rounded">
                        🌍 {s.countries.length} {s.countries.length === 1 ? 'страна' : 'стран'}
                      </span>
                    )}
                    {(s.partner_commission_pct ?? 0) > 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        партнёрам {s.partner_commission_pct}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Price block — себестоимость прячется, видна только в редакторе */}
                <div className="text-right whitespace-nowrap shrink-0">
                  <div className="text-[#3B5BFF] text-[15px] font-bold">+{s.price.toLocaleString('ru-RU')} ₽</div>
                </div>

                {/* Action buttons — brand soft style */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(s)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition active:scale-95 ${
                      s.enabled
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                    title={s.enabled ? 'Активна — скрыть' : 'Скрыта — показать'}
                  >
                    {s.enabled ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button
                    onClick={() => setEditing(s)}
                    className="w-9 h-9 rounded-lg bg-[#EAF1FF] text-[#3B5BFF] hover:bg-[#DCE7FF] flex items-center justify-center transition active:scale-95"
                    title="Редактировать"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition active:scale-95"
                    title={isBookings ? 'Удалить кастомизацию (вернётся к умолчанию)' : 'Удалить'}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Если редактируется бронь (hotel-booking/flight-booking) — открываем
          полный BookingProductEditor (Modal с полями анкеты внутри). Иначе —
          упрощённый ServiceFormModal (только цена/иконка/описание).
          Если settings ещё не загрузились — показываем спиннер
          (race-condition защита). */}
      {editing && editingBookingType && !settings && (
        <Modal open onClose={() => setEditing(null)} size="sm">
          <div className="p-10 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#3B5BFF]" />
            <p className="text-sm text-[#0F2A36]/60">Загружаем настройки…</p>
          </div>
        </Modal>
      )}
      {editing && editingBookingType && settings && (
        <BookingProductEditor
          open
          type={editingBookingType}
          row={editing}
          settings={settings}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      {((editing && !editingBookingType) || adding) && (
        <ServiceFormModal
          service={editing}
          mode={mode}
          existingIds={services.map(s => s.id)}
          onClose={() => { setEditing(null); setAdding(false); }}
          onSaved={async (saved) => {
            await upsertAdditionalService(saved);
            void auditLog('service.update', {
              target_type: 'additional_service', target_id: saved.id,
              details: { name: saved.name, price: saved.price, enabled: saved.enabled },
            });
            setEditing(null); setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
};

const ServiceFormModal: React.FC<{
  service: AdditionalService | null;
  mode: Mode;
  existingIds: string[];
  onClose: () => void;
  onSaved: (s: Omit<AdditionalService, 'created_at' | 'updated_at'>) => Promise<void>;
}> = ({ service, mode, existingIds, onClose, onSaved }) => {
  const dialog = useDialog();
  // Брони в нижнем меню оформляются без визы — поэтому ограничение по странам
  // не имеет смысла. Поле видно только в режиме доп. услуг.
  const showCountries = mode === 'addons';
  // Префиксуем id новой записи в режиме bookings — чтобы она появилась
  // в списке Каталог → Брони (фильтр по startsWith('standalone-')).
  const idPrefix = mode === 'bookings' ? 'standalone-' : '';
  const [form, setForm] = useState<Omit<AdditionalService, 'created_at' | 'updated_at'>>(
    service
      ? {
          ...service,
          countries: Array.isArray(service.countries) ? service.countries : [],
          partner_commission_pct: service.partner_commission_pct ?? 15,
        }
      : {
          id: idPrefix, name: '', icon: mode === 'bookings' ? '🧳' : '⭐',
          description: '',
          price: 0, cost_rub: 0,
          partner_commission_pct: mode === 'bookings' ? 10 : 15,
          enabled: true, sort_order: 0, countries: [],
        }
  );

  // List of countries to choose from — same names used elsewhere in the app
  const ALL_COUNTRIES = [
    'Индия', 'Вьетнам', 'Шри-Ланка', 'Южная Корея', 'Израиль',
    'Пакистан', 'Камбоджа', 'Кения', 'Филиппины',
  ];

  const toggleCountry = (c: string) => {
    setForm(p => ({
      ...p,
      countries: p.countries.includes(c)
        ? p.countries.filter(x => x !== c)
        : [...p.countries, c],
    }));
  };
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id || !form.name || form.price < 0) {
      await dialog.warning('Заполни ID, название и корректную цену');
      return;
    }
    if (!service && existingIds.includes(form.id)) {
      await dialog.warning('Услуга с таким ID уже есть');
      return;
    }
    setSaving(true);
    try { await onSaved(form); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon="📦"
      label={service ? 'Редактирование' : 'Новая услуга'}
      title={service ? 'Редактировать услугу' : 'Добавить услугу'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm text-gray-700 mb-1">Иконка (emoji)</label>
              <input
                type="text" value={form.icon ?? ''} onChange={e => set('icon', e.target.value)}
                placeholder="⚡"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-2xl text-center focus:outline-none focus:border-[#5C7BFF]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">ID *</label>
              <input
                type="text" value={form.id} onChange={e => set('id', e.target.value)}
                disabled={!!service}
                placeholder="urgent-processing"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl disabled:bg-gray-100 disabled:text-gray-500 font-mono text-sm focus:outline-none focus:border-[#5C7BFF]"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Уникальный, только латинские буквы/цифры/тире (нельзя менять)</p>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Название *</label>
            <input
              type="text" value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Срочное оформление"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5C7BFF]" required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Описание</label>
            <textarea
              value={form.description ?? ''} onChange={e => set('description', e.target.value)}
              rows={2}
              placeholder="Приоритетная обработка вашей заявки"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-[#5C7BFF]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Цена для клиента ₽ *</label>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                value={form.price ? String(form.price) : ''}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '');
                  set('price', v === '' ? 0 : parseInt(v, 10));
                }}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5C7BFF]" required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Себестоимость ₽</label>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                value={form.cost_rub ? String(form.cost_rub) : ''}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '');
                  set('cost_rub', v === '' ? 0 : parseFloat(v));
                }}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5C7BFF]"
              />
              <p className="text-xs text-gray-400 mt-1">Сколько мы тратим на эту услугу (для финансов)</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Комиссия партнёра %</label>
              <input
                type="text" inputMode="decimal"
                value={form.partner_commission_pct === undefined ? '' : String(form.partner_commission_pct)}
                onChange={e => {
                  const v = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
                  set('partner_commission_pct', v === '' ? 0 : parseFloat(v));
                }}
                placeholder="15"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5C7BFF]"
              />
              <p className="text-xs text-gray-400 mt-1">% от цены услуги, который получит партнёр-реферрер. 0 = не платим.</p>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Порядок отображения</label>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                value={form.sort_order ? String(form.sort_order) : ''}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '');
                  set('sort_order', v === '' ? 0 : parseInt(v, 10));
                }}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5C7BFF]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Видимость</p>
              <p className="text-xs text-gray-500">Если выключена — услуга не предлагается на странице визы</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox" checked={form.enabled}
                onChange={e => set('enabled', e.target.checked)}
                className="w-5 h-5 accent-emerald-500"
              />
              <span className="text-sm">{form.enabled ? 'Активна' : 'Скрыта'}</span>
            </label>
          </div>

          {/* Страны, для которых эта услуга показывается как доп. опция */}
          {showCountries && (
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Страны, где услуга доступна</p>
              {form.countries.length > 0 && (
                <button type="button" onClick={() => set('countries', [])}
                  className="text-xs text-[#3B5BFF] hover:underline">Сбросить</button>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-3">
              {form.countries.length === 0
                ? 'Сейчас услуга доступна во всех странах. Выберите конкретные страны, чтобы ограничить.'
                : `Услуга появится только при оформлении виз для: ${form.countries.join(', ')}`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_COUNTRIES.map(c => {
                const checked = form.countries.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCountry(c)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 ${
                      checked
                        ? 'vd-grad text-white shadow-sm'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {checked && '✓ '}{c}
                  </button>
                );
              })}
            </div>
          </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" size="lg" fullWidth onClick={onClose}>
              Отмена
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={saving}
              leftIcon={!saving ? <Save size={16} /> : undefined}
            >
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </div>
        </form>
    </Modal>
  );
};
