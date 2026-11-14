export const ELEVATION_NOISE_M = 1.0;

export class ElevationAccumulator {
  private gain = 0;
  private loss = 0;
  private reference: number | undefined;

  constructor(private readonly noiseFloorM: number = ELEVATION_NOISE_M) {}

  add(elevation: number | undefined): void {
    if (elevation === undefined || Number.isNaN(elevation)) return;

    if (this.reference === undefined) {
      this.reference = elevation;

      return;
    }

    const delta = elevation - this.reference;

    if (Math.abs(delta) < this.noiseFloorM) return;

    if (delta > 0) this.gain += delta;
    else this.loss -= delta;

    this.reference = elevation;
  }

  get gainM(): number {
    return this.gain;
  }

  get lossM(): number {
    return this.loss;
  }
}
