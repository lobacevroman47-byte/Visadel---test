import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Search, Eye, Upload, X, Loader2, RefreshCw, ExternalLink, Download, ArrowUp, ArrowDown, ArrowUpDown, FileDown, Flame, Filter, History, Clock } from 'lucide-react';
import { statusLabels, statusColors } from '../data/mockData';
import {
  useAdminApplications,
  updateApplicationStatus,
  updateApplicationUsdRate,
  updateApplicationTaxPct,
  uploadVisaFile,
  getStatusLog,
  type AdminApplication as Application,
  type StatusLogEntry,
} from '../hooks/useAdminData';
import { payReferralBonus } from '../../lib/db';
import { useAdmin } from '../contexts/AdminContext';

interface ApplicationsProps {
  filter?: { filter?: 'all' | 'in_progress' };
}

// ── Human-readable field labels ───────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  // Common
  citizenship: 'Гражданство',
  birthCountry: 'Страна рождения',
  birthCity: 'Город рождения',
  previousName: 'Предыдущее имя/фамилия',
  previousCitizenship: 'Предыдущее гражданство',
  secondCitizenship: 'Второе гражданство',
  internalPassport: 'Внутренний паспорт',
  residedTwoYears: 'Проживал 2+ лет в стране оформления',
  registrationAddress: 'Адрес регистрации',
  residenceAddress: 'Адрес проживания',
  currentAddress: 'Текущий адрес',
  fatherData: 'Данные отца',
  motherData: 'Данные матери',
  maritalStatus: 'Семейное положение',
  spouseInfo: 'Данные супруга/супруги',
  workplace: 'Место работы',
  visaRefusal: 'Отказы в визе ранее',
  citiesInIndia: 'Города в Индии',
  countriesVisited: 'Посещённые страны',
  visitedIndiaBefore: 'Был ранее в Индии',
  prevVisaType: 'Тип предыдущей визы',
  prevVisaNumber: 'Номер предыдущей визы',
  prevEntryAirport: 'Аэропорт въезда (прошлый раз)',
  prevVisitDate: 'Дата предыдущего посещения',
  southAsiaVisits: 'Посещения Южной Азии',
  hotelInfo: 'Отель',
  emergencyContact: 'Контакт на экстренный случай',
  airport: 'Аэропорт прилёта',
  arrivalDate: 'Дата прилёта',
  // Vietnam
  vietnamViolations: 'Нарушения законов Вьетнама',
  oldPassport: 'Старый паспорт',
  plannedDateFrom: 'Дата въезда',
  plannedDateTo: 'Дата выезда',
  registrationAddress2: 'Адрес регистрации',
  visitPurpose: 'Цель визита',
  contactsInVietnam: 'Контакты во Вьетнаме',
  arrivalAirport: 'Аэропорт прилёта',
  departureAirport: 'Аэропорт вылета',
  addressInVietnam: 'Адрес во Вьетнаме',
  previousVietnamVisits: 'Предыдущие визиты во Вьетнам',
  childInfo: 'Данные ребёнка',
  insuranceInfo: 'Страховка',
  expectedExpenses: 'Ожидаемые расходы ($)',
  workOrStudy: 'Работа/учёба',
  // Sri Lanka
  lastCountry: 'Страна за 14 дней до вылета',
  arrivalDate2: 'Дата прибытия',
  airline: 'Авиакомпания',
  addressInSriLanka: 'Адрес на Шри-Ланке',
  hasResidentVisa: 'Резидентская виза',
  hasExtension: 'Продление разрешения',
  hasMultipleVisa: 'Многократная виза',
  // Korea
  tripPurpose: 'Цель поездки',
  beenToKorea: 'Был в Корее ранее',
  dualCitizenship: 'Двойное гражданство',
  hasCriminalRecord: 'Судимости',
  hasDiseases: 'Опасные заболевания',
  hasContacts: 'Знакомые в Корее',
  traveling: 'Сопровождающие',
  working: 'Работа',
  tripDateFrom: 'Дата въезда в Корею',
  tripDateTo: 'Дата выезда из Кореи',
  addressInKorea: 'Адрес в Корее',
  // Israel
  isBiometric: 'Биометрический паспорт',
  hasSecondCitizenship: 'Второе гражданство',
  fatherData2: 'Данные отца',
  motherData2: 'Данные матери',
  homeAddress: 'Домашний адрес',
  // Pakistan
  daysInPakistan: 'Дней в Пакистане',
  entryPort: 'Порт въезда',
  exitPort: 'Порт выезда',
  stayDateFrom: 'Дата въезда',
  stayDateTo: 'Дата выезда',
  parentsData: 'Данные родителей',
  workInfo: 'Место работы',
  plannedAddress: 'Адрес проживания',
  // Kenya
  profession: 'Профессия',
  arrivalDate3: 'Дата прилёта',
  departureDate: 'Дата вылета',
  fromCountry: 'Страна вылета в Кению',
  exitAirline: 'Авиакомпания при выезде',
  toCountry: 'Страна назначения при выезде',
  addressInKenya: 'Адрес в Кении',
  convicted: 'Судимости за 5 лет',
  deniedEntry: 'Отказ въезда в Кению',
  beenToKenya: 'Был в Кении ранее',
  bringCurrency: 'Ввоз валюты >5000$',
};

const HOW_HEARD_LABELS: Record<string, string> = {
  telegram: 'Telegram', youtube: 'YouTube', instagram: 'Instagram',
  tiktok: 'TikTok', vk: 'VK', rutube: 'RuTube',
  friends: 'Посоветовали друзья', repeat: 'Оформлял(-а) ранее',
};

const MARITAL_LABELS: Record<string, string> = {
  single: 'Холост/Не замужем', married: 'Женат/Замужем',
  divorced: 'Разведён(а)', widowed: 'Вдовец/Вдова',
};

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'maritalStatus') return MARITAL_LABELS[value as string] ?? String(value);
  if (key === 'residedTwoYears' || key === 'isBiometric' || key === 'hasSecondCitizenship' ||
      key === 'beenToKorea' || key === 'dualCitizenship' || key === 'hasCriminalRecord' ||
      key === 'hasDiseases' || key === 'hasResidentVisa' || key === 'hasExtension' ||
      key === 'hasMultipleVisa' || key === 'convicted' || key === 'deniedEntry' ||
      key === 'beenToKenya' || key === 'visitedIndiaBefore') {
    return value === 'yes' ? 'Да' : value === 'no' ? 'Нет' : String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    if (key === 'southAsiaVisits') {
      return (value as { country: string; year: string; count: string }[])
        .map(v => `${v.country}: ${v.year}г., ${v.count} раз`)
        .join('; ');
    }
    return value.join(', ');
  }
  return String(value);
}

const PHOTO_LABELS: Record<string, string> = {
  facePhoto: 'Фото лица',
  passportPhoto: 'Фото загранпаспорта',
  previousVisa: 'Предыдущая виза (Индия)',
  indiaStamps: 'Штампы Индии',
  secondPassport: 'Второй паспорт (Корея)',
  hotelFile: 'Бронирование отеля',
  ticketFile: 'Авиабилет',
};

function FilePreview({ url, label }: { url: string; label: string }) {
  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(url) || url.includes('photos/') || url.includes('payments/');
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
        <p className="text-xs font-medium text-gray-600">{label}</p>
        <a href={url} target="_blank" rel="noreferrer"
          className="text-xs text-blue-500 hover:underline flex items-center gap-1">
          Открыть <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      {isImage && (
        <div className="p-2 bg-white">
          <img src={url} alt={label} className="w-full max-h-48 object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}

// ── Form Data (Анкета tab) ────────────────────────────────────────────────────
const FormDataView: React.FC<{ app: Application }> = ({ app }) => {
  const fd = app.formData as {
    basicData?: Record<string, unknown>;
    contactInfo?: Record<string, string>;
    additionalDocs?: Record<string, boolean>;
    howHeard?: string[];
  };

  const basicData = fd.basicData ?? {};
  const contactInfo = fd.contactInfo ?? {};
  const additionalDocs = fd.additionalDocs ?? {};
  const howHeard = fd.howHeard ?? [];

  const extras: string[] = [];
  if (additionalDocs.urgentProcessing) extras.push('Срочное оформление');
  if (additionalDocs.hotelBooking) extras.push('Подтверждение бронирования');
  if (additionalDocs.returnTicket) extras.push('Бронирование авиабилета');

  return (
    <div className="space-y-6">
      {/* Contact */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Контакты</h4>
        <div className="grid grid-cols-2 gap-2">
          {contactInfo.telegram && (
            <div className="col-span-2">
              <p className="text-xs text-gray-500">Telegram</p>
              <a href={`https://t.me/${contactInfo.telegram.replace('@', '')}`} target="_blank" rel="noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                @{contactInfo.telegram.replace('@', '')} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {contactInfo.phone && (
            <div><p className="text-xs text-gray-500">Телефон</p><p className="text-sm">{contactInfo.phone}</p></div>
          )}
          {contactInfo.email && (
            <div><p className="text-xs text-gray-500">Email</p><p className="text-sm">{contactInfo.email}</p></div>
          )}
        </div>
      </section>

      {/* Basic data */}
      {Object.keys(basicData).length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Анкетные данные</h4>
          <div className="space-y-2">
            {Object.entries(basicData).map(([key, value]) => {
              const label = FIELD_LABELS[key] ?? key;
              const formatted = formatValue(key, value);
              if (formatted === '—') return null;
              return (
                <div key={key} className="p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{formatted}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {extras.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Доп. услуги</h4>
          <div className="flex flex-wrap gap-2">
            {extras.map(e => <span key={e} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">{e}</span>)}
          </div>
        </section>
      )}

      {howHeard.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Откуда узнали</h4>
          <p className="text-sm text-gray-700">{howHeard.map(v => HOW_HEARD_LABELS[v] ?? v).join(', ')}</p>
        </section>
      )}
    </div>
  );
};

// ── Files tab (Файлы) ────────────────────────────────────────────────────────

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, '_blank');
  }
}

const FilesView: React.FC<{ app: Application }> = ({ app }) => {
  const fd = app.formData as { photoUrls?: Record<string, string | null> };
  const photoUrls = fd.photoUrls ?? {};
  const entries = Object.entries(photoUrls).filter(([, url]) => !!url) as [string, string][];

  if (entries.length === 0) {
    return (
      <div className="py-16 text-center space-y-2">
        <p className="text-gray-400 text-sm">Файлы не загружены</p>
        <p className="text-gray-300 text-xs">
          Фотографии сохраняются начиная с новых заявок.
          Старые заявки не содержат прикреплённых фото.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map(([key, url]) => {
        const label = PHOTO_LABELS[key] ?? key;
        const isPdf = /\.pdf$/i.test(url);
        const ext = url.split('.').pop() ?? 'file';
        const filename = `${label.replace(/\s+/g, '_')}.${ext}`;
        return (
          <div key={key} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 flex items-center justify-between border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">{label}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadFile(url, filename)}
                  className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 transition"
                  title="Скачать"
                >
                  <Download className="w-3.5 h-3.5" /> Скачать
                </button>
                <a href={url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
                  {isPdf ? 'Открыть PDF' : 'Открыть'} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            {/* Preview */}
            {!isPdf ? (
              <div className="p-2 bg-white">
                <img
                  src={url}
                  alt={label}
                  className="w-full max-h-72 object-contain rounded-lg"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            ) : (
              <div className="p-4 text-center text-gray-400 text-sm">
                PDF-файл — нажмите «Открыть PDF» для просмотра
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Status History Component ──────────────────────────────────────────────────
const STATUS_LABELS_RU: Record<string, string> = {
  draft: 'Черновик',
  pending_payment: 'Ожидает оплаты',
  pending_confirmation: 'Ожидает подтверждения',
  in_progress: 'В работе',
  completed: 'Готово',
  ready: 'Готово',
};

const StatusHistory: React.FC<{
  createdAt: string;
  log: StatusLogEntry[];
  loading: boolean;
}> = ({ createdAt, log, loading }) => {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mt-2 bg-gray-50 rounded-xl p-4 border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-gray-500" />
        <h4 className="text-sm font-semibold text-gray-700">История изменений</h4>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Загружаем…
        </div>
      ) : (
        <div className="relative pl-5 space-y-3">
          <div className="absolute left-1.5 top-1.5 bottom-1.5 w-px bg-gray-200" />
          {/* Creation entry */}
          <div className="relative">
            <div className="absolute -left-3.5 top-1 w-2 h-2 rounded-full bg-blue-400 ring-2 ring-white" />
            <p className="text-xs text-gray-500">{fmt(createdAt)}</p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Заявка создана</span> · ожидает подтверждения
            </p>
          </div>
          {/* Status changes */}
          {log.map(entry => (
            <div key={entry.id} className="relative">
              <div className="absolute -left-3.5 top-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              <p className="text-xs text-gray-500">{fmt(entry.created_at)}</p>
              <p className="text-sm text-gray-700">
                <span className="text-gray-400">{STATUS_LABELS_RU[entry.from_status ?? ''] ?? entry.from_status ?? '?'}</span>
                {' → '}
                <span className="font-medium">{STATUS_LABELS_RU[entry.to_status] ?? entry.to_status}</span>
              </p>
              {entry.changed_by_name && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" /> {entry.changed_by_name}
                </p>
              )}
            </div>
          ))}
          {log.length === 0 && (
            <p className="text-xs text-gray-400 italic ml-1">Статус ещё не менялся</p>
          )}
        </div>
      )}
    </div>
  );
};

// ── Application Modal ─────────────────────────────────────────────────────────
const ApplicationModal: React.FC<{ application: Application; onClose: () => void }> = ({ application, onClose }) => {
  const { currentUser } = useAdmin();
  const [status, setStatus] = useState(application.status);
  // Hold finance inputs as strings so user can fully clear the field while editing.
  // Parse to number on save and for the live tax preview.
  const [usdRateStr, setUsdRateStr] = useState(String(application.usdRateRub));
  const [taxPctStr, setTaxPctStr] = useState(String(application.taxPct));
  const usdRate = parseFloat(usdRateStr);
  const taxPct = parseFloat(taxPctStr);
  const [visaFile, setVisaFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'form' | 'files' | 'payment'>('info');
  const [statusLog, setStatusLog] = useState<StatusLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const saveGuard = useRef(false); // prevent double-execution

  const tgUsername = (application.telegram ?? '').replace('@', '') ||
    ((application.formData as { contactInfo?: { telegram?: string } })?.contactInfo?.telegram ?? '').replace('@', '');

  // Load status history
  useEffect(() => {
    let cancelled = false;
    setLogLoading(true);
    getStatusLog(application.id)
      .then(log => { if (!cancelled) setStatusLog(log); })
      .finally(() => { if (!cancelled) setLogLoading(false); });
    return () => { cancelled = true; };
  }, [application.id]);

  // Returns: 'sent' | 'skipped' — throws on error
  const sendNotify = async (overrideStatus?: string): Promise<'sent' | 'skipped'> => {
    const s = overrideStatus ?? application.status;
    const res = await fetch('/api/notify-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: application.telegramId,
        status: s,
        country: application.country,
        visa_type: application.visaType,
        application_id: application.id,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data.skipped ? 'skipped' : 'sent';
  };

  const handleSave = async () => {
    if (saveGuard.current) return; // hard guard — no double execution
    saveGuard.current = true;
    setSaving(true);
    try {
      let visaUrl: string | undefined;
      if (visaFile) {
        const url = await uploadVisaFile(visaFile);
        visaUrl = url ?? undefined;
      }
      const prevStatus = application.status;
      const tgId = (() => {
        try { return (window as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } } }).Telegram?.WebApp?.initDataUnsafe?.user?.id ?? 0; }
        catch { return 0; }
      })();
      const adminInfo = currentUser
        ? { id: tgId, name: `${currentUser.name}${currentUser.telegram ? ' ' + currentUser.telegram : ''}`.trim() }
        : undefined;
      await updateApplicationStatus(
        application.id, status, visaUrl,
        application.telegramId, application.country, application.visaType,
        prevStatus, adminInfo,
      );

      // Persist USD rate / tax % if admin changed them (used in finance reports).
      // Skip silently if input is empty / invalid — preserves the snapshot.
      if (Number.isFinite(usdRate) && usdRate > 0 && usdRate !== application.usdRateRub) {
        await updateApplicationUsdRate(application.id, usdRate);
      }
      if (Number.isFinite(taxPct) && taxPct >= 0 && taxPct !== application.taxPct) {
        await updateApplicationTaxPct(application.id, taxPct);
      }

      // Refresh log if status actually changed
      if (prevStatus !== status) {
        getStatusLog(application.id).then(setStatusLog).catch(() => {});
      }

      // Pay referral bonus to the referrer when admin confirms payment (status -> in_progress).
      // — Regular referrer: flat 500₽
      // — Partner referrer: % of this order's price (per-product partner_commission_pct)
      // payReferralBonus has built-in checks: only first paid app counts (dedup by referee).
      if (status === 'in_progress' && application.telegramId) {
        payReferralBonus(application.telegramId, application.id).catch(e => console.warn('referral bonus error', e));
      }

      // Send Telegram notification for all statuses except draft
      if (status !== 'draft' && application.telegramId) {
        try {
          const notifyResult = await sendNotify(status);
          if (notifyResult === 'sent') {
            alert(visaUrl ? 'Виза загружена! Уведомление отправлено в Telegram.' : 'Статус обновлён. Уведомление отправлено в Telegram.');
          } else {
            // skipped by dedup (duplicate within 1 min) — changes saved, no double send
            alert('Изменения сохранены. Уведомление уже было недавно отправлено.');
          }
        } catch (notifyErr) {
          alert(`Изменения сохранены, но уведомление не отправлено:\n${String(notifyErr)}`);
        }
      } else if (status !== 'draft' && !application.telegramId) {
        alert('Изменения сохранены. Telegram ID не найден — уведомление не отправлено.');
      } else {
        alert('Изменения сохранены');
      }
      onClose();
    } catch {
      alert('Ошибка сохранения');
    } finally {
      setSaving(false);
      saveGuard.current = false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">{application.countryFlag}</span>
              <h2 className="text-lg font-semibold text-gray-800">Заявка {application.id}</h2>
            </div>
            {tgUsername ? (
              <a
                href={`https://t.me/${tgUsername}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-500 hover:underline flex items-center gap-1 mt-0.5"
              >
                @{tgUsername} <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <p className="text-sm text-gray-500 mt-0.5">{application.clientName}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 shrink-0">
          {(['info', 'form', 'files', 'payment'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition ${
                activeTab === tab ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'info' ? 'Основное' : tab === 'form' ? 'Анкета' : tab === 'files' ? 'Файлы' : 'Оплата'}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-5">

          {/* ── Tab: Основное ── */}
          {activeTab === 'info' && (
            <div className="space-y-5">
              {/* Клиент */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">ФИО / имя</p>
                  <p className="text-sm font-medium">{application.clientName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Telegram</p>
                  {tgUsername ? (
                    <a href={`https://t.me/${tgUsername}`} target="_blank" rel="noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                      @{tgUsername} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : <p className="text-sm">—</p>}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Телефон</p>
                  <p className="text-sm">{application.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm">{application.email || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Дата подачи</p>
                  <p className="text-sm">{new Date(application.date).toLocaleDateString('ru-RU')}</p>
                </div>
              </div>

              {/* Оплата */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Итого к оплате</p>
                  <p className="text-xl text-blue-600 font-semibold">
                    {(application.cost - application.bonusesUsed).toLocaleString('ru-RU')} ₽
                  </p>
                </div>
                {application.bonusesUsed > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <p className="text-gray-400">Полная сумма</p>
                    <p className="text-gray-400">{application.cost.toLocaleString('ru-RU')} ₽</p>
                  </div>
                )}
                {application.bonusesUsed > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <p className="text-green-600">Списано бонусов</p>
                    <p className="text-green-600 font-medium">−{application.bonusesUsed} ₽</p>
                  </div>
                )}
              </div>

              {/* Финансы заявки — снапшот курса + налог + live превью прибыли */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
                <p className="text-xs font-medium text-amber-800 uppercase tracking-wider">Финансы заявки</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Курс USD на момент оплаты</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">1$ =</span>
                      <input
                        type="number" value={usdRateStr} step="0.01" min={0}
                        onChange={(e) => setUsdRateStr(e.target.value)}
                        onBlur={() => { if (usdRateStr.trim() === '' || !Number.isFinite(parseFloat(usdRateStr))) setUsdRateStr(String(application.usdRateRub)); }}
                        className="flex-1 px-2 py-2 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                      />
                      <span className="text-xs text-gray-500">₽</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Налог (%)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" value={taxPctStr} step="0.5" min={0} max={100}
                        onChange={(e) => setTaxPctStr(e.target.value)}
                        onBlur={() => { if (taxPctStr.trim() === '' || !Number.isFinite(parseFloat(taxPctStr))) setTaxPctStr(String(application.taxPct)); }}
                        className="flex-1 px-2 py-2 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Курс и налог влияют на расчёт прибыли в «Финансах». Налог считается от полной цены ({application.cost.toLocaleString('ru-RU')} ₽ × {Number.isFinite(taxPct) ? taxPct : 0}% = {Math.round(application.cost * (Number.isFinite(taxPct) ? taxPct : 0) / 100).toLocaleString('ru-RU')} ₽).
                </p>
              </div>

              {/* Статус */}
              <div>
                <label className="block text-sm text-gray-700 mb-2 font-medium">Статус заявки</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Application['status'])}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="draft">Черновик</option>
                  <option value="pending_payment">Ожидает оплаты</option>
                  <option value="pending_confirmation">Ожидает подтверждения</option>
                  <option value="in_progress">В работе</option>
                  <option value="completed">Готово</option>
                </select>
              </div>

              {/* Upload visa — only when status = completed */}
              {status === 'completed' && (
                <div>
                  <label className="block text-sm text-gray-700 mb-2 font-medium">Загрузить готовую визу</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center">
                    <Upload className="mx-auto mb-2 text-gray-400" size={28} />
                    <p className="text-sm text-gray-500 mb-2">Перетащите файл или нажмите для выбора</p>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setVisaFile(e.target.files?.[0] || null)}
                      className="hidden" id="visa-upload"
                    />
                    <label htmlFor="visa-upload"
                      className="inline-block px-4 py-2 bg-gray-100 text-sm rounded-lg cursor-pointer hover:bg-gray-200 transition">
                      Выбрать файл
                    </label>
                    {visaFile && <p className="text-sm text-green-600 mt-2">✓ {visaFile.name}</p>}
                  </div>
                </div>
              )}

              {/* Resend notification for already-completed apps */}
              {application.status === 'completed' && (
                <button
                  onClick={async () => {
                    setNotifying(true);
                    try {
                      await sendNotify();
                      alert('Уведомление отправлено!');
                    } catch (e) {
                      alert(`Ошибка: ${String(e)}`);
                    } finally {
                      setNotifying(false);
                    }
                  }}
                  disabled={notifying}
                  className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl transition font-medium flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {notifying ? <Loader2 className="w-4 h-4 animate-spin" /> : '📨'}
                  {notifying ? 'Отправка...' : 'Отправить уведомление повторно'}
                </button>
              )}

              {/* Save */}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                aria-busy={saving}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none select-none"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Сохранение…</span>
                  </>
                ) : (
                  <span>Сохранить изменения</span>
                )}
              </button>

              {/* Status history */}
              <StatusHistory
                createdAt={application.date}
                log={statusLog}
                loading={logLoading}
              />
            </div>
          )}

          {/* ── Tab: Анкета ── */}
          {activeTab === 'form' && (
            Object.keys(application.formData ?? {}).length > 0
              ? <FormDataView app={application} />
              : <p className="text-center text-gray-400 py-12 text-sm">Данные анкеты не сохранены</p>
          )}

          {/* ── Tab: Файлы ── */}
          {activeTab === 'files' && <FilesView app={application} />}

          {/* ── Tab: Оплата ── */}
          {activeTab === 'payment' && (
            <div className="space-y-5">
              {/* Payment screenshot */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Скриншот оплаты</h4>
                {application.paymentProofUrl ? (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-600">Чек / скриншот перевода</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => downloadFile(application.paymentProofUrl!, 'payment_proof.jpg')}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 transition"
                        >
                          <Download className="w-3.5 h-3.5" /> Скачать
                        </button>
                        <a href={application.paymentProofUrl} target="_blank" rel="noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                          Открыть <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    <div className="p-2 bg-white">
                      <img
                        src={application.paymentProofUrl}
                        alt="Скриншот оплаты"
                        className="w-full max-h-72 object-contain rounded-lg"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-400 text-center">
                    Скриншот оплаты не загружен
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Стоимость</span>
                  <span className="font-semibold text-blue-600">{application.cost.toLocaleString('ru-RU')} ₽</span>
                </div>
                {application.bonusesUsed > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Списано бонусов</span>
                    <span className="text-green-600">−{application.bonusesUsed} ₽</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-500">Итого к оплате</span>
                  <span className="font-bold text-gray-800">{(application.cost - application.bonusesUsed).toLocaleString('ru-RU')} ₽</span>
                </div>
              </div>

              {/* Ready visa */}
              {application.visaFileUrl && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Готовая виза</h4>
                  <a href={application.visaFileUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 p-3 bg-green-50 rounded-xl text-green-700 text-sm hover:bg-green-100 transition">
                    <ExternalLink className="w-4 h-4" /> Скачать / открыть визу
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Applications List ─────────────────────────────────────────────────────────
type SortField = 'date' | 'price' | 'country' | 'status';
type SortDir = 'asc' | 'desc';

function exportToCsv(rows: Application[]) {
  const head = ['ID', 'Страна', 'Тип', 'Клиент', 'Telegram', 'Телефон', 'Email', 'Сумма', 'Бонусы', 'Статус', 'Дата', 'Срочно'];
  const escape = (v: unknown) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[,";\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [head.join(',')];
  for (const a of rows) {
    const tg = ((a.formData as { contactInfo?: { telegram?: string } })?.contactInfo?.telegram ?? a.telegram ?? '').replace('@', '');
    lines.push([
      a.id, a.country, a.visaType, a.clientName, tg, a.phone, a.email,
      a.cost, a.bonusesUsed, statusLabels[a.status],
      new Date(a.date).toLocaleDateString('ru-RU'),
      a.urgent ? 'да' : 'нет',
    ].map(escape).join(','));
  }
  // Excel-friendly: BOM + CRLF
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `applications_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export const Applications: React.FC<ApplicationsProps> = ({ filter }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(filter?.filter === 'in_progress' ? 'in_progress' : 'all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  const { applications, loading, refetch } = useAdminApplications();
  const countries = useMemo(() => Array.from(new Set(applications.map(app => app.country))), [applications]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86_400_000 : null; // include "to" day
    return applications.filter(app => {
      if (statusFilter !== 'all' && app.status !== statusFilter) return false;
      if (countryFilter !== 'all' && app.country !== countryFilter) return false;
      if (urgentOnly && !app.urgent) return false;
      const ts = new Date(app.date).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts >= toTs) return false;
      if (q) {
        const tg = ((app.formData as { contactInfo?: { telegram?: string } })?.contactInfo?.telegram ?? app.telegram ?? '').toLowerCase();
        const hay = `${app.clientName} ${app.phone} ${app.id} ${tg} ${app.email ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [applications, searchQuery, statusFilter, countryFilter, urgentOnly, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':    cmp = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
        case 'price':   cmp = (a.cost - a.bonusesUsed) - (b.cost - b.bonusesUsed); break;
        case 'country': cmp = a.country.localeCompare(b.country, 'ru'); break;
        case 'status':  cmp = a.status.localeCompare(b.status); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const totalRevenue = useMemo(
    () => sorted.filter(a => a.status !== 'draft').reduce((s, a) => s + (a.cost - a.bonusesUsed), 0),
    [sorted]
  );

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || countryFilter !== 'all' || urgentOnly || dateFrom || dateTo;
  const resetFilters = () => {
    setSearchQuery(''); setStatusFilter('all'); setCountryFilter('all');
    setUrgentOnly(false); setDateFrom(''); setDateTo('');
  };
  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('desc'); }
  };
  const sortIcon = (f: SortField) =>
    sortField !== f ? <ArrowUpDown className="w-3 h-3 inline ml-1 text-gray-400" /> :
    sortDir === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1 text-blue-500" /> :
    <ArrowDown className="w-3 h-3 inline ml-1 text-blue-500" />;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h1>Заявки</h1>
          <p className="text-xs text-gray-500 mt-1">
            {sorted.length} из {applications.length} · сумма: {totalRevenue.toLocaleString('ru-RU')} ₽
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button
            onClick={() => exportToCsv(sorted)}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition flex items-center gap-1.5 text-sm"
            title="Экспорт CSV"
          >
            <FileDown size={16} /> CSV
          </button>
          <button onClick={refetch} className="p-2 hover:bg-gray-100 rounded-lg transition" title="Обновить">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 mb-5 space-y-3">
        {/* Row 1: search + status + country */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="ID, имя, Telegram, телефон, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3] text-sm">
            <option value="all">Все статусы</option>
            <option value="draft">Черновик</option>
            <option value="pending_payment">Ожидает оплаты</option>
            <option value="pending_confirmation">Ожидает подтверждения</option>
            <option value="in_progress">В работе</option>
            <option value="completed">Готово</option>
          </select>
          <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3] text-sm">
            <option value="all">Все страны</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Row 2: date range + urgent toggle + reset */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Filter size={14} className="text-gray-400" /> Период:
          </div>
          <input
            type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
            title="С"
          />
          <span className="text-gray-400 text-xs">—</span>
          <input
            type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
            title="По"
          />
          <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition text-sm ${urgentOnly ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'}`}>
            <input type="checkbox" checked={urgentOnly} onChange={e => setUrgentOnly(e.target.checked)} className="hidden" />
            <Flame size={14} /> Только срочные
          </label>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="ml-auto px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-xs transition flex items-center gap-1"
            >
              <X size={12} /> Сбросить
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F7FA]">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-600">ID</th>
                <th
                  className="px-4 py-3 text-left text-xs text-gray-600 cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => toggleSort('country')}
                >
                  Страна {sortIcon('country')}
                </th>
                <th className="px-4 py-3 text-left text-xs text-gray-600">Клиент / Telegram</th>
                <th className="px-4 py-3 text-left text-xs text-gray-600">Телефон</th>
                <th
                  className="px-4 py-3 text-left text-xs text-gray-600 cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => toggleSort('price')}
                >
                  Стоимость {sortIcon('price')}
                </th>
                <th className="px-4 py-3 text-left text-xs text-gray-600">Бонусы</th>
                <th
                  className="px-4 py-3 text-left text-xs text-gray-600 cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => toggleSort('status')}
                >
                  Статус {sortIcon('status')}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs text-gray-600 cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => toggleSort('date')}
                >
                  Дата {sortIcon('date')}
                </th>
                <th className="px-4 py-3 text-left text-xs text-gray-600 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-400 text-sm">
                    {applications.length === 0 ? 'Заявок пока нет' : 'По выбранным фильтрам ничего не найдено'}
                  </td>
                </tr>
              ) : sorted.map((app) => {
                const tgUser = ((app.formData as { contactInfo?: { telegram?: string } })?.contactInfo?.telegram ?? app.telegram ?? '').replace('@', '');
                return (
                  <tr key={app.id} className={`hover:bg-[#F5F7FA] ${app.urgent ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{app.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span>{app.countryFlag}</span>{app.country}
                        {app.urgent && <Flame className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>{app.clientName}</div>
                      {tgUser && (
                        <a href={`https://t.me/${tgUser}`} target="_blank" rel="noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                          @{tgUser} <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{app.phone}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-semibold text-blue-600">{(app.cost - app.bonusesUsed).toLocaleString('ru-RU')} ₽</span>
                      {app.bonusesUsed > 0 && (
                        <span className="text-xs text-gray-400 block">из {app.cost.toLocaleString('ru-RU')} ₽</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-green-600">
                      {app.bonusesUsed > 0 ? `−${app.bonusesUsed} ₽` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 rounded text-xs text-white whitespace-nowrap"
                        style={{ backgroundColor: statusColors[app.status] }}>
                        {statusLabels[app.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(app.date).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button onClick={() => setSelectedApp(app)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition" title="Открыть заявку">
                        <Eye size={18} className="text-[#2196F3]" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedApp && (
        <ApplicationModal application={selectedApp} onClose={() => setSelectedApp(null)} />
      )}
    </div>
  );
};
