import { DueDatePipe } from './due-date.pipe';

describe('DueDatePipe', () => {
  const pipe = new DueDatePipe();

  it('formats an ISO date as a readable date', () => {
    expect(pipe.transform('2026-08-10')).toBe('Aug 10, 2026');
  });

  it('does not zero-pad the day', () => {
    expect(pipe.transform('2026-01-05')).toBe('Jan 5, 2026');
  });

  it('handles year boundaries and leap days', () => {
    expect(pipe.transform('2026-12-31')).toBe('Dec 31, 2026');
    expect(pipe.transform('2028-02-29')).toBe('Feb 29, 2028');
  });

  it('is independent of the local timezone', () => {
    const original = process.env['TZ'];
    try {
      process.env['TZ'] = 'Pacific/Kiritimati';
      expect(pipe.transform('2026-03-01')).toBe('Mar 1, 2026');
      process.env['TZ'] = 'Pacific/Pago_Pago';
      expect(pipe.transform('2026-03-01')).toBe('Mar 1, 2026');
    } finally {
      process.env['TZ'] = original;
    }
  });

  it.each([null, undefined, '', 'tomorrow', '2026-8-1', '10/08/2026', '2026-13-01', '2026-02-30', '2027-02-29', ' 2026-08-10'])(
    'renders %p as an empty string',
    (value) => {
      expect(pipe.transform(value)).toBe('');
    },
  );

  it('is pure: the same input always gives the same output', () => {
    expect(pipe.transform('2026-08-10')).toBe(pipe.transform('2026-08-10'));
  });

  it('is registered as a pure pipe', () => {
    expect((DueDatePipe as any).ɵpipe.pure).toBe(true);
  });
});
