import { MapPlace, IconBadgeStyle } from '../Place';
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
export declare class MarkerStyleService {
    private static readonly parseRulesCache;
    private static readonly parseRulesCacheLimit;
    private static parseRule;
    private static parseConditionExpression;
    private static splitByOperator;
    private static parseSimpleCondition;
    private static parseValueList;
    static parseRules(rulesConfig: readonly string[] | string | undefined): StyleRule[];
    private static collectRuleLines;
    private static evaluateCondition;
    private static getMetadataValue;
    private static hasTag;
    private static buildTagSet;
    private static normalizeTagName;
    private static toBoolean;
    private static evaluateSimpleCondition;
    private static evaluateInMembership;
    static evaluateRulesWithClasses(rules: StyleRule[], metadata: Record<string, unknown>): {
        styles: string;
        classes: string[];
    };
    static filterVisiblePlaces(places: MapPlace[], visibleRules: readonly string[] | undefined): MapPlace[];
    private static isStructuralPlace;
    private static cleanFilterRule;
    static explainMarkerFilter(places: readonly MapPlace[], visibleRules: readonly string[] | undefined): {
        rules: Array<{
            rule: string;
            valid: boolean;
            matched: number;
        }>;
        total: number;
        kept: number;
        fieldNames: string[];
    };
    static explainPlaceMarkerFilter(place: MapPlace, visibleRules: readonly string[] | undefined): Array<{
        rule: string;
        valid: boolean;
        matched: boolean;
    }>;
    static styleMetadataEntries(place: MapPlace): Array<{
        field: string;
        value: string;
    }>;
    private static evaluateRulesWithClassesInContext;
    private static interpolateCss;
    static getDataAttributes(metadata: Record<string, unknown> | undefined): Record<string, string>;
    static sanitizeDataAttributeName(name: string): string;
    static buildDataAttributesString(dataAttributes: Record<string, string>): string;
    private static escapeHtml;
    private static extractCssProperty;
    private static cleanRemainingCss;
    private static normalizeCssDeclarations;
    private static extractIconStyleProperties;
    private static extractIconBadgeProperties;
    private static readIconBadgeOffset;
    private static extractIconZoomSizeStops;
    private static buildZoomSizeCss;
    static getBadgeClassName(badge: IconBadgeStyle): string;
    static withoutZoomVisibility(rules: StyleRule[]): StyleRule[];
    static buildBadgeCss(places: MapPlace[]): string;
    private static formatIconBadgeOffset;
    private static readonly cssColorPattern;
    private static readIconShadowProperties;
    private static readIconScale;
    private static readIconColor;
    private static readIconShape;
    private static readonly shapeHintPattern;
    private static parseShadowValue;
    private static splitOutsideParens;
    private static extractZoomStyleProperties;
    private static cssLengthToEm;
    private static extractLabelStyleProperties;
    static processPlace(place: MapPlace, config: MarkerStyleConfig): void;
    private static processPlaceInternal;
    private static buildConditionMetadata;
    private static buildStyleMetadata;
    private static createStyleEvaluationContext;
    static processPlaces(places: MapPlace[], config: MarkerStyleConfig, options?: {
        profile?: boolean;
    }): MarkerStyleProfile | undefined;
    private static profileNow;
}
