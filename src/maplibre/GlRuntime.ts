import type * as maplibregl from "maplibre-gl";

export interface MapGlRuntime {
  Map: typeof maplibregl.Map;
  Marker: typeof maplibregl.Marker;
  Popup: typeof maplibregl.Popup;
  LngLatBounds: typeof maplibregl.LngLatBounds;
  addProtocol?: typeof maplibregl.addProtocol;
  getVersion?: () => string;
}

let runtime: MapGlRuntime | undefined;

export function setGlRuntime(gl: MapGlRuntime): void {
  runtime = gl;
}

export function getGl(): MapGlRuntime {
  if (!runtime) {
    throw new Error("No map engine registered. A provider must call setGlRuntime() in its constructor before rendering a map.");
  }

  return runtime;
}

interface WorkerUrlConfigurable {
  setWorkerUrl(url: string): void;
}

let maplibreWorkerInstalled = false;

export function installMaplibreWorker(gl: WorkerUrlConfigurable, workerCode: string): void {
  if (maplibreWorkerInstalled) return;
  maplibreWorkerInstalled = true;
  const blob = new Blob([workerCode], { type: "text/javascript" });

  gl.setWorkerUrl(URL.createObjectURL(blob));
}
