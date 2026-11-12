import type { TSessionType } from '../types';

export function createServices(): TSessionType[] {
  return [
    {
      id: 'mock-service-personal',
      type: 'common',
      name: 'Классический массаж спины',
      durationMinutes: 60,
      price: 3500,
      currency: 'RUB',
    },
    {
      id: 'mock-service-mobility',
      type: 'batch',
      name: 'Курс массажа спины, 10 сеансов',
      durationMinutes: 45,
      price: 28000,
      currency: 'RUB',
      sessionsCount: 10,
    },
    {
      id: 'mock-service-consultation',
      type: 'common',
      name: 'Консультация и подбор программы',
      durationMinutes: 30,
      price: 1500,
      currency: 'RUB',
    },
    {
      id: 'mock-service-relax',
      type: 'common',
      name: 'Расслабляющий массаж всего тела',
      durationMinutes: 90,
      price: 5500,
      currency: 'RUB',
    },
    {
      id: 'mock-service-neck',
      type: 'batch',
      name: 'Абонемент: шея и плечи, 5 сеансов',
      durationMinutes: 30,
      price: 7500,
      currency: 'RUB',
      sessionsCount: 5,
    },
  ];
}
