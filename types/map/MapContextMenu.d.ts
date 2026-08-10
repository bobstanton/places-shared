import { Coordinate } from '../geo/DistanceCalculator';
import type { PlaceNoteHost } from './PlaceNoteRequest';
export interface MapContextMenuOptions {
    placeNoteHost?: PlaceNoteHost;
    reverseGeocodeHost?: (coordinate: Coordinate) => void;
    customMenuItems?: (coordinate: Coordinate, event: MouseEvent, point?: [number, number]) => ContextMenuItem[];
}
export interface ContextMenuItem {
    text: string;
    icon?: string;
    onClick: (coordinate: Coordinate, event: MouseEvent) => void | Promise<void>;
    separator?: boolean;
}
export declare class MapContextMenu {
    private placeNoteHost?;
    private reverseGeocodeHost?;
    private customMenuItems?;
    private contextMenu;
    private longPressTimer;
    private touchStartPosition;
    private readonly listeners;
    private openMenuListeners;
    constructor(options: MapContextMenuOptions);
    open(coordinate: Coordinate, clientX: number, clientY: number, event: MouseEvent, point?: [number, number]): void;
    attachTouchLongPress(container: HTMLElement, getCoordinate: (clientX: number, clientY: number) => Coordinate | null): void;
    private attachDismissListeners;
    private getDefaultMenuItems;
    private positionMenu;
    private hideContextMenu;
    private handleTouchStart;
    private handleTouchMove;
    private cancelLongPress;
    cleanup(): void;
}
