export type SpeedMultiplier = 0.5 | 1 | 10 | 100 | 1000;

/** Max real seconds consumed per advance() call (tab-switch guard). */
export const MAX_FRAME_DT_SECONDS = 0.25;

export class SimClock {
  simDays = 0;
  paused = false;
  multiplier: SpeedMultiplier = 1;

  /** 1x = 1 simulated Earth day per real second. */
  advance(realDtSeconds: number): void {
    if (this.paused) return;
    const dt = Math.min(realDtSeconds, MAX_FRAME_DT_SECONDS);
    this.simDays += dt * this.multiplier;
  }

  setMultiplier(m: SpeedMultiplier): void {
    this.multiplier = m;
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }
}
