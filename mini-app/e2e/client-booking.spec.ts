import { expect, test } from './fixtures';

import type { Page } from '@playwright/test';

/**
 * Selects the first bookable day in the calendar after advancing one month.
 *
 * Advancing to the next month lands us on a fully-future month, so the chosen
 * day's time slots are unaffected by the current time of day (selecting
 * "today" would be fragile once working hours have passed, and the last day of
 * a month has no future working days left in the current view at all). The
 * booking calendar renders without `fillOuterDays`, so only true in-month days
 * carry a `calendar-day-*` testid; the mock specialist works Mon–Sat, so the
 * first non-disabled day button is a valid working day with open slots.
 */
async function selectFirstBookableDayNextMonth(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Следующий месяц' }).click();

  const firstEnabledDay = page
    .locator('button[data-testid^="calendar-day-"]:not([disabled])')
    .first();
  await expect(firstEnabledDay).toBeVisible();
  await firstEnabledDay.click();
}

test.describe('Client booking smoke tests', () => {
  // Test 1: Home page renders specialist profile
  test('home page shows the specialist name and reaches a loaded state', async ({ page }) => {
    await page.goto('/test/client');

    // The specialist name from mock fixtures is 'Карлен Мисакян'
    const heading = page.getByRole('heading', { name: 'Карлен Мисакян' });
    await expect(heading).toBeVisible();

    // Ensure we are not stuck on the loading skeleton (no infinite "loading" state)
    const loadingText = page.getByText('Загрузка');
    await expect(loadingText).not.toBeVisible();

    // Confirm specialist specialization line is present
    await expect(page.getByText('Strength and mobility coach')).toBeVisible();

    // "Ваши записи" section heading confirms the page is fully loaded
    await expect(page.getByRole('heading', { name: 'Ваши записи' })).toBeVisible();
  });

  // Test 2: Client can complete a full booking (happy path)
  test('client can pick a service, date, and time slot, then submit a booking', async ({
    page,
  }) => {
    await page.goto('/test/client/book');

    // Wait for the booking form title to appear (confirms page loaded, not skeleton)
    await expect(page.getByRole('heading', { name: 'Онлайн запись' })).toBeVisible();

    // The form has 3 services; "Nutrition consultation" is common type (30min, no batch).
    // It should be a button whose accessible name contains the service name.
    const nutritionCard = page.getByRole('button', { name: /Nutrition consultation/i });
    await expect(nutritionCard).toBeVisible();
    await nutritionCard.click();

    // After selecting a service, a calendar appears. Pick the first bookable
    // day in the next month (deterministic regardless of run date/time).
    await selectFirstBookableDayNextMonth(page);

    // After picking a date, time slots appear. Each slot button renders a
    // start-time span ("HH:MM") plus an end-time span; unavailable slots are
    // disabled. Pick the first available (enabled) slot.
    const firstAvailableSlot = page
      .locator('button:not([disabled])')
      .filter({ has: page.locator('span', { hasText: /^\d{2}:\d{2}$/ }) })
      .first();
    await expect(firstAvailableSlot).toBeVisible({ timeout: 5000 });
    await firstAvailableSlot.click();

    // After selecting a time, the submit button should be enabled.
    // Button text is "Записаться" (btnSubmit) in Russian.
    const submitButton = page.getByRole('button', { name: 'Записаться' }).last();
    await expect(submitButton).toBeEnabled();

    // Submit the booking
    await submitButton.click();

    // On success the form calls router.push(resolveTestAwareHref(pathname, '/bookings'))
    // which under /test/client/book → /test/client/bookings.
    await page.waitForURL(/\/bookings/, { timeout: 10000 });

    // Confirm we actually landed on the bookings page (not a blank/error/404):
    // its "Мои записи" heading renders in every state of that page.
    await expect(page.getByRole('heading', { name: 'Мои записи' })).toBeVisible();
  });

  // Test 3: Submit button is disabled until a time slot is selected (unhappy path / edge case)
  test('submit button stays disabled when date is selected but no time slot is chosen', async ({
    page,
  }) => {
    await page.goto('/test/client/book');

    await expect(page.getByRole('heading', { name: 'Онлайн запись' })).toBeVisible();

    // Select "Nutrition consultation" service
    const nutritionCard = page.getByRole('button', { name: /Nutrition consultation/i });
    await nutritionCard.click();

    // Pick a future working day (first bookable day in the next month)
    await selectFirstBookableDayNextMonth(page);

    // Wait for time slots to appear so the UI is settled
    const firstAvailableSlot = page
      .locator('button:not([disabled])')
      .filter({ has: page.locator('span', { hasText: /^\d{2}:\d{2}$/ }) })
      .first();
    await expect(firstAvailableSlot).toBeVisible({ timeout: 5000 });

    // Do NOT click any time slot.
    // The submit / pinned button should still show the "Выберите время" label and be disabled.
    const selectTimeButton = page.getByRole('button', { name: 'Выберите время' });
    await expect(selectTimeButton).toBeDisabled();
  });
});
