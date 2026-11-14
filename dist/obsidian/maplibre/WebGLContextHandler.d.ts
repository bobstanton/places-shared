export declare function showWebGLContextLostMessage(container: HTMLElement, onRetry?: () => void): void;
export interface WebGLContextLostMap {
    on(type: 'webglcontextlost' | 'webglcontextrestored', handler: () => void): void;
}
export interface WebGLContextLossOptions {
    onPermanentLoss?: () => void;
    onRetry?: () => void;
}
export interface WebGLContextLossHandle {
    dispose(): void;
}
export declare function handleWebGLContextLost(map: WebGLContextLostMap, container: HTMLElement, options?: WebGLContextLossOptions): WebGLContextLossHandle;
