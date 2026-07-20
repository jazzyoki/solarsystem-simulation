import type { SpeedMultiplier } from '../sim/clock';

export interface ToolbarProps {
  multiplier: SpeedMultiplier;
  paused: boolean;
  onSelectSpeed: (m: SpeedMultiplier) => void;
  onTogglePause: () => void;
}

const SPEEDS: SpeedMultiplier[] = [1, 100, 1000];

export function Toolbar({ multiplier, paused, onSelectSpeed, onTogglePause }: ToolbarProps) {
  return (
    <div className="toolbar">
      {SPEEDS.map((speed) => (
        <button
          key={speed}
          type="button"
          className={speed === multiplier ? 'active' : ''}
          aria-pressed={speed === multiplier}
          onClick={() => onSelectSpeed(speed)}
        >
          {speed}x
        </button>
      ))}
      <button type="button" aria-pressed={paused} onClick={onTogglePause}>
        {paused ? 'Resume' : 'Pause'}
      </button>
    </div>
  );
}
