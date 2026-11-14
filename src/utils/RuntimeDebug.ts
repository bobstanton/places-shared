import { logger } from "./index";

export interface RuntimeDebugCompatibility {
  globalFlag?: string;
  storageKey?: string;
}

type RuntimeDebugGlobal = Window & {
  __placesDebugFeatures?: Set<string> | Record<string, boolean>;
  [key: string]: unknown;
};

export function isRuntimeDebugEnabled(channel: string, compatibility: RuntimeDebugCompatibility = {}): boolean {
  const globalState = window as unknown as RuntimeDebugGlobal;
  const configured = globalState.__placesDebugFeatures;

  if (configured instanceof Set && configured.has(channel)) return true;
  if (configured && !(configured instanceof Set) && configured[channel] === true) return true;
  if (compatibility.globalFlag && globalState[compatibility.globalFlag] === true) return true;

  try {
    return window.localStorage?.getItem(`places.debug.${channel}`) === "1"
      || (!!compatibility.storageKey && window.localStorage?.getItem(compatibility.storageKey) === "1");
  } catch {
    return false;
  }
}

export function logRuntimeDebug(channel: string, stage: string, payload?: Record<string, unknown>, options: RuntimeDebugCompatibility & { scope?: string } = {}): void {
  if (!isRuntimeDebugEnabled(channel, options)) return;
  const scopedLogger = logger.scope(options.scope ?? channel);

  if (payload) {
    scopedLogger.debug(`[${channel}] ${stage}`, payload);
  } else {
    scopedLogger.debug(`[${channel}] ${stage}`);
  }
}
