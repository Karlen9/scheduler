import { describe, expect, it } from 'vitest';

import { generateTimeSlotsForDay } from '../helpers';

describe('generateTimeSlotsForDay', () => {
  it('merges and sorts slots from multiple intervals on the same day', () => {
    const slots = generateTimeSlotsForDay(
      [
        { dayOfWeek: 1, startTime: '14:00', endTime: '18:00' },
        { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
      ],
      1,
      60,
    );

    expect(slots).toEqual(['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']);
  });

  it('deduplicates slots if intervals overlap in stored data', () => {
    const slots = generateTimeSlotsForDay(
      [
        { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 1, startTime: '11:00', endTime: '13:00' },
      ],
      1,
      60,
    );

    expect(slots).toEqual(['09:00', '10:00', '11:00', '12:00']);
  });

  it('divides the day by the selected duration', () => {
    const slots = generateTimeSlotsForDay(
      [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }],
      1,
      45,
    );

    expect(slots).toEqual(['09:00', '09:45', '10:30', '11:15']);
  });
});
