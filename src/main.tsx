import { render } from 'preact';
import { App } from './ui/App';

const root = document.getElementById('app')!;

if (new URLSearchParams(location.search).has('spike')) {
  // Temporary device-check page (Plan 02); removed in Plan 04.
  void import('./spike').then(({ Spike }) => render(<Spike />, root));
} else {
  render(<App />, root);
}
