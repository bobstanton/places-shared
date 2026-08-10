import { MarkdownRenderChild } from "obsidian";

// Marks a render superseded when Obsidian unloads its section while the block
// is still preparing data. Registered before the async work: a render whose
// section was replaced (each processor registration at startup re-renders open
// previews) aborts instead of updating an element nobody will see. Unlike a
// DOM connectedness check, the component lifecycle stays loaded for offscreen
// reading-view sections, and detached-but-alive blocks still render.
export class RenderStalenessGuard extends MarkdownRenderChild {
  superseded = false;

  onunload(): void {
    this.superseded = true;
  }
}
