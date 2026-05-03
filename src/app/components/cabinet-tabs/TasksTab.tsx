import { useState } from 'react';
import { CheckCircle, Upload, ThumbsUp, MessageCircle, Eye, X } from 'lucide-react';

interface Task {
  id: string;
  type: 'subscribe' | 'like' | 'comment' | 'view';
  title: string;
  description: string;
  reward: number;
  completed: boolean;
  pending?: boolean;
}

const initialTasks: Task[] = [
  {
    id: '1',
    type: 'subscribe',
    title: 'Подписаться на Telegram канал',
    description: '@visaexpress_official',
    reward: 5,
    completed: false
  },
  {
    id: '2',
    type: 'like',
    title: 'Поставить лайк на пост',
    description: 'Последний пост в канале',
    reward: 2,
    completed: false
  },
  {
    id: '3',
    type: 'view',
    title: 'Просмотреть видео',
    description: 'Как оформить визу за 5 минут',
    reward: 3,
    completed: false
  },
  {
    id: '4',
    type: 'comment',
    title: 'Оставить комментарий',
    description: 'Расскажите о своем опыте',
    reward: 10,
    completed: false
  },
  {
    id: '5',
    type: 'subscribe',
    title: 'Подписаться на Instagram',
    description: '@visaexpress',
    reward: 5,
    completed: false
  }
];

export default function TasksTab() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  const getTaskIcon = (type: Task['type']) => {
    switch (type) {
      case 'subscribe':
        return CheckCircle;
      case 'like':
        return ThumbsUp;
      case 'comment':
        return MessageCircle;
      case 'view':
        return Eye;
    }
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshot(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitTask = () => {
    if (!screenshot || !selectedTask) {
      alert('Загрузите скриншот выполнения');
      return;
    }

    // Mark task as pending
    setTasks(tasks.map(t => 
      t.id === selectedTask.id ? { ...t, pending: true } : t
    ));

    // Simulate admin approval after 2 seconds
    setTimeout(() => {
      setTasks(tasks.map(t => 
        t.id === selectedTask.id ? { ...t, completed: true, pending: false } : t
      ));
      
      // Add bonus
      const currentBalance = parseInt(localStorage.getItem('bonusBalance') || '0');
      localStorage.setItem('bonusBalance', (currentBalance + selectedTask.reward).toString());
      
      alert(`Задание выполнено! Вы получили +${selectedTask.reward}₽`);
    }, 2000);

    setSelectedTask(null);
    setScreenshot(null);
    setScreenshotPreview(null);
  };

  const totalEarned = tasks.filter(t => t.completed).reduce((sum, t) => sum + t.reward, 0);
  const pendingTasks = tasks.filter(t => t.pending);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
        <h2 className="text-xl mb-4">Ваша статистика</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/20 rounded-xl p-3">
            <p className="text-sm opacity-90 mb-1">Заработано</p>
            <p className="text-2xl">{totalEarned}₽</p>
          </div>
          <div className="bg-white/20 rounded-xl p-3">
            <p className="text-sm opacity-90 mb-1">Выполнено</p>
            <p className="text-2xl">{tasks.filter(t => t.completed).length}/{tasks.length}</p>
          </div>
        </div>
      </div>

      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h3 className="text-yellow-900 mb-2">На проверке: {pendingTasks.length}</h3>
          <p className="text-sm text-yellow-800">
            Ваши задания проверяются администратором. Обычно это занимает несколько минут.
          </p>
        </div>
      )}

      {/* Tasks List */}
      <div className="space-y-3">
        {tasks.map((task) => {
          const Icon = getTaskIcon(task.type);
          
          return (
            <div
              key={task.id}
              className={`bg-white rounded-xl border-2 p-4 transition-all ${
                task.completed
                  ? 'border-green-200 bg-green-50'
                  : task.pending
                  ? 'border-yellow-200 bg-yellow-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  task.completed
                    ? 'bg-green-500 text-white'
                    : task.pending
                    ? 'bg-yellow-500 text-white'
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-gray-900">{task.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      task.completed
                        ? 'bg-green-100 text-green-700'
                        : task.pending
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {task.completed ? 'Выполнено' : task.pending ? 'На проверке' : `+${task.reward}₽`}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                  
                  {!task.completed && !task.pending && (
                    <button
                      onClick={() => setSelectedTask(task)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                    >
                      Выполнить
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Submission Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-gray-900">{selectedTask.title}</h3>
              <button
                onClick={() => {
                  setSelectedTask(null);
                  setScreenshot(null);
                  setScreenshotPreview(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">{selectedTask.description}</p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-900">
                Выполните задание и загрузите скриншот для подтверждения
              </p>
            </div>

            {!screenshotPreview ? (
              <label className="block">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleScreenshotUpload}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-700 mb-1">Загрузите скриншот</p>
                  <p className="text-sm text-gray-500">JPG, PNG</p>
                </div>
              </label>
            ) : (
              <div className="mb-4">
                <img
                  src={screenshotPreview}
                  alt="Screenshot"
                  className="w-full h-48 object-cover rounded-xl mb-2"
                />
                <button
                  onClick={() => {
                    setScreenshot(null);
                    setScreenshotPreview(null);
                  }}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Удалить и загрузить другой
                </button>
              </div>
            )}

            <button
              onClick={handleSubmitTask}
              disabled={!screenshot}
              className="w-full bg-blue-500 text-white py-3 rounded-xl hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Отправить на проверку (+{selectedTask.reward}₽)
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="text-blue-900 mb-2">Как это работает?</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>1. Выполните задание</li>
          <li>2. Сделайте скриншот</li>
          <li>3. Отправьте на проверку</li>
          <li>4. Получите бонусы после одобрения</li>
        </ul>
      </div>
    </div>
  );
}
