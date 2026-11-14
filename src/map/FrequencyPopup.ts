import { getFileNameWithoutExtension, preventWheelPropagation } from "../utils/index";
import { createDiv, createElement } from "../utils/Dom";
import { isOpenableLink, popupLinkClass } from "./PopupBuilder";

export interface FrequencyPopupOptions {
  frequency: number;
  contributingFiles: string[];
  onLinkClick?: (linkPath: string) => void;
}

export function buildFrequencyPopupContent(options: FrequencyPopupOptions): HTMLElement {
  const { frequency, contributingFiles, onLinkClick } = options;
  const div = createDiv(null);

  preventWheelPropagation(div);

  createDiv(div, {
    attr: {
      style: "display: none;",
      "data-frequency": frequency.toString()
    }
  });

  if (frequency > 1) {
    createDiv(div, {
      text: "Frequency: " + frequency,
      attr: { style: "font-weight: bold; margin-bottom: 8px;" }
    });
  }

  if (contributingFiles && contributingFiles.length > 0) {
    createDiv(div, {
      text: "Contributing routes",
      attr: { style: "font-weight: bold; margin-bottom: 4px;" }
    });

    const fileList = createDiv(div, {
      attr: { style: "margin-top: 4px;" }
    });

    for (const filePath of contributingFiles) {
      const fileName = getFileNameWithoutExtension(filePath, filePath, /\.md$/i);

      if (!isOpenableLink(filePath)) {
        createDiv(fileList, { text: fileName, attr: { style: "display: block; margin-bottom: 4px;" } });
        continue;
      }

      const link = createElement(fileList, "a", {
        text: fileName,
        cls: popupLinkClass(filePath),
        attr: { style: "display: block; margin-bottom: 4px; cursor: pointer;" }
      });

      link.href = filePath;

      link.onclick = (clickEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        onLinkClick?.(filePath);
      };
    }
  } else if (frequency === 1) {
    createDiv(div, { text: "Gps point" });
  }

  return div;
}
