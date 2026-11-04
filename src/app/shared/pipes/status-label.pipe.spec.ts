import { StatusLabelPipe } from './status-label.pipe';

describe('StatusLabelPipe', () => {
  const pipe = new StatusLabelPipe();

  it.each([
    ['todo', 'To do'],
    ['doing', 'In progress'],
    ['done', 'Done'],
  ])('maps %s to "%s"', (status, label) => {
    expect(pipe.transform(status)).toBe(label);
  });

  it.each([null, undefined, '', 'archived', 'DONE', 'toString', '__proto__'])(
    'renders %p as an empty string',
    (value) => {
      expect(pipe.transform(value)).toBe('');
    },
  );

  it('is pure: the same input always gives the same output', () => {
    expect(pipe.transform('doing')).toBe(pipe.transform('doing'));
  });

  it('is registered as a pure pipe', () => {
    expect((StatusLabelPipe as any).ɵpipe.pure).toBe(true);
  });
});
