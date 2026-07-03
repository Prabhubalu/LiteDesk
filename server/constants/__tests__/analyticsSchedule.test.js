const {
  buildCronExpression,
  ANALYTICS_SCHEDULE_FREQUENCIES,
} = require('../../constants/analyticsSchedule');

describe('analyticsSchedule constants', () => {
  it('buildCronExpression supports daily, weekly, monthly', () => {
    expect(
      buildCronExpression({ frequency: 'daily', hour: 9, minute: 30 })
    ).toBe('30 9 * * *');

    expect(
      buildCronExpression({ frequency: 'weekly', hour: 8, minute: 0, dayOfWeek: 1 })
    ).toBe('0 8 * * 1');

    expect(
      buildCronExpression({ frequency: 'monthly', hour: 7, minute: 15, dayOfMonth: 15 })
    ).toBe('15 7 15 * *');
  });

  it('exports schedule frequencies', () => {
    expect(ANALYTICS_SCHEDULE_FREQUENCIES).toEqual(['daily', 'weekly', 'monthly']);
  });
});
