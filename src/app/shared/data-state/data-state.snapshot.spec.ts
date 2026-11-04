import { TestBed } from '@angular/core/testing';
import { DataState } from './data-state';

// Snapshots pin the *structure* a user (and assistive tech) gets: roles, live regions and the
// retry button. A refactor that changes any of it shows up as a reviewable diff.
describe('DataState (snapshots)', () => {
  function render(inputs: { error?: string | null; loadingLabel?: string }) {
    const fixture = TestBed.createComponent(DataState);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture;
  }

  it('renders the loading state', () => {
    expect(render({}).nativeElement).toMatchSnapshot();
  });

  it('renders a custom loading label', () => {
    expect(render({ loadingLabel: 'Loading board…' }).nativeElement).toMatchSnapshot();
  });

  it('renders the error state with its retry button', () => {
    expect(
      render({ error: "Couldn't load boards. The server ran into a problem." }).nativeElement,
    ).toMatchSnapshot();
  });
});
