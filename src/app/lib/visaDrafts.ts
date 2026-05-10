// Helpers для работы с черновиками визовых анкет в localStorage.
//
// Структура хранения:
//   localStorage[<draftKey>]      — отдельный JSON каждого черновика
//   localStorage['visa_drafts']    — массив всех черновиков (для списка
//                                    в ApplicationsTab)
//
// До рефактора на multi-draft: draftKey = `draft_${visa.id}_${urgent}`.
// Один драфт на (виза, срочность). Перетирался при второй заявке.
//
// После: draftKey = `draft_${uuid}`. Несколько драфтов на одну визу
// (например для разных членов семьи). UUID генерится при первом сохранении.
//
// Старые draft-ключи продолжают работать (load по любому ключу из массива).

import type { VisaOption } from '../App';

export interface VisaDraft {
  id: string;                   // draft key — `draft_<uuid>` или legacy `draft_<visaId>_<urgent>`
  formData: Record<string, unknown>;
  step: number;
  visa: VisaOption;
  urgent: boolean;
  savedAt: string;              // ISO
}

const ARRAY_KEY = 'visa_drafts';

/** Прочитать массив всех черновиков. Безопасно при сломанном JSON. */
export function loadAllDrafts(): VisaDraft[] {
  try {
    const raw = localStorage.getItem(ARRAY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as VisaDraft[] : [];
  } catch {
    return [];
  }
}

/** Драфты для конкретной визы. Используется на главной для маркера и
 *  в DraftPickerModal для списка. */
export function getDraftsForVisa(visaId: string): VisaDraft[] {
  return loadAllDrafts().filter(d => d.visa?.id === visaId);
}

/** Имя заявителя из formData (для отображения в списке драфтов).
 *  Берёт firstName + lastName из basicData (Step1BasicData), затем fullName. */
export function getDraftApplicantName(draft: VisaDraft): string {
  const basicData = (draft.formData?.basicData as Record<string, string> | undefined) ?? {};
  const fromBasic = [basicData.firstName, basicData.lastName].filter(Boolean).join(' ').trim();
  if (fromBasic) return fromBasic;
  if (basicData.fullName) return basicData.fullName;
  return 'Без имени';
}

/** Удалить конкретный драфт по ID — и individual ключ, и из массива. */
export function removeDraft(draftId: string): void {
  try {
    localStorage.removeItem(draftId);
    const arr = loadAllDrafts();
    const filtered = arr.filter(d => d.id !== draftId);
    if (filtered.length !== arr.length) {
      localStorage.setItem(ARRAY_KEY, JSON.stringify(filtered));
    }
  } catch (e) {
    console.warn('[removeDraft] failed:', e);
  }
}

/** Уникальный draftKey для НОВОЙ заявки. Используется когда юзер
 *  создаёт новую анкету через DraftPicker «Начать новую». */
export function generateNewDraftId(): string {
  // crypto.randomUUID() есть во всех современных браузерах + Telegram WebView
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `draft_${crypto.randomUUID()}`;
  }
  // Fallback: Math.random + timestamp (достаточно уникально для нашего масштаба)
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
