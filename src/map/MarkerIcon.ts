import { normalizeFrontmatterTags, tagMatchNames } from './PlaceTags';
import { coerceScalarString } from '../utils/Utilities';

export const DEFAULT_MARKER_ICON = '📍';

export function addTagMetadata(metadata: Record<string, unknown>, tags: unknown): void {
  for (const raw of normalizeFrontmatterTags(tags)) {
    const cleanTag = raw.replace(/^#/, '').trim();

    if (cleanTag) metadata[`tag:${cleanTag}`] = true;
  }
}

interface CompiledIconRule {
  target: 'tag' | 'name' | 'path';
  regex: RegExp;
  emoji: string;
}

let userRules: CompiledIconRule[] = [];

const TRAIL_ICON_RULES = [
  'name:Rail Trail => 🚲',
  'path:(^|/)Biking Trails(/|$) => 🚲',
  'path:(^|/)Hiking Trails(/|$) => 🥾',
];

const ICE_CREAM_ICON_RULE = 'tag:^ice_cream$ => 🍦';
const DONUT_SHOP_ICON_RULE = 'tag:^donut-shop$ => 🍩';

export const CURRENT_MARKER_ICON_RULES_REVISION = 1;

function parseIconRule(line: string): CompiledIconRule | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) return null;
  const arrowIndex = trimmed.indexOf('=>');

  if (arrowIndex === -1) return null;

  const emoji = trimmed.slice(arrowIndex + 2).trim();
  let matcher = trimmed.slice(0, arrowIndex).trim();
  let target: 'tag' | 'name' | 'path' = 'tag';
  const nameMatch = matcher.match(/^name\s*:\s*(.*)$/i);
  const pathMatch = matcher.match(/^path\s*:\s*(.*)$/i);
  const tagMatch = matcher.match(/^tag\s*:\s*(.*)$/i);

  if (nameMatch) { target = 'name'; matcher = nameMatch[1].trim(); }
  else if (pathMatch) { target = 'path'; matcher = pathMatch[1].trim(); }
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
    ...TRAIL_ICON_RULES,
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
    ICE_CREAM_ICON_RULE,
    'tag:^ice-cream-store$ => 🍦',
    DONUT_SHOP_ICON_RULE,
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
    'tag:^american-restaurant$ => 🍔',
    'tag:^burger-restaurant$ => 🍔',
    'tag:^italian-restaurant$ => 🍝',
    'tag:^mexican-restaurant$ => 🌮',
    'tag:^latin-american-restaurant$ => 🌮',
    'tag:^fish-restaurant$ => 🐟',
    'tag:^breakfast-restaurant$ => 🍳',
    'tag:^brunch-restaurant$ => 🥞',
    'tag:^carribean-restaurant$ => 🍹',
    'tag:^chinese-restaurant$ => 🥡',
    'tag:^cuban-restaurant$ => 🥪',
    'tag:^french-restaurant$ => 🥖',
    'tag:^japanese-restaurant$ => 🍣',
    'tag:^middle-eastern-restaurant$ => 🧆',
    'tag:^turkish-restaurant$ => 🥙',
    'tag:^vietnamese-restaurant$ => 🍜',
    'tag:^fast-food$ => 🍟',
    'tag:^fast-food-restaurant$ => 🍟',
    'tag:^catering-fast_food$ => 🍟',
    'tag:^hot-dogs$ => 🌭',
    'tag:^bagel-shop$ => 🥯',
    'tag:^waffles$ => 🧇',
    'tag:^pie$ => 🥧',
    'tag:^pies$ => 🥧',
    'tag:^confectionary$ => 🍬',
    'tag:^snacks$ => 🍿',
    'tag:^bubble-tea$ => 🧋',
    'tag:^lobster$ => 🦞',
    'tag:^lobster-roll$ => 🦞',
    'tag:^cheese-store$ => 🧀',
    'tag:^sandwiches$ => 🥪',
    'tag:^bar$ => 🍸',
    'tag:^pub$ => 🍺',
    'tag:^catering-pub$ => 🍺',
    'tag:^brewery$ => 🍺',
    'tag:^nightlife$ => 🌃',
    'tag:^restaurant$ => 🍽️',
    'tag:^catering-restaurant$ => 🍽️',
    'tag:^diner$ => 🍽️',
    'tag:^food$ => 🍽️',
    'tag:^food-and-drink$ => 🍽️',
    'tag:^food-court$ => 🍽️',
    'tag:^lunch$ => 🍽️',
    'tag:^dinner$ => 🍽️',
    'tag:^beach$ => 🏖️',
    'tag:^waterfall$ => 🌊',
    'tag:^camping$ => 🏕️',
    'tag:^brunch$ => 🥞',
    'tag:^pancakes$ => 🥞',
    'tag:^donut$ => 🍩',
    'tag:^donuts$ => 🍩',
    'tag:^doughnut$ => 🍩',
    'tag:^bakery$ => 🥐',
    'tag:^pastries$ => 🥐',
    'tag:^commercial-food_and_drink-bakery$ => 🥐',
    'tag:^bread$ => 🍞',
    'tag:^breads$ => 🍞',
    'tag:^dessert$ => 🍰',
    'tag:^desserts$ => 🍰',
    'tag:^cake$ => 🍰',
    'tag:^cakes$ => 🍰',
    'tag:^candy$ => 🍬',
    'tag:^coffee$ => ☕️',
    'tag:^cafe$ => ☕️',
    'tag:^café$ => ☕️',
    'tag:^coffee-shop$ => ☕️',
    'tag:^catering-cafe$ => ☕️',
    'tag:^teahouse$ => 🍵',
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
    'tag:^books$ => 📚',
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
    'tag:^art-gallery$ => 🖼️',
    'tag:^artwork$ => 🖼️',
    'tag:^entertainment-museum$ => 🏛️',
    'tag:^books$ => 📚',
    'tag:^bookstore$ => 📚',
    'tag:^commercial-books$ => 📚',
    'tag:^garden-center$ => 🌷',
    'tag:^gardens$ => 🌷',
    'tag:^miniature_golf$ => ⛳',
    'tag:^golf-course$ => ⛳',
    'tag:^hike$ => 🥾',
    'tag:^walk$ => 🥾',
    'tag:^nature-reserve$ => 🏞️',
    'tag:^nature_reserve$ => 🏞️',
    'tag:^protected-area$ => 🏞️',
    'tag:^protected_area$ => 🏞️',
    'tag:^leisure-park$ => 🏞️',
    'tag:^recreation_ground$ => 🏞️',
    'tag:^recreation-center$ => 🏞️',
    'tag:^boutique-shop$ => 🛍️',
    'tag:^commercial-clothing-clothes$ => 👗',
    'tag:^fashion-accessories$ => 👗',
    'tag:^supermarket$ => 🛒',
    'tag:^convenience-store$ => 🛒',
    'tag:^gift$ => 🎁',
    'tag:^gift-shop$ => 🎁',
    'tag:^toy-store$ => 🧸',
    'tag:^flower-shop$ => 💐',
    'tag:^plants$ => 🪴',
    'tag:^nursery$ => 🪴',
    'tag:^plant_nursery$ => 🪴',
    'tag:^fabric$ => 🧵',
    'tag:^fabric-store$ => 🧵',
    'tag:^arts-and-craft-store$ => 🧵',
    'tag:^furniture-store$ => 🛋️',
    'tag:^architectural-salvage$ => 🪚',
    'tag:^stationery$ => 🖨️',
    'tag:^commercial-stationery$ => 🖨️',
    'tag:^copyshop$ => 🖨️',
    'tag:^pharmacy$ => 💊',
    'tag:^health-services$ => 💊',
    'tag:^laboratory$ => 🔬',
    'tag:^medical-laboratory$ => 🔬',
    'tag:^delivery$ => 🥡',
    'tag:^takeaway$ => 🥡',
    'tag:^online-ordering$ => 🥡',
    'tag:^forest$ => 🌲',
    'tag:^natural-forest$ => 🌲',
    'tag:^hill$ => ⛰️',
    'tag:^peak$ => ⛰️',
    'tag:^island$ => 🏝️',
    'tag:^islet$ => 🏝️',
    'tag:^river$ => 🏞️',
    'tag:^stream$ => 🏞️',
    'tag:^waterway$ => 🏞️',
    'tag:^water$ => 🏞️',
    'tag:^reservoir$ => 💧',
    'tag:^dam$ => 💧',
    'tag:^tide-pools$ => 🐚',
    'tag:^sea-glass$ => 🐚',
    'tag:^pier$ => ⚓',
    'tag:^slipway$ => ⚓',
    'tag:^boat-rental$ => 🛶',
    'tag:^kayak-rental$ => 🛶',
    'tag:^kayaking$ => 🛶',
    'tag:^fishing$ => 🎣',
    'tag:^bike-rental$ => 🚲',
    'tag:^farm$ => 🚜',
    'tag:^picnic-shelter$ => 🧺',
    'tag:^rest_area$ => 🧺',
    'tag:^playground$ => 🛝',
    'tag:^sports$ => ⚽',
    'tag:^sports-ground$ => ⚽',
    'tag:^great-views$ => 👀',
    'tag:^animals$ => 🐾',
    'tag:^attraction$ => 🎡',
    'tag:^tourism-attraction$ => 🎡',
    'tag:^tourist-attraction$ => 🎡',
    'tag:^tourist-information-center$ => ℹ️',
    'tag:^monument$ => 🗿',
    'tag:^historic$ => 🗿',
    'tag:^historic-site$ => 🗿',
    'tag:^heritage$ => 🗿',
    'tag:^education$ => 🏫',
    'tag:^weird$ => 👽',
    'tag:^house$ => 🏠',
    'tag:^building$ => 🏠',
    'tag:^bus-stop$ => 🚌',
    'tag:^transportation$ => 🚌',
    'tag:^highway$ => 🛣️',
    'tag:^road$ => 🛣️',
    'tag:^street$ => 🛣️',
    'tag:^footway$ => 🛣️',
    'tag:^entertainment$ => 🎟️',
    'tag:^venue$ => 🎟️',
    'tag:^activities$ => 🎟️',
    'tag:^leisure$ => 🎟️',
    'tag:^services$ => 🛠️',
    'tag:^retail$ => 🛍️',
    'tag:^shop$ => 🛍️',
    'tag:^commercial$ => 🛍️',
    'tag:^wholesale$ => 🛍️',
    'tag:^outside$ => 🌲',
    'tag:^outdoors$ => 🌲',
    'tag:^nature$ => 🌲',
    'tag:^natural$ => 🌲',
    'tag:^tourism$ => 🎡',
  ];
}

export function upgradeMarkerIconRules(lines: string[] | undefined, revision: unknown): string[] {
  const rules = Array.isArray(lines) ? [...lines] : [];
  const numericRevision = typeof revision === 'number' && Number.isFinite(revision) ? revision : 0;

  if (numericRevision >= CURRENT_MARKER_ICON_RULES_REVISION) return rules;

  const matcherKeys = new Set(rules.map(markerIconRuleMatcherKey).filter((key): key is string => key !== undefined));
  const missing = TRAIL_ICON_RULES.filter(rule => {
    const key = markerIconRuleMatcherKey(rule);

    return key !== undefined && !matcherKeys.has(key);
  });
  const genericTrailIndex = rules.findIndex(rule => markerIconRuleMatcherKey(rule) === 'name:trail$');

  rules.splice(genericTrailIndex >= 0 ? genericTrailIndex : rules.length, 0, ...missing);

  if (!matcherKeys.has('tag:^ice_cream$')) {
    const foodMatchers = new Set(['tag:^icecream$', 'tag:^ice-cream$', 'tag:^ice-cream-store$', 'tag:^restaurant$', 'tag:^catering-restaurant$', 'tag:^food$', 'tag:^food-and-drink$', 'tag:^food-court$', 'tag:^cafe$', 'tag:^catering-cafe$']);
    const foodIndex = rules.findIndex(rule => foodMatchers.has(markerIconRuleMatcherKey(rule) ?? ''));

    rules.splice(foodIndex >= 0 ? foodIndex : rules.length, 0, ICE_CREAM_ICON_RULE);
  }

  if (!matcherKeys.has('tag:^donut-shop$')) {
    const foodMatchers = new Set([
      'tag:^breakfast$', 'tag:^breakfast-restaurant$', 'tag:^brunch$', 'tag:^brunch-restaurant$',
      'tag:^fast-food$', 'tag:^fast-food-restaurant$', 'tag:^catering-fast_food$',
      'tag:^restaurant$', 'tag:^catering-restaurant$', 'tag:^diner$',
      'tag:^food$', 'tag:^food-and-drink$', 'tag:^food-court$', 'tag:^lunch$', 'tag:^dinner$',
      'tag:^donut$', 'tag:^donuts$', 'tag:^doughnut$', 'tag:^bakery$', 'tag:^pastries$',
      'tag:^commercial-food_and_drink-bakery$', 'tag:^dessert$', 'tag:^desserts$',
      'tag:^coffee$', 'tag:^cafe$', 'tag:^café$', 'tag:^coffee-shop$', 'tag:^catering-cafe$',
    ]);
    const foodIndex = rules.findIndex(rule => foodMatchers.has(markerIconRuleMatcherKey(rule) ?? ''));

    rules.splice(foodIndex >= 0 ? foodIndex : rules.length, 0, DONUT_SHOP_ICON_RULE);
  }

  return rules;
}

function markerIconRuleMatcherKey(line: string): string | undefined {
  const arrowIndex = line.indexOf('=>');

  if (arrowIndex === -1) return undefined;
  const matcher = line.slice(0, arrowIndex).trim();
  const targeted = matcher.match(/^(tag|name|path)\s*:\s*(.*)$/i);

  if (!targeted) return `tag:${matcher.toLowerCase()}`;

  return `${targeted[1].toLowerCase()}:${targeted[2].trim().toLowerCase()}`;
}

export function resolveMarkerIcon(explicitIcon: unknown): string {
  if (explicitIcon !== undefined && explicitIcon !== null && coerceScalarString(explicitIcon).trim() !== '') {
    return coerceScalarString(explicitIcon);
  }

  return DEFAULT_MARKER_ICON;
}

export function resolveDefaultMarkerIcon(tags: unknown, name?: unknown, path?: unknown): string {
  return matchMarkerIconRule(tags, name, path) || DEFAULT_MARKER_ICON;
}

export function matchMarkerIconRule(tags: unknown, name?: unknown, path?: unknown): string | undefined {
  const normalizedTags = tagMatchNames(tags);
  const noteName = name !== undefined && name !== null ? coerceScalarString(name) : '';
  const notePath = path !== undefined && path !== null
    ? coerceScalarString(path).replace(/\\/g, '/')
    : '';

  for (const rule of userRules) {
    const matched = rule.target === 'name'
      ? noteName !== '' && rule.regex.test(noteName)
      : rule.target === 'path'
        ? notePath !== '' && rule.regex.test(notePath)
        : normalizedTags.some((tag) => rule.regex.test(tag));

    if (matched) return rule.emoji;
  }

  return undefined;
}
