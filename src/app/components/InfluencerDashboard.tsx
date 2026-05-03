import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  DollarSign, 
  ExternalLink,
  CreditCard,
  Building2,
  User,
  Link as LinkIcon,
  Save
} from 'lucide-react';

interface InfluencerStats {
  clicks: number;
  applications: number;
  paidApplications: number;
  totalEarnings: number;
  pendingEarnings: number;
}

interface InfluencerProfile {
  cardNumber: string;
  bankName: string;
  entityType: 'ip' | 'self_employed' | 'individual';
  resourceLink: string;
  resourceType: string;
}

interface InfluencerDashboardProps {
  onBack: () => void;
}

export default function InfluencerDashboard({ onBack }: InfluencerDashboardProps) {
  const [stats, setStats] = useState<InfluencerStats>({
    clicks: 0,
    applications: 0,
    paidApplications: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
  });

  const [profile, setProfile] = useState<InfluencerProfile>({
    cardNumber: '',
    bankName: '',
    entityType: 'individual',
    resourceLink: '',
    resourceType: 'youtube',
  });

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    // Load stats from localStorage
    const savedStats = localStorage.getItem('influencerStats');
    if (savedStats) {
      setStats(JSON.parse(savedStats));
    } else {
      // Demo data
      setStats({
        clicks: 245,
        applications: 18,
        paidApplications: 12,
        totalEarnings: 24500,
        pendingEarnings: 3500,
      });
    }

    // Load profile from localStorage
    const savedProfile = localStorage.getItem('influencerProfile');
    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    }
  }, []);

  const handleSaveProfile = () => {
    if (!profile.cardNumber.trim()) {
      alert('Укажите номер карты');
      return;
    }
    if (!profile.bankName.trim()) {
      alert('Укажите название банка');
      return;
    }
    if (!profile.resourceLink.trim()) {
      alert('Укажите ссылку на ваш ресурс');
      return;
    }

    localStorage.setItem('influencerProfile', JSON.stringify(profile));
    setIsEditingProfile(false);
    alert('Профиль сохранен!');
  };

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      alert('Укажите корректную сумму');
      return;
    }

    if (amount > stats.totalEarnings) {
      alert('Недостаточно средств для вывода');
      return;
    }

    if (!profile.cardNumber || !profile.bankName) {
      alert('Сначала заполните данные для вывода в настройках профиля');
      return;
    }

    // Process withdrawal
    const newEarnings = stats.totalEarnings - amount;
    const newStats = { ...stats, totalEarnings: newEarnings };
    setStats(newStats);
    localStorage.setItem('influencerStats', JSON.stringify(newStats));
    
    setWithdrawAmount('');
    alert(`Заявка на вывод ${amount}₽ отправлена! Средства поступят на карту в течение 1-3 рабочих дней.`);
  };

  const entityTypeLabels = {
    ip: 'ИП',
    self_employed: 'Самозанятый',
    individual: 'Физическое лицо',
  };

  const resourceTypeLabels = {
    youtube: 'YouTube канал',
    telegram: 'Telegram канал',
    instagram: 'Instagram',
    vk: 'VK',
    other: 'Другое',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white p-6 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-4 max-w-2xl mx-auto">
          <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-full transition">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl mb-1">Партнёрский кабинет</h1>
            <p className="text-purple-100 text-sm">Статистика и управление выплатами</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl shadow-md p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Переходы</p>
                <p className="text-xl text-gray-800">{stats.clicks}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-yellow-100 p-2 rounded-lg">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Заявки</p>
                <p className="text-xl text-gray-800">{stats.applications}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Оплачено</p>
                <p className="text-xl text-gray-800">{stats.paidApplications}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-purple-100 p-2 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Конверсия</p>
                <p className="text-xl text-gray-800">
                  {stats.clicks > 0 ? ((stats.paidApplications / stats.clicks) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Earnings Card */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-2xl p-6 text-white shadow-lg">
          <h3 className="text-lg mb-4">Заработок</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-purple-100">Доступно к выводу:</span>
              <span className="text-3xl">{stats.totalEarnings}₽</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-purple-100 text-sm">В обработке:</span>
              <span className="text-lg">{stats.pendingEarnings}₽</span>
            </div>
          </div>
        </div>

        {/* Withdrawal Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg text-gray-800 mb-4">Вывод средств</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block mb-2 text-gray-700">Сумма вывода (₽)</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="form-input"
                placeholder="Введите сумму"
              />
              <p className="text-xs text-gray-500 mt-1">
                Доступно: {stats.totalEarnings}₽
              </p>
            </div>

            <button
              onClick={handleWithdraw}
              disabled={!profile.cardNumber || !profile.bankName}
              className={`w-full py-4 rounded-xl hover:shadow-lg transition flex items-center justify-center gap-2 ${
                profile.cardNumber && profile.bankName
                  ? 'bg-gradient-to-r from-green-600 to-emerald-500 text-white'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              <DollarSign className="w-5 h-5" />
              Вывести средства
            </button>

            {(!profile.cardNumber || !profile.bankName) && (
              <p className="text-xs text-red-600 text-center">
                Сначала заполните данные для вывода ниже
              </p>
            )}
          </div>
        </div>

        {/* Profile Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg text-gray-800">Данные для вывода</h3>
            {!isEditingProfile ? (
              <button
                onClick={() => setIsEditingProfile(true)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Редактировать
              </button>
            ) : null}
          </div>

          {!isEditingProfile ? (
            <div className="space-y-3">
              {profile.cardNumber ? (
                <>
                  <div className="flex items-start gap-3 border-b pb-3">
                    <CreditCard className="w-5 h-5 text-gray-600 mt-1" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">Номер карты</p>
                      <p className="text-gray-800">{profile.cardNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 border-b pb-3">
                    <Building2 className="w-5 h-5 text-gray-600 mt-1" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">Банк</p>
                      <p className="text-gray-800">{profile.bankName}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 border-b pb-3">
                    <User className="w-5 h-5 text-gray-600 mt-1" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">Статус</p>
                      <p className="text-gray-800">{entityTypeLabels[profile.entityType]}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <LinkIcon className="w-5 h-5 text-gray-600 mt-1" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">{resourceTypeLabels[profile.resourceType]}</p>
                      <a 
                        href={profile.resourceLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 text-sm break-all flex items-center gap-1"
                      >
                        {profile.resourceLink}
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-600 mb-3">Данные не заполнены</p>
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    Заполнить
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-gray-700">
                  Номер карты <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={profile.cardNumber}
                  onChange={(e) => setProfile({ ...profile, cardNumber: e.target.value })}
                  className="form-input"
                  placeholder="0000 0000 0000 0000"
                />
              </div>

              <div>
                <label className="block mb-2 text-gray-700">
                  Название банка <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={profile.bankName}
                  onChange={(e) => setProfile({ ...profile, bankName: e.target.value })}
                  className="form-input"
                  placeholder="Например: Сбербанк, Тинькофф"
                />
              </div>

              <div>
                <label className="block mb-2 text-gray-700">
                  Статус <span className="text-red-500">*</span>
                </label>
                <select
                  value={profile.entityType}
                  onChange={(e) => setProfile({ ...profile, entityType: e.target.value as any })}
                  className="form-input"
                >
                  <option value="individual">Физическое лицо</option>
                  <option value="self_employed">Самозанятый</option>
                  <option value="ip">ИП</option>
                </select>
              </div>

              <div>
                <label className="block mb-2 text-gray-700">
                  Тип ресурса <span className="text-red-500">*</span>
                </label>
                <select
                  value={profile.resourceType}
                  onChange={(e) => setProfile({ ...profile, resourceType: e.target.value })}
                  className="form-input"
                >
                  <option value="youtube">YouTube канал</option>
                  <option value="telegram">Telegram канал</option>
                  <option value="instagram">Instagram</option>
                  <option value="vk">VK</option>
                  <option value="other">Другое</option>
                </select>
              </div>

              <div>
                <label className="block mb-2 text-gray-700">
                  Ссылка на ресурс <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={profile.resourceLink}
                  onChange={(e) => setProfile({ ...profile, resourceLink: e.target.value })}
                  className="form-input"
                  placeholder="https://..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setIsEditingProfile(false);
                    // Reload from localStorage
                    const savedProfile = localStorage.getItem('influencerProfile');
                    if (savedProfile) {
                      setProfile(JSON.parse(savedProfile));
                    }
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveProfile}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Сохранить
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="text-gray-800 mb-2">💡 Информация</h4>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Вознаграждение начисляется за оплаченные заявки</li>
            <li>• Минимальная сумма вывода: 500₽</li>
            <li>• Выплаты обрабатываются в течение 1-3 рабочих дней</li>
          </ul>
        </div>
      </div>
    </div>
  );
}