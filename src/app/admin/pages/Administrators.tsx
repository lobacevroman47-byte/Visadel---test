import React, { useState } from 'react';
import { Plus, Ban, Trash2, X } from 'lucide-react';
import { mockAdministrators, Administrator, roleLabels } from '../data/mockData';
import { useAdmin } from '../contexts/AdminContext';

const AddAdminModal: React.FC<{
  onClose: () => void;
  onAdd: (admin: Omit<Administrator, 'id' | 'addedDate'>) => void;
}> = ({ onClose, onAdd }) => {
  const [telegram, setTelegram] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'manager'>('manager');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      name,
      telegram,
      role,
      status: 'active'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2>Добавить администратора</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-2">Имя</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              placeholder="Иван Иванов"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Telegram @username</label>
            <input
              type="text"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              placeholder="@username"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Роль</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'manager')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
            >
              <option value="admin">Администратор</option>
              <option value="manager">Менеджер</option>
            </select>
            <p className="text-xs text-gray-500 mt-2">
              {role === 'admin' 
                ? 'Полный доступ к заявкам, пользователям, странам и анкетам'
                : 'Доступ только к заявкам и их обработке'}
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-lg transition-colors"
            >
              Добавить
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const Administrators: React.FC = () => {
  const { currentUser, hasPermission } = useAdmin();
  const [administrators, setAdministrators] = useState(mockAdministrators);
  const [showAddModal, setShowAddModal] = useState(false);

  const isOwner = currentUser?.role === 'owner';

  const handleAddAdmin = (admin: Omit<Administrator, 'id' | 'addedDate'>) => {
    const newAdmin: Administrator = {
      ...admin,
      id: `ADM${Date.now()}`,
      addedDate: new Date().toISOString().split('T')[0]
    };
    setAdministrators([...administrators, newAdmin]);
    alert(`Администратор ${admin.name} успешно добавлен`);
  };

  const handleChangeRole = (id: string, newRole: 'owner' | 'admin' | 'manager') => {
    if (!isOwner) {
      alert('Только владелец может менять роли');
      return;
    }
    setAdministrators(administrators.map(admin =>
      admin.id === id ? { ...admin, role: newRole } : admin
    ));
    alert('Роль изменена');
  };

  const handleToggleStatus = (id: string) => {
    setAdministrators(administrators.map(admin =>
      admin.id === id 
        ? { ...admin, status: admin.status === 'active' ? 'blocked' : 'active' }
        : admin
    ));
  };

  const handleDelete = (id: string) => {
    const admin = administrators.find(a => a.id === id);
    if (admin?.role === 'owner') {
      alert('Нельзя удалить владельца');
      return;
    }
    if (!isOwner) {
      alert('Только владелец может удалять администраторов');
      return;
    }
    if (confirm(`Удалить администратора ${admin?.name}?`)) {
      setAdministrators(administrators.filter(a => a.id !== id));
      alert('Администратор удалён');
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="mb-2">Администраторы и роли</h1>
          <p className="text-sm text-gray-600">
            Управление доступом к админ-панели
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Добавить администратора
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gradient-to-br from-[#2196F3] to-[#1565C0] p-6 rounded-xl text-white">
          <p className="text-sm opacity-90 mb-1">Владельцев</p>
          <p className="text-3xl">
            {administrators.filter(a => a.role === 'owner').length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Администраторов</p>
          <p className="text-3xl text-[#2196F3]">
            {administrators.filter(a => a.role === 'admin').length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Менеджеров</p>
          <p className="text-3xl text-[#00C853]">
            {administrators.filter(a => a.role === 'manager').length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F7FA]">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Имя</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Telegram</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Роль</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Дата добавления</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Статус</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {administrators.map((admin) => (
                <tr key={admin.id} className="hover:bg-[#F5F7FA]">
                  <td className="px-6 py-4 text-sm">
                    {admin.name}
                    {admin.id === currentUser?.id && (
                      <span className="ml-2 text-xs text-[#2196F3]">(Вы)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">{admin.telegram}</td>
                  <td className="px-6 py-4 text-sm">
                    {isOwner && admin.role !== 'owner' ? (
                      <select
                        value={admin.role}
                        onChange={(e) => handleChangeRole(admin.id, e.target.value as any)}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
                      >
                        <option value="admin">Администратор</option>
                        <option value="manager">Менеджер</option>
                      </select>
                    ) : (
                      <span className={`px-3 py-1 rounded text-xs ${
                        admin.role === 'owner' 
                          ? 'bg-purple-100 text-purple-700'
                          : admin.role === 'admin'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                      }`}>
                        {roleLabels[admin.role]}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(admin.addedDate).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded text-xs ${
                      admin.status === 'active'
                        ? 'bg-[#00C853] bg-opacity-10 text-[#00C853]'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {admin.status === 'active' ? 'Активен' : 'Заблокирован'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {admin.role !== 'owner' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleStatus(admin.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            admin.status === 'active'
                              ? 'hover:bg-red-50 text-red-600'
                              : 'hover:bg-green-50 text-green-600'
                          }`}
                          title={admin.status === 'active' ? 'Заблокировать' : 'Разблокировать'}
                        >
                          <Ban size={18} />
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => handleDelete(admin.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                            title="Удалить"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Info */}
      <div className="mt-6 bg-white p-6 rounded-xl border border-gray-200">
        <h3 className="mb-4">Права доступа</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <p className="text-sm">Владелец</p>
            </div>
            <ul className="text-xs text-gray-600 space-y-1 ml-5">
              <li>• Полный доступ ко всем разделам</li>
              <li>• Управление администраторами</li>
              <li>• Изменение ролей</li>
              <li>• Настройки системы</li>
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <p className="text-sm">Администратор</p>
            </div>
            <ul className="text-xs text-gray-600 space-y-1 ml-5">
              <li>• Заявки, пользователи</li>
              <li>• Страны и анкеты</li>
              <li>• Бонусная система</li>
              <li>• Без доступа к настройкам</li>
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <p className="text-sm">Менеджер</p>
            </div>
            <ul className="text-xs text-gray-600 space-y-1 ml-5">
              <li>• Только заявки</li>
              <li>• Изменение статусов</li>
              <li>• Загрузка виз</li>
              <li>• Отправка клиентам</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddAdminModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddAdmin}
        />
      )}
    </div>
  );
};
