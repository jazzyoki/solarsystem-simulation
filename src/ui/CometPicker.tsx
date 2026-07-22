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

export function CometPicker({ comets, selected, onSelect, onJumpToPerihelion }: CometPickerProps) {
  return (
    <div className="comet-picker">
      <ul className="comet-list">
        {comets.map((comet) => (
          <li key={comet.name}>
            <button
              type="button"
              className={comet.name === selected ? 'active' : ''}
              aria-pressed={comet.name === selected}
              onClick={() => onSelect(comet.name === selected ? null : comet.name)}
            >
              {comet.name} ({comet.designation}){comet.note === 'historical' ? ' — historical' : ''}
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <button type="button" className="perihelion-button" onClick={onJumpToPerihelion}>
          Jump to perihelion
        </button>
      )}
    </div>
  );
}
