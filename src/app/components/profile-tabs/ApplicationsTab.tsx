import { useState, useEffect } from 'react';
import { FileText, Clock, CheckCircle, Download, MessageSquare, Copy, X, Star, Play, Trash2 } from 'lucide-react';

interface Application {
  id: string;
  visa: {
    country: string;
    type: string;
  };
  urgent: boolean;
  totalPrice: number;
  bonusesUsed?: number;
  finalPrice?: number;
  status: 'draft' | 'pending_payment' | 'pending_confirmation' | 'in_progress' | 'ready';
  createdAt: string;
  formData?: any;
  visaFileUrl?: string;
  hasReview?: boolean;
}

interface Draft {
  id: string;
  visa: {
    country: string;
    type: string;
    price: number;
  };
  urgent: boolean;
  step: number;
  savedAt: string;
  formData: any;
  draftKey: string;
}

interface Review {
  applicationId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface ApplicationsTabProps {
  onContinueDraft?: (draft: Draft) => void;
}

const STATUS_CONFIG = {
  draft: { label: 'Черновик', icon: '📝', color: 'bg-gray-100 text-gray-700' },
  pending_payment: { label: 'Ожидает оплаты', icon: '💰', color: 'bg-yellow-100 text-yellow-700' },
  pending_confirmation: { label: 'Ожидает подтверждения', icon: '⏳', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'В работе', icon: '✅', color: 'bg-green-100 text-green-700' },
  ready: { label: 'Готово', icon: '🎉', color: 'bg-purple-100 text-purple-700' },
};

export default function ApplicationsTab({ onContinueDraft }: ApplicationsTabProps) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = () => {
    // Load completed applications
    const apps = JSON.parse(localStorage.getItem('visa_applications') || localStorage.getItem('applications') || '[]');
    setApplications(apps);

    // Load drafts from new format (visa_drafts)
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
      
      // Add draftKey to each draft
      const draftsWithKey = validDrafts.map((draft: any) => ({
        ...draft,
        draftKey: draft.id
      }));
      
      setDrafts(draftsWithKey);
      
      // Update localStorage with valid drafts only
      if (validDrafts.length !== parsedDrafts.length) {
        localStorage.setItem('visa_drafts', JSON.stringify(validDrafts));
      }
    }
  };

  const handleContinueDraft = (draft: Draft) => {
    if (onContinueDraft) {
      onContinueDraft(draft);
    }
  };

  const handleDeleteDraft = (draftKey: string) => {
    if (confirm('Вы уверены, что хотите удалить черновик? Это действие нельзя отменить.')) {
      // Remove from individual storage
      localStorage.removeItem(draftKey);
      
      // Remove from drafts list
      const savedDrafts = localStorage.getItem('visa_drafts');
      if (savedDrafts) {
        const parsedDrafts = JSON.parse(savedDrafts);
        const updatedDrafts = parsedDrafts.filter((d: any) => d.id !== draftKey);
        localStorage.setItem('visa_drafts', JSON.stringify(updatedDrafts));
      }
      
      // Reload applications to update UI
      loadApplications();
      alert('✅ Черновик удален');
    }
  };

  const handleCopyData = (formData: any) => {
    localStorage.setItem('copiedFormData', JSON.stringify(formData));
    alert('Данные скопированы! При следующем оформлении визы они будут предложены для автозаполнения.');
  };

  const handleDownloadVisa = (app: Application) => {
    // In real app, this would download the actual visa file
    // For demo, we'll just show an alert
    if (app.visaFileUrl) {
      window.open(app.visaFileUrl, '_blank');
    } else {
      alert('Виза готова к скачиванию! В реальном приложении здесь будет ссылка на PDF-файл.');
    }
  };

  const handleOpenReviewModal = (appId: string) => {
    const app = applications.find(a => a.id === appId);
    if (app?.hasReview) {
      alert('Вы уже оставили отзыв на эту заявку');
      return;
    }
    setSelectedAppId(appId);
    setShowReviewModal(true);
  };

  const handleSubmitReview = () => {
    if (rating === 0) {
      alert('Пожалуйста, поставьте оценку');
      return;
    }

    if (!selectedAppId) return;

    // Save review
    const reviews = JSON.parse(localStorage.getItem('reviews') || '[]');
    const newReview: Review = {
      applicationId: selectedAppId,
      rating,
      comment: reviewComment,
      createdAt: new Date().toISOString(),
    };
    reviews.push(newReview);
    localStorage.setItem('reviews', JSON.stringify(reviews));

    // Update application to mark as reviewed
    const updatedApps = applications.map(app =>
      app.id === selectedAppId ? { ...app, hasReview: true } : app
    );
    localStorage.setItem('applications', JSON.stringify(updatedApps));
    setApplications(updatedApps);

    // Add 100₽ bonus
    const userData = JSON.parse(localStorage.getItem('userData') || '{"bonusBalance": 0}');
    userData.bonusBalance = (userData.bonusBalance || 0) + 100;
    localStorage.setItem('userData', JSON.stringify(userData));

    alert('Спасибо за отзыв! На ваш счёт начислено 100₽');
    setShowReviewModal(false);
    setRating(0);
    setReviewComment('');
    setSelectedAppId(null);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Drafts */}
        {drafts.length > 0 && (
          <div>
            <h3 className="text-lg text-gray-800 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Незавершенные заявки
            </h3>
            <div className="space-y-3">
              {drafts.map((draft) => (
                <div key={draft.draftKey} className="bg-white rounded-xl shadow-md p-4 border-l-4 border-gray-400">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-gray-800">{draft.visa.country}</h4>
                      <p className="text-sm text-gray-600">{draft.visa.type}</p>
                    </div>
                    <span className="bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-full">
                      📝 Черновик
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                    <span>Шаг {draft.step + 1} из 7</span>
                    <span>{new Date(draft.savedAt).toLocaleDateString('ru-RU')}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleContinueDraft(draft)}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition text-sm"
                    >
                      Продолжить
                    </button>
                    <button
                      onClick={() => handleDeleteDraft(draft.draftKey)}
                      className="px-4 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition text-sm"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Applications */}
        <div>
          <h3 className="text-lg text-gray-800 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Мои заявки
          </h3>
          
          {applications.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">У вас пока нет заявок</p>
              <p className="text-sm text-gray-500 mt-1">Оформите первую визу, чтобы увидеть её здесь</p>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => {
                const statusConfig = STATUS_CONFIG[app.status];
                return (
                  <div key={app.id} className="bg-white rounded-xl shadow-md p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-gray-800">{app.visa.country}</h4>
                        <p className="text-sm text-gray-600">{app.visa.type}</p>
                      </div>
                      <span className={`${statusConfig.color} text-xs px-3 py-1 rounded-full`}>
                        {statusConfig.icon} {statusConfig.label}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-gray-500 mb-3">
                      <div className="flex items-center justify-between">
                        <span>Стоимость:</span>
                        <span>{app.totalPrice}₽</span>
                      </div>
                      {app.bonusesUsed && app.bonusesUsed > 0 && (
                        <div className="flex items-center justify-between text-green-600">
                          <span>Оплачено бонусами:</span>
                          <span>-{app.bonusesUsed}₽</span>
                        </div>
                      )}
                      {app.finalPrice !== undefined && app.finalPrice !== app.totalPrice && (
                        <div className="flex items-center justify-between text-blue-600">
                          <span>Итого оплачено:</span>
                          <span>{app.finalPrice}₽</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span>Дата:</span>
                        <span>{new Date(app.createdAt).toLocaleDateString('ru-RU')}</span>
                      </div>
                    </div>

                    {app.status === 'ready' && (
                      <div className="space-y-2">
                        <button 
                          onClick={() => handleDownloadVisa(app)}
                          className="w-full bg-gradient-to-r from-green-600 to-emerald-500 text-white py-2 rounded-lg hover:shadow-lg transition text-sm flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Скачать визу
                        </button>
                        {!app.hasReview && (
                          <button 
                            onClick={() => handleOpenReviewModal(app.id)}
                            className="w-full bg-blue-100 text-blue-700 py-2 rounded-lg hover:bg-blue-200 transition text-sm flex items-center justify-center gap-2"
                          >
                            <MessageSquare className="w-4 h-4" />
                            Оставить отзыв (получить 100��)
                          </button>
                        )}
                        {app.hasReview && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                            <p className="text-sm text-green-700">✓ Отзыв оставлен</p>
                          </div>
                        )}
                        <button
                          onClick={() => handleCopyData(app.formData)}
                          className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition text-sm flex items-center justify-center gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          Использовать данные для новой заявки
                        </button>
                      </div>
                    )}

                    {app.status === 'in_progress' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-green-800">
                          <p>Ваша заявка в работе!</p>
                          <p className="text-xs text-green-600 mt-1">Мы свяжемся с вами при готовности визы</p>
                        </div>
                      </div>
                    )}

                    {app.status === 'pending_confirmation' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                        <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <p>Ожидаем подтверждения оплаты</p>
                          <p className="text-xs text-blue-600 mt-1">Обычно это занимает до 24 часов</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl text-gray-800">Оставить отзыв</h3>
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setRating(0);
                  setReviewComment('');
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3">Оцените качество сервиса:</p>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-10 h-10 ${
                        star <= rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block mb-2 text-gray-700">
                Комментарий (необязательно)
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-[16px] focus:outline-none focus:ring-2 focus:ring-[#2196F3] min-h-[100px]"
                placeholder="Расскажите о вашем опыте..."
              />
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-700 text-center">
                🎁 За отзыв вы получите <strong>100₽</strong> на бонусный счёт
              </p>
            </div>

            <button
              onClick={handleSubmitReview}
              className="w-full bg-[#2196F3] text-white py-3 rounded-[16px] hover:bg-[#1E88E5] transition"
            >
              Отправить отзыв
            </button>
          </div>
        </div>
      )}
    </>
  );
}