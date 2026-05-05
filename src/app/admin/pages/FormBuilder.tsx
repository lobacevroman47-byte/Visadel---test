import React, { useEffect, useMemo, useState } from 'react';
import {
  FileEdit, Image as ImageIcon, Plus, Edit2, Trash2, X, Save, Loader2,
  RefreshCw, Database, AlertCircle,
} from 'lucide-react';
import {
  getVisaProducts,
  getAllFormFields, upsertFormField, deleteFormField,
  getAllPhotoRequirements, upsertPhotoRequirement, deletePhotoRequirement,
  seedFormFieldsFromCode,
  type VisaFormField, type VisaPhotoRequirement, type FormFieldType, type VisaProduct,
} from '../../lib/db';
import { countriesVisaData } from '../data/countriesData';
import { countryPhotoRequirements } from '../data/photoRequirements';

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

export const FormBuilder: React.FC = () => {
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
