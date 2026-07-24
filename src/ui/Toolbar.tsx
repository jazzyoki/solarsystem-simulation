import type { SpeedMultiplier } from '../sim/clock';
import type { ViewMode } from '../sim/types';
import { timeScaleLabel } from './timeScale';

export interface ToolbarProps {
  multiplier: SpeedMultiplier;
  paused: boolean;
  mode: ViewMode;
  onSelectSpeed: (m: SpeedMultiplier) => void;
  onTogglePause: () => void;
  onSelectMode: (mode: ViewMode) => void;
  cometsEnabled: boolean;
  onToggleComets: () => void;
}

const SPEEDS: SpeedMultiplier[] = [0.5, 1, 10, 100, 1000];
const MODES: { value: ViewMode; label: string }[] = [
  { value: 'schematic', label: 'Schematic' },
  { value: 'toScale', label: 'To Scale' },
  { value: 'threeD', label: '3D' },
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
      <span className="time-scale">{timeScaleLabel(multiplier)}</span>
      <button type="button" aria-pressed={paused} onClick={onTogglePause}>
        {paused ? 'Resume' : 'Pause'}
      </button>
      <span className="toolbar-separator" aria-hidden="true" />
      <select
        className="mode-select"
        aria-label="Scale mode"
        value={mode}
        onChange={(e) => onSelectMode(e.target.value as ViewMode)}
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
