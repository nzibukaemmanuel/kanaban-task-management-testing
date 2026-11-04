import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectField } from './select-field';

describe('SelectField', () => {
  let fixture: ComponentFixture<SelectField>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectField],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectField);
    fixture.componentRef.setInput('options', [
      { value: 'todo', label: 'To do' },
      { value: 'doing', label: 'In progress' },
      { value: 'done', label: 'Done' },
    ]);
    fixture.componentRef.setInput('value', 'todo');
    fixture.detectChanges();
  });

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.select-trigger');
  }

  function options(): HTMLLIElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.select-option'));
  }

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the label of the currently selected option, closed by default', () => {
    expect(trigger().textContent).toContain('To do');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('.select-listbox')).toBeNull();
  });

  it('has no labelledby/required/invalid/describedby attributes by default', () => {
    expect(trigger().hasAttribute('aria-labelledby')).toBe(false);
    expect(trigger().hasAttribute('aria-required')).toBe(false);
    expect(trigger().hasAttribute('aria-invalid')).toBe(false);
    expect(trigger().hasAttribute('aria-describedby')).toBe(false);
  });

  it('forwards ariaLabelledby/ariaRequired/ariaInvalid/ariaDescribedby to the trigger button', () => {
    fixture.componentRef.setInput('ariaLabelledby', 'ext-label');
    fixture.componentRef.setInput('ariaRequired', true);
    fixture.componentRef.setInput('ariaInvalid', true);
    fixture.componentRef.setInput('ariaDescribedby', 'ext-error');
    fixture.detectChanges();

    expect(trigger().getAttribute('aria-labelledby')).toBe('ext-label');
    expect(trigger().getAttribute('aria-required')).toBe('true');
    expect(trigger().getAttribute('aria-invalid')).toBe('true');
    expect(trigger().getAttribute('aria-describedby')).toBe('ext-error');
  });

  it('focus() moves focus to the trigger button', () => {
    fixture.componentInstance.focus();

    expect(document.activeElement).toBe(trigger());
  });

  it('opens the listbox when the trigger is clicked', () => {
    trigger().click();
    fixture.detectChanges();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(options().length).toBe(3);
  });

  it('emits valueChange and closes when an option is clicked', () => {
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => emitted.push(value));

    trigger().click();
    fixture.detectChanges();
    options()[1].click();
    fixture.detectChanges();

    expect(emitted).toEqual(['doing']);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('does not emit when the already-selected option is clicked again', () => {
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => emitted.push(value));

    trigger().click();
    fixture.detectChanges();
    options()[0].click();
    fixture.detectChanges();

    expect(emitted).toEqual([]);
  });

  it('opens on ArrowDown and selects the active option on Enter', () => {
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => emitted.push(value));

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(emitted).toEqual(['doing']);
  });

  it('closes without emitting on Escape', () => {
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => emitted.push(value));

    trigger().click();
    fixture.detectChanges();
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(emitted).toEqual([]);
  });

  it('closes when a click happens outside the component', () => {
    trigger().click();
    fixture.detectChanges();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });
});
