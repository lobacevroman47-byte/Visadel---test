import { Trophy, Upload, CheckCircle } from 'lucide-react';

export default function TasksTab() {
  const tasks = [
    {
      id: 1,
      title: 'Подписаться на Telegram канал',
      description: 'Подпишитесь на наш канал и получите 100₽ на счёт',
      reward: 100,
      completed: true,
      icon: '📱',
    },
    {
      id: 2,
      title: 'Подписаться на Instagram',
      description: 'Подпишитесь на наш Instagram и получите 50₽',
      reward: 50,
      completed: false,
      icon: '📸',
    },
    {
      id: 3,
      title: 'Оставить отзыв',
      description: 'Оставьте отзыв о нашем сервисе и получите 100₽',
      reward: 100,
      completed: false,
      icon: '⭐',
    },
    {
      id: 4,
      title: 'Пригласить друга',
      description: 'Пригласите друга и получите 300₽ после его первого заказа',
      reward: 300,
      completed: false,
      icon: '👥',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-1">Задания</h2>
          <p className="text-gray-600 text-sm">Выполняйте задания и получайте бонусы</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Доступно бонусов</p>
          <p className="text-orange-600 text-2xl">
            {tasks.filter(t => !t.completed).reduce((sum, t) => sum + t.reward, 0)}₽
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {tasks.map((task) => (
          <div 
            key={task.id} 
            className={`bg-white rounded-xl border border-gray-200 p-4 ${
              task.completed ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{task.icon}</span>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="mb-1">{task.title}</h3>
                    <p className="text-gray-600 text-sm">{task.description}</p>
                  </div>
                  {task.completed ? (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                      <CheckCircle className="w-4 h-4" />
                      <span>Выполнено</span>
                    </div>
                  ) : (
                    <div className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full">
                      +{task.reward}₽
                    </div>
                  )}
                </div>

                {!task.completed && (
                  <div className="mt-4 flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      <Trophy className="w-4 h-4" />
                      <span className="text-sm">Выполнить</span>
                    </button>
                    {task.id === 2 && (
                      <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                        <Upload className="w-4 h-4" />
                        <span className="text-sm">Загрузить скриншот</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 rounded-xl p-4">
        <h3 className="text-blue-900 mb-2">💡 Как это работает?</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Выполняйте задания и получайте бонусы на счёт</li>
          <li>• Используйте бонусы для оплаты виз</li>
          <li>• Чем больше заданий — тем больше скидка!</li>
        </ul>
      </div>
    </div>
  );
}
