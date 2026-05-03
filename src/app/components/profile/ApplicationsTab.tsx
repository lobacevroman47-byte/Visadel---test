import { FileText, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';

export default function ApplicationsTab() {
  // Mock данные - в реальном приложении будут из базы
  const applications = [
    {
      id: '12345',
      country: 'Индия',
      flag: '🇮🇳',
      visa: 'E-VISA 30 дней',
      status: 'completed',
      statusLabel: 'Выполнено',
      date: '15 ноября 2024',
      price: 5490,
    },
    {
      id: '12346',
      country: 'Вьетнам',
      flag: '🇻🇳',
      visa: 'E-VISA 90 дней',
      status: 'processing',
      statusLabel: 'В обработке',
      date: '28 ноября 2024',
      price: 5490,
    },
    {
      id: '12347',
      country: 'Южная Корея',
      flag: '🇰🇷',
      visa: 'K-ETA 3 года',
      status: 'draft',
      statusLabel: 'Черновик',
      date: '29 ноября 2024',
      price: 3490,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'processing':
        return 'bg-blue-100 text-blue-700';
      case 'draft':
        return 'bg-gray-100 text-gray-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5" />;
      case 'processing':
        return <Clock className="w-5 h-5" />;
      case 'draft':
        return <FileText className="w-5 h-5" />;
      case 'rejected':
        return <XCircle className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2>Мои заявки</h2>
        <p className="text-gray-600">{applications.length} заявок</p>
      </div>

      {applications.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">У вас пока нет заявок</p>
          <p className="text-gray-500 text-sm">Начните оформление визы прямо сейчас!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div key={app.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{app.flag}</span>
                  <div>
                    <h3 className="text-lg mb-1">{app.country}</h3>
                    <p className="text-gray-600 text-sm">{app.visa}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${getStatusColor(app.status)}`}>
                  {getStatusIcon(app.status)}
                  <span>{app.statusLabel}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div>
                  <p className="text-sm text-gray-600">Заявка #{app.id}</p>
                  <p className="text-sm text-gray-600">{app.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-blue-600">{app.price}₽</p>
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                    <Eye className="w-4 h-4" />
                    <span className="text-sm">Подробнее</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
