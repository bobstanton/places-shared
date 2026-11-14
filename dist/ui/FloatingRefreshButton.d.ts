export interface FloatingRefreshButtonOptions {
    buttonContainer: HTMLElement;
    ariaLabel: string;
    className?: string;
    onRefresh: () => Promise<unknown>;
    onError?: (error: unknown) => void;
    progressHost?: HTMLElement;
    registerActions?: (container: HTMLElement) => void;
}
export declare function createFloatingRefreshButton(options: FloatingRefreshButtonOptions): HTMLElement;
