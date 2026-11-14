import { Coordinate } from '../../geo/index';
import { formatDisplayCoordinate } from '../../utils/index';
import { copyToClipboard } from '../utils/FileUtils';
import type { PlaceNoteHost } from '../../map/index';

export interface MapContextMenuOptions {
  sourcePath?: string;
  placeNoteHost?: PlaceNoteHost;
  reverseGeocodeHost?: (coordinate: Coordinate, sourcePath?: string) => void;
  customMenuItems?: (coordinate: Coordinate, event: MouseEvent, point?: [number, number]) => ContextMenuItem[];
}

export interface ContextMenuItem {
  text: string;
  icon?: string;
  onClick: (coordinate: Coordinate, event: MouseEvent) => void | Promise<void>;
  separator?: boolean;
}

export class MapContextMenu {
  private contextMenu: HTMLElement | null = null;
  private longPressTimer: number | null = null;
  private touchStartPosition: { x: number; y: number } | null = null;
  private readonly listeners = new AbortController();
  private openMenuListeners: AbortController | null = null;

  constructor(private readonly getOptions: () => MapContextMenuOptions) {}

  open(coordinate: Coordinate, clientX: number, clientY: number, event: MouseEvent, point?: [number, number]): void {
    this.hideContextMenu();

    this.contextMenu = createDiv({ cls: 'places-context-menu' });
    this.contextMenu.setCssProps({
      position: 'fixed',
      left: `${clientX}px`,
      top: `${clientY}px`,
      zIndex: '10000'
    });

    const options = this.getOptions();
    const menuItems = this.getDefaultMenuItems(coordinate, options);

    if (options.customMenuItems) {
      const custom = options.customMenuItems(coordinate, event, point);

      if (custom.length > 0) {
        menuItems.push({ text: '', icon: '', onClick: () => {}, separator: true });
        menuItems.push(...custom);
      }
    }

    menuItems.forEach((item, index) => {
      if (item.separator && index > 0) {
        this.contextMenu!.createDiv({ cls: 'places-context-menu-separator' });
      }

      if (item.text) {
        const menuItem = this.contextMenu!.createDiv({ cls: 'places-context-menu-item' });

        if (item.icon) {
          menuItem.createSpan({ text: item.icon, cls: 'places-context-menu-icon' });
        }

        menuItem.createSpan({ text: item.text });

        menuItem.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hideContextMenu();
          void item.onClick(coordinate, event);
        });
      }
    });

    this.positionMenu(clientX, clientY);

    activeDocument.body.appendChild(this.contextMenu);
    this.attachDismissListeners();
  }

  attachTouchLongPress(container: HTMLElement, getCoordinate: (clientX: number, clientY: number) => Coordinate | null): void {
    const signal = this.listeners.signal;

    container.addEventListener('touchstart', (event) => this.handleTouchStart(event, getCoordinate), { passive: false, signal });
    container.addEventListener('touchend', () => this.cancelLongPress(), { passive: false, signal });
    container.addEventListener('touchmove', (event) => this.handleTouchMove(event), { passive: false, signal });
  }

  private attachDismissListeners(): void {
    this.openMenuListeners?.abort();
    this.openMenuListeners = new AbortController();
    const signal = this.openMenuListeners.signal;

    const dismissIfOutside = (event: Event) => {
      if (this.contextMenu && !this.contextMenu.contains(event.target as Node)) {
        this.hideContextMenu();
      }
    };

    activeDocument.addEventListener('mousedown', dismissIfOutside, { capture: true, signal });
    activeDocument.addEventListener('touchstart', dismissIfOutside, { capture: true, signal });
    activeDocument.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.hideContextMenu();
    }, { signal });
  }

  private getDefaultMenuItems(coordinate: Coordinate, { placeNoteHost, reverseGeocodeHost, sourcePath }: MapContextMenuOptions): ContextMenuItem[] {
    const items: ContextMenuItem[] = [
      ...(reverseGeocodeHost ? [{
        text: 'Search for place here',
        icon: '🔍',
        onClick: (coord: Coordinate) => reverseGeocodeHost(coord, sourcePath),
      }] : []),
      ...(placeNoteHost ? [{
        text: 'Create note at location',
        icon: '📝',
        onClick: (coord: Coordinate) => {
          void placeNoteHost.createNote({ kind: 'location', coordinate: coord, sourcePath });
        }
      }] : []),
      {
        text: `📋 ${formatDisplayCoordinate(coordinate)}`,
        icon: '',
        onClick: async (coord) => {
          const text = formatDisplayCoordinate(coord);

          await copyToClipboard(text, 'Coordinates copied to clipboard');
        }
      }
    ];

    return items;
  }

  private positionMenu(x: number, y: number): void {
    if (!this.contextMenu) return;

    const menu = this.contextMenu;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = activeWindow.innerWidth;
    const viewportHeight = activeWindow.innerHeight;

    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 10;
    }

    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 10;
    }

    menu.setCssProps({
      left: `${Math.max(10, x)}px`,
      top: `${Math.max(10, y)}px`
    });
  }

  private hideContextMenu(): void {
    this.openMenuListeners?.abort();
    this.openMenuListeners = null;

    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
  }

  private handleTouchStart(event: TouchEvent, getCoordinate: (clientX: number, clientY: number) => Coordinate | null): void {
    if (event.touches.length !== 1) {
      this.cancelLongPress();

      return;
    }

    const touch = event.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;

    this.touchStartPosition = { x: startX, y: startY };

    this.longPressTimer = window.setTimeout(() => {
      this.cancelLongPress();
      const coordinate = getCoordinate(startX, startY);

      if (!coordinate) return;
      const syntheticEvent = { clientX: startX, clientY: startY, preventDefault: () => {}, stopPropagation: () => {} } as MouseEvent;

      this.open(coordinate, startX, startY, syntheticEvent);
    }, 500);
  }

  private handleTouchMove(event: TouchEvent): void {
    if (!this.touchStartPosition || !this.longPressTimer) {
      return;
    }

    const touch = event.touches[0];

    if (touch) {
      const deltaX = Math.abs(touch.clientX - this.touchStartPosition.x);
      const deltaY = Math.abs(touch.clientY - this.touchStartPosition.y);

      if (deltaX > 10 || deltaY > 10) {
        this.cancelLongPress();
      }
    }
  }

  private cancelLongPress(): void {
    if (this.longPressTimer) {
      window.clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    this.touchStartPosition = null;
  }

  cleanup(): void {
    this.hideContextMenu();
    this.cancelLongPress();
    this.listeners.abort();
  }
}
