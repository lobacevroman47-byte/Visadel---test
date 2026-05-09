import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, RefreshCw, Loader2, ShieldCheck, Shield, User } from 'lucide-react';
import { getAdminUsers, addAdminUser, removeAdminUser, updateAdminRole, type AdminUserRow, type AdminRole } from '../../lib/db';
import { useDialog } from '../../components/shared/BrandDialog';
import { Button, Input, Card, Modal, EmptyState, Badge } from '../../components/ui/brand';

const ROLE_LABELS: Record<AdminRole, string> = {
  founder: 'Основатель',
  admin: 'Администратор',
  moderator: 'Модератор',
};

const ROLE_LABELS_PLURAL: Record<AdminRole, string> = {
  founder: 'Основатели',
  admin: 'Администраторы',
  moderator: 'Модераторы',
};

const ROLE_COLORS: Record<AdminRole, string> = {
  founder: 'bg-purple-100 text-purple-700',
  admin: 'bg-[#EAF1FF] text-[#3B5BFF]',
  moderator: 'bg-emerald-100 text-emerald-700',
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
  open: boolean;
  onClose: () => void;
  onAdd: (row: Omit<AdminUserRow, 'id' | 'created_at'>) => Promise<void>;
}> = ({ open, onClose, onAdd }) => {
  const dialog = useDialog();
  const [telegramId, setTelegramId] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<AdminRole>('moderator');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(telegramId.trim(), 10);
    if (isNaN(id)) { await dialog.warning('Telegram ID должен быть числом'); return; }
    setSaving(true);
    await onAdd({ telegram_id: id, telegram_username: username.replace('@', '') || undefined, name, role });
    setSaving(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="👤"
      label="Сотрудник"
      title="Добавить сотрудника"
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <Input
          type="number"
          label="Telegram ID *"
          value={telegramId}
          onChange={e => setTelegramId(e.target.value)}
          placeholder="123456789"
          hint="Узнать ID можно у бота @userinfobot"
          required
        />
        <Input
          type="text"
          label="Имя *"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Иван Иванов"
          required
        />
        <Input
          type="text"
          label="Username (необязательно)"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="@username"
        />
        <div>
          <label className="block text-xs text-gray-500 mb-1">Роль</label>
          <select value={role} onChange={e => setRole(e.target.value as AdminRole)}
            className="w-full px-3 py-2.5 text-sm bg-white border border-[#E1E5EC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]/20 focus:border-[#3B5BFF]">
            <option value="admin">Администратор — полный доступ</option>
            <option value="moderator">Модератор — доступ к заявкам</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={saving}
            leftIcon={!saving ? <Plus className="w-4 h-4" /> : undefined}
          >
            {saving ? 'Сохраняем...' : 'Добавить'}
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const Administrators: React.FC = () => {
  const dialog = useDialog();
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
      await dialog.warning('Нельзя удалить основателя');
      return;
    }
    const ok = await dialog.confirm(`Удалить ${row.name}?`, 'Доступ к админ-панели будет отозван.', { confirmLabel: 'Удалить', cancelLabel: 'Отмена' });
    if (!ok) return;
    await removeAdminUser(row.telegram_id);
    setAdmins(prev => prev.filter(a => a.telegram_id !== row.telegram_id));
  };

  const handleRoleChange = async (row: AdminUserRow, role: AdminRole) => {
    if (FOUNDER_IDS.includes(String(row.telegram_id))) {
      await dialog.warning('Нельзя изменить роль основателя');
      return;
    }
    await updateAdminRole(row.telegram_id, role);
    setAdmins(prev => prev.map(a => a.telegram_id === row.telegram_id ? { ...a, role } : a));
  };

  const counts = { founder: 0, admin: 0, moderator: 0 };
  admins.forEach(a => counts[a.role]++);
  FOUNDER_IDS.forEach(() => counts.founder++);

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-6 md:mb-8">
        <div className="min-w-0">
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36] mb-1">Сотрудники</h1>
          <p className="text-sm text-[#0F2A36]/60">Управление доступом к админ-панели</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-[#0F2A36]/45" />}
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            title="Обновить"
            leftIcon={<RefreshCw size={16} />}
          >
            <span className="sr-only">Обновить</span>
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowAdd(true)}
            leftIcon={<Plus size={16} />}
          >
            Добавить
          </Button>
        </div>
      </div>

      {/* Stats — на мобилке layout column'ом, чтобы длинные подписи
          (Администраторы, Модераторы) не обрезались. */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(['founder', 'admin', 'moderator'] as AdminRole[]).map(role => (
          <Card key={role} variant="flat" padding="md" radius="xl" className="flex flex-col items-start gap-2 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ROLE_COLORS[role]}`}>
              {ROLE_ICON[role]}
            </div>
            <div className="min-w-0 w-full">
              <p className="text-[11px] text-[#0F2A36]/60 leading-tight break-words">{ROLE_LABELS_PLURAL[role]}</p>
              <p className="text-2xl font-semibold text-[#0F2A36] leading-tight mt-0.5">{counts[role]}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Founders row (from env var) */}
      {FOUNDER_IDS.length > 0 && (
        <Card variant="flat" padding="none" radius="xl" className="overflow-hidden mb-4">
          <div className="px-4 md:px-5 py-3 bg-purple-50 border-b border-purple-100">
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Основатели (защищены)</p>
          </div>
          {FOUNDER_IDS.map(id => (
            <div key={id} className="px-4 md:px-5 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#0F2A36] truncate">Telegram ID: {id}</p>
                <p className="text-xs text-[#0F2A36]/45">Настроен через Vercel ENV</p>
              </div>
              <Badge variant="neutral" className="bg-purple-100 text-purple-700 shrink-0 whitespace-nowrap">
                {ROLE_ICON.founder} {ROLE_LABELS.founder}
              </Badge>
            </div>
          ))}
        </Card>
      )}

      {/* Admins table — обёрнута в overflow-x-auto чтобы на узких экранах
          таблица скроллилась горизонтально, а не уходила за край. */}
      <Card variant="flat" padding="none" radius="xl" className="overflow-hidden">
        {admins.length === 0 && !loading ? (
          <EmptyState
            icon={<User className="w-6 h-6 text-[#3B5BFF]" />}
            title="Сотрудники не добавлены"
            subtitle="Нажмите «Добавить» чтобы выдать доступ"
          />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b border-[#E1E5EC]">
              <tr>
                <th className="px-4 md:px-5 py-3 text-left text-xs text-[#0F2A36]/60 font-medium">Имя</th>
                <th className="px-4 md:px-5 py-3 text-left text-xs text-[#0F2A36]/60 font-medium">Telegram ID</th>
                <th className="px-4 md:px-5 py-3 text-left text-xs text-[#0F2A36]/60 font-medium">Роль</th>
                <th className="px-4 md:px-5 py-3 text-left text-xs text-[#0F2A36]/60 font-medium">Добавлен</th>
                <th className="px-4 md:px-5 py-3 text-left text-xs text-[#0F2A36]/60 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {admins.map(row => (
                <tr key={row.telegram_id} className="hover:bg-gray-50">
                  <td className="px-4 md:px-5 py-4">
                    <p className="text-sm font-medium text-[#0F2A36]">{row.name}</p>
                    {row.telegram_username && (
                      <p className="text-xs text-[#0F2A36]/45">@{row.telegram_username}</p>
                    )}
                  </td>
                  <td className="px-4 md:px-5 py-4 text-sm text-[#0F2A36]/65 whitespace-nowrap">{row.telegram_id}</td>
                  <td className="px-4 md:px-5 py-4">
                    <select
                      value={row.role}
                      onChange={e => handleRoleChange(row, e.target.value as AdminRole)}
                      disabled={FOUNDER_IDS.includes(String(row.telegram_id))}
                      className="px-3 py-1.5 text-sm bg-white border border-[#E1E5EC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]/20 focus:border-[#3B5BFF] disabled:opacity-50"
                    >
                      <option value="admin">Администратор</option>
                      <option value="moderator">Модератор</option>
                    </select>
                  </td>
                  <td className="px-4 md:px-5 py-4 text-sm text-[#0F2A36]/45 whitespace-nowrap">
                    {row.created_at ? new Date(row.created_at).toLocaleDateString('ru-RU') : '—'}
                  </td>
                  <td className="px-4 md:px-5 py-4">
                    <button
                      onClick={() => handleDelete(row)}
                      disabled={FOUNDER_IDS.includes(String(row.telegram_id))}
                      className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      <AddAdminModal open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAdd} />
    </div>
  );
};
