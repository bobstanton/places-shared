export interface ZoomValueStop {
    readonly zoom: number;
    readonly value: number;
}
export type ZoomScaledNumber = number | readonly ZoomValueStop[];
export declare function parseZoomScaledNumber(value: unknown): ZoomScaledNumber | undefined;
