export interface FloatingRefreshButtonOptions {
    buttonContainer: HTMLElement;
    ariaLabel: string;
    className?: string;
    onRefresh: () => Promise<unknown>;
    onError?: (error: unknown) => void;
    progressHost?: HTMLElement;
}
export declare function createFloatingRefreshButton(options: FloatingRefreshButtonOptions): HTMLElement;
