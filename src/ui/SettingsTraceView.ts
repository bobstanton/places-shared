import * as _placesDom from '../utils';
import { SettingsTrace, settingsTraceToMarkdown } from '../settings/SettingsTrace';
import { copyToClipboard } from '../utils/Clipboard';
import { createFloatingCopyButton } from './FloatingCopyButton';

export function renderSettingsTraceView(container: HTMLElement, trace: SettingsTrace, title: string): void {
  const section = _placesDom.createDiv(container, { cls: 'places-settings-trace' });

  const header = _placesDom.createDiv(section, { cls: 'places-settings-trace-header' });

  _placesDom.createSpan(header, { cls: 'places-settings-trace-title', text: title });

  const buttonContainer = _placesDom.createDiv(header, 'places-floating-buttons');

  createFloatingCopyButton({
    buttonContainer,
    onCopy: () => copyToClipboard(settingsTraceToMarkdown(trace)),
  });

  const scroll = _placesDom.createDiv(section, { cls: 'places-settings-trace-scroll' });
  const table = _placesDom.createElement(scroll, 'table');

  const head = _placesDom.createElement(_placesDom.createElement(table, 'thead'), 'tr');

  for (const column of ['Setting', ...trace.layers, 'Resolved', 'Source']) {
    _placesDom.createElement(head, 'th', { text: column });
  }

  const body = _placesDom.createElement(table, 'tbody');

  for (const row of trace.rows) {
    const tr = _placesDom.createElement(body, 'tr');

    _placesDom.createElement(tr, 'td', { text: row.key, cls: 'places-settings-trace-key' });
    row.layerValues.forEach((value, index) => {
      const td = _placesDom.createElement(tr, 'td', { text: value });

      if (value !== '' && index === row.winnerLayerIndex) {
        _placesDom.addClass(td, 'places-settings-trace-winner');
      }
    });
    _placesDom.createElement(tr, 'td', { text: row.resolved, cls: 'places-settings-trace-resolved' });
    const sourceTd = _placesDom.createElement(tr, 'td', { text: row.note ? `${row.source} - ${row.note}` : row.source });

    if (row.source.includes('derived')) {
      _placesDom.addClass(sourceTd, 'places-settings-trace-derived');
    }
  }
}
