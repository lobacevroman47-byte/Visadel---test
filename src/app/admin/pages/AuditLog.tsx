import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, History, Search } from 'lucide-react';
import { getAuditLog, type AuditLogRow } from '../lib/audit';

const ACTION_LABELS: Record<string, string> = {
  'application.status_change':  'Статус заявки',
  'application.visa_uploaded':  'Загружена виза',
  'application.usd_rate_change':'Курс USD на заявку',
  'application.tax_pct_change': 'Налог % на заявку',
  'service.toggle':             'Услуга вкл/выкл',
  'service.update':             'Услуга изменена',
  'service.delete':             'Услуга удалена',
  'visa.toggle':                'Виза вкл/выкл',
  'visa.update':                'Виза изменена',
  'visa.delete':                'Виза удалена',
  'review.update':              'Отзыв изменён',
  'booking.status_change':      'Статус брони',
  'booking.confirmation_uploaded': 'Загружено подтверждение',
};

const fmt = (s: string) => new Date(s).toLocaleString('ru-RU', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
});

export const AuditLog: React.FC = () => {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try { setRows(await getAuditLog(500)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const filtered = rows.filter(r => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const blob = `${r.admin_name ?? ''} ${r.action} ${r.target_type ?? ''} ${r.target_id ?? ''} ${JSON.stringify(r.details)}`.toLowerCase();
    return blob.includes(q);
  });

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl vd-grad flex items-center justify-center text-white shadow-md shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36]">Журнал изменений</h1>
            <p className="text-xs text-gray-500 mt-0.5">{rows.length} записей · действия админов</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50 transition active:scale-95">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Обновить
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по админу, действию, target..."
          className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3B5BFF]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <History className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {rows.length === 0 ? 'Журнал пуст' : 'Ничего не найдено по запросу'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-bold text-[#0F2A36]">{ACTION_LABELS[r.action] ?? r.action}</span>
                {r.target_type && (
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[#3B5BFF] bg-[#EAF1FF] px-1.5 py-0.5 rounded">
                    {r.target_type}{r.target_id ? ` · ${r.target_id.slice(0, 8)}…` : ''}
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">{fmt(r.created_at)}</span>
              </div>
              <p className="text-xs text-[#0F2A36]/65">
                {r.admin_name || `tg ${r.admin_tg_id}`}
              </p>
              {r.details && Object.keys(r.details).length > 0 && (
                <pre className="mt-2 bg-gray-50 rounded-lg p-2 text-[11px] font-mono text-[#0F2A36]/80 overflow-x-auto">
                  {JSON.stringify(r.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
