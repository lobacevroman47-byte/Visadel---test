import React, { useState } from 'react';
import { Search, Plus, Minus, Loader2, RefreshCw, ExternalLink, ShieldCheck, Shield, User as UserIcon } from 'lucide-react';
import { useAdminUsers, updateUserBonuses, updateUserStatus, type AdminUser } from '../hooks/useAdminData';
import { useDialog } from '../../components/shared/BrandDialog';
import { Button, Input, Card, Modal } from '../../components/ui/brand';

interface UsersProps {
  filter?: { filter?: 'all' | 'partners' | 'regular' };
}

// Effective role label & visual style — admin role takes priority over partner/regular.
function getRoleBadge(user: AdminUser) {
  if (user.adminRole === 'founder') {
    return { label: 'Основатель', className: 'bg-purple-100 text-purple-700', icon: <ShieldCheck className="w-3 h-3" /> };
  }
  if (user.adminRole === 'admin') {
    return { label: 'Администратор', className: 'bg-[#EAF1FF] text-[#3B5BFF]', icon: <Shield className="w-3 h-3" /> };
  }
  if (user.adminRole === 'moderator') {
    return { label: 'Модератор', className: 'bg-emerald-100 text-emerald-700', icon: <UserIcon className="w-3 h-3" /> };
  }
  if (user.status === 'partner') {
    return { label: 'Партнёр', className: 'bg-emerald-100 text-emerald-700', icon: null };
  }
  return { label: 'Обычный', className: 'bg-gray-100 text-[#0F2A36]/65', icon: null };
}

// ── User Modal ────────────────────────────────────────────────────────────────
const UserModal: React.FC<{ user: AdminUser; onClose: () => void; onSaved: () => void }> = ({ user, onClose, onSaved }) => {
  const dialog = useDialog();
  const [bonusBalance, setBonusBalance] = useState(user.bonusBalance);
  const [bonusInput, setBonusInput] = useState('');
  const [status, setStatus] = useState(user.status);
  const [saving, setSaving] = useState(false);

  const amount = parseInt(bonusInput, 10) || 0;

  const handleBonus = async (add: boolean) => {
    if (amount <= 0) { await dialog.warning('Введите сумму'); return; }
    if (!add && bonusBalance < amount) { await dialog.warning('Недостаточно бонусов'); return; }
    setSaving(true);
    try {
      await updateUserBonuses(user.telegramId, amount, add);
      setBonusBalance(prev => add ? prev + amount : prev - amount);
      setBonusInput('');
    } catch {
      await dialog.error('Ошибка при изменении бонусов');
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
      await dialog.error('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  const tgUsername = user.username?.replace('@', '') ?? '';

  return (
    <Modal
      open
      onClose={onClose}
      icon="👤"
      label="Пользователь"
      title={user.name}
      subtitle={tgUsername ? (
        <a href={`https://t.me/${tgUsername}`} target="_blank" rel="noreferrer"
          className="text-[#3B5BFF] hover:underline inline-flex items-center gap-1">
          @{tgUsername} <ExternalLink className="w-3 h-3" />
        </a>
      ) : undefined}
      size="md"
      footer={(
        <div className="flex gap-3">
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            loading={saving}
            onClick={handleSave}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={onClose}>
            Отмена
          </Button>
        </div>
      )}
    >
      <div className="p-5 space-y-5">

        {/* Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-[#0F2A36]/60 mb-0.5">Телефон</p>
            <p className="text-sm font-medium text-[#0F2A36]">{user.phone || '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-[#0F2A36]/60 mb-0.5">Email</p>
            <p className="text-sm font-medium truncate text-[#0F2A36]">{user.email || '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-[#0F2A36]/60 mb-0.5">Зарегистрирован</p>
            <p className="text-sm font-medium text-[#0F2A36]">{new Date(user.registeredAt).toLocaleDateString('ru-RU')}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-[#0F2A36]/60 mb-0.5">Заявок</p>
            <p className="text-sm font-medium text-[#0F2A36]">{user.applicationsCount}</p>
          </div>
        </div>

        {/* Bonus Balance */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm font-medium text-[#0F2A36]">Баланс бонусов</p>
            <span className="text-2xl font-bold text-amber-600">{bonusBalance} ₽</span>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                type="number"
                value={bonusInput}
                onChange={e => setBonusInput(e.target.value)}
                placeholder="Сумма"
                min={1}
              />
            </div>
            <Button
              variant="success"
              size="md"
              onClick={() => handleBonus(true)}
              disabled={saving}
              leftIcon={<Plus size={16} />}
            >
              Начислить
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => handleBonus(false)}
              disabled={saving}
              leftIcon={<Minus size={16} />}
            >
              Снять
            </Button>
          </div>
          <p className="text-xs text-[#0F2A36]/45 mt-2">
            Обычный пользователь может списать до 500 ₽ за заявку
          </p>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Статус</label>
          <select value={status} onChange={e => setStatus(e.target.value as 'regular' | 'partner')}
            className="w-full px-3 py-2.5 text-sm bg-white border border-[#E1E5EC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]/20 focus:border-[#3B5BFF]">
            <option value="regular">Обычный пользователь</option>
            <option value="partner">Партнёр (может списывать до 100% бонусами)</option>
          </select>
        </div>
      </div>
    </Modal>
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
        <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36]">Пользователи</h1>
        <div className="flex items-center gap-3">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-[#0F2A36]/45" />}
          <Button
            variant="ghost"
            size="sm"
            onClick={refetch}
            title="Обновить"
            leftIcon={<RefreshCw size={16} />}
          >
            <span className="sr-only">Обновить</span>
          </Button>
          <div className="text-sm text-[#0F2A36]/60">Всего: {filteredUsers.length} из {users.length}</div>
        </div>
      </div>

      {/* Filters */}
      <Card variant="flat" padding="lg" radius="xl" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Input
              type="text"
              placeholder="Поиск по имени, Telegram, телефону..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-white border border-[#E1E5EC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]/20 focus:border-[#3B5BFF]">
            <option value="all">Все</option>
            <option value="regular">Обычные</option>
            <option value="partner">Партнёры</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card variant="flat" padding="none" radius="xl" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-[#0F2A36]/60 font-medium">Имя / Telegram</th>
                <th className="px-6 py-3 text-left text-xs text-[#0F2A36]/60 font-medium">Телефон</th>
                <th className="px-6 py-3 text-left text-xs text-[#0F2A36]/60 font-medium">Бонусы</th>
                <th className="px-6 py-3 text-left text-xs text-[#0F2A36]/60 font-medium">Статус</th>
                <th className="px-6 py-3 text-left text-xs text-[#0F2A36]/60 font-medium">Заявок</th>
                <th className="px-6 py-3 text-left text-xs text-[#0F2A36]/60 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-[#0F2A36]">{user.name}</p>
                    {user.username && (
                      <a href={`https://t.me/${user.username.replace('@', '')}`} target="_blank" rel="noreferrer"
                        className="text-xs text-[#3B5BFF] hover:underline">@{user.username.replace('@', '')}</a>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#0F2A36]/65">{user.phone || '—'}</td>
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
                  <td className="px-6 py-4 text-sm text-[#0F2A36]/65">{user.applicationsCount}</td>
                  <td className="px-6 py-4">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setSelectedUser(user)}
                    >
                      Управление
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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
