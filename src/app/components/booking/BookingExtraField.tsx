import { useState } from 'react';
import { Upload, Loader2, Check } from 'lucide-react';
import { uploadFile, type ExtraFormField } from '../../lib/db';

// Универсальный рендерер дополнительных полей в анкетах броней.
// Используется HotelBookingForm и FlightBookingForm — типы полей
// настраиваются админом в Конструктор анкет → Брони.
//
// value/onChange — строка по всем типам:
//   checkbox     → 'yes' | ''
//   file         → URL загруженного файла | ''
//   text/select/radio/textarea/number/date — обычная строка

interface Props {
  field: ExtraFormField;
  value: string;
  onChange: (v: string) => void;
}

export default function BookingExtraField({ field, value, onChange }: Props) {
  if (field.type === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        className="vd-input"
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="vd-input"
      >
        <option value="">{field.placeholder ?? 'Выбери вариант'}</option>
        {(field.options ?? []).map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'radio') {
    return (
      <div className="space-y-2">
        {(field.options ?? []).map(opt => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name={field.id}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="w-4 h-4 accent-[#3B5BFF]"
            />
            <span className="text-sm text-[#0F2A36]">{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    const checked = value === 'yes';
    return (
      <label className="flex items-center gap-2 cursor-pointer select-none bg-gray-50 rounded-xl p-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked ? 'yes' : '')}
          className="w-5 h-5 accent-[#3B5BFF]"
        />
        <span className="text-sm text-[#0F2A36]">{field.placeholder ?? 'Да'}</span>
      </label>
    );
  }

  if (field.type === 'file') {
    return <ExtraFileUpload value={value} onChange={onChange} />;
  }

  return (
    <input
      type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder}
      className="vd-input"
    />
  );
}

function ExtraFileUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);

  const handle = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file, 'visas');
      if (url) onChange(url);
      else alert('Не удалось загрузить файл');
    } catch (e) {
      alert(`Ошибка: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploading(false);
    }
  };

  if (value) {
    return (
      <div className="vd-grad-soft border border-blue-100 rounded-xl p-3 flex items-center gap-2">
        <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={3} />
        <span className="text-sm font-semibold text-[#0F2A36] flex-1">Файл загружен</span>
        <a href={value} target="_blank" rel="noreferrer" className="text-xs text-[#3B5BFF] hover:underline">Открыть</a>
        <label className="text-xs text-[#3B5BFF] hover:underline cursor-pointer">
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) void handle(f); }}
          />
          Заменить
        </label>
      </div>
    );
  }

  return (
    <label className="block border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-[#5C7BFF] hover:bg-[#EAF1FF] transition text-center">
      {uploading ? <Loader2 className="w-5 h-5 animate-spin text-[#3B5BFF] mx-auto" /> : <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />}
      <p className="text-xs text-[#0F2A36]">{uploading ? 'Загружаем…' : 'Нажми чтобы выбрать файл'}</p>
      <p className="text-[10px] text-[#0F2A36]/55 mt-0.5">PDF / JPG / PNG</p>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        disabled={uploading}
        onChange={e => { const f = e.target.files?.[0]; if (f) void handle(f); }}
      />
    </label>
  );
}
