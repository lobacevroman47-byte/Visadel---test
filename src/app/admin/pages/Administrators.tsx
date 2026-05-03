import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, X, RefreshCw, Loader2, ShieldCheck, Shield, User } from 'lucide-react';
import { getAdminUsers, addAdminUser, removeAdminUser, updateAdminRole, type AdminUserRow, type AdminRole } from '../../lib/db';

const ROLE_LABELS: Record<AdminRole, string> = {
  founder: 'Основатель',
  admin: 'Администратор',
  moderator: 'Модератор',
};

const ROLE_COLORS: Record<AdminRole, string> = {
  founder: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  moderator: 'bg-green-100 text-green-700',
};

const ROLE_ICON: Record<AdminRole, React.ReactNode> = {
  founder: <ShieldCheck className="w-4 h-4" />,
  admin: <Shield className="w-4 h-4" />,
  moderator: <User className="w-4 h-4" />,
};

// ── Founder IDs from env (cannot be deleted) ──────────────────────────────────
const FOUNDER_IDS: string[] = (import.meta.env.VITE_ADMIN_TELEGRAM_IDS ?? '')
  .split(',').map((s: string) => s.trim()).filter(Boolean);

// ── Add Modal ─────────────────────────────────────────────────────────────────
const AddAdminModal: React.FC<{
  onClose: () => void;
  onAdd: (row: Omit<AdminUserRow, 'id' | 'created_at'>) => Promise<void>;
}> = ({ onClose, onAdd }) => {
  const [telegramId, setTelegramId] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<AdminRole>('moderator');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(telegramId.trim(), 10);
    if (isNaN(id)) { alert('Telegram ID должен быть числом'); return; }
    setSaving(true);
    await onAdd({ telegram_id: id, telegram_username: username.replace('@', '') || undefined, name, role });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-5 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Добавить сотрудника</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1 font-medium">Telegram ID <span className="text-red-500">*</span></label>
            <input type="number" value={telegramId} onChange={e => setTelegramId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="123456789" required />
            <p className="text-xs text-gray-400 mt-1">Узнать ID можно у бота @userinfobot</p>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1 font-medium">Имя <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Иван Иванов" required />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1 font-medium">Username (необязательно)</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="@username" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1 font-medium">Роль</label>
            <select value={role} onChange={e => setRole(e.target.value as AdminRole)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="admin">Администратор — полный доступ</option>
              <option value="moderator">Модератор — доступ к заявкам</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white rounded-xl transition flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Сохраняем...' : 'Добавить'}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition">
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const Administrators: React.FC = () => {
  const [admins, setAdmins] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await getAdminUsers();
    setAdmins(rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (row: Omit<AdminUserRow, 'id' | 'created_at'>) => {
    await addAdminUser(row);
    await load();
  };

  const handleDelete = async (row: AdminUserRow) => {
    if (FOUNDER_IDS.includes(String(row.telegram_id))) {
      alert('Нельзя удалить основателя');
      return;
    }
    if (!confirm(`Удалить ${row.name}?`)) return;
    await removeAdminUser(row.telegram_id);
    setAdmins(prev => prev.filter(a => a.telegram_id !== row.telegram_id));
  };

  const handleRoleChange = async (row: AdminUserRow, role: AdminRole) => {
    if (FOUNDER_IDS.includes(String(row.telegram_id))) {
      alert('Нельзя изменить роль основателя');
      return;
    }
    await updateAdminRole(row.telegram_id, role);
    setAdmins(prev => prev.map(a => a.telegram_id === row.telegram_id ? { ...a, role } : a));
  };

  const counts = { founder: 0, admin: 0, moderator: 0 };
  admins.forEach(a => counts[a.role]++);
  FOUNDER_IDS.forEach(() => counts.founder++);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="mb-1">Сотрудники</h1>
          <p className="text-sm text-gray-500">Управление доступом к админ-панели</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg transition" title="Обновить">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition flex items-center gap-2 text-sm">
            <Plus size={18} /> Добавить
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(['founder', 'admin', 'moderator'] as AdminRole[]).map(role => (
          <div key={role} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ROLE_COLORS[role]}`}>
              {ROLE_ICON[role]}
            </div>
            <div>
              <p className="text-xs text-gray-500">{ROLE_LABELS[role]}ов</p>
              <p className="text-2xl font-semibold text-gray-800">{counts[role]}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Founders row (from env var) */}
      {FOUNDER_IDS.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <div className="px-5 py-3 bg-purple-50 border-b border-purple-100">
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Основатели (защищены)</p>
          </div>
          {FOUNDER_IDS.map(id => (
            <div key={id} className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">Telegram ID: {id}</p>
                <p className="text-xs text-gray-400">Настроен через Vercel ENV</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${ROLE_COLORS.founder}`}>
                {ROLE_ICON.founder} {ROLE_LABELS.founder}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Admins table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {admins.length === 0 && !loading ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">Сотрудники не добавлены</p>
            <p className="text-gray-300 text-xs mt-1">Нажмите «Добавить» чтобы выдать доступ</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs text-gray-500 font-medium">Имя</th>
                <th className="px-5 py-3 text-left text-xs text-gray-500 font-medium">Telegram ID</th>
                <th className="px-5 py-3 text-left text-xs text-gray-500 font-medium">Роль</th>
                <th className="px-5 py-3 text-left text-xs text-gray-500 font-medium">Добавлен</th>
                <th className="px-5 py-3 text-left text-xs text-gray-500 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {admins.map(row => (
                <tr key={row.telegram_id} className="hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-gray-800">{row.name}</p>
                    {row.telegram_username && (
                      <p className="text-xs text-gray-400">@{row.telegram_username}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{row.telegram_id}</td>
                  <td className="px-5 py-4">
                    <select
                      value={row.role}
                      onChange={e => handleRoleChange(row, e.target.value as AdminRole)}
                      disabled={FOUNDER_IDS.includes(String(row.telegram_id))}
                      className="px-3 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                    >
                      <option value="admin">Администратор</option>
                      <option value="moderator">Модератор</option>
                    </select>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-400">
                    {row.created_at ? new Date(row.created_at).toLocaleDateString('ru-RU') : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => handleDelete(row)}
                      disabled={FOUNDER_IDS.includes(String(row.telegram_id))}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && <AddAdminModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
    </div>
  );
};
