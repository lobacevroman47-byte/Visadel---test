// Требования к фотографиям для каждой страны

import { PhotoRequirement } from './countriesData';

// Обязательные фото для всех стран
export const defaultPhotoRequirements: PhotoRequirement[] = [
  {
    id: 'photo-face',
    label: 'Фото лица',
    key: 'face_photo',
    required: true,
    requirements: 'Светлый фон, можно на телефон, ~80% лица, без очков',
    formats: 'JPG/PNG/PDF',
    maxSize: '5MB'
  },
  {
    id: 'photo-passport',
    label: 'Фото загранпаспорта',
    key: 'passport_photo',
    required: true,
    requirements: 'Хорошо читаемо, без бликов и пальцев, срок действия не менее 6 месяцев',
    formats: 'JPG/PNG/PDF',
    maxSize: '5MB'
  }
];

// Дополнительные фото для Индии
export const indiaPhotoRequirements: PhotoRequirement[] = [
  ...defaultPhotoRequirements,
  {
    id: 'photo-india-prev-visa',
    label: 'Фото предыдущей индийской визы (если была)',
    key: 'previous_india_visa',
    required: false,
    formats: 'JPG/PNG/PDF',
    maxSize: '5MB'
  },
  {
    id: 'photo-india-stamps',
    label: 'Фото штампов пограничной службы Индии (если есть)',
    key: 'india_border_stamps',
    required: false,
    formats: 'JPG/PNG/PDF',
    maxSize: '5MB'
  }
];

// Дополнительные фото для Южной Кореи
export const southKoreaPhotoRequirements: PhotoRequirement[] = [
  ...defaultPhotoRequirements,
  {
    id: 'photo-korea-second-passport',
    label: 'Фото второго паспорта (если двойное гражданство)',
    key: 'second_passport',
    required: false,
    formats: 'JPG/PNG/PDF',
    maxSize: '5MB'
  }
];

// Дополнительные фото для Камбоджи
export const cambodiaPhotoRequirements: PhotoRequirement[] = [
  ...defaultPhotoRequirements,
  {
    id: 'photo-cambodia-hotel',
    label: 'Файл бронирования отеля',
    key: 'hotel_booking',
    required: true,
    requirements: 'Обязательное поле',
    formats: 'JPG/PNG/PDF',
    maxSize: '5MB',
    hideIfServiceSelected: 'hotel-booking' // ID услуги "Бронь отеля"
  }
];

// Дополнительные фото для Кении
export const kenyaPhotoRequirements: PhotoRequirement[] = [
  ...defaultPhotoRequirements,
  {
    id: 'photo-kenya-hotel',
    label: 'Файл бронирования отеля / письмо-приглашение',
    key: 'hotel_or_invitation',
    required: true,
    requirements: 'Файл бронирования отеля (если остановка у друзей/семьи — письмо-приглашение)',
    formats: 'JPG/PNG/PDF',
    maxSize: '5MB'
  },
  {
    id: 'photo-kenya-flight',
    label: 'Файл авиабилета/круиза',
    key: 'flight_ticket',
    required: true,
    requirements: 'Обязательное поле',
    formats: 'JPG/PNG/PDF',
    maxSize: '5MB',
    hideIfServiceSelected: 'flight-booking' // ID услуги "Бронь обратного билета"
  }
];

// Маппинг стран к требованиям фотографий
export const countryPhotoRequirements: Record<string, PhotoRequirement[]> = {
  'india': indiaPhotoRequirements,
  'vietnam': defaultPhotoRequirements,
  'sri-lanka': defaultPhotoRequirements,
  'south-korea': southKoreaPhotoRequirements,
  'israel': defaultPhotoRequirements,
  'pakistan': defaultPhotoRequirements,
  'cambodia': cambodiaPhotoRequirements,
  'kenya': kenyaPhotoRequirements
};
