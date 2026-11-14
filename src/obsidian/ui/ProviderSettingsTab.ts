import type { SettingGroupItem } from 'obsidian';

// Settings rows contributed through ExtensionSettingsGroup; the main plugin's
// settings tab renders the definitions and persists plain string values.

export interface ProviderStyleOption {
  value: string;
  name: string;
}

export interface SettingsPageStatus {
  displayValue: () => string;
  status: () => 'warning' | null;
}

export function settingsPageStatus(isConfigured: () => boolean, missingValue = 'API key needed'): SettingsPageStatus {
  return {
    displayValue: () => isConfigured() ? 'Configured' : missingValue,
    status: () => isConfigured() ? null : 'warning',
  };
}

export function readSettingString(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];

  return typeof value === 'string' ? value : '';
}

export function apiKeySettingItem(apiName: string, desc?: string): SettingGroupItem {
  return {
    name: 'API key',
    aliases: [`${apiName} API key`],
    ...(desc ? { desc } : {}),
    control: { type: 'text', key: 'apiKey' },
  };
}

export function countrySettingItem(desc?: string): SettingGroupItem {
  return {
    name: 'Country',
    desc: desc ?? 'Two-letter country code used to limit searches.',
    control: { type: 'text', key: 'country' },
  };
}

export function styleDropdownItem(options: { desc: string; styles: readonly ProviderStyleOption[]; fallbackStyle: string; name?: string }): SettingGroupItem {
  return {
    name: options.name ?? 'Default map style',
    desc: options.desc,
    control: {
      type: 'dropdown',
      key: 'defaultStyle',
      options: Object.fromEntries(options.styles.map((style) => [style.value, style.name])),
      defaultValue: options.fallbackStyle,
    },
  };
}
