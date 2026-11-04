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

describe('SelectField — keyboard and ARIA behaviour', () => {
  let fixture: ComponentFixture<SelectField>;
  let emitted: string[];

  const OPTIONS = [
    { value: 'todo', label: 'To do' },
    { value: 'doing', label: 'In progress' },
    { value: 'done', label: 'Done' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SelectField] }).compileComponents();
    fixture = TestBed.createComponent(SelectField);
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('value', 'doing');
    fixture.detectChanges();
    emitted = [];
    fixture.componentInstance.valueChange.subscribe((value) => emitted.push(value));
  });

  const trigger = () => fixture.nativeElement.querySelector('.select-trigger') as HTMLButtonElement;
  const optionEls = () =>
    Array.from(fixture.nativeElement.querySelectorAll('.select-option')) as HTMLLIElement[];
  const activeLabel = () => optionEls().find((o) => o.classList.contains('active'))?.textContent?.trim();
  const press = (key: string) => {
    const event = new KeyboardEvent('keydown', { key, cancelable: true });
    trigger().dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };
  const isOpen = () => trigger().getAttribute('aria-expanded') === 'true';

  it('exposes a combobox pattern: role, popup type and a listbox it controls', () => {
    trigger().click();
    fixture.detectChanges();

    expect(trigger().getAttribute('role')).toBe('combobox');
    expect(trigger().getAttribute('aria-haspopup')).toBe('listbox');
    const listbox = fixture.nativeElement.querySelector('[role="listbox"]') as HTMLElement;
    expect(trigger().getAttribute('aria-controls')).toBe(listbox.id);
  });

  it('marks the selected option with aria-selected and the selected class', () => {
    trigger().click();
    fixture.detectChanges();

    expect(optionEls().map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(optionEls().find((o) => o.classList.contains('selected'))?.textContent?.trim()).toBe('In progress');
  });

  it('starts the active option on the current value when it opens', () => {
    trigger().click();
    fixture.detectChanges();

    expect(activeLabel()).toBe('In progress');
  });

  it('points aria-activedescendant at the active option, only while open', () => {
    expect(trigger().getAttribute('aria-activedescendant')).toBeNull();

    trigger().click();
    fixture.detectChanges();
    const active = optionEls().find((o) => o.classList.contains('active'))!;

    expect(trigger().getAttribute('aria-activedescendant')).toBe(active.id);
  });

  it('closing the listbox removes the options from the DOM and the activedescendant', () => {
    trigger().click();
    fixture.detectChanges();

    trigger().click();
    fixture.detectChanges();

    expect(isOpen()).toBe(false);
    expect(optionEls()).toHaveLength(0);
    expect(trigger().getAttribute('aria-activedescendant')).toBeNull();
  });

  describe('arrow keys', () => {
    it('ArrowDown on a closed field opens it without moving the active option', () => {
      const event = press('ArrowDown');

      expect(isOpen()).toBe(true);
      expect(activeLabel()).toBe('In progress');
      expect(event.defaultPrevented).toBe(true);
    });

    it('ArrowUp on a closed field opens it too', () => {
      press('ArrowUp');

      expect(isOpen()).toBe(true);
    });

    it('ArrowDown moves to the next option and stops at the last', () => {
      press('ArrowDown'); // open
      press('ArrowDown');
      expect(activeLabel()).toBe('Done');

      press('ArrowDown');
      expect(activeLabel()).toBe('Done');
    });

    it('ArrowUp moves to the previous option and stops at the first', () => {
      press('ArrowUp'); // open
      press('ArrowUp');
      expect(activeLabel()).toBe('To do');

      press('ArrowUp');
      expect(activeLabel()).toBe('To do');
    });

    it('moving the active option does not change the value until it is chosen', () => {
      press('ArrowDown');
      press('ArrowDown');

      expect(emitted).toEqual([]);
      expect(fixture.nativeElement.querySelector('.select-trigger__label').textContent).toBe('In progress');
    });
  });

  describe('Home and End', () => {
    it('jump to the first and last option while open', () => {
      trigger().click();
      fixture.detectChanges();

      press('End');
      expect(activeLabel()).toBe('Done');

      press('Home');
      expect(activeLabel()).toBe('To do');
    });

    it('are left alone (not prevented) while closed', () => {
      expect(press('Home').defaultPrevented).toBe(false);
      expect(press('End').defaultPrevented).toBe(false);
      expect(isOpen()).toBe(false);
    });
  });

  describe('Enter and Space', () => {
    it.each(['Enter', ' '])('%j opens a closed field', (key) => {
      expect(press(key).defaultPrevented).toBe(true);
      expect(isOpen()).toBe(true);
    });

    it('Space chooses the active option when open, then closes', () => {
      press('ArrowDown'); // open
      press('ArrowDown'); // Done
      press(' ');

      expect(emitted).toEqual(['done']);
      expect(isOpen()).toBe(false);
    });

    it('does not emit when Enter confirms the option that is already selected', () => {
      press('Enter'); // open, active = current value
      press('Enter');

      expect(emitted).toEqual([]);
      expect(isOpen()).toBe(false);
    });

    it('selects the option the pointer last hovered', () => {
      trigger().click();
      fixture.detectChanges();

      optionEls()[2].dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();
      expect(activeLabel()).toBe('Done');

      press('Enter');
      expect(emitted).toEqual(['done']);
    });
  });

  describe('Escape and Tab', () => {
    it('Escape on a closed field does nothing and is not prevented', () => {
      expect(press('Escape').defaultPrevented).toBe(false);
      expect(isOpen()).toBe(false);
    });

    it('Escape on an open field is prevented, so a surrounding dialog is not also dismissed', () => {
      trigger().click();
      fixture.detectChanges();

      expect(press('Escape').defaultPrevented).toBe(true);
      expect(isOpen()).toBe(false);
    });

    it('Tab closes the list without emitting, letting focus move on', () => {
      trigger().click();
      fixture.detectChanges();

      const event = press('Tab');

      expect(isOpen()).toBe(false);
      expect(event.defaultPrevented).toBe(false);
      expect(emitted).toEqual([]);
    });

    it('ignores keys it has no meaning for', () => {
      expect(press('a').defaultPrevented).toBe(false);
      expect(isOpen()).toBe(false);
    });
  });

  describe('clicks', () => {
    it('choosing an option with a click is not treated as an outside click', () => {
      trigger().click();
      fixture.detectChanges();

      optionEls()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(emitted).toEqual(['todo']);
    });

    it('an outside click while closed has no effect', () => {
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(isOpen()).toBe(false);
      expect(emitted).toEqual([]);
    });
  });

  describe('inputs', () => {
    it('shows an empty label when the value matches no option', () => {
      fixture.componentRef.setInput('value', 'archived');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.select-trigger__label').textContent).toBe('');
    });

    it('follows the value input and the options input as they change', () => {
      fixture.componentRef.setInput('value', 'done');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.select-trigger__label').textContent).toBe('Done');

      fixture.componentRef.setInput('options', [{ value: 'done', label: 'Finished' }]);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.select-trigger__label').textContent).toBe('Finished');
    });

    it('does nothing on a key press when there are no options', () => {
      fixture.componentRef.setInput('options', []);
      fixture.detectChanges();

      press('ArrowDown');
      press('ArrowDown');
      press('End');
      press('Enter');

      expect(emitted).toEqual([]);
    });

    it('gives two instances different listbox ids', () => {
      const other = TestBed.createComponent(SelectField);
      other.componentRef.setInput('options', OPTIONS);
      other.componentRef.setInput('value', 'todo');
      other.detectChanges();
      const listboxId = (f: ComponentFixture<SelectField>) =>
        (f.nativeElement.querySelector('[role="listbox"]') as HTMLElement).id;

      trigger().click();
      fixture.detectChanges();
      const first = listboxId(fixture);

      // Opening another select counts as an outside click for the first, so read ids one at a time.
      (other.nativeElement.querySelector('.select-trigger') as HTMLButtonElement).click();
      other.detectChanges();
      const second = listboxId(other);

      expect(first).not.toBe(second);
    });
  });
});
