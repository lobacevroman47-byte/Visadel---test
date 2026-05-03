import React, { useState } from 'react';
import { FileText, Users, Globe, TrendingUp } from 'lucide-react';
import { mockApplications, mockUsers, statusLabels } from '../data/mockData';

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  onClick?: () => void;
}> = ({ icon, label, value, color, onClick }) => {
  return (
    <div 
      className={`bg-white p-6 rounded-xl border border-gray-200 transition-all ${onClick ? 'cursor-pointer hover:shadow-lg hover:border-[#2196F3]' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-2xl">{value}</p>
        </div>
        <div className={`p-3 rounded-lg`} style={{ backgroundColor: color + '20' }}>
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
    </div>
  );
};

interface DashboardProps {
  onNavigate?: (section: string, filter?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [revenueFilter, setRevenueFilter] = useState<'1h' | '1d' | '1w' | '30d' | '3m' | '6m' | '1y'>('30d');

  const totalApplications = mockApplications.length;
  const inProgressApplications = mockApplications.filter(app => app.status === 'in_progress').length;
  const totalUsers = mockUsers.filter(user => user.status === 'regular').length;
  const partnersCount = mockUsers.filter(user => user.status === 'partner').length;
  
  const totalRevenue = mockApplications
    .filter(app => app.status !== 'draft')
    .reduce((sum, app) => sum + app.cost, 0);

  const recentApplications = mockApplications.slice(0, 10);
  
  // Новые пользователи за последние 24 часа (обычные + партнёры)
  const newUsers24h = mockUsers.filter(user => {
    const userDate = new Date(user.registeredAt);
    const now = new Date();
    const diff = now.getTime() - userDate.getTime();
    return diff < 24 * 60 * 60 * 1000;
  });

  // Генерация данных для мини-графика выручки
  const generateRevenueData = () => {
    const data = [];
    const now = new Date();
    let days = 30;
    
    switch(revenueFilter) {
      case '1h': days = 1; break;
      case '1d': days = 1; break;
      case '1w': days = 7; break;
      case '30d': days = 30; break;
      case '3m': days = 90; break;
      case '6m': days = 180; break;
      case '1y': days = 365; break;
    }

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Подсчёт заявок за этот день
      const dayApplications = mockApplications.filter(app => {
        const appDate = new Date(app.date);
        return appDate.toDateString() === date.toDateString() && app.status !== 'draft';
      });
      
      const dayRevenue = dayApplications.reduce((sum, app) => sum + app.cost, 0);
      
      data.push({
        date: date.toLocaleDateString('ru-RU'),
        revenue: dayRevenue
      });
    }
    
    return data;
  };

  const generateRevenueDataForPeriod = (period: '1h' | '1d' | '1w' | '30d' | '3m' | '6m' | '1y') => {
    const data = [];
    const now = new Date();
    let days = 30;
    
    switch(period) {
      case '1h': days = 1; break;
      case '1d': days = 1; break;
      case '1w': days = 7; break;
      case '30d': days = 30; break;
      case '3m': days = 90; break;
      case '6m': days = 180; break;
      case '1y': days = 365; break;
    }

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Подсчёт заявок за этот день
      const dayApplications = mockApplications.filter(app => {
        const appDate = new Date(app.date);
        return appDate.toDateString() === date.toDateString() && app.status !== 'draft';
      });
      
      const dayRevenue = dayApplications.reduce((sum, app) => sum + app.cost, 0);
      
      data.push({
        date: date.toLocaleDateString('ru-RU'),
        revenue: dayRevenue
      });
    }
    
    return data;
  };

  const revenueData = generateRevenueData();
  const periodRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="p-8">
      <h1 className="mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={<FileText size={24} />}
          label="Всего заявок"
          value={totalApplications}
          color="#2196F3"
          onClick={() => onNavigate?.('applications', { filter: 'all' })}
        />
        <StatCard
          icon={<TrendingUp size={24} />}
          label="В работе"
          value={inProgressApplications}
          color="#FF9800"
          onClick={() => onNavigate?.('applications', { filter: 'in_progress' })}
        />
        <StatCard
          icon={<Users size={24} />}
          label="Пользователи"
          value={totalUsers}
          color="#00C853"
          onClick={() => onNavigate?.('users', { filter: 'regular' })}
        />
        <StatCard
          icon={<Globe size={24} />}
          label="Партнёры"
          value={partnersCount}
          color="#9C27B0"
          onClick={() => onNavigate?.('users', { filter: 'partners' })}
        />
      </div>

      {/* Revenue Widget and New Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* New Users in 24h - LEFT */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <Users size={20} className="text-blue-600" />
            </div>
            <h3>Новые пользователи за 24 часа</h3>
          </div>
          <p className="text-3xl mb-4">{newUsers24h.length}</p>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {newUsers24h.map(user => (
              <div 
                key={user.id} 
                className="flex items-center justify-between p-3 bg-[#F5F7FA] rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div 
                    className={`w-3 h-3 rounded-full ${
                      user.status === 'partner' ? 'bg-purple-500' : 'bg-green-500'
                    }`}
                    title={user.status === 'partner' ? 'Партнёр' : 'Обычный пользователь'}
                  />
                  <div className="flex-1">
                    <p className="text-sm">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {new Date(user.registeredAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    user.status === 'partner' 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {user.status === 'partner' ? 'Партнёр' : 'Обычный'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Widget - RIGHT - Improved Structure */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-green-100">
              <TrendingUp size={20} className="text-green-600" />
            </div>
            <h3>Общая выручка</h3>
          </div>

          {/* Timeframe Grid - All visible with labels */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[
              { period: '1 час', value: '1h' },
              { period: '1 день', value: '1d' },
              { period: '1 неделя', value: '1w' },
              { period: '30 дней', value: '30d' },
              { period: '3 месяца', value: '3m' },
              { period: '6 месяцев', value: '6m' },
              { period: '1 год', value: '1y' }
            ].map((filter, index) => {
              const filterData = generateRevenueDataForPeriod(filter.value as any);
              const filterRevenue = filterData.reduce((sum, d) => sum + d.revenue, 0);
              const isActive = revenueFilter === filter.value;
              
              return (
                <button
                  key={filter.value}
                  onClick={() => setRevenueFilter(filter.value as any)}
                  className={`p-3 rounded-lg text-left transition-all ${
                    index === 6 ? 'col-span-4' : ''
                  } ${
                    isActive
                      ? 'bg-[#2196F3] text-white shadow-md'
                      : 'bg-[#F5F7FA] text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <p className={`text-xs mb-1 ${isActive ? 'text-white opacity-90' : 'text-gray-500'}`}>
                    {filter.period}
                  </p>
                  <p className={`text-sm ${isActive ? 'font-bold' : ''}`}>
                    {filterRevenue.toLocaleString('ru-RU')} ₽
                  </p>
                </button>
              );
            })}
          </div>

          {/* Selected Period - Large Display */}
          <div className="bg-gradient-to-br from-[#2196F3] to-[#1565C0] p-5 rounded-lg mb-4">
            <p className="text-sm text-white opacity-80 mb-2">
              Выбран период: {
                revenueFilter === '1h' ? '1 час' :
                revenueFilter === '1d' ? '1 день' :
                revenueFilter === '1w' ? '1 неделя' :
                revenueFilter === '30d' ? '30 дней' :
                revenueFilter === '3m' ? '3 месяца' :
                revenueFilter === '6m' ? '6 месяцев' : '1 год'
              }
            </p>
            <p className="text-3xl text-white">{periodRevenue.toLocaleString('ru-RU')} ₽</p>
          </div>

          {/* Mini Chart */}
          <div className="bg-[#F5F7FA] p-4 rounded-lg">
            <p className="text-xs text-gray-600 mb-3">График выручки за период</p>
            <div className="h-20 flex items-end gap-0.5">
              {revenueData.slice(-30).map((data, index) => {
                const maxRevenue = Math.max(...revenueData.map(d => d.revenue), 1);
                const height = (data.revenue / maxRevenue) * 100;
                return (
                  <div
                    key={index}
                    className="flex-1 bg-[#2196F3] hover:bg-[#1565C0] rounded-t transition-all cursor-pointer"
                    style={{ height: `${height}%` || '2%', minHeight: '3px' }}
                    title={`${data.date}: ${data.revenue.toLocaleString('ru-RU')} ₽`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Applications - 10 заявок */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3>Последние 10 заявок</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F7FA]">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-600">ID</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Страна</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Клиент</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Стоимость</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Статус</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">Дата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentApplications.map((app) => (
                <tr key={app.id} className="hover:bg-[#F5F7FA]">
                  <td className="px-6 py-4 text-sm">{app.id}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="mr-2">{app.countryFlag}</span>
                    {app.country}
                  </td>
                  <td className="px-6 py-4 text-sm">{app.clientName}</td>
                  <td className="px-6 py-4 text-sm">{app.cost.toLocaleString('ru-RU')} ₽</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-2 py-1 bg-[#F5F7FA] rounded text-xs">
                      {statusLabels[app.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(app.date).toLocaleDateString('ru-RU')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};