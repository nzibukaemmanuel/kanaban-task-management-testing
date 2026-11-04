import { toBoardId } from './board-id';

describe('toBoardId', () => {
  it('lowercases and hyphenates a typed name', () => {
    expect(toBoardId('Q4 Launch!')).toBe('q4-launch');
  });

  it('trims and collapses runs of separators', () => {
    expect(toBoardId('  Design   &  Research  ')).toBe('design-research');
  });

  it('returns an empty string when nothing usable is left', () => {
    expect(toBoardId(' !!! ')).toBe('');
  });
});
