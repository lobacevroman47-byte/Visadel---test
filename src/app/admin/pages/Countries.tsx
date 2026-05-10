import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, Edit2, Trash2, X, Loader2, RefreshCw, Eye, EyeOff,
  Database, Save, FileText, Package, Hotel,
} from 'lucide-react';
import {
  getVisaProducts,
  upsertVisaProduct,
  deleteVisaProduct,
  toggleVisaProductEnabled,
  seedVisaProductsFromCode,
  type VisaProduct,
} from '../../lib/db';
import { countriesVisaData } from '../data/countriesData';
import { AdditionalServices } from './AdditionalServices';
import { useDialog } from '../../components/shared/BrandDialog';
import { Button, Modal } from '../../components/ui/brand';

// ── Top-level tab nav: Визы / Доп. услуги / Брони
type TopTab = 'visas' | 'addons' | 'bookings';

const TOP_TABS: { id: TopTab; label: string; Icon: typeof FileText }[] = [
  { id: 'visas',    label: 'Визы',        Icon: FileText },
  { id: 'addons',   label: 'Доп. услуги', Icon: Package  },
  { id: 'bookings', label: 'Брони',       Icon: Hotel    },
];

export const Countries: React.FC = () => {
  const [topTab, setTopTab] = useState<TopTab>('visas');
  return (
    <div>
      {/* Top nav — same brand pattern as FormBuilder */}
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

      {topTab === 'visas'    && <VisasSection />}
      {topTab === 'addons'   && <AdditionalServices mode="addons" />}
      {topTab === 'bookings' && <AdditionalServices mode="bookings" />}
    </div>
  );
};

const VisasSection: React.FC = () => {
  const dialog = useDialog();
  const [products, setProducts] = useState<VisaProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState('');
  const [showOnlyEnabled, setShowOnlyEnabled] = useState(false);
  const [editing, setEditing] = useState<VisaProduct | null>(null);
  const [adding, setAdding] = useState(false);
  // Выбранная страна (как в Конструкторе анкет). По умолчанию ни одна
  // не выбрана — админ должен явно ткнуть страну в списке.
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setProducts(await getVisaProducts()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Список стран для пилюль селектора (из products + по умолчанию).
  const countries = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const p of products) if (!map.has(p.country)) map.set(p.country, p.flag);
    return Array.from(map.entries()).map(([name, flag]) => ({ name, flag }));
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (showOnlyEnabled && !p.enabled) return false;
      if (selectedCountry && p.country !== selectedCountry) return false;
      if (q && !`${p.country} ${p.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, showOnlyEnabled, selectedCountry]);

  const grouped = useMemo(() => {
    const map = new Map<string, VisaProduct[]>();
    for (const p of filtered) {
      const list = map.get(p.country) ?? [];
      list.push(p);
      map.set(p.country, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleSeed = async () => {
    const ok = await dialog.confirm('Загрузить визы из хардкода в БД?', 'Существующие записи не будут перезаписаны.', { confirmLabel: 'Загрузить', cancelLabel: 'Отмена' });
    if (!ok) return;
    setSeeding(true);
    try {
      console.log('[seed] starting, countriesVisaData length:', countriesVisaData?.length);
      const r = await seedVisaProductsFromCode(false, { countriesVisaData });
      console.log('[seed] result:', r);
      if (r.error) {
        await dialog.error('Ошибка импорта', `${r.error}\n\nВозможные причины:\n— Таблица visa_products не создана в Supabase\n— RLS блокирует запись\n\nЗапусти SQL из инструкции и попробуй снова.`);
      } else {
        await dialog.success('Импорт завершён', `Импортировано: ${r.inserted}\nУже было в БД: ${r.skipped}`);
      }
      await load();
    } catch (e) {
      console.error('[seed] exception:', e);
      await dialog.error('Не удалось импортировать', e instanceof Error ? e.message : String(e));
    } finally { setSeeding(false); }
  };

  const handleToggle = async (p: VisaProduct) => {
    await toggleVisaProductEnabled(p.id, !p.enabled);
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, enabled: !p.enabled } : x));
  };

  const handleDelete = async (p: VisaProduct) => {
    const ok = await dialog.confirm(`Удалить «${p.name}»?`, `Страна: ${p.country}. Это действие нельзя отменить.`, { confirmLabel: 'Удалить', cancelLabel: 'Отмена' });
    if (!ok) return;
    await deleteVisaProduct(p.id);
    setProducts(prev => prev.filter(x => x.id !== p.id));
  };

  const totalEnabled = products.filter(p => p.enabled).length;

  return (
    <div className="p-4 md:p-8">
      {/* Hero — same brand pattern as Доп. услуги */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl vd-grad flex items-center justify-center text-white shadow-md shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36]">Визы</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {products.length} {products.length === 1 ? 'виза' : 'виз'} · {totalEnabled} активных · показываются клиенту в каталоге
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="px-4 py-2.5 vd-grad text-white rounded-xl flex items-center gap-1.5 text-sm font-bold select-none shadow-md vd-shadow-cta active:scale-[0.98] transition"
          >
            <Plus size={16} strokeWidth={2.5} /> Добавить визу
          </button>
          <button onClick={load} className="w-10 h-10 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center transition active:scale-95" title="Обновить">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Country selector — pills like в Конструкторе анкет */}
      {countries.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCountry(null)}
            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition ${
              selectedCountry === null ? 'bg-[#3B5BFF] text-white shadow-sm' : 'text-[#0F2A36] hover:bg-gray-100'
            }`}
          >
            <span className="text-base">🌍</span>
            Все страны
          </button>
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

      {/* Filters — brand pill style */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-5 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text" placeholder="Поиск по стране или названию..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C7BFF]/40 focus:border-[#5C7BFF]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowOnlyEnabled(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition active:scale-95 ${
            showOnlyEnabled
              ? 'vd-grad text-white shadow-sm'
              : 'bg-white border border-gray-200 text-[#0F2A36]/65 hover:bg-gray-50'
          }`}
        >
          <Eye size={14} /> Только активные
        </button>
      </div>

      {/* Empty state with seed CTA — brand-styled */}
      {!loading && products.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl vd-grad-soft border border-blue-100 flex items-center justify-center text-3xl mx-auto mb-4">
            🌍
          </div>
          <h3 className="text-[18px] font-extrabold tracking-tight text-[#0F2A36] mb-1">Каталог пустой</h3>
          <p className="text-sm text-[#0F2A36]/60 mb-5">Импортируй визы из текущего кода — это разовая операция</p>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-5 py-2.5 vd-grad text-white rounded-xl inline-flex items-center gap-2 select-none shadow-md vd-shadow-cta font-bold active:scale-[0.98] transition disabled:opacity-60"
          >
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database size={16} strokeWidth={2.5} />}
            {seeding ? 'Импортируем…' : 'Импортировать из кода'}
          </button>
        </div>
      )}

      {grouped.length === 0 && products.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-sm text-gray-400 shadow-sm">
          По выбранным фильтрам ничего не найдено
        </div>
      )}

      {/* Country groups — each group's title is a brand subheader, visas are stand-alone cards */}
      <div className="space-y-6">
        {grouped.map(([country, items]) => (
          <div key={country} className="space-y-2.5">
            <div className="flex items-center gap-2 px-1">
              <span className="text-xl">{items[0].flag ?? '🌍'}</span>
              <h3 className="text-sm font-extrabold tracking-tight text-[#0F2A36]">{country}</h3>
              <span className="text-xs text-gray-400">· {items.length} {items.length === 1 ? 'виза' : 'виз'}</span>
            </div>
            <div className="space-y-2.5">
              {items.map(p => (
                <div
                  key={p.id}
                  className={`bg-white rounded-2xl border border-gray-100 hover:shadow-md transition p-4 flex flex-wrap items-start gap-3 ${!p.enabled ? 'opacity-55' : ''}`}
                >
                  <div className="w-12 h-12 rounded-xl vd-grad-soft border border-blue-100 flex items-center justify-center text-2xl shrink-0">
                    {p.flag ?? '🌍'}
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[15px] font-bold text-[#0F2A36]">{p.name}</p>
                      {!p.enabled && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-500">Скрыта</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{p.id}</span>
                      {p.processing_time && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#3B5BFF] bg-[#EAF1FF] px-1.5 py-0.5 rounded">
                          ⏱ {p.processing_time}
                        </span>
                      )}
                      {(p.partner_commission_pct ?? 0) > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          партнёрам {p.partner_commission_pct}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right whitespace-nowrap shrink-0">
                    <div className="text-[#3B5BFF] text-[15px] font-bold">{p.price.toLocaleString('ru-RU')} ₽</div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggle(p)}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition active:scale-95 ${
                        p.enabled
                          ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                      title={p.enabled ? 'Активна — скрыть' : 'Скрыта — показать'}
                    >
                      {p.enabled ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <button
                      onClick={() => setEditing(p)}
                      className="w-9 h-9 rounded-lg bg-[#EAF1FF] text-[#3B5BFF] hover:bg-[#DCE7FF] flex items-center justify-center transition active:scale-95"
                      title="Редактировать"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="w-9 h-9 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition active:scale-95"
                      title="Удалить"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(editing || adding) && (
        <ProductFormModal
          product={editing}
          onClose={() => { setEditing(null); setAdding(false); }}
          onSaved={async (saved) => {
            await upsertVisaProduct(saved);
            setEditing(null); setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
};

// ─── Product Edit/Create Modal ────────────────────────────────────────────────
const ProductFormModal: React.FC<{
  product: VisaProduct | null;
  onClose: () => void;
  onSaved: (p: Omit<VisaProduct, 'created_at' | 'updated_at'>) => Promise<void>;
}> = ({ product, onClose, onSaved }) => {
  const dialog = useDialog();
  const [form, setForm] = useState<Omit<VisaProduct, 'created_at' | 'updated_at'>>(
    product ?? {
      id: '', country: '', flag: '🌍', name: '',
      price: 0, processing_time: '', description: '',
      partner_commission_pct: 15,
      cost_usd_fee: 0, cost_usd_commission: 0,
      enabled: true, sort_order: 0,
    }
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id || !form.country || !form.name || form.price <= 0) {
      await dialog.warning('Заполни ID, Страну, Название и Цену');
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
      icon="🌍"
      label={product ? 'Редактирование' : 'Новая виза'}
      title={product ? 'Редактировать визу' : 'Добавить визу'}
      size="lg"
    >
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">ID *</label>
              <input
                type="text" value={form.id} onChange={e => set('id', e.target.value)}
                disabled={!!product}
                placeholder="india-evisa-30"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Уникальный (нельзя менять после создания)</p>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Страна *</label>
              <input
                type="text" value={form.country} onChange={e => set('country', e.target.value)}
                placeholder="Индия"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Флаг (emoji)</label>
              <input
                type="text" value={form.flag ?? ''} onChange={e => set('flag', e.target.value)}
                placeholder="🇮🇳"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-2xl text-center"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">Название *</label>
              <input
                type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="E-VISA на 30 дней"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Цена ₽ *</label>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                value={form.price === 0 ? '' : form.price}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '');
                  set('price', v === '' ? 0 : parseInt(v, 10));
                }}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Срок оформления</label>
              <input
                type="text" value={form.processing_time ?? ''} onChange={e => set('processing_time', e.target.value)}
                placeholder="5-7 дней"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Комиссия партнёра %</label>
              <input
                type="text" inputMode="decimal"
                value={form.partner_commission_pct === 0 ? '' : form.partner_commission_pct}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                  set('partner_commission_pct', v === '' ? 0 : parseFloat(v) || 0);
                }}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Описание</label>
            <textarea
              value={form.description ?? ''} onChange={e => set('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-3 space-y-3">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Себестоимость (для расчёта прибыли)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-700 mb-1">Сбор $</label>
                <input
                  type="text" inputMode="decimal"
                  value={form.cost_usd_fee === 0 ? '' : form.cost_usd_fee}
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                    set('cost_usd_fee', v === '' ? 0 : parseFloat(v) || 0);
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Комиссия $</label>
                <input
                  type="text" inputMode="decimal"
                  value={form.cost_usd_commission === 0 ? '' : form.cost_usd_commission}
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                    set('cost_usd_commission', v === '' ? 0 : parseFloat(v) || 0);
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">Используется в разделе «Финансы» для расчёта прибыли (по курсу из bonus-config.ts).</p>
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Видимость</p>
              <p className="text-xs text-gray-500">Если выключена — пользователи не увидят эту визу</p>
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
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </Button>
          </div>
        </form>
    </Modal>
  );
};
