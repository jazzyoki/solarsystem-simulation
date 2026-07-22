import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CometPicker } from './CometPicker';

const comets = [
  { name: 'Halley', designation: '1P' },
  { name: 'Encke', designation: '2P' },
];

describe('CometPicker', () => {
  it('renders a dropdown with a placeholder plus every comet', () => {
    render(<CometPicker comets={comets} selected={null} onSelect={vi.fn()} onJumpToPerihelion={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: 'Comet' }) as HTMLSelectElement;
    expect(select.querySelectorAll('option')).toHaveLength(comets.length + 1);
    expect(screen.getByRole('option', { name: /Halley/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Encke/ })).toBeTruthy();
  });

  it('reflects the selected comet as the dropdown value', () => {
    render(<CometPicker comets={comets} selected={'Halley'} onSelect={vi.fn()} onJumpToPerihelion={vi.fn()} />);
    expect((screen.getByRole('combobox', { name: 'Comet' }) as HTMLSelectElement).value).toBe('Halley');
  });

  it('calls onSelect with the comet name when one is chosen', () => {
    const onSelect = vi.fn();
    render(<CometPicker comets={comets} selected={null} onSelect={onSelect} onJumpToPerihelion={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Comet' }), { target: { value: 'Halley' } });
    expect(onSelect).toHaveBeenCalledWith('Halley');
  });

  it('calls onSelect(null) when the placeholder is chosen', () => {
    const onSelect = vi.fn();
    render(<CometPicker comets={comets} selected={'Halley'} onSelect={onSelect} onJumpToPerihelion={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Comet' }), { target: { value: '' } });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('flags a comet with a historical note in its option label', () => {
    const flagged = [
      { name: 'ISON', designation: 'C/2012 S1', note: 'historical' },
      { name: 'Halley', designation: '1P' },
    ];
    render(<CometPicker comets={flagged} selected={null} onSelect={vi.fn()} onJumpToPerihelion={vi.fn()} />);
    expect(screen.getByRole('option', { name: /ISON/ }).textContent).toContain('historical');
    expect(screen.getByRole('option', { name: /Halley/ }).textContent).not.toContain('historical');
  });

  it('shows the jump-to-perihelion button only when a comet is selected', () => {
    const onJump = vi.fn();
    const { rerender } = render(
      <CometPicker comets={comets} selected={null} onSelect={vi.fn()} onJumpToPerihelion={onJump} />,
    );
    expect(screen.queryByRole('button', { name: /perihelion/i })).toBeNull();
    rerender(<CometPicker comets={comets} selected={'Halley'} onSelect={vi.fn()} onJumpToPerihelion={onJump} />);
    fireEvent.click(screen.getByRole('button', { name: /perihelion/i }));
    expect(onJump).toHaveBeenCalled();
  });
});
