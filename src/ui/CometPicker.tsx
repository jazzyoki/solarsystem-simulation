interface CometOption {
  name: string;
  designation: string;
  note?: string;
}

interface CometPickerProps {
  comets: CometOption[];
  selected: string | null;
  onSelect: (name: string | null) => void;
  onJumpToPerihelion: () => void;
}

function optionLabel(comet: CometOption): string {
  const base = `${comet.name} (${comet.designation})`;
  return comet.note === 'historical' ? `${base} — historical` : base;
}

export function CometPicker({ comets, selected, onSelect, onJumpToPerihelion }: CometPickerProps) {
  return (
    <div className="comet-picker">
      <select
        className="comet-select"
        aria-label="Comet"
        value={selected ?? ''}
        onChange={(e) => onSelect(e.target.value || null)}
      >
        <option value="">Select a comet…</option>
        {comets.map((comet) => (
          <option key={comet.name} value={comet.name}>
            {optionLabel(comet)}
          </option>
        ))}
      </select>
      {selected && (
        <button type="button" className="perihelion-button" onClick={onJumpToPerihelion}>
          Jump to perihelion
        </button>
      )}
    </div>
  );
}
