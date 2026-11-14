import { tagMatchNames } from './PlaceTags';
import { logger as rootLogger } from '../utils/logger';
import { hashString36, coerceScalarString, normalizePropertyName, scalarToString } from '../utils/Utilities';
import { MapPlace, IconBadgeOffset, IconBadgeStyle, IconShadowStyle, IconShapeStyle, IconZoomSizeStop } from '../Place';
import { getZoomRangeClassNames, mergeZoomRanges, normalizeZoomRange, readZoomRangesFromRecord, type ZoomRange } from '../ZoomVisibility';

const logger = rootLogger.scope('MarkerStyleService');

export interface AlwaysCondition {
  type: 'always';
}

export interface SimpleCondition {
  type: 'simple';
  property: string;
  operator: '<' | '>' | '<=' | '>=' | '==' | '!=' | 'truthy' | 'in';
  value?: string | number;
  values?: (string | number)[];
  negated?: boolean;
}

export interface CompoundCondition {
  type: 'compound';
  operator: 'AND' | 'OR';
  conditions: Condition[];
}

export type Condition = AlwaysCondition | SimpleCondition | CompoundCondition;

export interface StyleRule {
  condition: Condition;
  css: string; 
}

export interface MarkerStyleConfig {
  css?: string;
  iconStyles?: StyleRule[];
  iconImageStyles?: StyleRule[];
  labelStyles?: StyleRule[];
  markerMinZoom?: number;
  markerMaxZoom?: number;
  labelMinZoom?: number;
  labelMaxZoom?: number;
  trackMinZoom?: number;
  trackMaxZoom?: number;
  overlayMinZoom?: number;
  overlayMaxZoom?: number;
}

export interface MarkerStyleProfile {
  places: number;
  totalMs: number;
  metadataContextMs: number;
  attributesAndZoomMs: number;
  dataAttributesMs: number;
  zoomRangesMs: number;
  iconStyleMs: number;
  labelStyleMs: number;
}

interface StyleEvaluationContext {
  metadata: Record<string, unknown>;
  lowercaseKeys: Record<string, string>;
  normalizedKeys: Record<string, string>;
  tags?: Set<string>;
}

export class MarkerStyleService {
  private static readonly parseRulesCache = new Map<string, StyleRule[]>();
  private static readonly parseRulesCacheLimit = 128;

  private static parseRule(ruleString: string): StyleRule | null {
    const trimmed = ruleString.replace(/^\s*-\s*/, '').trim();

    const arrowIndex = trimmed.indexOf('=>');

    if (arrowIndex === -1) {
      logger.warn(`Invalid rule (missing =>): ${ruleString}`);

      return null;
    }

    const conditionPart = trimmed.substring(0, arrowIndex).trim();
    const cssPart = trimmed.substring(arrowIndex + 2).trim();

    if (!cssPart) {
      logger.warn(`Invalid rule (empty CSS): ${ruleString}`);

      return null;
    }

    if (!conditionPart) {
      return { condition: { type: 'always' }, css: cssPart };
    }

    const condition = this.parseConditionExpression(conditionPart);

    if (!condition) {
      logger.warn(`Invalid condition: ${conditionPart}`);

      return null;
    }

    return { condition, css: cssPart };
  }

  private static parseConditionExpression(conditionStr: string): Condition | null {
    const orParts = this.splitByOperator(conditionStr, ' OR ');

    if (orParts.length > 1) {
      const conditions = orParts
        .map(part => this.parseConditionExpression(part.trim()))
        .filter((c): c is Condition => c !== null);

      if (conditions.length === 0) return null;
      if (conditions.length === 1) return conditions[0];

      return { type: 'compound', operator: 'OR', conditions };
    }

    const andParts = this.splitByOperator(conditionStr, ' AND ');

    if (andParts.length > 1) {
      const conditions = andParts
        .map(part => this.parseSimpleCondition(part.trim()))
        .filter((c): c is SimpleCondition => c !== null);

      if (conditions.length === 0) return null;
      if (conditions.length === 1) return conditions[0];

      return { type: 'compound', operator: 'AND', conditions };
    }

    return this.parseSimpleCondition(conditionStr.trim());
  }

  private static splitByOperator(str: string, operator: string): string[] {
    const parts: string[] = [];
    let current = '';
    let i = 0;

    while (i < str.length) {
      if (str.substring(i, i + operator.length).toUpperCase() === operator.toUpperCase()) {
        parts.push(current);
        current = '';
        i += operator.length;
      } else {
        current += str[i];
        i++;
      }
    }

    parts.push(current);

    return parts.filter(p => p.trim().length > 0);
  }

  private static parseSimpleCondition(conditionStr: string): SimpleCondition | null {
    let str = conditionStr.trim();
    let negated = false;

    if (str.startsWith('!')) {
      negated = true;
      str = str.substring(1).trim();
    }

    // Set membership: `field IN a, b, c` (and `NOT IN`). The right side is a
    // comma-separated list - a multiselect/list parameter substitutes exactly
    // that way (`a, b`).
    const inMatch = /\s(not\s+)?in\s/i.exec(str);

    if (inMatch) {
      const property = str.substring(0, inMatch.index).trim();

      if (!property) return null;
      const values = this.parseValueList(str.substring(inMatch.index + inMatch[0].length));
      const notIn = Boolean(inMatch[1]);

      return { type: 'simple', property, operator: 'in', values, negated: (negated !== notIn) || undefined };
    }

    const operators = ['<=', '>=', '==', '!=', '<', '>'] as const;

    for (const op of operators) {
      const opIndex = str.indexOf(op);

      if (opIndex !== -1) {
        const property = str.substring(0, opIndex).trim();
        const valueStr = str.substring(opIndex + op.length).trim();

        if (!property) return null;

        let value: string | number;

        if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
            (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
          value = valueStr.slice(1, -1);
        } else if (!isNaN(Number(valueStr))) {
          value = Number(valueStr);
        } else {
          value = valueStr;
        }

        return { type: 'simple', property, operator: op, value, negated: negated || undefined };
      }
    }

    const property = str;

    if (!property) return null;

    return { type: 'simple', property, operator: 'truthy', negated: negated || undefined };
  }

  // Split an `IN` right-hand side (`a, "b", 3`) into trimmed, unquoted, numeric-coerced values; empties dropped.
  private static parseValueList(listStr: string): (string | number)[] {
    return listStr.split(',').map(raw => {
      const value = raw.trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
      }

      if (value !== '' && !isNaN(Number(value))) return Number(value);

      return value;
    }).filter(value => value !== '');
  }

  static parseRules(rulesConfig: readonly string[] | string | undefined): StyleRule[] {
    if (!rulesConfig) return [];

    const cacheKey = typeof rulesConfig === 'string' ? rulesConfig : rulesConfig.join('\n');
    const cached = this.parseRulesCache.get(cacheKey);

    if (cached) return cached;

    const lines = this.collectRuleLines(cacheKey.split('\n'));
    const rules = lines
      .map(line => this.parseRule(line))
      .filter((rule): rule is StyleRule => rule !== null);

    if (this.parseRulesCache.size >= this.parseRulesCacheLimit) {
      const oldestKey = this.parseRulesCache.keys().next().value;

      if (oldestKey !== undefined) {
        this.parseRulesCache.delete(oldestKey);
      }
    }

    this.parseRulesCache.set(cacheKey, rules);

    return rules;
  }

  private static collectRuleLines(lines: string[]): string[] {
    const rules: string[] = [];
    let currentRule: string | null = null;

    const pushCurrent = (): void => {
      if (currentRule !== null && currentRule.trim().length > 0) {
        rules.push(currentRule);
      }

      currentRule = null;
    };

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();

      if (!trimmed) {
        continue;
      }

      const withoutBullet = trimmed.replace(/^\s*-\s*/, '');

      if (withoutBullet.includes('=>')) {
        pushCurrent();
        currentRule = withoutBullet;
        continue;
      }

      if (currentRule !== null) {
        currentRule = `${currentRule} ${trimmed}`;
      } else {
        rules.push(rawLine);
      }
    }

    pushCurrent();

    return rules;
  }

  private static evaluateCondition(condition: Condition, context: StyleEvaluationContext): boolean {
    if (condition.type === 'always') return true;

    if (condition.type === 'compound') {
      if (condition.operator === 'AND') {
        return condition.conditions.every(c => this.evaluateCondition(c, context));
      } else {
        return condition.conditions.some(c => this.evaluateCondition(c, context));
      }
    }

    return this.evaluateSimpleCondition(condition, context);
  }

  private static getMetadataValue(context: StyleEvaluationContext, property: string): unknown {
    const metadata = context.metadata;

    if (property in metadata) {
      return metadata[property];
    }

    const lowerProperty = property.toLowerCase();
    const exactKey = context.lowercaseKeys[lowerProperty];

    if (exactKey !== undefined) {
      return metadata[exactKey];
    }

    const normalizedKey = context.normalizedKeys[normalizePropertyName(property)];

    if (normalizedKey !== undefined) {
      return metadata[normalizedKey];
    }

    if (lowerProperty.startsWith('tag:')) {
      return this.hasTag(context, property.slice(4));
    }

    return undefined;
  }

  private static hasTag(context: StyleEvaluationContext, tagName: string): boolean | undefined {
    const target = this.normalizeTagName(tagName);

    if (!target) return undefined;

    context.tags ??= this.buildTagSet(context);

    return context.tags.has(target) ? true : undefined;
  }

  private static buildTagSet(context: StyleEvaluationContext): Set<string> {
    const rawTags = this.getMetadataValue(context, 'tags') ?? this.getMetadataValue(context, 'tag');

    return new Set(tagMatchNames(rawTags));
  }

  private static normalizeTagName(tag: string): string {
    return tag.replace(/^#/, '').trim().toLowerCase();
  }

  private static toBoolean(value: unknown): boolean {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();

      if (lower === 'false' || lower === '0' || lower === '') {
        return false;
      }
    }

    return Boolean(value);
  }

  private static evaluateSimpleCondition(condition: SimpleCondition, context: StyleEvaluationContext): boolean {
    if (condition.operator === 'in') {
      const result = this.evaluateInMembership(condition, context);

      return condition.negated ? !result : result;
    }

    const metadataValue = this.getMetadataValue(context, condition.property);

    let result: boolean;

    if (condition.operator === 'truthy') {
      result = this.toBoolean(metadataValue);
    } else if (metadataValue === undefined || metadataValue === null) {
      result = false;
    } else {
      const compareValue = condition.value;

      switch (condition.operator) {
        case '==':
          result = metadataValue == compareValue;
          break;
        case '!=':
          result = metadataValue != compareValue;
          break;
        case '<':
          result = Number(metadataValue) < Number(compareValue);
          break;
        case '>':
          result = Number(metadataValue) > Number(compareValue);
          break;
        case '<=':
          result = Number(metadataValue) <= Number(compareValue);
          break;
        case '>=':
          result = Number(metadataValue) >= Number(compareValue);
          break;
        default:
          result = false;
      }
    }

    return condition.negated ? !result : result;
  }

  // `field IN a, b, c` membership. `tag`/`tags` means the place carries any of
  // the listed tags; any other field is a scalar compared with loose equality
  // (matching the `==` operator). An empty candidate list never matches.
  private static evaluateInMembership(condition: SimpleCondition, context: StyleEvaluationContext): boolean {
    const values = condition.values ?? [];

    if (values.length === 0) return false;

    const property = condition.property.toLowerCase();

    if (property === 'tag' || property === 'tags') {
      return values.some(value => this.hasTag(context, String(value)) === true);
    }

    const metadataValue = this.getMetadataValue(context, condition.property);

    if (metadataValue === undefined || metadataValue === null) return false;

    return values.some(value => metadataValue == value);
  }

  static evaluateRulesWithClasses(rules: StyleRule[], metadata: Record<string, unknown>): { styles: string; classes: string[] } {
    return this.evaluateRulesWithClassesInContext(rules, this.createStyleEvaluationContext(metadata));
  }

  // Filter places by whole-marker visibility conditions (the `visible:` block
  // key). A place is kept when it matches ANY rule; with no rules, all places
  // pass. Structural places (heatmap frequency points, bounds anchors) are never
  // filtered. Each rule uses the same condition syntax as iconStyles/labelStyles
  // (without the `=> css` part) and is evaluated against place metadata;
  // `{parameter.*}` placeholders are already substituted by the caller.
  static filterVisiblePlaces(places: MapPlace[], visibleRules: readonly string[] | undefined): MapPlace[] {
    if (!visibleRules || visibleRules.length === 0) {
      return places;
    }

    const conditions = visibleRules
      .map(rule => this.parseConditionExpression(rule.replace(/^\s*-\s*/u, '').trim()))
      .filter((condition): condition is Condition => condition !== null);

    if (conditions.length === 0) {
      return places;
    }

    return places.filter(place => {
      if (this.isStructuralPlace(place)) {
        return true;
      }

      const context = this.createStyleEvaluationContext(this.buildConditionMetadata(place));

      return conditions.some(condition => this.evaluateCondition(condition, context));
    });
  }

  private static isStructuralPlace(place: MapPlace): boolean {
    return place.metadata?.frequency !== undefined || place.metadata?.boundsAnchor === true;
  }

  private static cleanFilterRule(rule: string): string {
    return rule.replace(/^\s*-\s*/u, '').trim();
  }

  static explainMarkerFilter(places: readonly MapPlace[], visibleRules: readonly string[] | undefined): { rules: Array<{ rule: string; valid: boolean; matched: number }>; total: number; kept: number; fieldNames: string[] } {
    const filterable = places.filter(place => !this.isStructuralPlace(place));
    const contexts = filterable.map(place => this.createStyleEvaluationContext(this.buildConditionMetadata(place)));

    const fieldNames = new Set<string>();

    for (const context of contexts) {
      for (const key of Object.keys(context.metadata)) fieldNames.add(key);
    }

    const parsed = (visibleRules ?? []).map(raw => {
      const rule = this.cleanFilterRule(raw);

      return { rule, condition: this.parseConditionExpression(rule) };
    });

    const rules = parsed.map(({ rule, condition }) => ({
      rule,
      valid: condition !== null,
      matched: condition === null ? 0 : contexts.filter(context => this.evaluateCondition(condition, context)).length,
    }));

    const conditions = parsed.map(entry => entry.condition).filter((condition): condition is Condition => condition !== null);
    const kept = conditions.length === 0
      ? filterable.length
      : contexts.filter(context => conditions.some(condition => this.evaluateCondition(condition, context))).length;

    return { rules, total: filterable.length, kept, fieldNames: Array.from(fieldNames).sort() };
  }

  static explainPlaceMarkerFilter(place: MapPlace, visibleRules: readonly string[] | undefined): Array<{ rule: string; valid: boolean; matched: boolean }> {
    const structural = this.isStructuralPlace(place);
    const context = structural ? null : this.createStyleEvaluationContext(this.buildConditionMetadata(place));

    return (visibleRules ?? []).map(raw => {
      const rule = this.cleanFilterRule(raw);
      const condition = this.parseConditionExpression(rule);

      if (!condition) {
        return { rule, valid: false, matched: false };
      }

      return { rule, valid: true, matched: context === null ? true : this.evaluateCondition(condition, context) };
    });
  }

  static styleMetadataEntries(place: MapPlace): Array<{ field: string; value: string }> {
    return Object.entries(this.buildConditionMetadata(place))
      .filter(([, value]) => value !== undefined && value !== null)
      .flatMap(([field, value]): Array<{ field: string; value: string }> => {
        // Tag lists drive `tag IN` conditions; other objects have no condition semantics.
        if (Array.isArray(value)) return [{ field, value: value.map(item => scalarToString(item)).join(', ') }];
        if (typeof value === 'object') return [];

        return [{ field, value: scalarToString(value) }];
      })
      .sort((left, right) => left.field.localeCompare(right.field));
  }

  private static evaluateRulesWithClassesInContext(rules: StyleRule[], context: StyleEvaluationContext): { styles: string; classes: string[] } {
    if (!rules || rules.length === 0) return { styles: '', classes: [] };

    const styles: string[] = [];
    const classes: string[] = [];

    for (const rule of rules) {
      if (!this.evaluateCondition(rule.condition, context)) {
        continue;
      }

      const cssValue = this.interpolateCss(rule.css, context).trim();

      if (cssValue.startsWith('.')) {
        const classNames = cssValue.split(/\s+/)
          .filter(c => c.startsWith('.'))
          .map(c => c.substring(1));

        classes.push(...classNames);
      } else {
        styles.push(cssValue);
      }
    }

    return { styles: styles.join('; '), classes };
  }

  private static interpolateCss(css: string, context: StyleEvaluationContext): string {
    if (!css.includes('{')) return css;

    return css.replace(/\{(\w+)\}/g, (match: string, propertyName: string) => {
      const value = this.getMetadataValue(context, propertyName);

      if (value === undefined || value === null) {
        return match;
      }

      return coerceScalarString(value);
    });
  }

  static getDataAttributes(metadata: Record<string, unknown> | undefined): Record<string, string> {
    if (!metadata) return {};

    const dataAttrs: Record<string, string> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (key.startsWith('_') || typeof value === 'object' || typeof value === 'function') {
        continue;
      }

      if (['Polyline', 'Overlay Source', 'Overlay Cache', 'Location', 'mapOptions'].includes(key)) {
        continue;
      }

      // HTML attribute names are case-insensitive and normalized by the DOM.
      // Keep CSS data selectors aligned with style-rule property names by not
      // converting camelCase metadata keys to kebab-case.
      const dataKey = key
        .replace(/\s+/g, '-')
        .toLowerCase();

      dataAttrs[dataKey] = coerceScalarString(value);
    }

    return dataAttrs;
  }

  static sanitizeDataAttributeName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  static buildDataAttributesString(dataAttributes: Record<string, string>): string {
    return Object.entries(dataAttributes)
      .map(([key, value]) => `data-${this.sanitizeDataAttributeName(key)}="${this.escapeHtml(value)}"`)
      .join(' ');
  }

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private static extractCssProperty(css: string, pattern: RegExp): { match: RegExpMatchArray | null; remaining: string } {
    const match = css.match(pattern);

    if (!match) return { match: null, remaining: css };
    const remaining = css.replace(match[0], match[0].startsWith(';') ? ';' : '');

    return { match, remaining };
  }

  private static cleanRemainingCss(css: string): string {
    return css.replace(/^[;\s]+|[;\s]+$/g, '').replace(/;+/g, ';').trim();
  }

  private static normalizeCssDeclarations(css: string): string {
    if (!css) return '';

    const declarations = css
      .split(';')
      .map(declaration => declaration.trim())
      .filter(Boolean);

    if (declarations.length <= 1) return css.trim();

    const properties = new Map<string, { property: string; value: string }>();

    for (const declaration of declarations) {
      const separatorIndex = declaration.indexOf(':');

      if (separatorIndex === -1) {
        continue;
      }

      const property = declaration.slice(0, separatorIndex).trim();
      const value = declaration.slice(separatorIndex + 1).trim();

      if (!property || !value) {
        continue;
      }

      properties.set(property.toLowerCase(), { property, value });
    }

    return Array.from(properties.values())
      .map(({ property, value }) => `${property}: ${value}`)
      .join('; ');
  }

  private static extractIconStyleProperties(css: string): { opacity?: number; zIndex?: number; remainingCss: string } {
    if (!css) return { remainingCss: '' };

    let remaining = css;
    let opacity: number | undefined;
    let zIndex: number | undefined;

    const opacityResult = this.extractCssProperty(remaining, /(?:^|;)\s*opacity\s*:\s*(\d*\.?\d+)\s*(%)?/i);

    remaining = opacityResult.remaining;

    if (opacityResult.match) {
      const value = parseFloat(opacityResult.match[1]);

      opacity = opacityResult.match[2] === '%' ? value / 100 : value;
    }

    const zIndexResult = this.extractCssProperty(remaining, /(?:^|;)\s*z-index\s*:\s*(-?\d+)/i);

    remaining = zIndexResult.remaining;

    if (zIndexResult.match) {
      zIndex = parseInt(zIndexResult.match[1], 10);
    }

    return { opacity, zIndex, remainingCss: this.cleanRemainingCss(remaining) };
  }

  private static extractIconBadgeProperties(css: string): { badge?: IconBadgeStyle; remainingCss: string } {
    if (!css) return { remainingCss: '' };

    let remaining = css;

    const contentResult = this.extractCssProperty(remaining, /(?:^|;)\s*content\s*:\s*([^;]+)/i);

    remaining = contentResult.remaining;

    const sizeResult = this.extractCssProperty(remaining, /(?:^|;)\s*content-size\s*:\s*(\d*\.?\d+)\s*%/i);

    remaining = sizeResult.remaining;

    const opacityResult = this.extractCssProperty(remaining, /(?:^|;)\s*content-opacity\s*:\s*(\d*\.?\d+)\s*(%)?/i);

    remaining = opacityResult.remaining;

    const orderResult = this.extractCssProperty(remaining, /(?:^|;)\s*content-order\s*:\s*(behind|front)\b/i);

    remaining = orderResult.remaining;

    const offsetXResult = this.extractCssProperty(remaining, /(?:^|;)\s*content-offset-x\s*:\s*(-?\d*\.?\d+)\s*(%|px)?/i);

    remaining = offsetXResult.remaining;

    const offsetYResult = this.extractCssProperty(remaining, /(?:^|;)\s*content-offset-y\s*:\s*(-?\d*\.?\d+)\s*(%|px)?/i);

    remaining = offsetYResult.remaining;

    let badge: IconBadgeStyle | undefined;
    const content = contentResult.match?.[1].trim().replace(/^["']|["']$/g, '');

    if (content) {
      const opacityValue = opacityResult.match ? parseFloat(opacityResult.match[1]) : undefined;

      badge = {
        content,
        sizePct: sizeResult.match ? parseFloat(sizeResult.match[1]) : 100,
        opacity: opacityValue === undefined ? 1 : (opacityResult.match?.[2] === '%' ? opacityValue / 100 : opacityValue),
        order: orderResult.match ? orderResult.match[1].toLowerCase() as 'behind' | 'front' : 'behind',
      };
      const offsetX = this.readIconBadgeOffset(offsetXResult.match);
      const offsetY = this.readIconBadgeOffset(offsetYResult.match);

      if (offsetX) badge.offsetX = offsetX;
      if (offsetY) badge.offsetY = offsetY;
    }

    return { badge, remainingCss: this.cleanRemainingCss(remaining) };
  }

  private static readIconBadgeOffset(match: RegExpMatchArray | null): IconBadgeOffset | undefined {
    if (!match) return undefined;

    return {
      value: parseFloat(match[1]),
      unit: (match[2]?.toLowerCase() === 'px' ? 'px' : '%'),
    };
  }

  // A font-size value containing `@` zoom stops (`font-size: 25% @z7, 87.5% @z15`) is
  // consumed - it is not valid CSS. Plain percentage font-size stays in inlineCss.
  // The equivalent valid CSS is synthesized back into inlineCss, and HTML markers render
  // the same curve through the `--map-zoom` container variable.
  private static extractIconZoomSizeStops(css: string): { zoomSizeStops?: IconZoomSizeStop[]; remainingCss: string } {
    if (!css) return { remainingCss: '' };

    const result = this.extractCssProperty(css, /(?:^|;)\s*font-size\s*:\s*([^;]*@[^;]+)/i);

    if (!result.match) return { remainingCss: css };

    const stops: IconZoomSizeStop[] = [];

    for (const part of result.match[1].split(',')) {
      const stopMatch = part.trim().match(/^(\d*\.?\d+)\s*%\s*@\s*z?\s*(\d*\.?\d+)$/i);

      if (!stopMatch) continue;
      stops.push({ scale: parseFloat(stopMatch[1]) / 100, zoom: parseFloat(stopMatch[2]) });
    }

    stops.sort((a, b) => a.zoom - b.zoom);

    const cleaned = this.cleanRemainingCss(result.remaining);

    if (stops.length === 0) return { remainingCss: cleaned };

    // A single stop is a constant scale: identical to plain percentage font-size on both renderers.
    const synthesized = stops.length === 1
      ? `font-size: ${stops[0].scale * 100}%`
      : this.buildZoomSizeCss(stops);

    return {
      zoomSizeStops: stops.length > 1 ? stops : undefined,
      remainingCss: [cleaned, synthesized].filter(Boolean).join('; '),
    };
  }

  // HTML equivalent of zoom-size stops: a piecewise-linear curve over the `--map-zoom`
  // container variable. Any stop list, including non-monotonic ones, reduces to
  // one calc() expression.
  private static buildZoomSizeCss(stops: IconZoomSizeStop[]): string {
    const terms: string[] = [String(stops[0].scale)];

    for (let i = 1; i < stops.length; i++) {
      const from = stops[i - 1];
      const to = stops[i];
      const delta = to.scale - from.scale;

      if (delta === 0) continue;
      const slope = Number((delta / (to.zoom - from.zoom)).toFixed(6));

      terms.push(`clamp(${Math.min(0, delta)}, (var(--map-zoom) - ${from.zoom}) * ${slope}, ${Math.max(0, delta)})`);
    }

    return `font-size: calc(var(--places-icon-font-size) * (${terms.join(' + ')}))`;
  }

  static getBadgeClassName(badge: IconBadgeStyle): string {
    return `places-badge-${hashString36(JSON.stringify(badge))}`;
  }

  static withoutZoomVisibility(rules: StyleRule[]): StyleRule[] {
    return rules
      .map(rule => ({
        ...rule,
        css: this.cleanRemainingCss(rule.css.replace(/(?:^|;)\s*(?:min-zoom|max-zoom|places-min-zoom|places-max-zoom)\s*:\s*[^;]+/gi, ';')),
      }))
      .filter(rule => rule.css);
  }

  static buildBadgeCss(places: MapPlace[]): string {
    const rules = new Map<string, string>();

    for (const place of places) {
      const badge = place.iconStyle?.badge;

      if (!badge) continue;
      const className = this.getBadgeClassName(badge);

      if (rules.has(className)) continue;
      rules.set(className, [
        `.${className}::before {`,
        `  content: "${badge.content.replace(/"/g, '\\"')}";`,
        `  position: absolute;`,
        `  font-size: ${badge.sizePct}%;`,
        `  opacity: ${badge.opacity};`,
        `  z-index: ${badge.order === 'front' ? 1 : -1};`,
        `  transform: translate(${this.formatIconBadgeOffset(badge.offsetX)}, ${this.formatIconBadgeOffset(badge.offsetY)});`,
        `}`,
      ].join('\n'));
    }

    return Array.from(rules.values()).join('\n\n');
  }

  private static formatIconBadgeOffset(offset: IconBadgeOffset | undefined): string {
    if (!offset) return '0';

    return `${offset.value}${offset.unit}`;
  }

  private static readonly cssColorPattern = /#[0-9a-fA-F]{3,8}|rgba?\s*\([^)]+\)|\b(?:black|white|red|green|blue|yellow|cyan|magenta|orange|purple|pink|gray|grey|brown|gold|silver|transparent)\b/i;

  private static readIconShadowProperties(css: string): IconShadowStyle[] | undefined {
    if (!css) return undefined;

    const shadows: IconShadowStyle[] = [];

    const filterMatch = css.match(/(?:^|;)\s*filter\s*:\s*([^;]+)/i);

    if (filterMatch) {
      const dropShadowPattern = /drop-shadow\s*\(([^()]*(?:\([^)]*\)[^()]*)*)\)/gi;
      let shadowMatch;

      while ((shadowMatch = dropShadowPattern.exec(filterMatch[1])) !== null) {
        const shadow = this.parseShadowValue(shadowMatch[1]);

        if (shadow) shadows.push(shadow);
      }
    }

    const textShadowMatch = css.match(/(?:^|;)\s*text-shadow\s*:\s*([^;]+)/i);

    if (textShadowMatch) {
      for (const part of this.splitOutsideParens(textShadowMatch[1], ',')) {
        const shadow = this.parseShadowValue(part);

        if (shadow) shadows.push(shadow);
      }
    }

    return shadows.length > 0 ? shadows : undefined;
  }

  private static readIconScale(css: string): number | undefined {
    const match = css.match(/(?:^|;)\s*font-size\s*:\s*(\d*\.?\d+)\s*%/i);

    if (!match) return undefined;
    const scale = parseFloat(match[1]) / 100;

    return Number.isFinite(scale) && scale > 0 ? scale : undefined;
  }

  private static readIconColor(css: string): string | undefined {
    const match = css.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);

    return match?.[1]?.trim() || undefined;
  }

  private static readIconShape(css: string): IconShapeStyle | undefined {
    if (!css || !this.shapeHintPattern.test(css)) return undefined;

    const fill = css.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i)?.[1]?.trim();
    const borderShorthand = css.match(/(?:^|;)\s*border\s*:\s*([^;]+)/i)?.[1]?.trim();
    const strokeColor = css.match(/(?:^|;)\s*border-color\s*:\s*([^;]+)/i)?.[1]?.trim()
      ?? borderShorthand?.match(this.cssColorPattern)?.[0];
    const strokeWidth = css.match(/(?:^|;)\s*border-width\s*:\s*(\d*\.?\d+)\s*px/i)?.[1]
      ?? borderShorthand?.match(/(\d*\.?\d+)\s*px/i)?.[1];
    const radius = css.match(/(?:^|;)\s*border-radius\s*:\s*(\d*\.?\d+)\s*(px|%)/i);

    const stroke = strokeWidth === undefined || borderShorthand === 'none' ? undefined : strokeColor;
    const paints = Boolean(stroke) || Boolean(fill && fill !== 'none' && fill !== 'transparent');

    if (!paints && !radius) return undefined;

    return {
      fill: fill && fill !== 'none' && fill !== 'transparent' ? fill : undefined,
      stroke,
      strokeWidth: stroke ? parseFloat(strokeWidth ?? '0') : 0,
      radius: radius
        ? { value: parseFloat(radius[1]), unit: radius[2] === '%' ? '%' : 'px' }
        : { value: 0, unit: 'px' },
    };
  }

  private static readonly shapeHintPattern = /(?:^|;)\s*(?:background|border)/i;

  private static parseShadowValue(value: string): IconShadowStyle | undefined {
    const color = value.match(this.cssColorPattern)?.[0] ?? 'rgba(0, 0, 0, 0.8)';
    const lengths = (value.replace(new RegExp(this.cssColorPattern.source, 'gi'), '').match(/-?\d*\.?\d+/g) || []).map(parseFloat);

    if (lengths.length === 0) return undefined;

    return { offsetX: lengths[0] ?? 0, offsetY: lengths[1] ?? 0, blur: lengths[2] ?? 0, color };
  }

  private static splitOutsideParens(value: string, separator: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';

    for (const char of value) {
      if (char === '(') depth++;
      else if (char === ')') depth--;

      if (char === separator && depth === 0) {
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    parts.push(current);

    return parts.map(part => part.trim()).filter(Boolean);
  }

  private static extractZoomStyleProperties(css: string): { zoom?: ZoomRange; remainingCss: string } {
    if (!css) return { remainingCss: '' };

    let remaining = css;
    let minZoom: number | undefined;
    let maxZoom: number | undefined;

    const minZoomResult = this.extractCssProperty(remaining, /(?:^|;)\s*(?:min-zoom|places-min-zoom)\s*:\s*(-?\d*\.?\d+)/i);

    remaining = minZoomResult.remaining;
    if (minZoomResult.match) minZoom = Number(minZoomResult.match[1]);

    const maxZoomResult = this.extractCssProperty(remaining, /(?:^|;)\s*(?:max-zoom|places-max-zoom)\s*:\s*(-?\d*\.?\d+)/i);

    remaining = maxZoomResult.remaining;
    if (maxZoomResult.match) maxZoom = Number(maxZoomResult.match[1]);

    return { zoom: normalizeZoomRange({ minZoom, maxZoom }), remainingCss: this.cleanRemainingCss(remaining) };
  }

  private static cssLengthToEm(raw: string, fontSizePx: number): number | undefined {
    const match = raw.trim().match(/^(-?\d*\.?\d+)\s*(px|em)?$/i);

    if (!match) return undefined;
    const value = parseFloat(match[1]);

    if (Number.isNaN(value)) return undefined;

    return match[2]?.toLowerCase() === 'px' ? value / fontSizePx : value;
  }

  private static extractLabelStyleProperties(css: string): { color?: string; fontSize?: number; opacity?: number; haloColor?: string; haloWidth?: number; haloBlur?: number; letterSpacing?: number; maxWidth?: number; textTransform?: 'none' | 'uppercase' | 'lowercase'; textJustify?: 'left' | 'center' | 'right'; zIndex?: number; remainingCss: string } {
    if (!css) return { remainingCss: '' };

    let remaining = css;
    let color: string | undefined;
    let fontSize: number | undefined;
    let opacity: number | undefined;
    let haloColor: string | undefined;
    let haloWidth: number | undefined;
    let haloBlur: number | undefined;

    const colorResult = this.extractCssProperty(remaining, /(?:^|;)\s*color\s*:\s*([^;]+)/i);

    remaining = colorResult.remaining;
    if (colorResult.match) color = colorResult.match[1].trim();

    const fontSizeResult = this.extractCssProperty(remaining, /(?:^|;)\s*font-size\s*:\s*(\d*\.?\d+)\s*px/i);

    remaining = fontSizeResult.remaining;
    if (fontSizeResult.match) fontSize = parseFloat(fontSizeResult.match[1]);

    const opacityResult = this.extractCssProperty(remaining, /(?:^|;)\s*opacity\s*:\s*(\d*\.?\d+)/i);

    remaining = opacityResult.remaining;
    if (opacityResult.match) opacity = parseFloat(opacityResult.match[1]);

    const zIndexResult = this.extractCssProperty(remaining, /(?:^|;)\s*z-index\s*:\s*(-?\d+)/i);

    remaining = zIndexResult.remaining;
    const zIndex = zIndexResult.match ? parseInt(zIndexResult.match[1], 10) : undefined;

    const shadowResult = this.extractCssProperty(remaining, /(?:^|;)\s*text-shadow\s*:\s*([^;]+)/i);

    remaining = shadowResult.remaining;

    if (shadowResult.match) {
      const shadowValue = shadowResult.match[1].trim();
      const colorPattern = /#[0-9a-fA-F]{3,8}|rgba?\s*\([^)]+\)|\b(?:black|white|red|green|blue|yellow|cyan|magenta|orange|purple|pink|gray|grey|brown|transparent)\b/i;

      haloColor = shadowValue.match(colorPattern)?.[0];

      // text-shadow is `offsetX offsetY blur color`: the blur radius drives the halo blur,
      // and the offsets give a solid width (falling back to the blur, keeping `0 0 Npx` visible).
      const lengths = (shadowValue.replace(new RegExp(colorPattern, 'gi'), '').match(/-?\d*\.?\d+/g) || []).map(parseFloat);

      if (lengths.length > 0) {
        haloBlur = lengths[2] ?? 0;
        haloWidth = Math.max(Math.abs(lengths[0] ?? 0), Math.abs(lengths[1] ?? 0)) || haloBlur;
      }
    }

    // The following are valid CSS on Leaflet's HTML labels too, and are read without consuming
    // (left in remainingCss/inlineCss for native rendering; mapped to symbol props for MapLibre).
    const transformMatch = remaining.match(/(?:^|;)\s*text-transform\s*:\s*(uppercase|lowercase|none)\b/i);
    const textTransform = transformMatch ? transformMatch[1].toLowerCase() as 'none' | 'uppercase' | 'lowercase' : undefined;

    const justifyMatch = remaining.match(/(?:^|;)\s*text-align\s*:\s*(left|center|right)\b/i);
    const textJustify = justifyMatch ? justifyMatch[1].toLowerCase() as 'left' | 'center' | 'right' : undefined;

    const letterSpacingMatch = remaining.match(/(?:^|;)\s*letter-spacing\s*:\s*([^;]+)/i);
    const letterSpacing = letterSpacingMatch ? this.cssLengthToEm(letterSpacingMatch[1], fontSize ?? 14) : undefined;

    const maxWidthMatch = remaining.match(/(?:^|;)\s*max-width\s*:\s*([^;]+)/i);
    const maxWidth = maxWidthMatch ? this.cssLengthToEm(maxWidthMatch[1], fontSize ?? 14) : undefined;

    return { color, fontSize, opacity, haloColor, haloWidth, haloBlur, letterSpacing, maxWidth, textTransform, textJustify, zIndex, remainingCss: this.cleanRemainingCss(remaining) };
  }

  static processPlace(place: MapPlace, config: MarkerStyleConfig): void {
    this.processPlaceInternal(place, config);
  }

  private static processPlaceInternal(place: MapPlace, config: MarkerStyleConfig, profile?: MarkerStyleProfile): void {
    let phaseStarted = profile ? this.profileNow() : 0;
    const metadata = this.buildStyleMetadata(place);

    const context = this.createStyleEvaluationContext({ icon: place.icon, name: place.name, ...metadata });

    if (profile) {
      profile.metadataContextMs += this.profileNow() - phaseStarted;
      phaseStarted = this.profileNow();
    }

    place.dataAttributes = this.getDataAttributes(metadata);

    if (profile) {
      profile.dataAttributesMs += this.profileNow() - phaseStarted;
      phaseStarted = this.profileNow();
    }

    const zoomRanges = readZoomRangesFromRecord({ ...config, ...place.settings }, ['marker', 'label', 'track', 'overlay']);

    place.markerZoom = zoomRanges.marker;
    place.labelZoom = zoomRanges.label;
    place.overlayZoom = zoomRanges.overlay;
    place.trackZoom = mergeZoomRanges(
      zoomRanges.track,
      zoomRanges.overlay
    );

    if (profile) {
      profile.zoomRangesMs += this.profileNow() - phaseStarted;
      profile.attributesAndZoomMs = profile.dataAttributesMs + profile.zoomRangesMs;
      phaseStarted = this.profileNow();
    }

    const iconRules = [...(config.iconStyles ?? []), ...this.parseRules(place.settings?.iconStyles)];
    const iconResult = iconRules.length > 0
      ? this.evaluateRulesWithClassesInContext(iconRules, context)
      : { styles: '', classes: [] };

    const iconCssString = this.normalizeCssDeclarations(iconResult.styles);

    const iconZoomExtracted = iconCssString
      ? this.extractZoomStyleProperties(iconCssString)
      : { remainingCss: '' };
    const iconBadgeExtracted = this.extractIconBadgeProperties(iconZoomExtracted.remainingCss);
    const iconZoomSizeExtracted = this.extractIconZoomSizeStops(iconBadgeExtracted.remainingCss);
    const iconExtracted = iconZoomSizeExtracted.remainingCss
      ? this.extractIconStyleProperties(iconZoomSizeExtracted.remainingCss)
      : { remainingCss: '' };
    const iconZoom = mergeZoomRanges(place.markerZoom, iconZoomExtracted.zoom);

    place.iconStyle = {
      opacity: iconExtracted.opacity,
      zIndex: iconExtracted.zIndex,
      zoom: iconZoom,
      scale: this.readIconScale(iconExtracted.remainingCss),
      color: this.readIconColor(iconExtracted.remainingCss),
      badge: iconBadgeExtracted.badge,
      shape: this.readIconShape(iconExtracted.remainingCss),
      shadows: this.readIconShadowProperties(iconExtracted.remainingCss),
      zoomSizeStops: iconZoomSizeExtracted.zoomSizeStops,
      inlineCss: iconExtracted.remainingCss,
      classes: [
        ...iconResult.classes,
        ...(iconBadgeExtracted.badge ? [this.getBadgeClassName(iconBadgeExtracted.badge)] : []),
        ...getZoomRangeClassNames(iconZoom)
      ]
    };
    place.iconImageStyle = undefined;

    if (config.iconImageStyles?.length || place.settings?.iconImageStyles) {
      const pictureRules = [...(config.iconImageStyles ?? []), ...this.parseRules(place.settings?.iconImageStyles)];
      const pictureResult = this.evaluateRulesWithClassesInContext(pictureRules, context);
      const pictureCss = this.normalizeCssDeclarations(pictureResult.styles);
      const pictureExtracted = pictureCss ? this.extractIconStyleProperties(pictureCss) : { remainingCss: '' };

      place.iconImageStyle = {
        opacity: pictureExtracted.opacity,
        zIndex: pictureExtracted.zIndex,
        shape: this.readIconShape(pictureExtracted.remainingCss),
        inlineCss: pictureExtracted.remainingCss,
        classes: pictureResult.classes,
      };
    }

    if (profile) {
      profile.iconStyleMs += this.profileNow() - phaseStarted;
      phaseStarted = this.profileNow();
    }

    const labelRules = [...(config.labelStyles ?? []), ...this.parseRules(place.settings?.labelStyles)];
    const labelResult = labelRules.length > 0
      ? this.evaluateRulesWithClassesInContext(labelRules, context)
      : { styles: '', classes: [] };
    const labelCssString = this.normalizeCssDeclarations(labelResult.styles);
    const hasUserLabelStyle = Boolean(labelCssString.trim() || labelResult.classes.length);

    const labelZoomExtracted = labelCssString
      ? this.extractZoomStyleProperties(labelCssString)
      : { remainingCss: '' };
    const labelExtracted = labelZoomExtracted.remainingCss
      ? this.extractLabelStyleProperties(labelZoomExtracted.remainingCss)
      : { remainingCss: '' };
    const labelZoom = mergeZoomRanges(place.labelZoom, labelZoomExtracted.zoom);

    place.labelStyle = {
      color: labelExtracted.color,
      fontSize: labelExtracted.fontSize,
      opacity: labelExtracted.opacity,
      haloColor: labelExtracted.haloColor,
      haloWidth: labelExtracted.haloWidth,
      haloBlur: labelExtracted.haloBlur,
      letterSpacing: labelExtracted.letterSpacing,
      maxWidth: labelExtracted.maxWidth,
      textTransform: labelExtracted.textTransform,
      textJustify: labelExtracted.textJustify,
      zIndex: labelExtracted.zIndex,
      zoom: labelZoom,
      hasUserStyle: hasUserLabelStyle,
      inlineCss: labelZoomExtracted.remainingCss,
      classes: [...labelResult.classes, ...getZoomRangeClassNames(labelZoom)]
    };

    if (profile) {
      profile.labelStyleMs += this.profileNow() - phaseStarted;
    }
  }

  private static buildConditionMetadata(place: MapPlace): Record<string, unknown> {
    return { icon: place.icon, name: place.name, ...this.buildStyleMetadata(place) };
  }

  private static buildStyleMetadata(place: MapPlace): Record<string, unknown> {
    const metadata: Record<string, unknown> = { ...(place.metadata || {}) };

    if (place.tags && place.tags.length > 0) {
      metadata.tags ??= place.tags;

      for (const rawTag of place.tags) {
        const tag = this.normalizeTagName(String(rawTag));

        if (tag) {
          metadata[`tag:${tag}`] = true;
        }
      }
    }

    return metadata;
  }

  private static createStyleEvaluationContext(metadata: Record<string, unknown>): StyleEvaluationContext {
    const lowercaseKeys: Record<string, string> = {};
    const normalizedKeys: Record<string, string> = {};

    for (const key of Object.keys(metadata)) {
      lowercaseKeys[key.toLowerCase()] = key;
      normalizedKeys[normalizePropertyName(key)] = key;
    }

    return { metadata, lowercaseKeys, normalizedKeys };
  }

  static processPlaces(places: MapPlace[], config: MarkerStyleConfig, options?: { profile?: boolean }): MarkerStyleProfile | undefined {
    const profile: MarkerStyleProfile | undefined = options?.profile
      ? {
        places: places.length,
        totalMs: 0,
        metadataContextMs: 0,
        attributesAndZoomMs: 0,
        dataAttributesMs: 0,
        zoomRangesMs: 0,
        iconStyleMs: 0,
        labelStyleMs: 0,
      }
      : undefined;
    const started = profile ? this.profileNow() : 0;

    for (const place of places) {
      this.processPlaceInternal(place, config, profile);
    }

    if (profile) profile.totalMs = this.profileNow() - started;

    return profile;
  }

  private static profileNow(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }
}
