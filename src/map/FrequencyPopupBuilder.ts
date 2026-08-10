import { App } from "obsidian";
import { getFileNameWithoutExtension, preventWheelPropagation } from "../utils/Utilities";

export interface FrequencyPopupOptions {
  frequency: number;
  contributingFiles: string[];
  app?: App;
}

export function createFrequencyPopup(options: FrequencyPopupOptions): HTMLElement {
  const { frequency, contributingFiles, app } = options;
  const div = createDiv();

  preventWheelPropagation(div);

  div.createDiv({
    attr: {
      style: "display: none;",
      "data-frequency": frequency.toString()
    }
  });

  if (frequency > 1) {
    div.createDiv({
      text: "Frequency: " + frequency,
      attr: { style: "font-weight: bold; margin-bottom: 8px;" }
    });
  }

  if (contributingFiles && contributingFiles.length > 0) {
    div.createDiv({
      text: "Contributing routes",
      attr: { style: "font-weight: bold; margin-bottom: 4px;" }
    });

    const fileList = div.createDiv({
      attr: { style: "margin-top: 4px;" }
    });

    for (const filePath of contributingFiles) {
      const fileName = getFileNameWithoutExtension(filePath, filePath, /\.md$/i);
      const link = fileList.createEl("a", {
        text: fileName,
        cls: "internal-link",
        attr: { style: "display: block; margin-bottom: 4px; cursor: pointer;" }
      });
      link.href = filePath;
      link.onclick = (clickEvent) => {
        clickEvent.preventDefault();
        // Stop the click reaching Obsidian's delegated internal-link handler, which
        // would otherwise open the same file a second time from the href.
        clickEvent.stopPropagation();
        if (app) {
          void app.workspace.openLinkText(filePath, '');
        }
      };
    }
  } else if (frequency === 1) {
    div.createDiv({ text: "Gps point" });
  }

  return div;
}
