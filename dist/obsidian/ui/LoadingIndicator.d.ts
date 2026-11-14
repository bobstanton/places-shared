export interface LoadingIndicatorOptions {
    className?: string;
}
export declare function createLoadingIndicator(container: HTMLElement, initialText?: string, options?: LoadingIndicatorOptions): {
    setText: (text: string) => void;
    remove: () => void;
};
