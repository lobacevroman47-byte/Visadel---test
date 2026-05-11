import { useEffect, useRef, useState } from 'react';

// Единый компонент даты для всего mini-app:
//  - видимый текстовый инпут «дд.мм.гггг» + numeric клавиатура,
//  - 📅 иконка справа,
//  - невидимый native <input type="date"> поверх правого края — тап
//    по иконке открывает iOS picker.
//
// Источник истины — Step1BasicData; вынесено в shared чтобы все формы
// (HotelBookingForm, FlightBookingForm, Step2AdditionalDocs) использовали
// тот же визуальный паттерн «как в визовых анкетах».

interface Props {
  value: string;                       // ISO YYYY-MM-DD или ''
  onChange: (v: string) => void;       // выдаёт ISO или ''
  placeholder?: string;
  min?: string;
  className?: string;                  // обёртка относительной позиции
  inputClassName?: string;             // override для самого инпута (по умолчанию form-input)
}

const toDisplay = (v: string): string => {
  if (!v) return '';
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : v;
};

export default function DateInput({
  value, onChange, placeholder, min, className = 'relative', inputClassName = 'form-input pr-12',
}: Props) {
  const [display, setDisplay] = useState(() => toDisplay(value));
  // Ref на native <input type="date"> — для showPicker() на desktop Chrome
  // (на mobile тап по самому input открывает picker напрямую).
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const converted = toDisplay(value);
    if (converted !== display) setDisplay(converted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = digits.slice(0, 2) + '.' + digits.slice(2, 4) + '.' + digits.slice(4);
    } else if (digits.length > 2) {
      formatted = digits.slice(0, 2) + '.' + digits.slice(2);
    }
    setDisplay(formatted);
    if (digits.length === 8) {
      const d = digits.slice(0, 2), mo = digits.slice(2, 4), y = digits.slice(4, 8);
      onChange(`${y}-${mo}-${d}`);
    } else {
      onChange('');
    }
  };

  const dateIsoValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';

  return (
    <div className={className}>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder={placeholder || 'дд.мм.гггг'}
        maxLength={10}
        className={inputClassName}
      />
      {/* Native date input — лежит ПОВЕРХ правого края (где иконка 📅).
          Тап по нему открывает нативный picker на iOS/Android, без необходимости
          ручного showPicker() (который ломается, если elem скрыт через
          pointer-events:none). opacity:0 — невидим, но интерактивен. */}
      <input
        ref={dateRef}
        type="date"
        value={dateIsoValue}
        min={min}
        onChange={(e) => {
          const iso = e.target.value;
          onChange(iso);
          setDisplay(toDisplay(iso));
        }}
        onClick={(e) => {
          // Chrome desktop: showPicker() forces popover open even если
          // клик пришёлся в text-area внутри date input.
          const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
          if (typeof el.showPicker === 'function') {
            try { el.showPicker(); } catch { /* ignore */ }
          }
        }}
        aria-label="Открыть календарь"
        className="absolute right-0 top-0 bottom-0 w-12 opacity-0 cursor-pointer z-20"
        style={{ WebkitAppearance: 'none', appearance: 'none' }}
      />
      {/* 📅 иконка — чисто визуальная подсказка. pointer-events:none чтобы
          клик уходил в date input под ней. */}
      <span
        aria-hidden="true"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-base z-10 px-1 pointer-events-none select-none"
      >
        📅
      </span>
    </div>
  );
}
