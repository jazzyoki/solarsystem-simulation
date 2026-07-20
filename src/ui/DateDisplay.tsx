interface DateDisplayProps {
  date: string;
}

export function DateDisplay({ date }: DateDisplayProps) {
  return <div className="date-display">{date}</div>;
}
