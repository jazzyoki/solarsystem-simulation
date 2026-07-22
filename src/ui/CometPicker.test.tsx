import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CometPicker } from './CometPicker';

const comets = [
  { name: 'Halley', designation: '1P' },
  { name: 'Encke', designation: '2P' },
];

describe('CometPicker', () => {
  it('lists every comet', () => {
    render(<CometPicker comets={comets} selected={null} onSelect={vi.fn()} onJumpToPerihelion={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Halley/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Encke/ })).toBeTruthy();
  });

  it('calls onSelect with the comet name', () => {
    const onSelect = vi.fn();
    render(<CometPicker comets={comets} selected={null} onSelect={onSelect} onJumpToPerihelion={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Halley/ }));
    expect(onSelect).toHaveBeenCalledWith('Halley');
  });

  it('toggles selection off when re-clicking the selected comet', () => {
    const onSelect = vi.fn();
    render(<CometPicker comets={comets} selected={'Halley'} onSelect={onSelect} onJumpToPerihelion={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Halley/ }));
    expect(onSelect).toHaveBeenCalledWith(null);
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
