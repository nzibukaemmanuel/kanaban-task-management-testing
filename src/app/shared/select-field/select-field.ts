import { Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';

export interface SelectFieldOption {
  value: string;
  label: string;
}

let nextInstanceId = 0;

// A themed stand-in for the native <select>. The browser owns the native popup's colors
// (its hover/selected highlight can't be styled with CSS in any browser), so matching the
// app's design end-to-end means rendering the option list ourselves. Follows the ARIA
// "select-only combobox" pattern: focus stays on the trigger button and the virtual
// selection is conveyed to assistive tech via aria-activedescendant.
@Component({
  selector: 'app-select-field',
  imports: [],
  templateUrl: './select-field.html',
  styleUrl: './select-field.css',
})
export class SelectField {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly instanceId = `select-field-${nextInstanceId++}`;

  readonly options = input.required<SelectFieldOption[]>();
  readonly value = input.required<string>();
  readonly ariaLabel = input<string | null>(null);
  // Prefer this over ariaLabel when there's already a visible label element on the page —
  // it points assistive tech at that real text instead of duplicating it in a hidden string.
  readonly ariaLabelledby = input<string | null>(null);
  readonly ariaRequired = input<boolean | null>(null);
  readonly ariaInvalid = input<boolean | null>(null);
  readonly ariaDescribedby = input<string | null>(null);

  readonly valueChange = output<string>();

  protected readonly isOpen = signal(false);
  protected readonly activeValue = signal<string | null>(null);
  protected readonly listboxId = `${this.instanceId}-listbox`;

  protected readonly selectedLabel = computed(
    () => this.options().find((option) => option.value === this.value())?.label ?? '',
  );

  protected readonly activeOptionId = computed(() => {
    const active = this.activeValue() ?? this.value();
    return this.optionId(active);
  });

  protected optionId(value: string): string {
    return `${this.instanceId}-option-${value}`;
  }

  focus(): void {
    (this.host.nativeElement.querySelector('.select-trigger') as HTMLButtonElement | null)?.focus();
  }

  protected toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  protected open(): void {
    this.isOpen.set(true);
    this.activeValue.set(this.value());
  }

  protected close(): void {
    this.isOpen.set(false);
  }

  protected selectOption(value: string): void {
    this.close();
    if (value !== this.value()) {
      this.valueChange.emit(value);
    }
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    const options = this.options();
    const activeIndex = options.findIndex((option) => option.value === (this.activeValue() ?? this.value()));

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        if (!this.isOpen()) {
          this.open();
          return;
        }
        const next = options[Math.min(activeIndex + 1, options.length - 1)];
        if (next) {
          this.activeValue.set(next.value);
        }
        return;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.isOpen()) {
          this.open();
          return;
        }
        const previous = options[Math.max(activeIndex - 1, 0)];
        if (previous) {
          this.activeValue.set(previous.value);
        }
        return;
      }
      case 'Home': {
        if (!this.isOpen()) return;
        event.preventDefault();
        const first = options[0];
        if (first) this.activeValue.set(first.value);
        return;
      }
      case 'End': {
        if (!this.isOpen()) return;
        event.preventDefault();
        const last = options[options.length - 1];
        if (last) this.activeValue.set(last.value);
        return;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        if (this.isOpen()) {
          const active = this.activeValue();
          if (active !== null) {
            this.selectOption(active);
          }
        } else {
          this.open();
        }
        return;
      }
      case 'Escape': {
        if (this.isOpen()) {
          event.preventDefault();
          this.close();
        }
        return;
      }
      case 'Tab': {
        this.close();
        return;
      }
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }
}
