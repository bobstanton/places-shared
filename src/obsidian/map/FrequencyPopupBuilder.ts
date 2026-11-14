import type { App } from 'obsidian';
import { buildFrequencyPopupContent } from "../../map/index";
import { openLocalFile } from '../utils/LocalFile';

export interface FrequencyPopupOptions {
  frequency: number;
  contributingFiles: string[];
  app?: App;
}

export function createFrequencyPopup(options: FrequencyPopupOptions): HTMLElement {
  const { frequency, contributingFiles, app } = options;

  return buildFrequencyPopupContent({
    frequency,
    contributingFiles,
    onLinkClick: app ? (filePath) => openLocalFile(app, filePath) : undefined,
  });
}
