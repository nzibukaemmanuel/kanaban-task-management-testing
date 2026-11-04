import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataState } from './data-state';

@Component({
  imports: [DataState],
  template: `
    <app-data-state
      [error]="error()"
      loadingLabel="Loading things…"
      (retry)="retries = retries + 1"
    />
  `,
})
class Host {
  readonly error = signal<string | null>(null);
  retries = 0;
}

describe('DataState', () => {
  let fixture: ComponentFixture<Host>;
  const el = (selector: string) =>
    fixture.nativeElement.querySelector(selector) as HTMLElement | null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('shows a polite status spinner with the given label while there is no error', () => {
    expect(el('[role="status"]')?.textContent).toContain('Loading things…');
    expect(el('[role="alert"]')).toBeNull();
  });

  it('shows the error with a retry button, which emits retry', () => {
    fixture.componentInstance.error.set('Server is down.');
    fixture.detectChanges();

    expect(el('[role="alert"]')?.textContent).toContain('Server is down.');
    expect(el('[role="status"]')).toBeNull();

    el('button')?.click();
    expect(fixture.componentInstance.retries).toBe(1);
  });

  it('goes back to the spinner once the error is cleared by a retry', () => {
    fixture.componentInstance.error.set('Failed.');
    fixture.detectChanges();
    fixture.componentInstance.error.set(null);
    fixture.detectChanges();

    expect(el('[role="alert"]')).toBeNull();
    expect(el('[role="status"]')).not.toBeNull();
  });
});
