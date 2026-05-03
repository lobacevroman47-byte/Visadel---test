import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Ban, CheckCircle } from 'lucide-react';
import { mockUsers, User } from '../data/mockData';

interface UsersProps {
  filter?: {
    filter?: 'all' | 'partners' | 'regular';
  };
}

const UserModal: React.FC<{
  user: User;
  onClose: () => void;
}> = ({ user, onClose }) => {
  const [bonusBalance, setBonusBalance] = useState(user.bonusBalance);
  const [status, setStatus] = useState(user.status);
  const [bonusChange, setBonusChange] = useState(0);

  const handleAddBonus = () => {
    if (bonusChange > 0) {
      setBonusBalance(bonusBalance + bonusChange);
      alert(`Добавлено ${bonusChange} бонусов`);
      setBonusChange(0);
    }
  };

  const handleRemoveBonus = () => {
    if (bonusChange > 0 && bonusBalance >= bonusChange) {
      setBonusBalance(bonusBalance - bonusChange);
      alert(`Снято ${bonusChange} бонусов`);
      setBonusChange(0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full">
        <div className="p-6 border-b border-gray-200">
          <h2>Пользователь {user.name}</h2>
        </div>

        <div className="p-6 space-y-6">
          {/* User Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">ФИО</p>
              <p>{user.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Telegram</p>
              <p>{user.telegram}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Телефон</p>
              <p>{user.phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p>{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Дата регистрации</p>
              <p>{new Date(user.registrationDate).toLocaleDateString('ru-RU')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Заявок оформлено</p>
              <p>{user.applicationsCount}</p>
            </div>
          </div>

          {/* Bonus Balance */}
          <div className="p-4 bg-[#F5F7FA] rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-600">Баланс бонусов</span>
              <span className="text-2xl text-[#2196F3]">{bonusBalance} ₽</span>
            </div>
            
            <div className="flex gap-2">
              <input
                type="number"
                value={bonusChange || ''}
                onChange={(e) => setBonusChange(Number(e.target.value))}
                placeholder="Сумма"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              />
              <button
                onClick={handleAddBonus}
                className="px-4 py-2 bg-[#00C853] hover:bg-[#00A344] text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus size={18} />
                Добавить
              </button>
              <button
                onClick={handleRemoveBonus}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Minus size={18} />
                Снять
              </button>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm text-gray-700 mb-2">Статус пользователя</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as User['status'])}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
            >
              <option value="regular">Обычный</option>
              <option value="partner">Партнёр</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                alert('Изменения сохранены');
                onClose();
              }}
              className="flex-1 px-6 py-3 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-lg transition-colors"
            >
              Сохранить изменения
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
          </div>

          {/* Danger Zone */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                if (confirm('Вы уверены, что хотите заблокировать этого пользователя?')) {
                  alert('Пользователь заблокирован');
                  onClose();
                }
              }}
              className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
              <Ban size={18} />
              Заблокировать пользователя
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Users: React.FC<UsersProps> = ({ filter }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Применяем фильтр из Dashboard при первой загрузке
  useEffect(() => {
    if (filter?.filter === 'regular') {
      setStatusFilter('regular');
    } else if (filter?.filter === 'partners') {
      setStatusFilter('partner');
    } else if (filter?.filter === 'all') {
      setStatusFilter('all');
    }
  }, [filter]);

  const filteredUsers = mockUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.telegram.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
        <div className="text-sm text-gray-600">
          Всего: {filteredUsers.length} из {mockUsers.length}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Поиск по имени, Telegram, телефону, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
            >
              <option value="all">Все статусы</option>
              <option value="regular">Обычный</option>
              <option value="partner">Партнёр</option>
            </select>
          </div>
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
                <th className="px-6 py-3 text-left text-xs text-gray-600">Телефон</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Email</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Баланс бонусов</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Статус</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Заявок</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-[#F5F7FA]">
                  <td className="px-6 py-4 text-sm">{user.name}</td>
                  <td className="px-6 py-4 text-sm">{user.telegram}</td>
                  <td className="px-6 py-4 text-sm">{user.phone}</td>
                  <td className="px-6 py-4 text-sm">{user.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="text-[#2196F3]">{user.bonusBalance} ₽</span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      user.status === 'partner' 
                        ? 'bg-[#00C853] bg-opacity-10 text-[#00C853]'
                        : 'bg-[#F5F7FA] text-gray-600'
                    }`}>
                      {user.status === 'partner' ? 'Партнёр' : 'Обычный'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">{user.applicationsCount}</td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="px-4 py-2 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-lg text-sm transition-colors"
                    >
                      Управление
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {selectedUser && (
        <UserModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
};