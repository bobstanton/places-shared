import type { App } from 'obsidian';
import { normalizeVaultPath } from '../../utils/index';

export async function readKnapTemplateFile(app: App, reference: string, sourcePath = ''): Promise<string> {
  const linkpath = reference.trim().replace(/^\[\[(.*?)\]\]$/, '$1');
  const file = app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath)
    ?? app.vault.getFileByPath(normalizeVaultPath(linkpath));

  if (!file || !['md', 'knap'].includes(file.extension)) {
    throw new Error(`Knap template file not found: ${reference}`);
  }

  return app.vault.cachedRead(file);
}
