import { Component, input, output } from '@angular/core';

// The pending half of any page that depends on remote data: a spinner while it loads, or a
// retryable error if the request failed. Pages render their real content in the other branch of
// an @if (rather than projecting it in here) so nothing in it is instantiated until data exists.
@Component({
  selector: 'app-data-state',
  templateUrl: './data-state.html',
  styleUrl: './data-state.css',
})
export class DataState {
  readonly error = input<string | null>(null);
  readonly loadingLabel = input('Loading…');

  readonly retry = output<void>();
}
