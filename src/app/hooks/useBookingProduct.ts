import { useEffect, useState } from 'react';
import {
  getAdditionalServices, getAppSettings,
  type AdditionalService, type AppSettings,
  type ExtraFormField, type CoreFieldOverrides,
} from '../lib/db';

// Единый источник истины для бронь-аддонов: цена/название/иконка из
// additional_services + extra_fields/core_overrides из app_settings.
//
// Используется HotelBookingForm, FlightBookingForm, Step2AdditionalDocs.
// Раньше каждый компонент тащил эту логику отдельно (дубли getAppSettings,
// getAdditionalServices, маппинга ov(), и т.п.).

export type BookingKind = 'hotel' | 'flight';

export interface BookingProduct {
  id: 'hotel-booking' | 'flight-booking';
  kind: BookingKind;
  enabled: boolean;
  name: string | null;
  icon: string | null;
  description: string | null;
  price: number;
  cardNumber: string;
  extraFields: ExtraFormField[];
  overrides: CoreFieldOverrides;
  loading: boolean;
}

const DEFAULTS: Record<BookingKind, { id: BookingProduct['id']; price: number }> = {
  hotel:  { id: 'hotel-booking',  price: 1000 },
  flight: { id: 'flight-booking', price: 2000 },
};

export function useBookingProduct(kind: BookingKind): BookingProduct {
  const [state, setState] = useState<BookingProduct>(() => ({
    id: DEFAULTS[kind].id,
    kind,
    enabled: true,
    name: null,
    icon: null,
    description: null,
    price: DEFAULTS[kind].price,
    cardNumber: '5536 9140 3834 6908',
    extraFields: [],
    overrides: {},
    loading: true,
  }));

  useEffect(() => {
    let alive = true;
    Promise.all([getAppSettings(), getAdditionalServices()])
      .then(([s, services]: [AppSettings, AdditionalService[]]) => {
        if (!alive) return;
        const row = services.find(x => x.id === DEFAULTS[kind].id);
        const fallbackPrice = kind === 'hotel'
          ? (s.hotel_booking_price ?? DEFAULTS.hotel.price)
          : (s.flight_booking_price ?? DEFAULTS.flight.price);
        setState({
          id: DEFAULTS[kind].id,
          kind,
          enabled: row?.enabled ?? true,
          name: row?.name ?? null,
          icon: row?.icon ?? null,
          description: row?.description ?? null,
          price: row?.price ?? fallbackPrice,
          cardNumber: s.payment_card_number || '5536 9140 3834 6908',
          extraFields: kind === 'hotel'
            ? (Array.isArray(s.hotel_extra_fields) ? s.hotel_extra_fields : [])
            : (Array.isArray(s.flight_extra_fields) ? s.flight_extra_fields : []),
          overrides: kind === 'hotel'
            ? (s.hotel_core_overrides ?? {})
            : (s.flight_core_overrides ?? {}),
          loading: false,
        });
      })
      .catch(() => { if (alive) setState(prev => ({ ...prev, loading: false })); });
    return () => { alive = false; };
  }, [kind]);

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
