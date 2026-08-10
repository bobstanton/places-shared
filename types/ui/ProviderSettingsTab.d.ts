import type { SettingGroupItem } from 'obsidian';
export interface ProviderStyleOption {
    value: string;
    name: string;
}
export declare function readSettingString(settings: Record<string, unknown>, key: string): string;
export declare function apiKeySettingItem(apiName: string, desc?: string): SettingGroupItem;
export declare function countrySettingItem(desc?: string): SettingGroupItem;
export declare function styleDropdownItem(options: {
    desc: string;
    styles: readonly ProviderStyleOption[];
    fallbackStyle: string;
    name?: string;
}): SettingGroupItem;
