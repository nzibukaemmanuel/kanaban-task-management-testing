import { unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  it('allows navigation when the component has no unsaved changes', () => {
    const component = { hasUnsavedChanges: () => false };

    const result = unsavedChangesGuard(component, {} as any, {} as any, {} as any);

    expect(result).toBe(true);
  });

  it('prompts for confirmation and blocks navigation if the user cancels', () => {
    const component = { hasUnsavedChanges: () => true };
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const result = unsavedChangesGuard(component, {} as any, {} as any, {} as any);

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(result).toBe(false);
    confirmSpy.mockRestore();
  });

  it('allows navigation if the user confirms leaving with unsaved changes', () => {
    const component = { hasUnsavedChanges: () => true };
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const result = unsavedChangesGuard(component, {} as any, {} as any, {} as any);

    expect(result).toBe(true);
    confirmSpy.mockRestore();
  });
});
