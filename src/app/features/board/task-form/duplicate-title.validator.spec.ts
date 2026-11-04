import { FormControl } from '@angular/forms';
import { duplicateTitleValidator } from './duplicate-title.validator';

describe('duplicateTitleValidator', () => {
  const validate = (value: string | null, existing: string[]) =>
    duplicateTitleValidator(() => existing)(new FormControl(value));

  it('flags a title that matches a sibling exactly', () => {
    expect(validate('Ship it', ['Ship it'])).toEqual({ duplicateTitle: true });
  });

  it('ignores case and surrounding whitespace on both sides', () => {
    expect(validate('  SHIP it ', ['ship IT  '])).toEqual({ duplicateTitle: true });
  });

  it('accepts a title that is only a prefix or superset of a sibling', () => {
    expect(validate('Ship', ['Ship it'])).toBeNull();
    expect(validate('Ship it now', ['Ship it'])).toBeNull();
  });

  it('accepts anything when there are no siblings', () => {
    expect(validate('Ship it', [])).toBeNull();
  });

  it.each([[''], ['   '], [null]])(
    'leaves an empty value (%j) to the required validator',
    (value) => {
      expect(validate(value, ['', 'Ship it'])).toBeNull();
    },
  );

  it('reads the sibling list at validation time, not when the validator was built', () => {
    let siblings: string[] = [];
    const control = new FormControl(
      'Ship it',
      duplicateTitleValidator(() => siblings),
    );
    expect(control.valid).toBe(true);

    siblings = ['Ship it'];
    control.updateValueAndValidity();

    expect(control.hasError('duplicateTitle')).toBe(true);
  });
});
