// Дополнительные услуги для усиления заявки

export interface AdditionalService {
  id: string;
  name: string;
  icon: string;
  description: string;
  price: number;
  enabled: boolean;
}

export const defaultAdditionalServices: AdditionalService[] = [
  {
    id: 'urgent-processing',
    name: 'Срочное оформление',
    icon: '⚡',
    description: 'Ускоренная обработка вашей заявки',
    price: 2000,
    enabled: true
  },
  {
    id: 'hotel-booking',
    name: 'Подтверждение бронирования жилья',
    icon: '🏨',
    description: 'Официальное подтверждение бронирования отеля',
    price: 1500,
    enabled: true
  },
  {
    id: 'flight-booking',
    name: 'Бронирование авиабилета',
    icon: '✈️',
    description: 'Бронирование билетов на рейс',
    price: 1800,
    enabled: true
  },
  {
    id: 'insurance',
    name: 'Страхование',
    icon: '🛡️',
    description: 'Туристическая страховка',
    price: 1200,
    enabled: false
  }
];
