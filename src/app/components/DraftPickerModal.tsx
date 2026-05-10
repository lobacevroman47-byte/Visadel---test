// Модалка выбора при клике на визу с существующими черновиками.
// Показывает список незавершённых анкет (Иван 60% / Мария 40% / ...)
// + кнопку «Начать новую». Юзер кликает draft → продолжаем тот.
// Кликает «Начать новую» → создаём новый draftId, начинаем с чистой формы.
//
// Используется из App.tsx → handleVisaSelect когда getDraftsForVisa(visa.id).length > 0.

import { Modal, Button as BrandButton } from './ui/brand';
import { FileText, Plus, Trash2 } from 'lucide-react';
import type { VisaOption } from '../App';
import { type VisaDraft, getDraftApplicantName, removeDraft } from '../lib/visaDrafts';
import { useState } from 'react';
import { useDialog } from './shared/BrandDialog';

interface DraftPickerProps {
  visa: VisaOption;
  drafts: VisaDraft[];
  onContinue: (draft: VisaDraft) => void;
  onStartNew: () => void;
  onClose: () => void;
}

const TOTAL_STEPS = 6; // Step1..Step7 (Step3 удалён, итого 6 шагов)

function progressPct(step: number): number {
  return Math.min(100, Math.round(((step + 1) / TOTAL_STEPS) * 100));
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function DraftPickerModal({ visa, drafts, onContinue, onStartNew, onClose }: DraftPickerProps) {
  const dialog = useDialog();
  const [localDrafts, setLocalDrafts] = useState(drafts);

  const handleDelete = async (draft: VisaDraft) => {
    const name = getDraftApplicantName(draft);
    const ok = await dialog.confirm(
      `Удалить черновик «${name}»?`,
      'Это действие нельзя отменить.',
      { confirmLabel: 'Удалить', cancelLabel: 'Отмена' },
    );
    if (!ok) return;
    removeDraft(draft.id);
    const next = localDrafts.filter(d => d.id !== draft.id);
    setLocalDrafts(next);
    // Если удалили последний — закрываем модалку и стартуем новую
    if (next.length === 0) onStartNew();
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon="📝"
      label={`${visa.country} · ${visa.type}`}
      title={`Незавершённые анкеты (${localDrafts.length})`}
      subtitle="Выбери черновик для продолжения или начни новую"
      size="md"
      footer={
        <BrandButton
          variant="primary"
          size="lg"
          fullWidth
          onClick={onStartNew}
          leftIcon={<Plus className="w-4 h-4" strokeWidth={2.5} />}
        >
          Начать новую
        </BrandButton>
      }
    >
      <div className="p-5 space-y-3">
        {localDrafts.map(draft => {
          const name = getDraftApplicantName(draft);
          const pct = progressPct(draft.step ?? 0);
          return (
            <div
              key={draft.id}
              className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-[#5C7BFF]/40 transition"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl vd-grad-soft border border-blue-100 flex items-center justify-center text-[#3B5BFF] shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#0F2A36] truncate">{name}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Сохранено {fmtDate(draft.savedAt)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(draft)}
                  className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition active:scale-95"
                  aria-label="Удалить черновик"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full vd-grad rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-gray-500 font-medium">Заполнено {pct}%</span>
                <BrandButton
                  variant="primary"
                  size="sm"
                  onClick={() => onContinue(draft)}
                >
                  Продолжить
                </BrandButton>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
