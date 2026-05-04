import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search, Gift, AlertTriangle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface BonusLog {
  id: string;
  telegram_id: number;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

interface UserRow {
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  daily:    { label: 'Ежедневный',   color: 'bg-blue-50 text-blue-600',   icon: '📅' },
  weekly:   { label: 'Еженедельный', color: 'bg-green-50 text-green-600', icon: '🏆' },
  monthly:  { label: 'Ежемесячный',  color: 'bg-yellow-50 text-yellow-600', icon: '🌟' },
  referral: { label: 'Реферал',      color: 'bg-purple-50 text-purple-600', icon: '👫' },
  visa:     { label: 'Виза готова',  color: 'bg-emerald-50 text-emerald-600', icon: '🎉' },
  review:   { label: 'Отзыв',        color: 'bg-pink-50 text-pink-600',    icon: '⭐' },
};

export const BonusLogs: React.FC = () => {
  const [logs, setLogs]         = useState<BonusLog[]>([]);
  const [users, setUsers]       = useState<Record<number, UserRow>>({});
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) return;
      const [{ data: logsData }, { data: usersData }] = await Promise.all([
        supabase.from('bonus_logs').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('users').select('telegram_id,first_name,last_name,username'),
      ]);
      setLogs((logsData as BonusLog[]) ?? []);
      const map: Record<number, UserRow> = {};
      ((usersData as UserRow[]) ?? []).forEach(u => { map[u.telegram_id] = u; });
      setUsers(map);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const userName = (tgId: number) => {
    const u = users[tgId];
    if (!u) return `ID ${tgId}`;
    return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || `ID ${tgId}`;
  };

  // Stats per user — find suspicious daily claiming (>1 per day)
  const suspiciousIds = new Set<number>();
  const dailyByUser: Record<string, number> = {};
  logs.forEach(l => {
    if (l.type === 'daily') {
      const key = `${l.telegram_id}_${l.created_at.slice(0, 10)}`;
      dailyByUser[key] = (dailyByUser[key] ?? 0) + 1;
      if (dailyByUser[key] > 1) suspiciousIds.add(l.telegram_id);
    }
  });

  const filtered = logs.filter(l => {
    if (filter !== 'all' && l.type !== filter) return false;
    if (search) {
      const name = userName(l.telegram_id).toLowerCase();
      const idStr = String(l.telegram_id);
      if (!name.includes(search.toLowerCase()) && !idStr.includes(search)) return false;
    }
    return true;
  });

  // Aggregate per user for summary
  const userTotals: Record<number, { name: string; total: number; dailyCount: number; suspicious: boolean }> = {};
  logs.forEach(l => {
    if (!userTotals[l.telegram_id]) {
      userTotals[l.telegram_id] = { name: userName(l.telegram_id), total: 0, dailyCount: 0, suspicious: false };
    }
    userTotals[l.telegram_id].total += l.amount;
    if (l.type === 'daily') userTotals[l.telegram_id].dailyCount++;
    if (suspiciousIds.has(l.telegram_id)) userTotals[l.telegram_id].suspicious = true;
  });

  return (
    <div className="p-6 lg:p-8 min-h-screen bg-[#F5F7FA]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">История бонусов</h1>
          <p className="text-sm text-gray-400 mt-0.5">Все начисления · проверка на накрутку</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Suspicious users alert */}
      {suspiciousIds.size > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Подозрительная активность</p>
            <p className="text-xs text-red-600 mt-0.5">
              {suspiciousIds.size} пользователь(ей) получили ежедневный бонус более 1 раза в день:&nbsp;
              {[...suspiciousIds].map(id => userName(id)).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* User totals */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Сводка по пользователям</p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {Object.entries(userTotals).sort((a, b) => b[1].total - a[1].total).map(([id, u]) => (
            <div key={id} className={`flex items-center justify-between px-3 py-2 rounded-xl ${u.suspicious ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2">
                {u.suspicious && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                <p className="text-sm font-medium text-gray-700">{u.name}</p>
                <span className="text-xs text-gray-400">· {u.dailyCount} дн. входов</span>
              </div>
              <span className={`text-sm font-bold ${u.suspicious ? 'text-red-600' : 'text-gray-700'}`}>+{u.total}₽</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени или ID..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="all">Все типы</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
      </div>

      {/* Log table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Gift className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">Нет записей</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            const cfg = TYPE_CONFIG[log.type] ?? { label: log.type, color: 'bg-gray-50 text-gray-600', icon: '•' };
            const suspicious = suspiciousIds.has(log.telegram_id);
            return (
              <div key={log.id} className={`bg-white rounded-2xl border shadow-sm p-3 flex items-center gap-3 ${suspicious ? 'border-red-100' : 'border-gray-100'}`}>
                <span className="text-xl shrink-0">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-800">{userName(log.telegram_id)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    {suspicious && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">⚠️ Подозрение</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{log.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-green-600">+{log.amount}₽</p>
                  <p className="text-xs text-gray-400">{new Date(log.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
