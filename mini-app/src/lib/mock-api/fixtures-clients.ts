import { isoAt } from './utils';

import type { TClientInfo } from '../types';

const SPECIALIST_ID = 'mock-specialist';

type TClientSeed = {
  key: string;
  telegramUserId: number;
  telegramUsername?: string;
  name: string;
  displayName?: string;
  phone?: string;
  isGhost?: boolean;
  isBlocked?: boolean;
  joinedDaysAgo: number;
};

const CLIENT_SEEDS: TClientSeed[] = [
  {
    key: 'anna',
    telegramUserId: 101,
    telegramUsername: 'anna_morozova',
    name: 'Анна Морозова',
    displayName: 'Анна',
    phone: '+7 916 111-22-33',
    joinedDaysAgo: 80,
  },
  {
    key: 'ivan',
    telegramUserId: 102,
    telegramUsername: 'ivan_petrov',
    name: 'Иван Петров',
    displayName: 'Иван П.',
    phone: '+7 926 222-33-44',
    joinedDaysAgo: 35,
  },
  {
    key: 'maria',
    telegramUserId: 103,
    telegramUsername: 'maria_volkova',
    name: 'Мария Волкова',
    displayName: 'Мария',
    joinedDaysAgo: 12,
  },
  {
    key: 'guest',
    telegramUserId: -1700000000001,
    name: 'Ольга (по звонку)',
    phone: '+7 903 410-55-20',
    isGhost: true,
    joinedDaysAgo: 4,
  },
  {
    key: 'dasha',
    telegramUserId: 104,
    telegramUsername: 'dasha_kuznetsova',
    name: 'Дарья Кузнецова',
    displayName: 'Даша',
    phone: '+7 985 301-47-18',
    joinedDaysAgo: 120,
  },
  {
    key: 'sergey',
    telegramUserId: 105,
    telegramUsername: 'sergey_ivanov_pro',
    name: 'Сергей Иванов',
    phone: '+7 903 555-12-90',
    joinedDaysAgo: 95,
  },
  {
    key: 'katya',
    telegramUserId: 106,
    telegramUsername: 'kate_sokolova',
    name: 'Екатерина Соколова',
    displayName: 'Катя',
    phone: '+7 909 784-33-02',
    joinedDaysAgo: 150,
  },
  {
    key: 'dmitry',
    telegramUserId: 107,
    telegramUsername: 'dmitry_novikov',
    name: 'Дмитрий Новиков',
    phone: '+7 977 640-18-25',
    joinedDaysAgo: 60,
  },
  {
    key: 'alina',
    telegramUserId: 108,
    telegramUsername: 'alina_zakharova',
    name: 'Алина Захарова',
    phone: '+7 925 118-76-44',
    joinedDaysAgo: 45,
  },
  {
    key: 'pavel',
    telegramUserId: 109,
    telegramUsername: 'pavel_lebedev',
    name: 'Павел Лебедев',
    phone: '+7 999 203-61-70',
    isBlocked: true,
    joinedDaysAgo: 70,
  },
  {
    key: 'natalia',
    telegramUserId: 110,
    telegramUsername: 'natalia_orlova',
    name: 'Наталья Орлова',
    displayName: 'Наташа',
    phone: '+7 916 872-09-31',
    joinedDaysAgo: 200,
  },
  {
    key: 'andrey',
    telegramUserId: 111,
    telegramUsername: 'andrey_vasiliev',
    name: 'Андрей Васильев',
    phone: '+7 962 430-77-15',
    joinedDaysAgo: 28,
  },
  {
    key: 'olga',
    telegramUserId: 112,
    telegramUsername: 'olga_belova',
    name: 'Ольга Белова',
    phone: '+7 905 667-21-83',
    joinedDaysAgo: 18,
  },
  {
    key: 'mikhail',
    telegramUserId: 113,
    telegramUsername: 'mikhail_fedorov',
    name: 'Михаил Фёдоров',
    displayName: 'Миша',
    phone: '+7 921 345-60-09',
    joinedDaysAgo: 9,
  },
];

export type TClientsByKey = Record<string, TClientInfo>;

export function createClients(): { clients: TClientInfo[]; byKey: TClientsByKey } {
  const clients: TClientInfo[] = [];
  const byKey: TClientsByKey = {};

  for (const seed of CLIENT_SEEDS) {
    const client: TClientInfo = {
      id: `mock-client-${seed.key}`,
      telegramUserId: seed.telegramUserId,
      telegramUsername: seed.telegramUsername,
      specialistId: SPECIALIST_ID,
      name: seed.name,
      displayName: seed.displayName,
      phone: seed.phone,
      isGhost: seed.isGhost,
      isBlocked: seed.isBlocked,
      createdAt: isoAt(-seed.joinedDaysAgo, '09:00'),
    };
    clients.push(client);
    byKey[seed.key] = client;
  }

  const elena: TClientInfo = {
    id: 'mock-profile',
    telegramUserId: 999,
    telegramUsername: 'elena_smirnova',
    specialistId: SPECIALIST_ID,
    name: 'Елена Смирнова',
    displayName: 'Елена',
    phone: '+7 900 777-66-55',
    createdAt: isoAt(-100, '09:00'),
  };
  clients.push(elena);
  byKey.elena = elena;

  return { clients, byKey };
}
