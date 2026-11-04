import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// A factory (not a bare ValidatorFn) so the check reads the current sibling-title list at
// validation time via the closure, rather than freezing whatever list existed when the form
// was built.
export function duplicateTitleValidator(existingTitles: () => string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const title = ((control.value as string) ?? '').trim().toLowerCase();
    if (!title) {
      return null; 
    }
    const isDuplicate = existingTitles().some((other) => other.trim().toLowerCase() === title);
    return isDuplicate ? { duplicateTitle: true } : null;
  };
}
