import { useEffect, useRef, useState } from 'react';

interface DateDisplayProps {
  date: string;
  onSelectDate: (value: string) => void;
  onToday: () => void;
}

export function DateDisplay({ date, onSelectDate, onToday }: DateDisplayProps) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch {
        // showPicker can throw without user activation; the input still works.
      }
    }
  }, [editing]);

  return (
    <div className="date-controls">
      {editing ? (
        <input
          ref={inputRef}
          type="date"
          className="date-input"
          defaultValue={date}
          aria-label="Simulation date"
          onChange={(e) => {
            const value = e.target.value;
            if (!value) return;
            onSelectDate(value);
            setEditing(false);
          }}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <button
          type="button"
          className="date-display"
          aria-label="Simulation date, click to change"
          onClick={() => setEditing(true)}
        >
          {date}
        </button>
      )}
      <button type="button" className="today-button" onClick={onToday}>
        Today
      </button>
    </div>
  );
}
