import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, History, Search } from 'lucide-react';
import { getAuditLog, type AuditLogRow } from '../lib/audit';
import { Button, Input, Card, EmptyState } from '../../components/ui/brand';

const ACTION_LABELS: Record<string, string> = {
  'application.status_change':   'Статус заявки',
  'application.visa_uploaded':   'Загружена виза',
  'application.usd_rate_change': 'Курс USD на заявку',
  'application.tax_pct_change':  'Налог % на заявку',
  'service.toggle':              'Услуга вкл/выкл',
  'service.update':              'Услуга изменена',
  'service.delete':              'Услуга удалена',
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  application:        'Заявка',
  additional_service: 'Услуга',
  service:            'Услуга',
};

const STATUS_LABELS_RU: Record<string, string> = {
  draft:                 'Черновик',
  pending_payment:       'Ожидает оплаты',
  pending_confirmation:  'Ожидает подтверждения',
  in_progress:           'В работе',
  completed:             'Готово',
  ready:                 'Готово',
};

const fmtStatus = (s: unknown): string => {
  const k = String(s ?? '');
  return STATUS_LABELS_RU[k] ?? k ?? '—';
};

const fmtBool = (v: unknown): string => (v ? 'вкл' : 'выкл');

const fmtMoney = (v: unknown): string => {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString('ru-RU')} ₽` : String(v ?? '—');
};

/** Рендерит human-readable details для каждого известного action.
 *  Возвращает null если action нам неизвестен — вызывающий код покажет
 *  fallback (сырой JSON), чтобы не терять данные старых записей. */
function renderDetails(action: string, d: Record<string, unknown>): React.ReactNode | null {
  if (!d || typeof d !== 'object') return null;

  switch (action) {
    case 'application.status_change': {
      const ctx = [d.country, d.visa].filter(Boolean).join(' · ');
      return (
        <>
          <span className="text-[#0F2A36]/60">{fmtStatus(d.from)}</span>
          <span className="text-[#0F2A36]/40 mx-1.5">→</span>
          <span className="font-semibold text-[#0F2A36]">{fmtStatus(d.to)}</span>
          {ctx && <span className="text-[#0F2A36]/55 ml-2 text-[11px]">({ctx})</span>}
          {d.visa_uploaded === true && (
            <span className="ml-2 text-[10px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+виза</span>
          )}
        </>
      );
    }
    case 'application.visa_uploaded':
      return <span className="text-[#0F2A36]/65">Файл прикреплён к заявке</span>;
    case 'application.usd_rate_change':
      return (
        <>
          <span className="text-[#0F2A36]/60">{String(d.from ?? '—')} ₽/$</span>
          <span className="text-[#0F2A36]/40 mx-1.5">→</span>
          <span className="font-semibold text-[#0F2A36]">{String(d.to ?? '—')} ₽/$</span>
        </>
      );
    case 'application.tax_pct_change':
      return (
        <>
          <span className="text-[#0F2A36]/60">{String(d.from ?? '—')}%</span>
          <span className="text-[#0F2A36]/40 mx-1.5">→</span>
          <span className="font-semibold text-[#0F2A36]">{String(d.to ?? '—')}%</span>
        </>
      );
    case 'service.toggle':
      return (
        <>
          {d.name ? <span className="font-semibold text-[#0F2A36]">«{String(d.name)}»</span> : null}
          <span className="text-[#0F2A36]/60 ml-1">{fmtBool(d.from)}</span>
          <span className="text-[#0F2A36]/40 mx-1.5">→</span>
          <span className="font-semibold text-[#0F2A36]">{fmtBool(d.to)}</span>
        </>
      );
    case 'service.update':
      return (
        <>
          {d.name ? <span className="font-semibold text-[#0F2A36]">«{String(d.name)}»</span> : null}
          <span className="text-[#0F2A36]/60 ml-2">цена {fmtMoney(d.price)}</span>
          <span className="text-[#0F2A36]/60 ml-2">· {fmtBool(d.enabled)}</span>
        </>
      );
    case 'service.delete':
      return (
        <>
          {d.name ? <span className="font-semibold text-[#0F2A36]">«{String(d.name)}»</span> : null}
          <span className="text-[#0F2A36]/60 ml-2">(была {fmtMoney(d.price)})</span>
        </>
      );
    default:
      return null;
  }
}

const fmtDate = (s: string) => new Date(s).toLocaleString('ru-RU', {
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
          placeholder="Поиск по админу, действию, объекту..."
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
          {filtered.map(r => {
            const pretty = renderDetails(r.action, r.details);
            const targetLabel = r.target_type ? (TARGET_TYPE_LABELS[r.target_type] ?? r.target_type) : null;
            return (
              <Card key={r.id} variant="flat" padding="md" radius="xl">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-bold text-[#0F2A36]">{ACTION_LABELS[r.action] ?? r.action}</span>
                  {targetLabel && (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-[#3B5BFF] bg-[#EAF1FF] px-1.5 py-0.5 rounded">
                      {targetLabel}
                    </span>
                  )}
                  <span className="text-xs text-[#0F2A36]/45 ml-auto">{fmtDate(r.created_at)}</span>
                </div>
                <p className="text-xs text-[#0F2A36]/65 mb-1">
                  {r.admin_name || `tg ${r.admin_tg_id}`}
                </p>
                {pretty && (
                  <div className="text-sm mt-1 leading-relaxed">{pretty}</div>
                )}
                {!pretty && r.details && Object.keys(r.details).length > 0 && (
                  <pre className="mt-2 bg-gray-50 rounded-lg p-2 text-[11px] font-mono text-[#0F2A36]/80 overflow-x-auto">
                    {JSON.stringify(r.details, null, 2)}
                  </pre>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
