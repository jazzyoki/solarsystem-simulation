import type { SpeedMultiplier } from '../sim/clock';
import type { ScaleMode } from '../sim/types';

export interface ToolbarProps {
  multiplier: SpeedMultiplier;
  paused: boolean;
  mode: ScaleMode;
  onSelectSpeed: (m: SpeedMultiplier) => void;
  onTogglePause: () => void;
  onSelectMode: (mode: ScaleMode) => void;
  cometsEnabled: boolean;
  onToggleComets: () => void;
}

const SPEEDS: SpeedMultiplier[] = [0.5, 1, 10, 100, 1000];
const MODES: { value: ScaleMode; label: string }[] = [
  { value: 'schematic', label: 'Schematic' },
  { value: 'toScale', label: 'To Scale' },
];

export function Toolbar({
  multiplier,
  paused,
  mode,
  onSelectSpeed,
  onTogglePause,
  onSelectMode,
  cometsEnabled,
  onToggleComets,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="speed-buttons">
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
      </div>
      <select
        className="speed-select"
        aria-label="Speed"
        value={multiplier}
        onChange={(e) => onSelectSpeed(Number(e.target.value) as SpeedMultiplier)}
      >
        {SPEEDS.map((speed) => (
          <option key={speed} value={speed}>
            {speed}x
          </option>
        ))}
      </select>
      <button type="button" aria-pressed={paused} onClick={onTogglePause}>
        {paused ? 'Resume' : 'Pause'}
      </button>
      <span className="toolbar-separator" aria-hidden="true" />
      <div className="mode-buttons">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            className={m.value === mode ? 'active' : ''}
            aria-pressed={m.value === mode}
            onClick={() => onSelectMode(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <select
        className="mode-select"
        aria-label="Scale mode"
        value={mode}
        onChange={(e) => onSelectMode(e.target.value as ScaleMode)}
      >
        {MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <span className="toolbar-separator" aria-hidden="true" />
      <button
        type="button"
        className={cometsEnabled ? 'active' : ''}
        aria-pressed={cometsEnabled}
        onClick={onToggleComets}
      >
        Comets
      </button>
    </div>
  );
}
