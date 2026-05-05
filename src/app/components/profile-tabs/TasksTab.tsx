import { useState, useEffect } from 'react';
import { ListTodo, Upload, CheckCircle, Clock, X } from 'lucide-react';

interface Task {
  id: string;
  type: 'subscribe' | 'like' | 'comment' | 'view';
  platform: string;
  description: string;
  reward: number;
  link: string;
  status: 'available' | 'pending' | 'completed' | 'rejected';
  screenshot?: string;
}

const INITIAL_TASKS: Task[] = [
  {
    id: '1',
    type: 'subscribe',
    platform: 'Telegram',
    description: 'Подписаться на наш Telegram канал',
    reward: 10,
    link: 'https://t.me/visadelagency',
    status: 'available',
  },
  {
    id: '2',
    type: 'like',
    platform: 'Instagram',
    description: 'Поставить лайк на последний пост в Instagram',
    reward: 5,
    link: 'https://instagram.com/visadelagency',
    status: 'available',
  },
  {
    id: '3',
    type: 'subscribe',
    platform: 'YouTube',
    description: 'Подписаться на YouTube канал',
    reward: 10,
    link: 'https://youtube.com/@visadelagency',
    status: 'available',
  },
  {
    id: '4',
    type: 'view',
    platform: 'YouTube',
    description: 'Посмотреть видео "Как оформить визу в Индию"',
    reward: 3,
    link: 'https://youtube.com/watch?v=example',
    status: 'available',
  },
  {
    id: '5',
    type: 'subscribe',
    platform: 'VK',
    description: 'Подписаться на группу VK',
    reward: 8,
    link: 'https://vk.com/visadelagency',
    status: 'available',
  },
  {
    id: '6',
    type: 'comment',
    platform: 'Instagram',
    description: 'Оставить комментарий под последним постом',
    reward: 7,
    link: 'https://instagram.com/visadelagency',
    status: 'available',
  },
];

const TYPE_ICONS = {
  subscribe: '👤',
  like: '❤️',
  comment: '💬',
  view: '👁️',
};

export default function TasksTab() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  useEffect(() => {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    } else {
      setTasks(INITIAL_TASKS);
      localStorage.setItem('tasks', JSON.stringify(INITIAL_TASKS));
    }
  }, []);

  const handleSubmitTask = (taskId: string) => {
    if (!screenshot) {
      alert('Пожалуйста, загрузите скриншот выполненного задания');
      return;
    }

    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        return { ...task, status: 'pending' as const, screenshot: screenshot.name };
      }
      return task;
    });

    setTasks(updatedTasks);
    localStorage.setItem('tasks', JSON.stringify(updatedTasks));
    setScreenshot(null);
    setSelectedTask(null);
    alert('Задание отправлено на проверку! Бонусы будут начислены после подтверждения администратором.');
  };

  const availableTasks = tasks.filter(t => t.status === 'available');
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <ListTodo className="w-8 h-8" />
          <h3 className="text-xl">Задания</h3>
        </div>
        <p className="text-purple-100 text-sm mb-4">
          Выполняйте задания и получайте бонусы от 1 до 10₽
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/20 rounded-lg p-3 backdrop-blur-sm text-center">
            <p className="text-2xl mb-1">{availableTasks.length}</p>
            <p className="text-xs text-purple-100">Доступно</p>
          </div>
          <div className="bg-white/20 rounded-lg p-3 backdrop-blur-sm text-center">
            <p className="text-2xl mb-1">{pendingTasks.length}</p>
            <p className="text-xs text-purple-100">На проверке</p>
          </div>
          <div className="bg-white/20 rounded-lg p-3 backdrop-blur-sm text-center">
            <p className="text-2xl mb-1">{completedTasks.length}</p>
            <p className="text-xs text-purple-100">Выполнено</p>
          </div>
        </div>
      </div>

      {/* Available Tasks */}
      {availableTasks.length > 0 && (
        <div>
          <h3 className="text-lg text-gray-800 mb-3">Доступные задания</h3>
          <div className="space-y-3">
            {availableTasks.map((task) => (
              <div key={task.id} className="bg-white rounded-xl shadow-md p-4 border-l-4 border-[#5C7BFF]">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-2xl">{TYPE_ICONS[task.type]}</span>
                    <div className="flex-1">
                      <h4 className="text-gray-800 mb-1">{task.description}</h4>
                      <p className="text-sm text-gray-500">{task.platform}</p>
                    </div>
                  </div>
                  <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                    +{task.reward}₽
                  </div>
                </div>

                {selectedTask === task.id ? (
                  <div className="mt-4 space-y-3">
                    <a
                      href={task.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full bg-[#3B5BFF] hover:bg-[#4F2FE6] text-white py-2 rounded-lg transition text-sm text-center"
                    >
                      Открыть ссылку
                    </a>

                    {!screenshot ? (
                      <label className="block border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-[#5C7BFF] hover:bg-[#EAF1FF] transition">
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="w-6 h-6 text-gray-400" />
                          <p className="text-sm text-gray-600">Загрузить скриншот</p>
                        </div>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setScreenshot(file);
                          }}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="border-2 border-green-500 bg-green-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="text-sm text-gray-800">{screenshot.name}</span>
                          </div>
                          <button
                            onClick={() => setScreenshot(null)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedTask(null);
                          setScreenshot(null);
                        }}
                        className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition text-sm"
                      >
                        Отмена
                      </button>
                      <button
                        onClick={() => handleSubmitTask(task.id)}
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition text-sm"
                      >
                        Отправить
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedTask(task.id)}
                    className="w-full mt-3 bg-[#EAF1FF] text-[#3B5BFF] py-2 rounded-lg hover:bg-[#DCE7FF] transition text-sm font-semibold"
                  >
                    Выполнить задание
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <div>
          <h3 className="text-lg text-gray-800 mb-3">На проверке</h3>
          <div className="space-y-3">
            {pendingTasks.map((task) => (
              <div key={task.id} className="bg-white rounded-xl shadow-md p-4 border-l-4 border-yellow-400">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3 flex-1">
                    <Clock className="w-6 h-6 text-yellow-600" />
                    <div className="flex-1">
                      <h4 className="text-gray-800 mb-1">{task.description}</h4>
                      <p className="text-sm text-gray-500">{task.platform}</p>
                    </div>
                  </div>
                  <div className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm">
                    +{task.reward}₽
                  </div>
                </div>
                <p className="text-sm text-yellow-600 mt-2">Ожидает подтверждения администратором</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div>
          <h3 className="text-lg text-gray-800 mb-3">Выполнено</h3>
          <div className="space-y-3">
            {completedTasks.map((task) => (
              <div key={task.id} className="bg-white rounded-xl shadow-md p-4 border-l-4 border-green-400">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <div className="flex-1">
                      <h4 className="text-gray-800 mb-1">{task.description}</h4>
                      <p className="text-sm text-gray-500">{task.platform}</p>
                    </div>
                  </div>
                  <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                    +{task.reward}₽
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {availableTasks.length === 0 && pendingTasks.length === 0 && (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <p className="text-gray-800">Все задания выполнены!</p>
          <p className="text-sm text-gray-500 mt-1">Следите за новыми заданиями</p>
        </div>
      )}
    </div>
  );
}
