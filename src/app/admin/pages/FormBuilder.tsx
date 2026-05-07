import React, { useEffect, useMemo, useState } from 'react';
import {
  FileEdit, Image as ImageIcon, Plus, Edit2, Trash2, X, Save, Loader2,
  RefreshCw, Database, AlertCircle, Package, Hotel, Plane,
} from 'lucide-react';
import {
  getVisaProducts,
  getAllFormFields, upsertFormField, deleteFormField,
  getAllPhotoRequirements, upsertPhotoRequirement, deletePhotoRequirement,
  seedFormFieldsFromCode,
  getAppSettings, saveAppSettings, type AppSettings, type ExtraFormField, type CoreFieldOverrides,
  type VisaFormField, type VisaPhotoRequirement, type FormFieldType, type VisaProduct,
} from '../../lib/db';
import { countriesVisaData } from '../data/countriesData';
import { countryPhotoRequirements } from '../data/photoRequirements';
import { AdditionalServices } from './AdditionalServices';

// ── Top-level tab nav: Анкеты виз / Доп. услуги / Брони
type TopTab = 'visas' | 'addons' | 'bookings';

const TOP_TABS: { id: TopTab; label: string; Icon: typeof FileEdit }[] = [
  { id: 'visas',    label: 'Анкеты виз',  Icon: FileEdit },
  { id: 'addons',   label: 'Доп. услуги', Icon: Package },
  { id: 'bookings', label: 'Брони',       Icon: Hotel },
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
      {topTab === 'bookings' && <BookingsTab />}
    </div>
  );
};

// ── Sub-tab внутри «Брони»: Отель / Авиабилет
export const BookingsTab: React.FC = () => {
  const [sub, setSub] = useState<'hotel' | 'flight' | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Lightweight load just for the list summary (price + extras count)
  useEffect(() => {
    let alive = true;
    getAppSettings().then(s => { if (alive) setSettings(s); }).catch(() => {});
    return () => { alive = false; };
  }, [sub]); // refresh when leaving an editor

  // Editor view
  if (sub) {
    return (
      <div>
        <div className="px-4 md:px-8 pt-5">
          <button type="button" onClick={() => setSub(null)}
            className="text-xs text-[#3B5BFF] hover:underline flex items-center gap-1 mb-2">
            ← Назад к списку броней
          </button>
        </div>
        <BookingFormSection kind={sub} />
      </div>
    );
  }

  // List view — same card pattern as Доп. услуги
  const hotelExtras = settings?.hotel_extra_fields?.length ?? 0;
  const flightExtras = settings?.flight_extra_fields?.length ?? 0;
  const hotelPrice = settings?.hotel_booking_price ?? 1000;
  const flightPrice = settings?.flight_booking_price ?? 2000;

  const cards: Array<{
    kind: 'hotel' | 'flight';
    name: string;
    description: string;
    Icon: typeof Hotel;
    price: number;
    extrasCount: number;
  }> = [
    { kind: 'hotel',  name: 'Бронь отеля',      description: 'Подтверждение проживания для визы',     Icon: Hotel, price: hotelPrice,  extrasCount: hotelExtras },
    { kind: 'flight', name: 'Бронь авиабилета', description: 'Подтверждение брони рейса для визы',     Icon: Plane, price: flightPrice, extrasCount: flightExtras },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl vd-grad flex items-center justify-center text-white shadow-md shrink-0">
            <Hotel className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36]">Брони</h1>
            <p className="text-xs text-gray-500 mt-0.5">{cards.length} услуги · цена и поля анкеты — клик по карточке</p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {cards.map(c => (
          <button
            key={c.kind}
            type="button"
            onClick={() => setSub(c.kind)}
            className="w-full bg-white rounded-2xl border border-gray-100 hover:shadow-md transition p-4 flex flex-wrap items-start gap-3 text-left active:scale-[0.99]"
          >
            <div className="w-12 h-12 rounded-xl vd-grad-soft border border-blue-100 flex items-center justify-center text-[#3B5BFF] shrink-0">
              <c.Icon className="w-5 h-5" strokeWidth={2.2} />
            </div>

            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[15px] font-bold text-[#0F2A36]">{c.name}</p>
              </div>
              <p className="text-xs text-[#0F2A36]/65 mt-0.5">{c.description}</p>
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{c.kind === 'hotel' ? 'hotel-booking' : 'flight-booking'}</span>
                {c.extrasCount > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#3B5BFF] bg-[#EAF1FF] px-1.5 py-0.5 rounded">
                    + {c.extrasCount} {c.extrasCount === 1 ? 'доп. поле' : 'доп. полей'}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right whitespace-nowrap shrink-0">
              <div className="text-[#3B5BFF] text-[15px] font-bold">{c.price.toLocaleString('ru-RU')} ₽</div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="w-9 h-9 rounded-lg bg-[#EAF1FF] text-[#3B5BFF] flex items-center justify-center">
                <Edit2 size={15} />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
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
                  {fieldsOfSelected.map(f => (
                    <div key={f.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
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
                  {photosOfSelected.map(p => (
                    <div key={p.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
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

const BookingFormSection: React.FC<{ kind: 'hotel' | 'flight' }> = ({ kind }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    getAppSettings()
      .then(s => { if (alive) setSettings(s); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => {
    setSettings(prev => prev ? { ...prev, [k]: v } : prev);
  };

  const handleSave = async () => {
    if (!settings || saving) return;
    setSaving(true);
    try {
      const { id: _id, updated_at: _ts, ...rest } = settings;
      void _id; void _ts;
      await saveAppSettings(rest);
      setSavedAt(new Date());
    } catch (e) {
      alert(`Ошибка сохранения: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const priceKey = kind === 'hotel' ? 'hotel_booking_price' : 'flight_booking_price';
  const fieldsKey = kind === 'hotel' ? 'hotel_extra_fields' : 'flight_extra_fields';
  const overridesKey = kind === 'hotel' ? 'hotel_core_overrides' : 'flight_core_overrides';
  const coreFields = kind === 'hotel' ? HOTEL_CORE_FIELDS : FLIGHT_CORE_FIELDS;
  const title = kind === 'hotel' ? 'Бронь отеля' : 'Бронь авиабилета';
  const HeroIcon = kind === 'hotel' ? Hotel : Plane;
  const extras: ExtraFormField[] = settings[fieldsKey] ?? [];
  const overrides: CoreFieldOverrides = settings[overridesKey] ?? {};

  const updateOverride = (key: string, patch: Partial<{ label: string; required: boolean; visible: boolean }>) => {
    const next: CoreFieldOverrides = { ...overrides, [key]: { ...(overrides[key] ?? {}), ...patch } };
    set(overridesKey, next);
  };
  const resetOverride = (key: string) => {
    const next: CoreFieldOverrides = { ...overrides };
    delete next[key];
    set(overridesKey, next);
  };

  const addField = () => {
    set(fieldsKey, [
      ...extras,
      { id: Math.random().toString(36).slice(2, 10), label: '', type: 'text', required: false },
    ]);
  };

  const updateField = (idx: number, patch: Partial<ExtraFormField>) => {
    set(fieldsKey, extras.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeField = (idx: number) => {
    set(fieldsKey, extras.filter((_, i) => i !== idx));
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= extras.length) return;
    const arr = [...extras];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    set(fieldsKey, arr);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl vd-grad flex items-center justify-center text-white shadow-md shrink-0">
            <HeroIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36]">{title}</h1>
            <p className="text-xs text-gray-500 mt-0.5">Цена · поля анкеты · видимость и обязательные</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && !saving && (
            <span className="text-xs text-emerald-600">✓ сохранено в {savedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 vd-grad text-white rounded-xl flex items-center gap-2 font-bold select-none shadow-md vd-shadow-cta active:scale-[0.98] transition disabled:opacity-60">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Price card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="vd-grad-soft border border-blue-100 rounded-xl px-4 py-3 shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold">Цена услуги</p>
            <p className="text-2xl font-extrabold tracking-tight vd-grad-text mt-0.5">{(settings[priceKey] as number).toLocaleString('ru-RU')} ₽</p>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-700 mb-1 font-semibold">Изменить цену (₽)</label>
            <input
              type="number" min={0} step={100}
              value={settings[priceKey] as number}
              onChange={e => set(priceKey, parseInt(e.target.value, 10) || 0)}
              className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C7BFF]/40 focus:border-[#5C7BFF]"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Изменения подтягиваются клиентам на лету после нажатия «Сохранить».
            </p>
          </div>
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
            {coreFields.map(f => {
              const ov = overrides[f.key] ?? {};
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
            <span className="text-xs text-gray-400 shrink-0">{extras.length} {extras.length === 1 ? 'поле' : 'полей'}</span>
          </div>

          {extras.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
              <p className="text-xs text-gray-400">Нет дополнительных полей</p>
            </div>
          ) : (
            <div className="space-y-2">
              {extras.map((f, idx) => (
                <div key={f.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="flex flex-col gap-0.5 pt-1">
                      <button type="button" onClick={() => moveField(idx, -1)} disabled={idx === 0}
                        className="text-gray-400 hover:text-[#3B5BFF] disabled:opacity-30 text-xs">▲</button>
                      <button type="button" onClick={() => moveField(idx, 1)} disabled={idx === extras.length - 1}
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
                    </select>
                    <input
                      type="text"
                      value={f.placeholder ?? ''}
                      onChange={e => updateField(idx, { placeholder: e.target.value })}
                      placeholder="Подсказка"
                      className="flex-1 min-w-[120px] px-2 py-1 text-xs border border-gray-200 rounded-md"
                    />
                    <label className="text-xs text-gray-600 flex items-center gap-1 select-none">
                      <input
                        type="checkbox" checked={f.required}
                        onChange={e => updateField(idx, { required: e.target.checked })}
                        className="accent-[#3B5BFF]"
                      />
                      Обязательное
                    </label>
                  </div>
                </div>
              ))}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-700">Обязательное</p>
              <input
                type="checkbox" checked={form.required}
                onChange={e => set('required', e.target.checked)}
                className="w-5 h-5 accent-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Порядок</label>
              <input
                type="number" value={form.sort_order} min={0}
                onChange={e => set('sort_order', parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-700">Обязательное</p>
              <input type="checkbox" checked={form.required}
                onChange={e => set('required', e.target.checked)}
                className="w-5 h-5 accent-emerald-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Порядок</label>
              <input
                type="number" value={form.sort_order} min={0}
                onChange={e => set('sort_order', parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
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
