import { SubtaskProgressPipe } from './subtask-progress.pipe';

describe('SubtaskProgressPipe', () => {
  const pipe = new SubtaskProgressPipe();

  it('summarises completed vs total subtasks', () => {
    expect(pipe.transform([{ completed: true }, { completed: false }, { completed: true }])).toBe('2 of 3 subtasks');
  });

  it('reports zero completed', () => {
    expect(pipe.transform([{ completed: false }, { completed: false }])).toBe('0 of 2 subtasks');
  });

  it('uses the singular for a single subtask', () => {
    expect(pipe.transform([{ completed: true }])).toBe('1 of 1 subtask');
  });

  it.each([null, undefined, []])('renders %p as an empty string', (value) => {
    expect(pipe.transform(value)).toBe('');
  });

  it('does not mutate its input', () => {
    const subtasks = Object.freeze([Object.freeze({ completed: true })]);
    expect(() => pipe.transform(subtasks)).not.toThrow();
    expect(subtasks).toEqual([{ completed: true }]);
  });

  it('re-evaluates for a new array reference', () => {
    expect(pipe.transform([{ completed: false }])).toBe('0 of 1 subtask');
    expect(pipe.transform([{ completed: true }])).toBe('1 of 1 subtask');
  });

  it('is registered as a pure pipe', () => {
    expect((SubtaskProgressPipe as any).ɵpipe.pure).toBe(true);
  });
});
