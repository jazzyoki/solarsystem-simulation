interface PlanetPickerProps {
  planets: string[];
  selected: string | null;
  onSelect: (name: string | null) => void;
}

export function PlanetPicker({ planets, selected, onSelect }: PlanetPickerProps) {
  return (
    <div className="planet-picker">
      <select
        className="planet-select"
        aria-label="Planet"
        value={selected ?? ''}
        onChange={(e) => onSelect(e.target.value || null)}
      >
        <option value="">Jump to planet…</option>
        {planets.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
