import { CanDeactivateFn } from '@angular/router';

export interface ComponentWithUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

// Generic — any routed component that implements hasUnsavedChanges() can reuse this guard
// instead of writing a one-off CanDeactivate for every form.
export const unsavedChangesGuard: CanDeactivateFn<ComponentWithUnsavedChanges> = (component) => {
  if (!component.hasUnsavedChanges()) {
    return true;
  }
  return confirm('You have unsaved changes. Leave this page anyway?');
};
