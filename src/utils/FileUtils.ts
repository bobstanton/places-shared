import { App, normalizePath, Notice, Platform, TFile } from 'obsidian';
import { getErrorMessage } from './Utilities';

export interface DownloadOptions {
  app?: App;
  content: string;
  filename: string;
  mimeType: string;
  desktopNotice?: string;
  mobileNotice?: string;
  vaultFallbackFolder?: string;
}

type FileSystemWritableFileStream = {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
};

type FileSystemFileHandle = {
  createWritable: () => Promise<FileSystemWritableFileStream>;
};

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    id?: string;
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle>;
};

type SavePickerResult = 'saved' | 'cancelled' | 'unavailable' | 'failed';

export type VaultPathCollisionStyle = 'hyphen' | 'parentheses';

export async function downloadOrCopy(options: DownloadOptions): Promise<void> {
  const { content, filename, mimeType, desktopNotice, vaultFallbackFolder } = options;
  const blob = new Blob([content], { type: mimeType });

  if (Platform.isMobile) {
    const pickerResult = await saveWithFileSystemPicker(blob, filename, mimeType);
    if (pickerResult === 'saved') {
      new Notice(`Saved ${filename}`);
      return;
    }

    const app = resolveObsidianApp(options.app);
    if (app) {
      try {
        const savedPath = await saveToVault(app, {
          content,
          filename,
          fallbackFolder: vaultFallbackFolder ?? PLACES_EXPORTS_FOLDER,
        });

        new Notice(`Saved ${filename} to ${savedPath}`);
        return;
      } catch (error) {
        const message = getErrorMessage(error);
        new Notice(`Unable to save ${filename} to the vault: ${message}`);
        return;
      }
    }

    new Notice(`Unable to save ${filename}: Obsidian app context is unavailable.`);
  } else {
    const url = URL.createObjectURL(blob);

    const a = activeDocument.body.createEl('a', { href: url });
    a.download = filename;
    a.click();

    a.detach();
    URL.revokeObjectURL(url);

    if (desktopNotice !== undefined) {
      new Notice(desktopNotice);
    } else {
      new Notice(`Exported ${filename}`);
    }
  }
}

function resolveObsidianApp(app?: App): App | null {
  if (app?.vault?.create) {
    return app;
  }

  const globalApp = (window as Window & { app?: App }).app;
  if (globalApp?.vault?.create) {
    return globalApp;
  }

  return null;
}

async function saveWithFileSystemPicker(blob: Blob, filename: string, mimeType: string): Promise<SavePickerResult> {
  const saveFilePicker = (window as SaveFilePickerWindow).showSaveFilePicker;

  if (!saveFilePicker) {
    return 'unavailable';
  }

  try {
    const handle = await saveFilePicker({
      id: 'places-export',
      startIn: 'downloads',
      suggestedName: filename,
      types: [
        {
          description: getFileTypeDescription(mimeType, filename),
          accept: {
            [mimeType]: [getExtension(filename)],
          },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return 'saved';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'cancelled';
    }

    return 'failed';
  }
}

function getExtension(filename: string): string {
  const extensionMatch = filename.match(/\.[^./\\]+$/);
  return extensionMatch ? extensionMatch[0] : '.txt';
}

async function saveToVault(app: App, options: { content: string; filename: string; fallbackFolder: string }): Promise<string> {
  const defaultPath = normalizePath(`${options.fallbackFolder}/${options.filename}`);
  const finalPath = getAvailableVaultPath(app, defaultPath);
  await ensureVaultFolder(app, finalPath);
  await app.vault.create(normalizePath(finalPath), options.content);
  return finalPath;
}

function getFileTypeDescription(mimeType: string, filename: string): string {
  const extension = getExtension(filename).replace('.', '').toUpperCase();
  return extension ? `${extension} file` : mimeType;
}

// Where vault exports land when there is no better home for them.
export const PLACES_EXPORTS_FOLDER = 'Places Exports';

// Beside the source note, else beside the active file, else the vault root.
// Every creation path must resolve the folder through this.
export function resolveNewNoteFolder(app: App, sourcePath?: string): string {
  if (sourcePath) {
    const sourceFile = app.vault.getAbstractFileByPath(normalizePath(sourcePath));
    const parent = sourceFile instanceof TFile ? sourceFile.parent?.path : undefined;
    if (parent !== undefined) return parent;
  }
  return app.workspace.getActiveFile()?.parent?.path ?? '';
}

// `path`, or the next free `name (n)` beside it. Parentheses match Obsidian's
// own collision suffix; `hyphen` is for contexts where parentheses are awkward.
export function getAvailableVaultPath(app: App, path: string, collisionStyle: VaultPathCollisionStyle = 'parentheses'): string {
  const normalizedPath = normalizePath(path);

  if (!app.vault.getAbstractFileByPath(normalizedPath)) {
    return normalizedPath;
  }

  const extension = getExtension(normalizedPath);
  const basePath = normalizedPath.slice(0, -extension.length);
  let index = 1;
  let candidate = formatVaultPathCollision(basePath, extension, index, collisionStyle);

  while (app.vault.getAbstractFileByPath(normalizePath(candidate))) {
    index += 1;
    candidate = formatVaultPathCollision(basePath, extension, index, collisionStyle);
  }

  return candidate;
}

function formatVaultPathCollision(basePath: string, extension: string, index: number, collisionStyle: VaultPathCollisionStyle): string {
  return collisionStyle === 'parentheses'
    ? `${basePath} (${index})${extension}`
    : `${basePath}-${index}${extension}`;
}

export async function ensureVaultFolder(app: App, filePath: string): Promise<void> {
  const parts = normalizePath(filePath).split('/');
  parts.pop();

  let currentPath = '';
  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const normalizedCurrentPath = normalizePath(currentPath);
    if (!app.vault.getAbstractFileByPath(normalizedCurrentPath)) {
      await app.vault.createFolder(normalizedCurrentPath);
    }
  }
}

export async function copyToClipboard(text: string, notice?: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  if (notice) {
    new Notice(notice);
  }
}
