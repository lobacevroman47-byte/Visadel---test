import React, { useEffect, useMemo, useState } from 'react';
import {
  Package, Plus, Edit2, Trash2, X, Save, Loader2, RefreshCw, Eye, EyeOff,
} from 'lucide-react';
import {
  getAdditionalServices, upsertAdditionalService, deleteAdditionalService,
  type AdditionalService,
} from '../../lib/db';

export const AdditionalServices: React.FC = () => {
  const [services, setServices] = useState<AdditionalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdditionalService | null>(null);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setServices(await getAdditionalServices()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const totalEnabled = useMemo(() => services.filter(s => s.enabled).length, [services]);

  const handleToggle = async (s: AdditionalService) => {
    await upsertAdditionalService({ ...s, enabled: !s.enabled });
    setServices(prev => prev.map(x => x.id === s.id ? { ...x, enabled: !s.enabled } : x));
  };

  const handleDelete = async (s: AdditionalService) => {
    if (!confirm(`Удалить «${s.name}»? Это нельзя отменить.`)) return;
    await deleteAdditionalService(s.id);
    setServices(prev => prev.filter(x => x.id !== s.id));
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h1>Дополнительные услуги</h1>
          <p className="text-xs text-gray-500 mt-1">
            {services.length} услуг · {totalEnabled} активных · цены применяются на странице оплаты визы
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="px-3 py-2 bg-[#3B5BFF] hover:bg-[#4F2FE6] text-white rounded-lg flex items-center gap-1.5 text-sm select-none"
          >
            <Plus size={16} /> Добавить услугу
          </button>
          <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg" title="Обновить">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {!loading && services.length === 0 && (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-700 mb-2">Пока пусто</h3>
          <p className="text-sm text-gray-500 mb-4">Добавь первую услугу — она появится в калькуляторе на странице визы</p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="px-4 py-2 bg-[#3B5BFF] hover:bg-[#4F2FE6] text-white rounded-lg inline-flex items-center gap-2 select-none"
          >
            <Plus size={16} /> Добавить услугу
          </button>
        </div>
      )}

      {services.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {services.map(s => (
              <div key={s.id} className={`px-4 py-3 flex flex-wrap items-center gap-3 ${!s.enabled ? 'opacity-50' : ''}`}>
                <div className="text-3xl shrink-0">{s.icon ?? '⭐'}</div>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-gray-800 font-medium">{s.name}</p>
                  {s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{s.id}</p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <div className="text-blue-600 font-semibold">+{s.price.toLocaleString('ru-RU')} ₽</div>
                  {s.cost_rub > 0 && (
                    <div className="text-xs text-gray-400">себест. {s.cost_rub.toLocaleString('ru-RU')} ₽</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggle(s)}
                    className={`p-2 rounded-lg ${s.enabled ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`}
                    title={s.enabled ? 'Активна — скрыть' : 'Скрыта — показать'}
                  >
                    {s.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    onClick={() => setEditing(s)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Редактировать"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    title="Удалить"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(editing || adding) && (
        <ServiceFormModal
          service={editing}
          existingIds={services.map(s => s.id)}
          onClose={() => { setEditing(null); setAdding(false); }}
          onSaved={async (saved) => {
            await upsertAdditionalService(saved);
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
  existingIds: string[];
  onClose: () => void;
  onSaved: (s: Omit<AdditionalService, 'created_at' | 'updated_at'>) => Promise<void>;
}> = ({ service, existingIds, onClose, onSaved }) => {
  const [form, setForm] = useState<Omit<AdditionalService, 'created_at' | 'updated_at'>>(
    service ?? {
      id: '', name: '', icon: '⭐', description: '',
      price: 0, cost_rub: 0, enabled: true, sort_order: 0,
    }
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id || !form.name || form.price < 0) {
      alert('Заполни ID, название и корректную цену');
      return;
    }
    if (!service && existingIds.includes(form.id)) {
      alert('Услуга с таким ID уже есть');
      return;
    }
    setSaving(true);
    try { await onSaved(form); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-[#0F2A36]/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            {service ? 'Редактировать услугу' : 'Добавить услугу'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm text-gray-700 mb-1">Иконка (emoji)</label>
              <input
                type="text" value={form.icon ?? ''} onChange={e => set('icon', e.target.value)}
                placeholder="⚡"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-2xl text-center"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">ID *</label>
              <input
                type="text" value={form.id} onChange={e => set('id', e.target.value)}
                disabled={!!service}
                placeholder="urgent-processing"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500 font-mono text-sm"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg" required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Описание</label>
            <textarea
              value={form.description ?? ''} onChange={e => set('description', e.target.value)}
              rows={2}
              placeholder="Приоритетная обработка заявки"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Цена для клиента ₽ *</label>
              <input
                type="number" value={form.price} min={0}
                onChange={e => set('price', parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Себестоимость ₽</label>
              <input
                type="number" value={form.cost_rub} min={0}
                onChange={e => set('cost_rub', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-400 mt-1">Сколько мы тратим на эту услугу (для финансов)</p>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Порядок отображения</label>
            <input
              type="number" value={form.sort_order} min={0}
              onChange={e => set('sort_order', parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
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

          <div className="flex gap-2 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl"
            >
              Отмена
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 py-3 bg-[#3B5BFF] hover:bg-[#4F2FE6] disabled:opacity-60 disabled:pointer-events-none text-white rounded-xl flex items-center justify-center gap-2 font-medium select-none"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
