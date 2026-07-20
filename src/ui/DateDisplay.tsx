interface DateDisplayProps {
  date: string;
}

export function DateDisplay({ date }: DateDisplayProps) {
  return (
    <div className="date-display" aria-live="polite" aria-atomic="true">
      {date}
    </div>
  );
}
