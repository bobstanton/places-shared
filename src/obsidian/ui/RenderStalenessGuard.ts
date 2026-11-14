import { MarkdownRenderChild } from "obsidian";
import { logger } from "../../utils/index";

export class RenderStalenessGuard extends MarkdownRenderChild {
  superseded = false;

  constructor(containerEl: HTMLElement, private readonly sourcePath?: string) {
    super(containerEl);
  }

  onunload(): void {
    this.superseded = true;
    logger.scope('MapSurface').debug('render superseded - section unloaded', { source: this.sourcePath });
  }
}
