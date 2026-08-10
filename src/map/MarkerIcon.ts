import { coerceScalarString } from '../utils/Utilities';

export const DEFAULT_MARKER_ICON = '📍';

function normalizeTag(tag: string): string {
  const cleaned = tag.replace(/^#/, '').trim().toLowerCase();
  const lastSegment = cleaned.includes('/') ? cleaned.slice(cleaned.lastIndexOf('/') + 1) : cleaned;
  return lastSegment;
}

function toTagList(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.map((t) => String(t));
  if (typeof tags === 'string') return tags.split(/[,\s]+/).filter(Boolean);
  return [];
}

export function addTagMetadata(metadata: Record<string, unknown>, tags: unknown): void {
  for (const raw of toTagList(tags)) {
    const cleanTag = raw.replace(/^#/, '').trim();
    if (cleanTag) metadata[`tag:${cleanTag}`] = true;
  }
}

interface CompiledIconRule {
  target: 'tag' | 'name';
  regex: RegExp;
  emoji: string;
}

let userRules: CompiledIconRule[] = [];

function parseIconRule(line: string): CompiledIconRule | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const arrowIndex = trimmed.indexOf('=>');
  if (arrowIndex === -1) return null;

  const emoji = trimmed.slice(arrowIndex + 2).trim();
  let matcher = trimmed.slice(0, arrowIndex).trim();
  let target: 'tag' | 'name' = 'tag';
  const nameMatch = matcher.match(/^name\s*:\s*(.*)$/i);
  const tagMatch = matcher.match(/^tag\s*:\s*(.*)$/i);
  if (nameMatch) { target = 'name'; matcher = nameMatch[1].trim(); }
  else if (tagMatch) { target = 'tag'; matcher = tagMatch[1].trim(); }
  if (!matcher) return null;

  try {
    return { target, regex: new RegExp(matcher, 'i'), emoji };
  } catch {
    return null;
  }
}

export function configureMarkerIconRules(lines: string[] | undefined): void {
  userRules = (lines ?? []).map(parseIconRule).filter((rule): rule is CompiledIconRule => rule !== null);
}

export function defaultMarkerIconRules(): string[] {
  return [
    'name:pizza => 🍕',
    'tag:^pizza$ => 🍕',
    'name:trail$ => 🥾',
    'name:loop$ => 🥾',
    'tag:^hiking$ => 🥾',
    'tag:^trail$ => 🥾',
    'tag:^trailhead$ => 🥾',
    'name:Boat Ramp => 🛶',
    'tag:^boat-launch$ => 🛶',
    'tag:^lake$ => 🛶',
    'tag:^pond$ => 🛶',
    'tag:^bay$ => 🛶',
    'name:State Park => 🏞️',
    'tag:^state-park$ => 🏞️',
    'tag:^park$ => 🏞️',
    'tag:^golf$ => ⛳',
    'tag:^mini-golf$ => ⛳',
    'tag:^miniature-golf$ => ⛳',
    'name:motel => 🛏️',
    'name:hotel => 🛏️',
    'tag:^lodging$ => 🛏️',
    'tag:^motel$ => 🛏️',
    'tag:^hotel$ => 🛏️',
    'tag:^antiques$ => 🕰️',
    'tag:^antique-shop$ => 🕰️',
    'tag:^icecream$ => 🍦',
    'tag:^ice-cream$ => 🍦',
    'tag:^ice-cream-store$ => 🍦',
    'tag:^bbq$ => 🍖',
    'tag:^barbecue$ => 🍖',
    'tag:^barbecue-restaurant$ => 🍖',
    'tag:^sandwich-shop$ => 🥪',
    'tag:^burger$ => 🍔',
    'tag:^hamburger$ => 🍔',
    'tag:^sushi$ => 🍣',
    'tag:^ramen$ => 🍜',
    'tag:^noodles$ => 🍜',
    'tag:^taco$ => 🌮',
    'tag:^tacos$ => 🌮',
    'tag:^burrito$ => 🌯',
    'tag:^mexican$ => 🌮',
    'tag:^sandwich$ => 🥪',
    'tag:^deli$ => 🥪',
    'tag:^hotdog$ => 🌭',
    'tag:^fries$ => 🍟',
    'tag:^pasta$ => 🍝',
    'tag:^italian$ => 🍝',
    'tag:^steak$ => 🥩',
    'tag:^steakhouse$ => 🥩',
    'tag:^chicken$ => 🍗',
    'tag:^seafood$ => 🦞',
    'tag:^oyster$ => 🦪',
    'tag:^fish$ => 🐟',
    'tag:^salad$ => 🥗',
    'tag:^soup$ => 🍲',
    'tag:^breakfast$ => 🍳',
    'tag:^restaurant$ => 🍽️',
    'tag:^diner$ => 🍽️',
    'tag:^food$ => 🍽️',
    'tag:^beach$ => 🏖️',
    'tag:^waterfall$ => 🌊',
    'tag:^camping$ => 🏕️',
    'tag:^brunch$ => 🥞',
    'tag:^pancakes$ => 🥞',
    'tag:^donut$ => 🍩',
    'tag:^doughnut$ => 🍩',
    'tag:^bakery$ => 🥐',
    'tag:^bread$ => 🍞',
    'tag:^dessert$ => 🍰',
    'tag:^cake$ => 🍰',
    'tag:^candy$ => 🍬',
    'tag:^coffee$ => ☕',
    'tag:^cafe$ => ☕',
    'tag:^tea$ => 🍵',
    'tag:^mountain$ => ⛰️',
    'tag:^summit$ => ⛰️',
    'tag:^viewpoint$ => 👀',
    'tag:^campground$ => 🏕️',
    'tag:^museum$ => 🏛️',
    'tag:^art$ => 🖼️',
    'tag:^gallery$ => 🖼️',
    'tag:^theater$ => 🎭',
    'tag:^theatre$ => 🎭',
    'tag:^movie$ => 🎬',
    'tag:^music$ => 🎵',
    'tag:^shopping$ => 🛍️',
    'tag:^grocery$ => 🛒',
    'tag:^market$ => 🧺',
    'tag:^parking$ => 🅿️',
    'tag:^train$ => 🚉',
    'tag:^library$ => 📚',
    'tag:^gym$ => 🏋️',
    'tag:^ski$ => 🎿',
    'name:Zoo => 🦁',
    'tag:^zoo$ => 🦁',
    'tag:^aquarium$ => 🐠',
    'tag:^garden$ => 🌷',
    'tag:^bridge$ => 🌉',
    'tag:^school$ => 🏫',
    'tag:^university$ => 🎓',
    'tag:^lighthouse$ => 🗼',
  ];
}

export function resolveMarkerIcon(explicitIcon: unknown): string {
  if (explicitIcon !== undefined && explicitIcon !== null && coerceScalarString(explicitIcon).trim() !== '') {
    return coerceScalarString(explicitIcon);
  }
  return DEFAULT_MARKER_ICON;
}

export function resolveDefaultMarkerIcon(tags: unknown, name?: unknown): string {
  return matchMarkerIconRule(tags, name) || DEFAULT_MARKER_ICON;
}

export function matchMarkerIconRule(tags: unknown, name?: unknown): string | undefined {
  const normalizedTags = toTagList(tags).map(normalizeTag);
  const noteName = name !== undefined && name !== null ? coerceScalarString(name) : '';

  for (const rule of userRules) {
    const matched = rule.target === 'name'
      ? (noteName !== '' && rule.regex.test(noteName))
      : normalizedTags.some((tag) => rule.regex.test(tag));
    if (matched) return rule.emoji;
  }

  return undefined;
}
