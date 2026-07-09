import { expect } from 'chai';
import { findFirstMissingDailySnapshotTimestamp } from '../services/transparency';

describe('findFirstMissingDailySnapshotTimestamp', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  it('returns the missing completed day even when a newer current-day point exists', () => {
    const jul3 = Date.UTC(2026, 6, 3, 23, 59, 59, 999);
    const jul8 = Date.UTC(2026, 6, 8, 23, 59, 59, 999);
    const jul9 = Date.UTC(2026, 6, 9, 23, 59, 59, 999);

    const nextMissingTimestamp = findFirstMissingDailySnapshotTimestamp({
      startTimestamp: jul3,
      lastCompleteDayEnd: jul8,
      existingTimestamps: [
        jul3,
        jul3 + DAY_MS,
        jul3 + (2 * DAY_MS),
        jul3 + (3 * DAY_MS),
        jul3 + (4 * DAY_MS),
        jul9,
      ],
    });

    expect(nextMissingTimestamp).to.equal(jul8);
  });

  it('returns the next day after the completed range when there are no gaps', () => {
    const jul3 = Date.UTC(2026, 6, 3, 23, 59, 59, 999);
    const jul8 = Date.UTC(2026, 6, 8, 23, 59, 59, 999);

    const nextMissingTimestamp = findFirstMissingDailySnapshotTimestamp({
      startTimestamp: jul3,
      lastCompleteDayEnd: jul8,
      existingTimestamps: [
        jul3,
        jul3 + DAY_MS,
        jul3 + (2 * DAY_MS),
        jul3 + (3 * DAY_MS),
        jul3 + (4 * DAY_MS),
        jul8,
      ],
    });

    expect(nextMissingTimestamp).to.equal(jul8 + DAY_MS);
  });
});
