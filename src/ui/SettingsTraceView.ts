import { SettingsTrace, settingsTraceToMarkdown } from '../settings/SettingsTrace';
import { copyToClipboard } from '../utils/FileUtils';
import { createFloatingCopyButton } from './FloatingCopyButton';

// Renders a settings-resolution trace (the `debug: settings` block mode).
// Styles live in places-shared/settings-trace-styles.css, imported by each
// plugin bundle that uses this view.
export function renderSettingsTraceView(container: HTMLElement, trace: SettingsTrace, title: string): void {
  const section = container.createDiv({ cls: 'places-settings-trace' });

  const header = section.createDiv({ cls: 'places-settings-trace-header' });
  header.createSpan({ cls: 'places-settings-trace-title', text: title });

  const buttonContainer = header.createDiv('places-floating-buttons');
  createFloatingCopyButton({
    buttonContainer,
    onCopy: () => copyToClipboard(settingsTraceToMarkdown(trace)),
  });

  const scroll = section.createDiv({ cls: 'places-settings-trace-scroll' });
  const table = scroll.createEl('table');

  const head = table.createEl('thead').createEl('tr');
  for (const column of ['Setting', ...trace.layers, 'Resolved', 'Source']) {
    head.createEl('th', { text: column });
  }

  const body = table.createEl('tbody');
  for (const row of trace.rows) {
    const tr = body.createEl('tr');
    tr.createEl('td', { text: row.key, cls: 'places-settings-trace-key' });
    row.layerValues.forEach((value, index) => {
      const td = tr.createEl('td', { text: value });
      if (value !== '' && index === row.winnerLayerIndex) {
        td.addClass('places-settings-trace-winner');
      }
    });
    tr.createEl('td', { text: row.resolved, cls: 'places-settings-trace-resolved' });
    const sourceTd = tr.createEl('td', { text: row.note ? `${row.source} - ${row.note}` : row.source });
    if (row.source.includes('derived')) {
      sourceTd.addClass('places-settings-trace-derived');
    }
  }
}
