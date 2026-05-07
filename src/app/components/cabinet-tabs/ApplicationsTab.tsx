import { useState, useEffect } from 'react';
import { Clock, CreditCard, FileCheck, CheckCircle, FileText, Download, Star, Trash2, Play, MessageSquare } from 'lucide-react';

interface Application {
  id: string;
  visa: {
    country: string;
    type: string;
    duration: string;
    price: number;
  };
  status: 'draft' | 'pending_payment' | 'pending_confirmation' | 'in_progress' | 'ready';
  totalPrice: number;
  bonusesUsed?: number;
  finalPrice?: number;
  createdAt: string;
  hasReview?: boolean;
}

interface Draft {
  id: string;
  visa: {
    country: string;
    type: string;
    duration: string;
    price: number;
  };
  urgent: boolean;
  step: number;
  savedAt: string;
  formData: any;
}

interface ApplicationsTabProps {
  onContinueDraft?: (draft: Draft) => void;
}

export default function ApplicationsTab({ onContinueDraft }: ApplicationsTabProps) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    // Load applications
    const savedApplications = localStorage.getItem('visa_applications');
    if (savedApplications) {
      setApplications(JSON.parse(savedApplications));
    }

    // Load drafts
    const savedDrafts = localStorage.getItem('visa_drafts');
    if (savedDrafts) {
      const parsedDrafts = JSON.parse(savedDrafts);
      // Filter drafts older than 30 days
      const validDrafts = parsedDrafts.filter((draft: Draft) => {
        const savedDate = new Date(draft.savedAt);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - savedDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff < 30;
      });
      setDrafts(validDrafts);
      
      // Update localStorage with valid drafts only
      if (validDrafts.length !== parsedDrafts.length) {
        localStorage.setItem('visa_drafts', JSON.stringify(validDrafts));
      }
    }
  };

  const getStatusInfo = (status: Application['status']) => {
    switch (status) {
      case 'draft':
        return {
          icon: FileText,
          label: 'Черновик',
          color: 'text-gray-600',
          bgColor: 'bg-gray-100'
        };
      case 'pending_payment':
        return {
          icon: CreditCard,
          label: 'Ожидает оплаты',
          color: 'text-orange-600',
          bgColor: 'bg-orange-100'
        };
      case 'pending_confirmation':
        return {
          icon: FileCheck,
          label: 'Проверка оплаты',
          color: 'text-blue-600',
          bgColor: 'bg-blue-100'
        };
      case 'in_progress':
        return {
          icon: Clock,
          label: 'В работе',
          color: 'text-purple-600',
          bgColor: 'bg-purple-100'
        };
      case 'ready':
        return {
          icon: CheckCircle,
          label: 'Готово',
          color: 'text-green-600',
          bgColor: 'bg-green-100'
        };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleContinueDraft = (draft: Draft) => {
    if (onContinueDraft) {
      onContinueDraft(draft);
    }
  };

  const handleDeleteDraft = (draftId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить черновик? Это действие нельзя отменить.')) {
      // Remove from state
      const updatedDrafts = drafts.filter(d => d.id !== draftId);
      setDrafts(updatedDrafts);
      
      // Remove from localStorage
      localStorage.setItem('visa_drafts', JSON.stringify(updatedDrafts));
      localStorage.removeItem(draftId);
      
      alert('✅ Черновик удален');
    }
  };

  const handleDownloadVisa = (appId: string) => {
    alert('📄 Виза будет загружена в формате PDF');
  };

  const handleLeaveReview = (appId: string) => {
    setSelectedAppId(appId);
    setShowReviewModal(true);
  };

  const submitReview = () => {
    if (reviewRating === 0) {
      alert('Пожалуйста, поставьте оценку');
      return;
    }

    const review = {
      applicationId: selectedAppId,
      rating: reviewRating,
      comment: reviewComment,
      createdAt: new Date().toISOString()
    };

    // Save review
    const reviews = JSON.parse(localStorage.getItem('visa_reviews') || '[]');
    reviews.push(review);
    localStorage.setItem('visa_reviews', JSON.stringify(reviews));

    // Update application
    const updatedApps = applications.map(app => 
      app.id === selectedAppId ? { ...app, hasReview: true } : app
    );
    setApplications(updatedApps);
    localStorage.setItem('visa_applications', JSON.stringify(updatedApps));

    // Add bonus
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    userData.bonusBalance = (userData.bonusBalance || 0) + 200;
    localStorage.setItem('userData', JSON.stringify(userData));

    alert('✅ Спасибо за отзыв! На ваш счет начислено 200₽');
    setShowReviewModal(false);
    setReviewRating(0);
    setReviewComment('');
    setSelectedAppId('');
  };

  const handleUsePreviousData = (app: Application) => {
    alert('📋 Данные будут автоматически заполнены в новой заявке');
  };

  const getStepProgress = (step: number) => {
    const totalSteps = 7;
    return Math.round((step / totalSteps) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Drafts Section */}
      {drafts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-600" />
            Черновики ({drafts.length})
          </h3>
          
          {drafts.map((draft) => (
            <div key={draft.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="text-gray-900 mb-1">
                    {draft.visa.country} - {draft.visa.type}
                  </h4>
                  <p className="text-sm text-gray-600 mb-2">{draft.visa.duration}</p>
                  <p className="text-xs text-gray-500">
                    Сохранено: {formatDate(draft.savedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100">
                  <FileText className="w-4 h-4 text-yellow-700" />
                  <span className="text-sm text-yellow-700">Шаг {draft.step + 1}/7</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="h-2 bg-yellow-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-yellow-500 transition-all"
                    style={{ width: `${getStepProgress(draft.step + 1)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Заполнено {getStepProgress(draft.step + 1)}%
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleContinueDraft(draft)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3B5BFF] text-white rounded-lg hover:bg-[#4F2FE6] transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Продолжить
                </button>
                <button
                  onClick={() => handleDeleteDraft(draft.id)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Applications List */}
      {applications.length === 0 && drafts.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg text-gray-900 mb-2">Пока нет заявок</h3>
          <p className="text-gray-500">
            Ваши заявки на визы будут отображаться здесь
          </p>
        </div>
      ) : applications.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-gray-900 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-gray-600" />
            Заявки ({applications.length})
          </h3>
          
          {applications.map((app) => {
            const statusInfo = getStatusInfo(app.status);
            const StatusIcon = statusInfo.icon;

            return (
              <div key={app.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-gray-900 mb-1">{app.visa.country}</h3>
                    <p className="text-sm text-gray-500">{app.visa.type} • {app.visa.duration}</p>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${statusInfo.bgColor}`}>
                    <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                    <span className={`text-sm ${statusInfo.color}`}>{statusInfo.label}</span>
                  </div>
                </div>

                <div className="space-y-2 mb-3 pb-3 border-b border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Стоимость визы:</span>
                    <span className="text-gray-900">{app.totalPrice}₽</span>
                  </div>
                  {app.bonusesUsed && app.bonusesUsed > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Оплачено бонусами:</span>
                      <span className="text-green-600">-{app.bonusesUsed}₽</span>
                    </div>
                  )}
                  {app.finalPrice !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-900">Итого оплачено:</span>
                      <span className="text-gray-900">{app.finalPrice}₽</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                  <span>Создана: {formatDate(app.createdAt)}</span>
                  <span className="text-xs">ID: {app.id.slice(0, 8)}</span>
                </div>

                {app.status === 'ready' && (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleDownloadVisa(app.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Скачать визу
                    </button>
                    
                    {!app.hasReview ? (
                      <button
                        onClick={() => handleLeaveReview(app.id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3B5BFF] text-white rounded-lg hover:bg-[#4F2FE6] transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Оставить отзыв (получить 200₽)
                      </button>
                    ) : (
                      <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-lg border border-green-200">
                        <CheckCircle className="w-4 h-4" />
                        ✓ Отзыв оставлен
                      </div>
                    )}
                    
                    <button
                      onClick={() => handleUsePreviousData(app)}
                      className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                    >
                      Использовать данные для новой заявки
                    </button>
                  </div>
                )}

                {app.status === 'in_progress' && (
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-sm text-purple-900">
                      ⏳ Ваша заявка обрабатывается. Ожидайте уведомление о готовности визы.
                    </p>
                  </div>
                )}

                {app.status === 'pending_confirmation' && (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-sm text-blue-900">
                      🔍 Ваш платеж проверяется. Обычно это занимает до 2 часов.
                    </p>
                  </div>
                )}

                {app.status === 'pending_payment' && (
                  <div className="bg-orange-50 rounded-lg p-3">
                    <p className="text-sm text-orange-900">
                      💳 Ожидается оплата. Пожалуйста, завершите оплату для продолжения обработки.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl text-gray-900 mb-4">Оставить отзыв</h3>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">
                Оценка <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => setReviewRating(rating)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        rating <= reviewRating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 mb-2">
                Комментарий (опционально)
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="form-input min-h-24"
                placeholder="Расскажите о вашем опыте..."
              />
            </div>

            <div className="bg-blue-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-900">
                🎁 За отзыв вы получите <strong>200₽</strong> на бонусный счет
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setReviewRating(0);
                  setReviewComment('');
                }}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={submitReview}
                className="flex-1 px-4 py-3 bg-[#3B5BFF] text-white rounded-lg hover:bg-[#4F2FE6] transition-colors"
              >
                Отправить отзыв
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="text-blue-900 mb-2">💡 Полезная информация</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Черновики хранятся 30 дней</li>
          <li>• После готовности визы вы получите уведомление</li>
          <li>• Можно использовать данные предыдущих заявок</li>
          <li>• За отзыв к готовой визе вы получите +200₽</li>
        </ul>
      </div>
    </div>
  );
}
