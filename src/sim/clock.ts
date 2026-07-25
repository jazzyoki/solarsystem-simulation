/**
 * Speed options, in dropdown order: simulated seconds per real second.
 * 1x would be real time; 86_400x advances one simulated day per real second.
 *
 * This array is the single source of truth for both the SpeedMultiplier union
 * and the toolbar dropdown contents — never duplicate the list elsewhere.
 */
export const SPEED_MULTIPLIERS = [
  1_200, // 1s = 20 min
  3_600, // 1s = 1 h
  21_600, // 1s = 6 h
  43_200, // 1s = 12 h
  86_400, // 1s = 24 h
  2_592_000, // 1s = 1 month (30 d)
  7_776_000, // 1s = 3 months (90 d)
  31_536_000, // 1s = 1 year (365 d)
  94_608_000, // 1s = 3 years (1095 d)
] as const;

export type SpeedMultiplier = (typeof SPEED_MULTIPLIERS)[number];

/** 1s = 24 h — one simulated day per real second. */
export const DEFAULT_SPEED_MULTIPLIER: SpeedMultiplier = 86_400;

const SECONDS_PER_DAY = 86_400;

/** Max real seconds consumed per advance() call (tab-switch guard). */
export const MAX_FRAME_DT_SECONDS = 0.25;

export class SimClock {
  simDays = 0;
  paused = false;
  multiplier: SpeedMultiplier = DEFAULT_SPEED_MULTIPLIER;

  /** The multiplier is simulated seconds per real second; 1x is real time. */
  advance(realDtSeconds: number): void {
    if (this.paused) return;
    const dt = Math.min(realDtSeconds, MAX_FRAME_DT_SECONDS);
    this.simDays += (dt * this.multiplier) / SECONDS_PER_DAY;
  }

  setMultiplier(m: SpeedMultiplier): void {
    this.multiplier = m;
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }

  setSimDays(days: number): void {
    this.simDays = days;
  }
}
