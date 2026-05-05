import React, { useState } from 'react';
import { Search, Plus, Minus, Loader2, RefreshCw, X, ExternalLink, ShieldCheck, Shield, User as UserIcon } from 'lucide-react';
import { useAdminUsers, updateUserBonuses, updateUserStatus, type AdminUser } from '../hooks/useAdminData';

interface UsersProps {
  filter?: { filter?: 'all' | 'partners' | 'regular' };
}

// Effective role label & visual style — admin role takes priority over partner/regular.
function getRoleBadge(user: AdminUser) {
  if (user.adminRole === 'founder') {
    return { label: 'Основатель', className: 'bg-purple-100 text-purple-700', icon: <ShieldCheck className="w-3 h-3" /> };
  }
  if (user.adminRole === 'admin') {
    return { label: 'Администратор', className: 'bg-blue-100 text-blue-700', icon: <Shield className="w-3 h-3" /> };
  }
  if (user.adminRole === 'moderator') {
    return { label: 'Модератор', className: 'bg-emerald-100 text-emerald-700', icon: <UserIcon className="w-3 h-3" /> };
  }
  if (user.status === 'partner') {
    return { label: 'Партнёр', className: 'bg-green-100 text-green-700', icon: null };
  }
  return { label: 'Обычный', className: 'bg-gray-100 text-gray-600', icon: null };
}

// ── User Modal ────────────────────────────────────────────────────────────────
const UserModal: React.FC<{ user: AdminUser; onClose: () => void; onSaved: () => void }> = ({ user, onClose, onSaved }) => {
  const [bonusBalance, setBonusBalance] = useState(user.bonusBalance);
  const [bonusInput, setBonusInput] = useState('');
  const [status, setStatus] = useState(user.status);
  const [saving, setSaving] = useState(false);

  const amount = parseInt(bonusInput, 10) || 0;

  const handleBonus = async (add: boolean) => {
    if (amount <= 0) { alert('Введите сумму'); return; }
    if (!add && bonusBalance < amount) { alert('Недостаточно бонусов'); return; }
    setSaving(true);
    try {
      await updateUserBonuses(user.telegramId, amount, add);
      setBonusBalance(prev => add ? prev + amount : prev - amount);
      setBonusInput('');
    } catch {
      alert('Ошибка при изменении бонусов');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserStatus(user.telegramId, status === 'partner');
      onSaved();
      onClose();
    } catch {
      alert('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  const tgUsername = user.username?.replace('@', '') ?? '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{user.name}</h2>
            {tgUsername ? (
              <a href={`https://t.me/${tgUsername}`} target="_blank" rel="noreferrer"
                className="text-sm text-blue-500 hover:underline flex items-center gap-1">
                @{tgUsername} <ExternalLink className="w-3 h-3" />
              </a>
            ) : null}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-0.5">Телефон</p>
              <p className="text-sm font-medium">{user.phone || '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-0.5">Email</p>
              <p className="text-sm font-medium truncate">{user.email || '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-0.5">Зарегистрирован</p>
              <p className="text-sm font-medium">{new Date(user.registeredAt).toLocaleDateString('ru-RU')}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-0.5">Заявок</p>
              <p className="text-sm font-medium">{user.applicationsCount}</p>
            </div>
          </div>

          {/* Bonus Balance */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm font-medium text-gray-700">Баланс бонусов</p>
              <span className="text-2xl font-bold text-amber-600">{bonusBalance} ₽</span>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={bonusInput}
                onChange={e => setBonusInput(e.target.value)}
                placeholder="Сумма"
                min={1}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
              />
              <button onClick={() => handleBonus(true)} disabled={saving}
                className="px-3 py-2.5 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white rounded-xl transition flex items-center gap-1 text-sm">
                <Plus size={16} /> Начислить
              </button>
              <button onClick={() => handleBonus(false)} disabled={saving}
                className="px-3 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-xl transition flex items-center gap-1 text-sm">
                <Minus size={16} /> Снять
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Обычный пользователь может списать до 500 ₽ за заявку
            </p>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Статус</label>
            <select value={status} onChange={e => setStatus(e.target.value as 'regular' | 'partner')}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="regular">Обычный пользователь</option>
              <option value="partner">Партнёр (может списывать до 100% бонусами)</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex gap-3 shrink-0">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white rounded-xl transition font-medium flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button onClick={onClose}
            className="px-5 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition text-sm">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Users List ────────────────────────────────────────────────────────────────
export const Users: React.FC<UsersProps> = ({ filter }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(
    filter?.filter === 'regular' ? 'regular' : filter?.filter === 'partners' ? 'partner' : 'all'
  );
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const { users, loading, refetch } = useAdminUsers();

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone.includes(searchQuery) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1>Пользователи</h1>
        <div className="flex items-center gap-3">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button onClick={refetch} className="p-2 hover:bg-gray-100 rounded-lg transition" title="Обновить">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
          <div className="text-sm text-gray-600">Всего: {filteredUsers.length} из {users.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Поиск по имени, Telegram, телефону..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="all">Все</option>
            <option value="regular">Обычные</option>
            <option value="partner">Партнёры</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-500 font-medium">Имя / Telegram</th>
                <th className="px-6 py-3 text-left text-xs text-gray-500 font-medium">Телефон</th>
                <th className="px-6 py-3 text-left text-xs text-gray-500 font-medium">Бонусы</th>
                <th className="px-6 py-3 text-left text-xs text-gray-500 font-medium">Статус</th>
                <th className="px-6 py-3 text-left text-xs text-gray-500 font-medium">Заявок</th>
                <th className="px-6 py-3 text-left text-xs text-gray-500 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-800">{user.name}</p>
                    {user.username && (
                      <a href={`https://t.me/${user.username.replace('@', '')}`} target="_blank" rel="noreferrer"
                        className="text-xs text-blue-500 hover:underline">@{user.username.replace('@', '')}</a>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.phone || '—'}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-amber-600">{user.bonusBalance} ₽</span>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const badge = getRoleBadge(user);
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
                          {badge.icon}
                          {badge.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.applicationsCount}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => setSelectedUser(user)}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition">
                      Управление
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUser && (
        <UserModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSaved={refetch}
        />
      )}
    </div>
  );
};
