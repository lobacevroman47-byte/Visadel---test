import { useEffect, useState } from 'react';
import {
  getAdditionalServices, getAppSettings,
  type AdditionalService, type AppSettings,
  type ExtraFormField, type CoreFieldOverrides,
} from '../lib/db';

// Единый источник истины для бронь-продуктов: цена/название/иконка из
// additional_services + extra_fields/core_overrides из app_settings.
//
// Используется HotelBookingForm, FlightBookingForm, Step2AdditionalDocs.
// Раньше каждый компонент тащил эту логику отдельно (дубли getAppSettings,
// getAdditionalServices, маппинга ov(), и т.п.).
//
// ── Архитектурный split (миграция 027) ──
// Теперь поддерживается scope: visa-аддон vs самостоятельная бронь.
// Это РАЗНЫЕ сущности с РАЗНЫМИ ценами и полями:
//   * scope='addon'      → визовая доп.услуга. id=hotel-booking,
//     поля из app_settings.hotel_extra_fields / hotel_core_overrides
//   * scope='standalone' → отдельный booking-flow. id=standalone-hotel-booking,
//     поля из app_settings.standalone_hotel_extra_fields / *_core_overrides
//
// Изменение цены/полей в одной системе НЕ влияет на другую.

export type BookingKind = 'hotel' | 'flight';
export type BookingScope = 'addon' | 'standalone';

export interface BookingProduct {
  id: string;
  kind: BookingKind;
  scope: BookingScope;
  enabled: boolean;
  name: string | null;
  icon: string | null;
  description: string | null;
  price: number;
  cardNumber: string;
  cardHolder: string;
  extraFields: ExtraFormField[];
  overrides: CoreFieldOverrides;
  loading: boolean;
}

interface ScopeConfig {
  serviceId: string;
  defaultPrice: number;
  pickPrice: (s: AppSettings) => number | undefined;
  pickExtraFields: (s: AppSettings) => ExtraFormField[] | undefined;
  pickOverrides: (s: AppSettings) => CoreFieldOverrides | undefined;
}

const CONFIGS: Record<BookingScope, Record<BookingKind, ScopeConfig>> = {
  addon: {
    hotel: {
      serviceId: 'hotel-booking',
      defaultPrice: 1000,
      pickPrice: s => s.hotel_booking_price,
      pickExtraFields: s => Array.isArray(s.hotel_extra_fields) ? s.hotel_extra_fields : undefined,
      pickOverrides: s => s.hotel_core_overrides,
    },
    flight: {
      serviceId: 'flight-booking',
      defaultPrice: 2000,
      pickPrice: s => s.flight_booking_price,
      pickExtraFields: s => Array.isArray(s.flight_extra_fields) ? s.flight_extra_fields : undefined,
      pickOverrides: s => s.flight_core_overrides,
    },
  },
  standalone: {
    hotel: {
      serviceId: 'standalone-hotel-booking',
      defaultPrice: 1000,
      pickPrice: s => s.standalone_hotel_booking_price,
      pickExtraFields: s => Array.isArray(s.standalone_hotel_extra_fields) ? s.standalone_hotel_extra_fields : undefined,
      pickOverrides: s => s.standalone_hotel_core_overrides,
    },
    flight: {
      serviceId: 'standalone-flight-booking',
      defaultPrice: 2000,
      pickPrice: s => s.standalone_flight_booking_price,
      pickExtraFields: s => Array.isArray(s.standalone_flight_extra_fields) ? s.standalone_flight_extra_fields : undefined,
      pickOverrides: s => s.standalone_flight_core_overrides,
    },
  },
};

export function useBookingProduct(kind: BookingKind, scope: BookingScope = 'standalone'): BookingProduct {
  const cfg = CONFIGS[scope][kind];
  const [state, setState] = useState<BookingProduct>(() => ({
    id: cfg.serviceId,
    kind,
    scope,
    enabled: true,
    name: null,
    icon: null,
    description: null,
    price: cfg.defaultPrice,
    cardNumber: '5536 9140 3834 6908',
    cardHolder: '',
    extraFields: [],
    overrides: {},
    loading: true,
  }));

  useEffect(() => {
    let alive = true;
    Promise.all([getAppSettings(), getAdditionalServices()])
      .then(([s, services]: [AppSettings, AdditionalService[]]) => {
        if (!alive) return;
        const row = services.find(x => x.id === cfg.serviceId);
        const fallbackPrice = cfg.pickPrice(s) ?? cfg.defaultPrice;
        setState({
          id: cfg.serviceId,
          kind,
          scope,
          enabled: row?.enabled ?? true,
          name: row?.name ?? null,
          icon: row?.icon ?? null,
          description: row?.description ?? null,
          price: row?.price ?? fallbackPrice,
          cardNumber: s.payment_card_number || '5536 9140 3834 6908',
          cardHolder: s.payment_card_holder ?? '',
          extraFields: cfg.pickExtraFields(s) ?? [],
          overrides: cfg.pickOverrides(s) ?? {},
          loading: false,
        });
      })
      .catch(() => { if (alive) setState(prev => ({ ...prev, loading: false })); });
    return () => { alive = false; };
  }, [kind, scope, cfg]);

  return state;
}

// Helper: применяет override (label/required/visible) к встроенному полю.
// Используется и в HotelBookingForm, и в FlightBookingForm, и в Step2.
export function resolveFieldOverride(
  overrides: CoreFieldOverrides,
  key: string,
  defaultLabel: string,
  defaultRequired: boolean,
) {
  const o = overrides[key] ?? {};
  return {
    label: o.label ?? defaultLabel,
    required: o.required ?? defaultRequired,
    visible: o.visible !== false,
  };
}
