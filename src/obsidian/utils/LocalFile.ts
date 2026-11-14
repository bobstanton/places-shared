import { App, FileSystemAdapter, Platform, TFile } from 'obsidian';
import { sharedRegistryValue } from '../../utils/index';
import { isVaultPath, ABSOLUTE_DEVICE_PATH, REMOTE_URL } from '../../utils/index';

export interface LocalFile {
  url: string;
  name: string;
  extension: string;
  file?: TFile;
  devicePath?: string;
}

const WIKILINK = /^!?\[\[(.+?)(?:\|.*)?\]\]$/;

export function resolveLocalFile(app: App, value: string, sourcePath?: string): LocalFile | null {
  const trimmed = value.trim();

  if (!trimmed) return null;
  if (REMOTE_URL.test(trimmed)) return { url: trimmed, name: fileName(trimmed), extension: extensionOf(trimmed) };

  const path = WIKILINK.exec(trimmed)?.[1]?.trim() ?? trimmed;
  const file = resolveVaultFile(app, path, sourcePath);

  if (file) return { url: app.vault.getResourcePath(file), name: file.name, extension: file.extension, file };
  if (!ABSOLUTE_DEVICE_PATH.test(path)) return null;

  return { url: deviceResourceUrl(path), name: fileName(path), extension: extensionOf(path), devicePath: path };
}

export function openLocalFile(app: App, linkPath: string, sourcePath = ''): void {
  const target = resolveLocalFile(app, linkPath, sourcePath);

  if (target?.devicePath) {
    void openInDefaultApp(app, target.devicePath);

    return;
  }

  void app.workspace.openLinkText(linkPath, sourcePath);
}

function desktopShell(): { openPath?: (path: string) => Promise<string>; showItemInFolder?: (path: string) => void } | undefined {
  const load = (window as unknown as { require?: (id: string) => unknown }).require;

  if (typeof load !== 'function') return undefined;

  return (load('electron') as { shell?: { openPath?: (path: string) => Promise<string>; showItemInFolder?: (path: string) => void } }).shell;
}

function mobileOpener(app: App): ((path: string) => Promise<unknown>) | undefined {
  const bridge = (app.vault.adapter as unknown as { fs?: { open?: (path: string) => Promise<unknown> } }).fs;

  return Platform.isMobileApp && typeof bridge?.open === 'function' ? bridge.open.bind(bridge) : undefined;
}

export function canOpenDevicePaths(app: App): boolean {
  if (Platform.isDesktopApp) return desktopShell()?.openPath !== undefined;

  return mobileOpener(app) !== undefined;
}

export async function openInDefaultApp(app: App, path: string): Promise<void> {
  const mobile = mobileOpener(app);

  if (mobile) {
    await mobile(path);

    return;
  }

  await desktopShell()?.openPath?.(path);
}

export function canRevealDevicePaths(): boolean {
  return Platform.isDesktopApp && desktopShell()?.showItemInFolder !== undefined;
}

export function showInSystemExplorer(path: string): void {
  desktopShell()?.showItemInFolder?.(path);
}

function resolveVaultFile(app: App, path: string, sourcePath: string | undefined): TFile | null {
  if (!isVaultPath(path)) {
    const inside = vaultRelativePath(app, path);
    const nested = inside ? app.vault.getAbstractFileByPath(inside) : null;

    return nested instanceof TFile ? nested : null;
  }

  const direct = app.vault.getAbstractFileByPath(path);

  if (direct instanceof TFile) return direct;

  const linked = app.metadataCache.getFirstLinkpathDest(path, sourcePath ?? '');

  return linked instanceof TFile ? linked : null;
}

function vaultRelativePath(app: App, path: string): string | null {
  const adapter = app.vault.adapter;

  if (!(adapter instanceof FileSystemAdapter)) return null;
  const base = adapter.getBasePath().replace(/\\/g, '/').replace(/\/+$/, '');
  const normalized = path.replace(/\\/g, '/');

  return normalized.startsWith(`${base}/`) ? normalized.slice(base.length + 1) : null;
}

// Mobile vaults are served from http://localhost; the WebView rejects
// file:// image subresources. Capacitor serves device paths over HTTP.
function devicePathPrefix(): string {
  const capacitor = (window as { Capacitor?: { convertFileSrc?(path: string): string } }).Capacitor;
  const served = Platform.isMobileApp ? capacitor?.convertFileSrc?.('/') : undefined;

  return served ?? Platform.resourcePathPrefix;
}

function deviceResourceUrl(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');

  return devicePathPrefix() + encodeURI(normalized).replace(/\?/g, '%3F').replace(/#/g, '%23');
}

function fileName(path: string): string {
  return path.split(/[/\\]/).pop()?.split(/[?#]/)[0] ?? path;
}

function extensionOf(path: string): string {
  const name = fileName(path);
  const dot = name.lastIndexOf('.');

  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

const RESOLVER_KEY = Symbol.for('places.resource.urls');

function resolverState(): { app?: App } {
  return sharedRegistryValue<{ app?: App }>(RESOLVER_KEY, () => ({}));
}

export function configureResourceUrls(app: App | null): void {
  resolverState().app = app ?? undefined;
}

export function resourceUrl(path: unknown, sourcePath?: string): string {
  const app = resolverState().app;

  if (!app || typeof path !== 'string') return '';

  return resolveLocalFile(app, path, sourcePath)?.url ?? '';
}
