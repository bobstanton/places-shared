import { notify } from '../services/HostPrimitives';

export async function copyToClipboard(text: string, notice?: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  if (notice) notify(notice);
}
