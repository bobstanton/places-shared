export interface RenderOwner {
  register(cleanup: () => void): void;
}

export interface BlockRenderContext {
  sourcePath: string;
}

export class RenderLifetime implements RenderOwner {
  private cleanups: Array<() => void> = [];
  private children: RenderLifetime[] = [];
  private loaded = false;

  register(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.onload();
    for (const child of this.children) child.load();
  }

  unload(): void {
    this.loaded = false;
    for (const child of this.children.splice(0)) child.unload();

    for (const cleanup of this.cleanups.splice(0)) {
      try {
 cleanup(); 
} catch (error) {
 console.warn("Render cleanup failed", error); 
}
    }

    this.onunload();
  }

  addChild<T extends RenderLifetime>(child: T): T {
    this.children.push(child);
    if (this.loaded) child.load();

    return child;
  }

  removeChild(child: RenderLifetime): void {
    this.children = this.children.filter(candidate => candidate !== child);
    child.unload();
  }

  onload(): void {}
  onunload(): void {}
}

export type RenderApplication = unknown;
