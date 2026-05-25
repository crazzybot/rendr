import { renderOutliner } from './outliner';
import { renderProperties } from './properties';
import { updateStatus } from './status';

export function refreshUI(): void {
  renderOutliner();
  renderProperties();
  updateStatus();
}
