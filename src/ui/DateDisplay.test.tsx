import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateDisplay } from './DateDisplay';

function openEditor() {
  fireEvent.click(screen.getByRole('button', { name: /simulation date/i }));
  return document.querySelector('input[type="date"]') as HTMLInputElement;
}

describe('DateDisplay', () => {
  it('renders the date on a button', () => {
    render(<DateDisplay date="2026-07-21" onSelectDate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /simulation date/i }).textContent).toBe('2026-07-21');
  });

  it('reveals a date input seeded with the current date when clicked', () => {
    render(<DateDisplay date="2026-07-21" onSelectDate={vi.fn()} />);
    const input = openEditor();
    expect(input).toBeTruthy();
    expect(input.value).toBe('2026-07-21');
  });

  it('calls onSelectDate with the picked value and returns to the button', () => {
    const onSelectDate = vi.fn();
    render(<DateDisplay date="2026-07-21" onSelectDate={onSelectDate} />);
    const input = openEditor();
    fireEvent.change(input, { target: { value: '2027-03-15' } });
    expect(onSelectDate).toHaveBeenCalledWith('2027-03-15');
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(screen.getByRole('button', { name: /simulation date/i })).toBeTruthy();
  });

  it('ignores an empty value', () => {
    const onSelectDate = vi.fn();
    render(<DateDisplay date="2026-07-21" onSelectDate={onSelectDate} />);
    const input = openEditor();
    fireEvent.change(input, { target: { value: '' } });
    expect(onSelectDate).not.toHaveBeenCalled();
  });

  it('reverts on Escape without selecting', () => {
    const onSelectDate = vi.fn();
    render(<DateDisplay date="2026-07-21" onSelectDate={onSelectDate} />);
    const input = openEditor();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onSelectDate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /simulation date/i })).toBeTruthy();
  });

  it('reverts on blur without selecting', () => {
    const onSelectDate = vi.fn();
    render(<DateDisplay date="2026-07-21" onSelectDate={onSelectDate} />);
    const input = openEditor();
    fireEvent.blur(input);
    expect(onSelectDate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /simulation date/i })).toBeTruthy();
  });
});
