import React, { useEffect, useMemo, useState } from 'react';
import {
  FileEdit, Image as ImageIcon, Plus, Edit2, Trash2, X, Save, Loader2,
  RefreshCw, Database, AlertCircle, Package, Hotel, Plane,
  Eye, EyeOff, ChevronLeft, ChevronUp, ChevronDown,
} from 'lucide-react';
import {
  getVisaProducts,
  getAllFormFields, upsertFormField, deleteFormField, reorderFormFields,
  getAllPhotoRequirements, upsertPhotoRequirement, deletePhotoRequirement, reorderPhotoRequirements,
  seedFormFieldsFromCode,
  getAppSettings, saveAppSettings, type AppSettings, type ExtraFormField, type CoreFieldOverrides,
  type VisaFormField, type VisaPhotoRequirement, type FormFieldType, type VisaProduct,
  getAdditionalServices, upsertAdditionalService, type AdditionalService,
} from '../../lib/db';
import { countriesVisaData } from '../data/countriesData';
import { countryPhotoRequirements } from '../data/photoRequirements';
import { AdditionalServices } from './AdditionalServices';

// ── Top-level tab nav: Анкеты виз / Доп. услуги / Брони
type TopTab = 'visas' | 'addons' | 'bookings';

const TOP_TABS: { id: TopTab; label: string; Icon: typeof FileEdit }[] = [
  { id: 'visas',    label: 'Анкеты виз',  Icon: FileEdit },
  { id: 'addons',   label: 'Доп. услуги', Icon: Package  },
  { id: 'bookings', label: 'Брони',       Icon: Hotel    },
];

export const FormBuilder: React.FC = () => {
  const [topTab, setTopTab] = useState<TopTab>('visas');
  return (
    <div>
      {/* Top nav */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 pt-4">
        <div className="flex gap-1.5 flex-wrap">
          {TOP_TABS.map(({ id, label, Icon }) => {
            const active = topTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTopTab(id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg text-sm font-semibold transition ${
                  active
                    ? 'vd-grad text-white shadow-md'
                    : 'bg-gray-50 text-[#0F2A36]/65 hover:bg-gray-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {topTab === 'visas'    && <VisaFormSection />}
      {topTab === 'addons'   && <AdditionalServices />}
      {topTab === 'bookings' && <BookingsConstructor />}
    </div>
  );
};

// «Брони» — точный аналог «Доп. услуг», просто фильтрованный вид списка
// (только hotel-booking + flight-booking). Тот же редактор, тот же модал,
// те же поля. Никаких отдельных «полей анкеты» / «доп. полей» — только
// то, что есть у обычной услуги.
export const BookingsTab: React.FC = () => {
  return <AdditionalServices mode="bookings" />;
};

const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'Текст',
  email: 'Email',
  tel: 'Телефон',
  date: 'Дата',
  file: 'Файл',
  select: 'Выпадающий список',
  textarea: 'Многострочный',
  radio: 'Радио-кнопки',
  citizenship: 'Гражданство',
  'countries-multi': 'Список стран',
  'south-asia-visits': 'Визиты в Юж. Азию',
};

// Существующий конструктор анкет виз — теперь вкладка внутри обёртки FormBuilder.
const VisaFormSection: React.FC = () => {
  const [products, setProducts] = useState<VisaProduct[]>([]);
  const [allFields, setAllFields] = useState<VisaFormField[]>([]);
  const [allPhotos, setAllPhotos] = useState<VisaPhotoRequirement[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [tab, setTab] = useState<'fields' | 'photos'>('fields');
  const [editingField, setEditingField] = useState<VisaFormField | null>(null);
  const [addingField, setAddingField] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<VisaPhotoRequirement | null>(null);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, f, ph] = await Promise.all([
        getVisaProducts(),
        getAllFormFields(),
        getAllPhotoRequirements(),
      ]);
      setProducts(p);
      setAllFields(f);
      setAllPhotos(ph);
      setSelectedCountry(prev => {
        if (prev) return prev;
        const first = Array.from(new Set(p.map(x => x.country)))[0];
        return first ?? null;
      });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const countries = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const p of products) if (!map.has(p.country)) map.set(p.country, p.flag);
    return Array.from(map.entries()).map(([name, flag]) => ({ name, flag }));
  }, [products]);

  const visasOfSelected = useMemo(
    () => products.filter(p => p.country === selectedCountry),
    [products, selectedCountry]
  );
  const fieldsOfSelected = useMemo(
    () => allFields.filter(f => f.country === selectedCountry).sort((a, b) => a.sort_order - b.sort_order),
    [allFields, selectedCountry]
  );
  const photosOfSelected = useMemo(
    () => allPhotos.filter(p => p.country === selectedCountry).sort((a, b) => a.sort_order - b.sort_order),
    [allPhotos, selectedCountry]
  );

  // Seed runs without confirm() — iOS Telegram WebView often blocks native confirm
  // dialogs and the click silently no-ops. The button itself is an explicit click,
  // and the result is reported via the setSeedResult banner below.
  const [seedResult, setSeedResult] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedResult(null);
    console.log('[seed] starting, countries:', countriesVisaData.length);
    try {
      const r = await seedFormFieldsFromCode({ countriesVisaData }, countryPhotoRequirements);
      console.log('[seed] result:', r);
      if (r.error) {
        setSeedResult({ ok: false, text: `Ошибка: ${r.error}\n\nПричины: таблицы visa_form_fields / visa_photo_requirements не созданы, или RLS блокирует запись. Запусти SQL миграцию.` });
      } else if (r.skipped) {
        setSeedResult({ ok: true, text: 'В БД уже есть записи — импорт пропущен. Если хочешь переимпортировать, очисти таблицы в SQL Editor (DELETE FROM visa_form_fields; DELETE FROM visa_photo_requirements;) и нажми снова.' });
      } else {
        setSeedResult({ ok: true, text: `Импортировано: полей анкет ${r.insertedFields}, фото-требований ${r.insertedPhotos}.` });
      }
      await load();
    } catch (e) {
      console.error('[seed] exception:', e);
      setSeedResult({ ok: false, text: `Исключение: ${e instanceof Error ? e.message : String(e)}` });
    } finally { setSeeding(false); }
  };

  const handleDeleteField = async (f: VisaFormField) => {
    if (!confirm(`Удалить поле «${f.label}»?\n\nЭто пропадёт из анкеты на странице визы.`)) return;
    await deleteFormField(f.id);
    setAllFields(prev => prev.filter(x => x.id !== f.id));
  };

  const handleDeletePhoto = async (p: VisaPhotoRequirement) => {
    if (!confirm(`Удалить фото-требование «${p.label}»?`)) return;
    await deletePhotoRequirement(p.id);
    setAllPhotos(prev => prev.filter(x => x.id !== p.id));
  };

  // Перемещение поля вверх/вниз. Меняем порядок в текущем массиве (по
  // отсортированному списку для выбранной страны), потом пишем
  // sort_order = 0,1,2,... для всех полей этой страны атомарно.
  const handleMoveField = async (id: string, direction: 'up' | 'down') => {
    const sorted = fieldsOfSelected;
    const idx = sorted.findIndex(f => f.id === id);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sorted.length) return;

    // Поменять местами в копии
    const reordered = [...sorted];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const orderedIds = reordered.map(f => f.id);

    // Optimistic UI: обновляем sort_order локально, чтобы не мигало
    setAllFields(prev => prev.map(f => {
      const newPos = orderedIds.indexOf(f.id);
      return newPos !== -1 ? { ...f, sort_order: newPos } : f;
    }));

    try { await reorderFormFields(orderedIds); }
    catch (e) { console.error('reorderFormFields failed', e); }
  };

  const handleMovePhoto = async (id: string, direction: 'up' | 'down') => {
    const sorted = photosOfSelected;
    const idx = sorted.findIndex(p => p.id === id);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sorted.length) return;

    const reordered = [...sorted];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const orderedIds = reordered.map(p => p.id);

    setAllPhotos(prev => prev.map(p => {
      const newPos = orderedIds.indexOf(p.id);
      return newPos !== -1 ? { ...p, sort_order: newPos } : p;
    }));

    try { await reorderPhotoRequirements(orderedIds); }
    catch (e) { console.error('reorderPhotoRequirements failed', e); }
  };

  const isEmpty = allFields.length === 0 && allPhotos.length === 0;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h1>Конструктор анкет</h1>
          <p className="text-xs text-gray-500 mt-1">
            Поля анкеты и фото-требования по странам · {allFields.length} полей · {allPhotos.length} фото
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg" title="Обновить">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {!loading && isEmpty && (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center mb-6">
          <Database className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-700 mb-2">Конструктор пустой</h3>
          <p className="text-sm text-gray-500 mb-4">Импортируй текущие анкеты из кода — это разовая операция</p>
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="px-4 py-2 bg-[#3B5BFF] hover:bg-[#4F2FE6] disabled:opacity-60 disabled:pointer-events-none text-white rounded-lg inline-flex items-center gap-2 select-none"
          >
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database size={16} />}
            {seeding ? 'Импортируем…' : 'Импортировать из кода'}
          </button>
        </div>
      )}

      {seedResult && (
        <div className={`mb-5 p-4 rounded-xl border whitespace-pre-line text-sm ${
          seedResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'
        }`}>
          {seedResult.ok ? '✅ ' : '⚠️ '}{seedResult.text}
        </div>
      )}

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5 flex items-start gap-3">
        <AlertCircle className="text-emerald-600 mt-0.5 shrink-0" size={18} />
        <p className="text-sm text-emerald-900">
          ✓ Изменения здесь сразу видны клиентам в анкете на странице визы. Если страна
          ещё не импортирована — клиент видит старую версию из кода (fallback).
        </p>
      </div>

      {countries.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5 bg-white p-2 rounded-xl border border-gray-200">
          {countries.map(c => (
            <button
              key={c.name}
              type="button"
              onClick={() => setSelectedCountry(c.name)}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition ${
                selectedCountry === c.name ? 'bg-[#3B5BFF] text-white shadow-sm' : 'text-[#0F2A36] hover:bg-gray-100'
              }`}
            >
              <span className="text-base">{c.flag ?? '🌍'}</span>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {selectedCountry && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setTab('fields')}
              className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition ${
                tab === 'fields' ? 'vd-grad text-white shadow-md' : 'bg-white border border-gray-200 text-[#0F2A36] hover:bg-gray-50'
              }`}
            >
              <FileEdit size={16} />
              Поля анкеты ({fieldsOfSelected.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('photos')}
              className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition ${
                tab === 'photos' ? 'vd-grad text-white shadow-md' : 'bg-white border border-gray-200 text-[#0F2A36] hover:bg-gray-50'
              }`}
            >
              <ImageIcon size={16} />
              Фото-требования ({photosOfSelected.length})
            </button>
            <div className="ml-auto">
              {tab === 'fields' ? (
                <button
                  type="button"
                  onClick={() => setAddingField(true)}
                  className="px-3 py-2 bg-[#3B5BFF] hover:bg-[#4F2FE6] text-white rounded-lg flex items-center gap-1.5 text-sm"
                >
                  <Plus size={16} /> Добавить поле
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingPhoto(true)}
                  className="px-3 py-2 bg-[#3B5BFF] hover:bg-[#4F2FE6] text-white rounded-lg flex items-center gap-1.5 text-sm"
                >
                  <Plus size={16} /> Добавить фото
                </button>
              )}
            </div>
          </div>

          {tab === 'fields' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {fieldsOfSelected.length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-400">Полей пока нет — добавь первое</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {fieldsOfSelected.map((f, idx) => (
                    <div key={f.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => handleMoveField(f.id, 'up')}
                          disabled={idx === 0}
                          className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Переместить выше"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          onClick={() => handleMoveField(f.id, 'down')}
                          disabled={idx === fieldsOfSelected.length - 1}
                          className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Переместить ниже"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <p className="text-gray-800 font-medium">{f.label} {f.required && <span className="text-red-500">*</span>}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-gray-500">
                          <span className="font-mono">{f.field_key}</span>
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded">{FIELD_TYPE_LABELS[f.field_type]}</span>
                          {f.visa_id ? (
                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">только {f.visa_id}</span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded">все визы</span>
                          )}
                          {f.options && <span className="text-gray-400">опций: {f.options.length}</span>}
                        </div>
                        {f.comment && <p className="text-xs text-gray-400 mt-0.5 italic">{f.comment}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditingField(f)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Редактировать">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteField(f)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Удалить">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'photos' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {photosOfSelected.length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-400">Фото-требований пока нет</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {photosOfSelected.map((p, idx) => (
                    <div key={p.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => handleMovePhoto(p.id, 'up')}
                          disabled={idx === 0}
                          className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Переместить выше"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          onClick={() => handleMovePhoto(p.id, 'down')}
                          disabled={idx === photosOfSelected.length - 1}
                          className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Переместить ниже"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <p className="text-gray-800 font-medium">{p.label} {p.required && <span className="text-red-500">*</span>}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-gray-500">
                          <span className="font-mono">{p.field_key}</span>
                          {p.formats && <span>{p.formats}</span>}
                          {p.max_size && <span>≤{p.max_size}</span>}
                        </div>
                        {p.requirements && <p className="text-xs text-gray-500 mt-0.5">{p.requirements}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditingPhoto(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                        <button onClick={() => handleDeletePhoto(p)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {(editingField || addingField) && selectedCountry && (
        <FieldFormModal
          country={selectedCountry}
          field={editingField}
          visasOfCountry={visasOfSelected}
          onClose={() => { setEditingField(null); setAddingField(false); }}
          onSaved={async (saved) => {
            await upsertFormField(saved);
            setEditingField(null); setAddingField(false);
            load();
          }}
        />
      )}
      {(editingPhoto || addingPhoto) && selectedCountry && (
        <PhotoFormModal
          country={selectedCountry}
          photo={editingPhoto}
          visasOfCountry={visasOfSelected}
          onClose={() => { setEditingPhoto(null); setAddingPhoto(false); }}
          onSaved={async (saved) => {
            await upsertPhotoRequirement(saved);
            setEditingPhoto(null); setAddingPhoto(false);
            load();
          }}
        />
      )}
    </div>
  );
};

// ─── Booking form config (price + extra fields) ──────────────────────────────
// Hardcoded core fields of the booking forms — must mirror what's actually
// rendered in HotelBookingForm/FlightBookingForm. Admin overrides label /
// required / visibility per key.
const HOTEL_CORE_FIELDS: Array<{ key: string; defaultLabel: string; defaultRequired: boolean }> = [
  { key: 'firstName',     defaultLabel: 'Имя (как в загранпаспорте)',       defaultRequired: true },
  { key: 'lastName',      defaultLabel: 'Фамилия (как в загранпаспорте)',    defaultRequired: true },
  { key: 'country',       defaultLabel: 'Страна назначения',                  defaultRequired: true },
  { key: 'city',          defaultLabel: 'Город',                              defaultRequired: true },
  { key: 'checkIn',       defaultLabel: 'Дата заезда',                        defaultRequired: true },
  { key: 'checkOut',      defaultLabel: 'Дата выезда',                        defaultRequired: true },
  { key: 'guests',        defaultLabel: 'Количество гостей',                  defaultRequired: true },
  { key: 'children',      defaultLabel: 'Есть ли дети?',                      defaultRequired: false },
  { key: 'email',         defaultLabel: 'E-mail',                             defaultRequired: true },
  { key: 'phone',         defaultLabel: 'Номер телефона',                     defaultRequired: true },
  { key: 'telegramLogin', defaultLabel: 'Логин в Telegram',                   defaultRequired: true },
  { key: 'passport',      defaultLabel: 'Загранпаспорт (файл)',               defaultRequired: true },
];

const FLIGHT_CORE_FIELDS: Array<{ key: string; defaultLabel: string; defaultRequired: boolean }> = [
  { key: 'firstName',     defaultLabel: 'Имя (латиницей)',                    defaultRequired: true },
  { key: 'lastName',      defaultLabel: 'Фамилия (латиницей)',                defaultRequired: true },
  { key: 'fromCity',      defaultLabel: 'Из какого города',                   defaultRequired: true },
  { key: 'toCity',        defaultLabel: 'В какой город',                      defaultRequired: true },
  { key: 'bookingDate',   defaultLabel: 'Дата брони',                         defaultRequired: true },
  { key: 'email',         defaultLabel: 'E-mail',                             defaultRequired: true },
  { key: 'phone',         defaultLabel: 'Номер телефона',                     defaultRequired: true },
  { key: 'telegramLogin', defaultLabel: 'Логин в Telegram',                   defaultRequired: true },
  { key: 'passport',      defaultLabel: 'Загранпаспорт (файл)',               defaultRequired: true },
];

// ─── Booking constructor ──────────────────────────────────────────────────────
//
// Единый раздел «Брони» — список карточек в стиле Доп. услуг + общий редактор
// по клику. Один источник истины:
//
//   - Карточка / название / иконка / описание / цена / партнёр % / видимость /
//     порядок  → таблица additional_services (id = hotel-booking | flight-booking)
//   - Поля анкеты (override label/required/visible) и доп. поля → app_settings
//     (hotel_core_overrides / flight_core_overrides / hotel_extra_fields /
//     flight_extra_fields)
//
// Тот же id используется визовым калькулятором и stand-alone формами в
// мини-аппе → клиент видит изменения сразу.

interface BookingType {
  serviceId: string;          // additional_services.id
  kind: 'hotel' | 'flight';   // выбирает coreFields + ключ в app_settings
  fallbackName: string;
  fallbackIcon: string;
  fallbackDescription: string;
  HeroIcon: typeof Hotel;
  coreFields: Array<{ key: string; defaultLabel: string; defaultRequired: boolean }>;
  extraFieldsKey: 'hotel_extra_fields' | 'flight_extra_fields';
  overridesKey: 'hotel_core_overrides' | 'flight_core_overrides';
}

const BOOKING_TYPES: BookingType[] = [
  {
    serviceId: 'hotel-booking',
    kind: 'hotel',
    fallbackName: 'Бронь отеля для визы',
    fallbackIcon: '🏨',
    fallbackDescription: 'Подтверждение проживания для визы и границы',
    HeroIcon: Hotel,
    coreFields: HOTEL_CORE_FIELDS,
    extraFieldsKey: 'hotel_extra_fields',
    overridesKey: 'hotel_core_overrides',
  },
  {
    serviceId: 'flight-booking',
    kind: 'flight',
    fallbackName: 'Бронь обратного билета',
    fallbackIcon: '✈️',
    fallbackDescription: 'Подтверждение рейса для визы и границы',
    HeroIcon: Plane,
    coreFields: FLIGHT_CORE_FIELDS,
    extraFieldsKey: 'flight_extra_fields',
    overridesKey: 'flight_core_overrides',
  },
];

const BookingsConstructor: React.FC = () => {
  const [services, setServices] = useState<AdditionalService[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, st] = await Promise.all([getAdditionalServices(), getAppSettings()]);
      setServices(s);
      setSettings(st);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleToggle = async (s: AdditionalService) => {
    await upsertAdditionalService({ ...s, enabled: !s.enabled });
    setServices(prev => prev.map(x => x.id === s.id ? { ...x, enabled: !s.enabled } : x));
  };

  // Возвращаем actual row для хотел/флайт, либо «псевдо»-объект с дефолтами
  // если в БД ещё нет записи (срабатывает первый запуск).
  const visible = useMemo(() => {
    return BOOKING_TYPES.map(bt => {
      const row = services.find(s => s.id === bt.serviceId);
      return { bt, row };
    });
  }, [services]);

  const editingType = editingId ? BOOKING_TYPES.find(bt => bt.serviceId === editingId) : null;
  const editingRow = editingId ? services.find(s => s.id === editingId) : null;

  if (editingType && settings) {
    return (
      <BookingProductEditor
        type={editingType}
        row={editingRow ?? null}
        settings={settings}
        onClose={() => setEditingId(null)}
        onSaved={async () => {
          await load();
          setEditingId(null);
        }}
      />
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* Hero — копия Доп. услуг */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl vd-grad flex items-center justify-center text-white shadow-md shrink-0">
            <Hotel className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36]">Брони</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {visible.length} {visible.length === 1 ? 'услуга' : 'услуг'} ·{' '}
              {visible.filter(v => v.row?.enabled !== false).length} активных ·
              автоматически синхронизируются с разделом «Брони» в мини-аппе
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button
            onClick={load}
            className="w-10 h-10 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center transition active:scale-95"
            title="Обновить"
          >
            <RefreshCw size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Card list — точная копия паттерна Доп. услуг */}
      <div className="space-y-2.5">
        {visible.map(({ bt, row }) => {
          const enabled = row?.enabled !== false;
          const name = row?.name || bt.fallbackName;
          const icon = row?.icon || bt.fallbackIcon;
          const description = row?.description || bt.fallbackDescription;
          const price = row?.price ?? 0;
          const partnerPct = row?.partner_commission_pct ?? 0;
          const extrasCount = (settings?.[bt.extraFieldsKey] ?? []).length;
          return (
            <div
              key={bt.serviceId}
              className={`bg-white rounded-2xl border border-gray-100 hover:shadow-md transition p-4 flex flex-wrap items-start gap-3 ${!enabled ? 'opacity-55' : ''}`}
            >
              <div className="w-12 h-12 rounded-xl vd-grad-soft border border-blue-100 flex items-center justify-center text-2xl shrink-0">
                {icon}
              </div>

              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[15px] font-bold text-[#0F2A36]">{name}</p>
                  {!enabled && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-500">Скрыта</span>
                  )}
                </div>
                {description && <p className="text-xs text-[#0F2A36]/65 mt-0.5">{description}</p>}
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{bt.serviceId}</span>
                  {extrasCount > 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3B5BFF] bg-[#EAF1FF] px-1.5 py-0.5 rounded">
                      ➕ доп. полей: {extrasCount}
                    </span>
                  )}
                  {partnerPct > 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      партнёрам {partnerPct}%
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right whitespace-nowrap shrink-0">
                <div className="text-[#3B5BFF] text-[15px] font-bold">+{price.toLocaleString('ru-RU')} ₽</div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {row && (
                  <button
                    onClick={() => handleToggle(row)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition active:scale-95 ${
                      enabled
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                    title={enabled ? 'Активна — скрыть' : 'Скрыта — показать'}
                  >
                    {enabled ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                )}
                <button
                  onClick={() => setEditingId(bt.serviceId)}
                  className="w-9 h-9 rounded-lg bg-[#EAF1FF] text-[#3B5BFF] hover:bg-[#DCE7FF] flex items-center justify-center transition active:scale-95"
                  title="Редактировать"
                >
                  <Edit2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Booking product editor ───────────────────────────────────────────────────
// Один редактор для записи брони — атомарный save в additional_services +
// app_settings (overrides + extras).
const BookingProductEditor: React.FC<{
  type: BookingType;
  row: AdditionalService | null;
  settings: AppSettings;
  onClose: () => void;
  onSaved: () => Promise<void>;
}> = ({ type, row, settings, onClose, onSaved }) => {
  // Локальный draft объединяет данные обеих таблиц; save сбрасывает в обе
  const [draftRow, setDraftRow] = useState<Omit<AdditionalService, 'created_at' | 'updated_at'>>(
    row
      ? { ...row, countries: Array.isArray(row.countries) ? row.countries : [], partner_commission_pct: row.partner_commission_pct ?? 15 }
      : {
          id: type.serviceId,
          name: type.fallbackName,
          icon: type.fallbackIcon,
          description: type.fallbackDescription,
          price: 0, cost_rub: 0, partner_commission_pct: 15,
          enabled: true, sort_order: 0, countries: [],
        }
  );
  const [draftExtras, setDraftExtras] = useState<ExtraFormField[]>(settings[type.extraFieldsKey] ?? []);
  const [draftOverrides, setDraftOverrides] = useState<CoreFieldOverrides>(settings[type.overridesKey] ?? {});
  const [saving, setSaving] = useState(false);

  const setRow = <K extends keyof typeof draftRow>(k: K, v: typeof draftRow[K]) =>
    setDraftRow(p => ({ ...p, [k]: v }));

  const updateOverride = (key: string, patch: Partial<{ label: string; required: boolean; visible: boolean }>) => {
    setDraftOverrides(p => ({ ...p, [key]: { ...(p[key] ?? {}), ...patch } }));
  };
  const resetOverride = (key: string) => {
    setDraftOverrides(p => {
      const next = { ...p };
      delete next[key];
      return next;
    });
  };

  const addField = () => {
    setDraftExtras(prev => [...prev, { id: Math.random().toString(36).slice(2, 10), label: '', type: 'text', required: false }]);
  };
  const updateField = (idx: number, patch: Partial<ExtraFormField>) => {
    setDraftExtras(prev => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };
  const removeField = (idx: number) => {
    setDraftExtras(prev => prev.filter((_, i) => i !== idx));
  };
  const moveField = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= draftExtras.length) return;
    const arr = [...draftExtras];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    setDraftExtras(arr);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // 1) additional_services row
      await upsertAdditionalService(draftRow);
      // 2) app_settings: extras + overrides
      const { id: _id, updated_at: _ts, ...rest } = settings;
      void _id; void _ts;
      await saveAppSettings({
        ...rest,
        [type.extraFieldsKey]: draftExtras,
        [type.overridesKey]: draftOverrides,
      });
      await onSaved();
    } catch (e) {
      alert(`Ошибка сохранения: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-8">
      {/* Top bar with back + save */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-[#0F2A36] hover:bg-gray-50 active:scale-95 transition flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" /> К списку броней
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 vd-grad text-white rounded-xl flex items-center gap-2 font-bold select-none shadow-md vd-shadow-cta active:scale-[0.98] transition disabled:opacity-60"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>

      <div className="space-y-4">
        {/* About product card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl vd-grad-soft border border-blue-100 flex items-center justify-center text-[#3B5BFF] shrink-0">
              <type.HeroIcon className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-extrabold tracking-tight text-[#0F2A36]">Об услуге</h3>
              <p className="text-xs text-gray-500 mt-0.5">Название, описание, цена — синхронизируются с Каталогом и формами в мини-аппе</p>
            </div>
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider shrink-0">{type.serviceId}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-semibold">Иконка (emoji)</label>
              <input
                type="text"
                value={draftRow.icon ?? ''}
                onChange={e => setRow('icon', e.target.value)}
                placeholder={type.fallbackIcon}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-2xl text-center focus:outline-none focus:border-[#5C7BFF]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-700 mb-1 font-semibold">Название</label>
              <input
                type="text"
                value={draftRow.name}
                onChange={e => setRow('name', e.target.value)}
                placeholder={type.fallbackName}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5C7BFF]"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs text-gray-700 mb-1 font-semibold">Описание</label>
            <textarea
              value={draftRow.description ?? ''}
              onChange={e => setRow('description', e.target.value)}
              rows={2}
              placeholder={type.fallbackDescription}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-[#5C7BFF]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-semibold">Цена для клиента ₽</label>
              <input
                type="number" min={0}
                value={draftRow.price}
                onChange={e => setRow('price', parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5C7BFF]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-semibold">Себестоимость ₽</label>
              <input
                type="number" min={0}
                value={draftRow.cost_rub}
                onChange={e => setRow('cost_rub', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5C7BFF]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-semibold">Комиссия партнёра %</label>
              <input
                type="number" min={0} max={100} step="0.5"
                value={draftRow.partner_commission_pct ?? 0}
                onChange={e => setRow('partner_commission_pct', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5C7BFF]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none bg-gray-50 rounded-xl p-3">
            <input
              type="checkbox"
              checked={draftRow.enabled}
              onChange={e => setRow('enabled', e.target.checked)}
              className="w-5 h-5 accent-emerald-500"
            />
            <span className="text-sm text-[#0F2A36]">{draftRow.enabled ? 'Активна — показывается клиентам' : 'Скрыта — клиенты не видят'}</span>
          </label>
        </div>

        {/* Core fields card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl vd-grad-soft border border-blue-100 flex items-center justify-center text-[#3B5BFF] shrink-0">
              <FileEdit className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-extrabold tracking-tight text-[#0F2A36]">Поля анкеты</h3>
              <p className="text-xs text-gray-500 mt-0.5">Переименовывай, скрывай или меняй обязательность встроенных полей</p>
            </div>
          </div>
          <div className="space-y-2">
            {type.coreFields.map(f => {
              const ov = draftOverrides[f.key] ?? {};
              const label = ov.label ?? f.defaultLabel;
              const required = ov.required ?? f.defaultRequired;
              const visible = ov.visible !== false;
              const isCustom = ov.label !== undefined || ov.required !== undefined || ov.visible !== undefined;
              return (
                <div
                  key={f.key}
                  className={`bg-gray-50 rounded-xl p-3 border border-gray-100 ${!visible ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 shrink-0">{f.key}</span>
                    <input
                      type="text"
                      value={label}
                      onChange={e => updateOverride(f.key, { label: e.target.value })}
                      className="flex-1 min-w-[180px] px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-[#5C7BFF]"
                    />
                    {isCustom && (
                      <button type="button" onClick={() => resetOverride(f.key)}
                        className="text-[11px] text-[#3B5BFF] hover:underline shrink-0">
                        Сбросить
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <label className="text-xs text-gray-600 flex items-center gap-1.5 select-none">
                      <input
                        type="checkbox" checked={visible}
                        onChange={e => updateOverride(f.key, { visible: e.target.checked })}
                        className="accent-[#3B5BFF]"
                      />
                      Показывать клиенту
                    </label>
                    <label className="text-xs text-gray-600 flex items-center gap-1.5 select-none">
                      <input
                        type="checkbox" checked={required}
                        onChange={e => updateOverride(f.key, { required: e.target.checked })}
                        className="accent-[#3B5BFF]"
                      />
                      Обязательное
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom fields card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl vd-grad-soft border border-blue-100 flex items-center justify-center text-[#3B5BFF] shrink-0">
              <Plus className="w-4 h-4" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-extrabold tracking-tight text-[#0F2A36]">Дополнительные поля</h3>
              <p className="text-xs text-gray-500 mt-0.5">Свои поля поверх анкеты — например, «Класс перелёта» или «Особые пожелания»</p>
            </div>
            <span className="text-xs text-gray-400 shrink-0">{draftExtras.length} {draftExtras.length === 1 ? 'поле' : 'полей'}</span>
          </div>

          {draftExtras.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
              <p className="text-xs text-gray-400">Нет дополнительных полей</p>
            </div>
          ) : (
            <div className="space-y-2">
              {draftExtras.map((f, idx) => {
                const needsOptions = f.type === 'select' || f.type === 'radio';
                return (
                  <div key={f.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex flex-col gap-0.5 pt-1">
                        <button type="button" onClick={() => moveField(idx, -1)} disabled={idx === 0}
                          className="text-gray-400 hover:text-[#3B5BFF] disabled:opacity-30 text-xs">▲</button>
                        <button type="button" onClick={() => moveField(idx, 1)} disabled={idx === draftExtras.length - 1}
                          className="text-gray-400 hover:text-[#3B5BFF] disabled:opacity-30 text-xs">▼</button>
                      </div>
                      <input
                        type="text" value={f.label}
                        onChange={e => updateField(idx, { label: e.target.value })}
                        placeholder="Название поля"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#5C7BFF]"
                      />
                      <button type="button" onClick={() => removeField(idx)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap pl-6">
                      <select
                        value={f.type}
                        onChange={e => updateField(idx, { type: e.target.value as ExtraFormField['type'] })}
                        className="px-2 py-1 text-xs border border-gray-200 rounded-md bg-white"
                      >
                        <option value="text">Текст</option>
                        <option value="textarea">Длинный текст</option>
                        <option value="number">Число</option>
                        <option value="date">Дата</option>
                        <option value="select">Выпадающий список</option>
                        <option value="radio">Радио-кнопки</option>
                        <option value="checkbox">Чекбокс (да/нет)</option>
                        <option value="file">Файл</option>
                      </select>
                      {f.type !== 'checkbox' && f.type !== 'file' && (
                        <input
                          type="text"
                          value={f.placeholder ?? ''}
                          onChange={e => updateField(idx, { placeholder: e.target.value })}
                          placeholder="Подсказка"
                          className="flex-1 min-w-[120px] px-2 py-1 text-xs border border-gray-200 rounded-md"
                        />
                      )}
                      <label className="text-xs text-gray-600 flex items-center gap-1 select-none">
                        <input
                          type="checkbox" checked={f.required}
                          onChange={e => updateField(idx, { required: e.target.checked })}
                          className="accent-[#3B5BFF]"
                        />
                        Обязательное
                      </label>
                    </div>
                    {needsOptions && (
                      <div className="mt-2 pl-6">
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Варианты (по одному в строке)</label>
                        <textarea
                          value={(f.options ?? []).join('\n')}
                          onChange={e => updateField(idx, { options: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                          rows={3}
                          placeholder="Эконом&#10;Бизнес&#10;Первый класс"
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white resize-none focus:outline-none focus:border-[#5C7BFF]"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button type="button" onClick={addField}
            className="mt-3 w-full py-2 border-2 border-dashed border-gray-200 hover:border-[#5C7BFF] hover:bg-[#EAF1FF] text-sm text-[#3B5BFF] font-semibold rounded-lg transition flex items-center justify-center gap-1">
            <Plus size={14} strokeWidth={2.5} />
            Добавить поле
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Field Form Modal ─────────────────────────────────────────────────────────
const FieldFormModal: React.FC<{
  country: string;
  field: VisaFormField | null;
  visasOfCountry: VisaProduct[];
  onClose: () => void;
  onSaved: (f: Omit<VisaFormField, 'created_at' | 'updated_at'>) => Promise<void>;
}> = ({ country, field, visasOfCountry, onClose, onSaved }) => {
  const [form, setForm] = useState<Omit<VisaFormField, 'created_at' | 'updated_at'>>(
    field ?? {
      id: '', country, visa_id: null,
      field_key: '', label: '', field_type: 'text',
      required: false, placeholder: null, comment: null,
      options: null, warning: null, sort_order: 999,
    }
  );
  const [optionsText, setOptionsText] = useState((form.options ?? []).join('\n'));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(p => ({ ...p, [k]: v }));
  const needsOptions = form.field_type === 'select' || form.field_type === 'radio';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.field_key.trim() || !form.label.trim()) {
      alert('Заполни ключ поля и название');
      return;
    }
    const id = field?.id || `${form.visa_id ?? country}__${form.field_key}-${Date.now()}`;
    const options = needsOptions ? optionsText.split('\n').map(s => s.trim()).filter(Boolean) : null;
    setSaving(true);
    try { await onSaved({ ...form, id, options }); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-[#0F2A36]/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileEdit className="w-5 h-5 text-blue-500" />
            {field ? 'Редактировать поле' : 'Добавить поле'} · {country}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Ключ (для form_data) *</label>
              <input
                type="text" value={form.field_key} onChange={e => set('field_key', e.target.value)}
                disabled={!!field}
                placeholder="citizenship"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500 font-mono text-sm"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Английский ключ — нельзя менять после создания</p>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Тип поля *</label>
              <select
                value={form.field_type}
                onChange={e => set('field_type', e.target.value as FormFieldType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Название поля (видит юзер) *</label>
            <input
              type="text" value={form.label} onChange={e => set('label', e.target.value)}
              placeholder="Гражданство"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg" required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Подсказка (под полем)</label>
            <input
              type="text" value={form.comment ?? ''} onChange={e => set('comment', e.target.value || null)}
              placeholder="например: 'если СССР, пишите Россия'"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Placeholder (внутри поля)</label>
            <input
              type="text" value={form.placeholder ?? ''} onChange={e => set('placeholder', e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {needsOptions && (
            <div>
              <label className="block text-sm text-gray-700 mb-1">Варианты (по одному на строке) *</label>
              <textarea
                value={optionsText} onChange={e => setOptionsText(e.target.value)}
                rows={4}
                placeholder="Да&#10;Нет"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm resize-none"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-700 mb-1">Применяется к</label>
            <select
              value={form.visa_id ?? ''}
              onChange={e => set('visa_id', e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Все визы страны</option>
              {visasOfCountry.map(v => (
                <option key={v.id} value={v.id}>Только: {v.name} ({v.id})</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              «Все визы» — поле появится в анкете для каждой визы этой страны.
              Если выбрана конкретная виза — появится только в ней (полезно для продлений).
            </p>
          </div>

          {/* Обязательное — единственный toggle здесь. Поле "Порядок"
              убрано: порядок меняется кнопками ↑↓ прямо в списке. */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-700">Обязательное</p>
            <input
              type="checkbox" checked={form.required}
              onChange={e => set('required', e.target.checked)}
              className="w-5 h-5 accent-emerald-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl">Отмена</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-3 bg-[#3B5BFF] hover:bg-[#4F2FE6] disabled:opacity-60 disabled:pointer-events-none text-white rounded-xl flex items-center justify-center gap-2 font-medium select-none">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Photo Form Modal ─────────────────────────────────────────────────────────
const PhotoFormModal: React.FC<{
  country: string;
  photo: VisaPhotoRequirement | null;
  visasOfCountry: VisaProduct[];
  onClose: () => void;
  onSaved: (p: Omit<VisaPhotoRequirement, 'created_at' | 'updated_at'>) => Promise<void>;
}> = ({ country, photo, visasOfCountry, onClose, onSaved }) => {
  const [form, setForm] = useState<Omit<VisaPhotoRequirement, 'created_at' | 'updated_at'>>(
    photo ?? {
      id: '', country, visa_id: null,
      field_key: '', label: '', required: false,
      requirements: null, formats: 'JPG/PNG/PDF', max_size: '5MB',
      hide_if_service_selected: null, sort_order: 999,
    }
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.field_key.trim() || !form.label.trim()) { alert('Заполни ключ и название'); return; }
    const id = photo?.id || `${form.visa_id ?? country}__${form.field_key}-${Date.now()}`;
    setSaving(true);
    try { await onSaved({ ...form, id }); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-[#0F2A36]/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-blue-500" />
            {photo ? 'Редактировать фото' : 'Добавить фото'} · {country}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Ключ *</label>
            <input
              type="text" value={form.field_key} onChange={e => set('field_key', e.target.value)}
              disabled={!!photo}
              placeholder="passportPhoto"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 font-mono text-sm" required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Название *</label>
            <input
              type="text" value={form.label} onChange={e => set('label', e.target.value)}
              placeholder="Главная страница загранпаспорта"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg" required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Требования к фото</label>
            <textarea
              value={form.requirements ?? ''} onChange={e => set('requirements', e.target.value || null)}
              rows={2} placeholder="без бликов, чёткое, со всеми углами"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Форматы</label>
              <input
                type="text" value={form.formats ?? ''} onChange={e => set('formats', e.target.value || null)}
                placeholder="JPG/PNG/PDF"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Макс. размер</label>
              <input
                type="text" value={form.max_size ?? ''} onChange={e => set('max_size', e.target.value || null)}
                placeholder="5MB"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Применяется к</label>
            <select
              value={form.visa_id ?? ''}
              onChange={e => set('visa_id', e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Все визы страны</option>
              {visasOfCountry.map(v => (
                <option key={v.id} value={v.id}>Только: {v.name}</option>
              ))}
            </select>
          </div>

          {/* Порядок задаётся через ↑↓ в списке, не здесь */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-700">Обязательное</p>
            <input type="checkbox" checked={form.required}
              onChange={e => set('required', e.target.checked)}
              className="w-5 h-5 accent-emerald-500" />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl">Отмена</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-3 bg-[#3B5BFF] hover:bg-[#4F2FE6] disabled:opacity-60 disabled:pointer-events-none text-white rounded-xl flex items-center justify-center gap-2 font-medium select-none">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
