export interface FloatingCopyButtonOptions {
    buttonContainer: HTMLElement;
    onCopy: () => Promise<unknown>;
    ariaLabel?: string;
    successLabel?: string;
    errorLabel?: string;
    resetDelayMs?: number;
}
export declare function createFloatingCopyButton(options: FloatingCopyButtonOptions): HTMLElement;
