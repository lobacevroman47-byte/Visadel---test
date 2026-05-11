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
  // Ref на скрытый <input type="date"> — нужен для программного открытия
  // picker при клике на text-поле или иконку 📅 (в Chrome desktop без
  // showPicker() календарь не открывается, потому что overlay date-input
  // занимает только 12px справа).
  const dateRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = dateRef.current;
    if (!el) return;
    // showPicker() в Chrome 99+, требует user-gesture (мы внутри onClick — ок).
    // Fallback для старых браузеров — fокус, тогда некоторые показывают picker.
    if (typeof (el as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
      try { (el as HTMLInputElement & { showPicker: () => void }).showPicker(); return; }
      catch { /* ignore — fallback to focus */ }
    }
    el.focus();
    el.click();
  };

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
      {/* 📅 кнопка-иконка — клик открывает picker через showPicker() API.
          На iOS Safari clickable, на Android Chrome тоже. */}
      <button
        type="button"
        onClick={openPicker}
        aria-label="Открыть календарь"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-base z-20 px-1 cursor-pointer select-none"
      >
        📅
      </button>
      {/* Скрытый native date-input: используется для programmatic showPicker() и
          fallback при тапе по иконке. На iOS — нативный picker, на Chrome desktop —
          встроенный date popover. opacity:0, position absolute чтобы не мешать UI. */}
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
        aria-hidden="true"
        tabIndex={-1}
        className="absolute right-0 top-0 bottom-0 w-12 opacity-0 pointer-events-none"
        style={{ WebkitAppearance: 'none', appearance: 'none' }}
      />
    </div>
  );
}
