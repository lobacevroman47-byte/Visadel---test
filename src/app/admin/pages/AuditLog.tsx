import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, History, Search } from 'lucide-react';
import { getAuditLog, type AuditLogRow } from '../lib/audit';
import { Button, Input, Card, EmptyState } from '../../components/ui/brand';

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
        <Button
          variant="secondary"
          size="md"
          onClick={load}
          disabled={loading}
          leftIcon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        >
          Обновить
        </Button>
      </div>

      <div className="mb-4">
        <Input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по админу, действию, target..."
          leftIcon={<Search className="w-4 h-4" />}
        />
      </div>

      {filtered.length === 0 ? (
        <Card variant="flat" padding="none" className="py-12">
          <EmptyState
            icon={<History className="w-6 h-6 text-[#3B5BFF]" />}
            title={rows.length === 0 ? 'Журнал пуст' : 'Ничего не найдено'}
            subtitle={rows.length === 0 ? 'Действия админов появятся здесь' : 'Попробуйте изменить запрос'}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Card key={r.id} variant="flat" padding="md" radius="xl">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-bold text-[#0F2A36]">{ACTION_LABELS[r.action] ?? r.action}</span>
                {r.target_type && (
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[#3B5BFF] bg-[#EAF1FF] px-1.5 py-0.5 rounded">
                    {r.target_type}{r.target_id ? ` · ${r.target_id.slice(0, 8)}…` : ''}
                  </span>
                )}
                <span className="text-xs text-[#0F2A36]/45 ml-auto">{fmt(r.created_at)}</span>
              </div>
              <p className="text-xs text-[#0F2A36]/65">
                {r.admin_name || `tg ${r.admin_tg_id}`}
              </p>
              {r.details && Object.keys(r.details).length > 0 && (
                <pre className="mt-2 bg-gray-50 rounded-lg p-2 text-[11px] font-mono text-[#0F2A36]/80 overflow-x-auto">
                  {JSON.stringify(r.details, null, 2)}
                </pre>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
