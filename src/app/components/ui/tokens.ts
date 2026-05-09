// VISADEL Design Tokens — единый источник правды для всего UI.
//
// Используется reusable-компонентами из ./ui/. Существующие страницы
// продолжают работать на inline Tailwind классах — это намеренно, чтобы
// миграция шла постепенно без breaking changes.
//
// Когда будем мигрировать страницу: заменяем raw className строки на
// <Button>, <Input>, <Card> etc. — те же визуальные результаты, но
// одна строка изменения вместо десяти.
//
// Глобальные tokens из CSS (vd-grad, vd-grad-soft, vd-shadow-cta) — в
// src/styles/globals.css. Здесь дублируем только TS-side ссылки чтобы
// автокомплит и type-safety работали.

// ── Colors ──────────────────────────────────────────────────────────────────
export const colors = {
  // Brand
  brand:        '#3B5BFF',  // primary CTA
  brandLight:   '#5C7BFF',  // borders/accents
  brandDark:    '#4F2FE6',  // hover state
  brandSubtle:  '#EAF1FF',  // soft backgrounds

  // Text
  text:         '#0F2A36',  // primary text (almost black)
  textMuted:    'rgb(15 42 54 / 0.6)',  // 60% — secondary
  textSubtle:   'rgb(15 42 54 / 0.45)', // 45% — captions/hints

  // Surfaces
  bg:           '#F5F7FA',  // app background (between cards)
  surface:      '#FFFFFF',  // card/modal background
  border:       '#E1E5EC',  // hairline borders

  // Status (semantic)
  success:      '#10B981',  // emerald-500
  successBg:    '#D1FAE5',  // emerald-100
  warning:      '#F59E0B',  // amber-500
  warningBg:    '#FEF3C7',  // amber-100
  danger:       '#EF4444',  // rose-500
  dangerBg:     '#FEE2E2',  // rose-100
  info:         '#3B5BFF',  // = brand
  infoBg:       '#EAF1FF',  // = brandSubtle
} as const;

// ── Typography ──────────────────────────────────────────────────────────────
// Соответствуют классам Tailwind text-{size}. Используем как ссылки в JSDoc.
export const typography = {
  // Page titles
  pageTitle:    'text-[22px] font-extrabold tracking-tight text-[#0F2A36]',
  // Section titles
  sectionTitle: 'text-base font-bold text-[#0F2A36]',
  // Card titles
  cardTitle:    'text-sm font-bold text-[#0F2A36]',
  // Body
  body:         'text-sm text-[#0F2A36]',
  bodyMuted:    'text-sm text-[#0F2A36]/60',
  // Caption
  caption:      'text-xs text-[#0F2A36]/60',
  captionMuted: 'text-xs text-[#0F2A36]/45',
  // Label (small caps over input)
  label:        'text-xs text-gray-500',
  // UPPERCASE micro-label (above section)
  microLabel:   'text-[10px] uppercase tracking-widest font-bold',
  // Status pills text
  status:       'text-[11px] font-medium',
  // Button text
  buttonText:   'text-sm font-semibold',
} as const;

// ── Spacing ─────────────────────────────────────────────────────────────────
// Использовать как Tailwind classes. 4px (1) — base unit.
export const spacing = {
  // Inline gaps
  gapTight:    'gap-1',     // 4px
  gapDefault:  'gap-2',     // 8px
  gapWide:     'gap-3',     // 12px

  // Stack (vertical) gaps
  stackTight:    'space-y-2',   // 8px between blocks
  stackDefault:  'space-y-3',   // 12px
  stackLoose:    'space-y-4',   // 16px

  // Container padding
  cardPadding:   'p-5',     // standard card
  cardPaddingSm: 'p-4',     // dense cards (lists)
  modalPadding:  'px-5 py-5',
} as const;

// ── Radii ───────────────────────────────────────────────────────────────────
export const radii = {
  pill:  'rounded-full',   // 9999px — buttons-circles, badges
  field: 'rounded-xl',     // 12px — inputs, small buttons
  card:  'rounded-2xl',    // 16px — cards, modals, hero blocks
} as const;

// ── Shadows ─────────────────────────────────────────────────────────────────
export const shadows = {
  cta:   'shadow-md vd-shadow-cta',  // CTA-кнопки (vd-shadow-cta из globals.css)
  card:  'shadow-sm',                // карточки
  none:  '',
} as const;

// ── Sizes (heights) ─────────────────────────────────────────────────────────
// Унифицированные высоты для кнопок и инпутов.
export const sizes = {
  buttonSm:   'py-1.5 px-3 text-xs',          // 30-32px
  buttonMd:   'py-2.5 px-4 text-sm',          // 40px (стандарт)
  buttonLg:   'py-3 px-5 text-sm',            // 44px (CTA на странице)
  inputDefault: 'py-2.5 px-3 text-sm',        // 40px
} as const;

// ── Brand gradients (CSS classes из globals.css) ────────────────────────────
export const gradients = {
  /** Primary CTA gradient — основной brand-градиент */
  primary:  'vd-grad text-white',
  /** Soft brand gradient — фон hero-карточек */
  soft:     'vd-grad-soft',
  /** Brand text gradient (для крупных чисел/денег) */
  text:     'vd-grad-text',
} as const;
