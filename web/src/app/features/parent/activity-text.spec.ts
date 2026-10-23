import { activityText } from './activity-text';

/** The PocketBase form of a local moment: UTC with a space and milliseconds. */
function pocketBaseDate(date: Date): string {
  return date.toISOString().replace('T', ' ');
}

describe('activityText', () => {
  // Every date is made with a local new Date(…), so the time zone of the test does not matter.
  const now = new Date(2026, 9, 23, 16, 30);

  it('today says vandaag om', () => {
    expect(activityText(new Date(2026, 9, 23, 14, 5).toISOString(), now)).toBe('vandaag om 14:05');
  });

  it('yesterday says gisteren om', () => {
    expect(activityText(new Date(2026, 9, 22, 9, 12).toISOString(), now)).toBe('gisteren om 9:12');
    // Also across the start of a month.
    expect(
      activityText(new Date(2026, 9, 31, 23, 59).toISOString(), new Date(2026, 10, 1, 8, 0)),
    ).toBe('gisteren om 23:59');
  });

  it('earlier this year gives day and month', () => {
    expect(activityText(new Date(2026, 9, 12, 14, 5).toISOString(), now)).toBe(
      '12 oktober om 14:05',
    );
  });

  it('another year adds the year', () => {
    expect(activityText(new Date(2025, 11, 3, 10, 0).toISOString(), now)).toBe(
      '3 december 2025 om 10:00',
    );
  });

  it('reads the PocketBase date format', () => {
    expect(activityText(pocketBaseDate(new Date(2026, 9, 23, 12, 5)), now)).toBe(
      'vandaag om 12:05',
    );
    expect(activityText('geen datum', now)).toBe('onbekend');
  });
});
