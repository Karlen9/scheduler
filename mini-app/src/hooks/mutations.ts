import { mutate } from 'swr';

import { CACHE_KEYS } from './cache-keys';

import type { TMutationEvent } from '@/lib/mutation-events';
import type { TChangeGroup } from '@/lib/types';

async function runRevalidation(label: string, action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (err) {
    console.error(`Cache revalidation failed for ${label}:`, err);
  }
}

function isRecurringDetailKey(key: unknown): boolean {
  return (
    typeof key === 'string' &&
    (key.startsWith('recurringDetail:') || key.startsWith('adminRecurringDetail:'))
  );
}

function isAdminBookingsListKey(key: unknown): boolean {
  return typeof key === 'string' && key.includes('adminBookingsList:');
}

function isBookingsListKey(key: unknown): boolean {
  return typeof key === 'string' && key.includes('bookingsList:');
}

function isAdminClientsListKey(key: unknown): boolean {
  return typeof key === 'string' && key.includes('adminClientsList:');
}

function isAdminClientBatchesKey(key: unknown): boolean {
  return typeof key === 'string' && key.includes('adminClientBatches:');
}

async function revalidateKeys(keys: string[]): Promise<void> {
  await Promise.all(
    [...new Set(keys)].map(async (key) => runRevalidation(key, async () => mutate(key))),
  );
}

async function revalidateRecurringDetails(): Promise<void> {
  await runRevalidation('recurring details', async () =>
    mutate(isRecurringDetailKey, undefined, { revalidate: true }),
  );
}

async function revalidateAdminBookingsLists(): Promise<void> {
  await runRevalidation('admin bookings lists', async () =>
    mutate(isAdminBookingsListKey, undefined, { revalidate: true }),
  );
}

async function revalidateBookingsLists(): Promise<void> {
  await runRevalidation('client bookings lists', async () =>
    mutate(isBookingsListKey, undefined, { revalidate: true }),
  );
}

async function revalidateAdminClientsLists(): Promise<void> {
  await runRevalidation('admin clients lists', async () =>
    mutate(isAdminClientsListKey, undefined, { revalidate: true }),
  );
}

async function revalidateAdminClientBatches(): Promise<void> {
  await runRevalidation('admin client batches', async () =>
    mutate(isAdminClientBatchesKey, undefined, { revalidate: true }),
  );
}

function mutationGroupsForEndpoint({ method, endpoint }: TMutationEvent): TChangeGroup[] {
  const path = endpoint.split('?')[0];

  if (path.endsWith('/preview')) {
    return [];
  }

  if (path === '/api/bookings' && method === 'POST') {
    return ['bookings', 'clients', 'clientBatches'];
  }
  if (path.startsWith('/api/bookings/')) {
    return ['bookings', 'clientBatches'];
  }
  if (path.startsWith('/api/admin/bookings')) {
    return ['bookings', 'clientBatches'];
  }

  if (path.startsWith('/api/admin/recurring') || path.startsWith('/api/recurring')) {
    return ['recurring', 'bookings'];
  }

  if (path.startsWith('/api/admin/services')) {
    return ['services'];
  }

  if (path.startsWith('/api/admin/working-hours')) {
    return ['workingHours'];
  }

  if (path.startsWith('/api/admin/days-off')) {
    return ['daysOff'];
  }

  if (path === '/api/admin/clients' && method === 'POST') {
    return ['clients'];
  }
  if (path.startsWith('/api/admin/clients')) {
    return ['clients', 'bookings', 'recurring', 'clientBatches'];
  }

  if (path === '/api/profile/notifications') {
    return ['clientProfile'];
  }
  if (path === '/api/profile') {
    return ['clientProfile', 'clients', 'bookings', 'recurring'];
  }

  if (path === '/api/admin/notifications') {
    return ['adminNotifications'];
  }
  if (path === '/api/admin/profile' || path === '/api/admin/upload/photo') {
    return ['specialist'];
  }

  return [];
}

/***************************************************************************************************
 * Revalidates frontend cache keys for backend change groups.
 ***************************************************************************************************/
export async function invalidateChangeGroups(groups: TChangeGroup[]): Promise<void> {
  const keys = new Set<string>();
  let shouldRevalidateRecurringDetails = false;
  let shouldRevalidateAdminBookingsLists = false;
  let shouldRevalidateBookingsLists = false;
  let shouldRevalidateAdminClientsLists = false;
  let shouldRevalidateAdminClientBatches = false;

  for (const group of new Set(groups)) {
    switch (group) {
      case 'bookings':
        keys.add(CACHE_KEYS.bookings);
        keys.add(CACHE_KEYS.clientStats);
        keys.add(CACHE_KEYS.adminBookings);
        keys.add(CACHE_KEYS.adminStats);
        shouldRevalidateAdminBookingsLists = true;
        shouldRevalidateBookingsLists = true;
        break;
      case 'clientBatches':
        keys.add(CACHE_KEYS.clientBatches);
        shouldRevalidateAdminClientBatches = true;
        break;
      case 'recurring':
        keys.add(CACHE_KEYS.recurringSchedules);
        keys.add(CACHE_KEYS.adminRecurringSchedules);
        shouldRevalidateRecurringDetails = true;
        break;
      case 'clients':
        keys.add(CACHE_KEYS.adminClients);
        shouldRevalidateAdminClientsLists = true;
        break;
      case 'services':
        keys.add(CACHE_KEYS.sessionTypes);
        keys.add(CACHE_KEYS.adminServices);
        break;
      case 'workingHours':
        keys.add(CACHE_KEYS.workingHours);
        keys.add(CACHE_KEYS.scheduleContext);
        keys.add(CACHE_KEYS.adminWorkingHours);
        keys.add(CACHE_KEYS.adminScheduleContext);
        break;
      case 'daysOff':
        keys.add(CACHE_KEYS.daysOff);
        keys.add(CACHE_KEYS.scheduleContext);
        keys.add(CACHE_KEYS.adminDaysOff);
        keys.add(CACHE_KEYS.adminScheduleContext);
        break;
      case 'specialist':
        keys.add(CACHE_KEYS.specialist);
        keys.add(CACHE_KEYS.adminProfile);
        break;
      case 'clientProfile':
        keys.add(CACHE_KEYS.profile);
        break;
      case 'adminNotifications':
        keys.add(CACHE_KEYS.adminNotifications);
        break;
    }
  }

  await Promise.all([
    revalidateKeys([...keys]),
    shouldRevalidateRecurringDetails ? revalidateRecurringDetails() : Promise.resolve(),
    shouldRevalidateAdminBookingsLists ? revalidateAdminBookingsLists() : Promise.resolve(),
    shouldRevalidateBookingsLists ? revalidateBookingsLists() : Promise.resolve(),
    shouldRevalidateAdminClientsLists ? revalidateAdminClientsLists() : Promise.resolve(),
    shouldRevalidateAdminClientBatches ? revalidateAdminClientBatches() : Promise.resolve(),
  ]);
}

export async function invalidateMutation(event: TMutationEvent): Promise<void> {
  await invalidateChangeGroups(mutationGroupsForEndpoint(event));
}

export async function invalidateBookings(): Promise<void> {
  await invalidateChangeGroups(['bookings']);
}

export async function invalidateClientStats(): Promise<void> {
  await revalidateKeys([CACHE_KEYS.clientStats]);
}

export async function invalidateAdminStats(): Promise<void> {
  await revalidateKeys([CACHE_KEYS.adminStats]);
}

export async function invalidateWorkingHours(): Promise<void> {
  await invalidateChangeGroups(['workingHours']);
}

export async function invalidateDaysOff(): Promise<void> {
  await invalidateChangeGroups(['daysOff']);
}

export async function invalidateServices(): Promise<void> {
  await invalidateChangeGroups(['services']);
}

export async function invalidateSpecialist(): Promise<void> {
  await invalidateChangeGroups(['specialist']);
}

export async function invalidateProfile(): Promise<void> {
  await invalidateChangeGroups(['clientProfile']);
}

export async function invalidateRecurring(): Promise<void> {
  await invalidateChangeGroups(['recurring', 'bookings']);
}

export async function invalidateClients(): Promise<void> {
  await invalidateChangeGroups(['clients']);
}

export async function invalidateClientBatches(): Promise<void> {
  await invalidateChangeGroups(['clientBatches']);
}

export async function invalidateAdminNotifications(): Promise<void> {
  await invalidateChangeGroups(['adminNotifications']);
}
