import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Toolbar, type ToolbarProps } from './Toolbar';

function renderToolbar(overrides: Partial<ToolbarProps> = {}) {
  const props: ToolbarProps = {
    multiplier: 1,
    paused: false,
    mode: 'schematic',
    onSelectSpeed: vi.fn(),
    onTogglePause: vi.fn(),
    onSelectMode: vi.fn(),
    cometsEnabled: false,
    onToggleComets: vi.fn(),
    ...overrides,
  };
  render(<Toolbar {...props} />);
  return props;
}

describe('Toolbar', () => {
  it('renders all five speed buttons and pause', () => {
    renderToolbar();
    for (const label of ['0.5x', '1x', '10x', '100x', '1000x', 'Pause']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it('marks the active speed', () => {
    renderToolbar({ multiplier: 10 });
    expect(screen.getByRole('button', { name: '10x' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '1x' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onSelectSpeed when a speed button is clicked', () => {
    const props = renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: '0.5x' }));
    expect(props.onSelectSpeed).toHaveBeenCalledWith(0.5);
    fireEvent.click(screen.getByRole('button', { name: '10x' }));
    expect(props.onSelectSpeed).toHaveBeenCalledWith(10);
  });

  it('shows Resume while paused and toggles on click', () => {
    const props = renderToolbar({ paused: true });
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(props.onTogglePause).toHaveBeenCalledTimes(1);
  });

  it('renders the Schematic and To Scale buttons', () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: 'Schematic' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'To Scale' })).toBeTruthy();
  });

  it('marks the active mode', () => {
    renderToolbar({ mode: 'toScale' });
    expect(screen.getByRole('button', { name: 'To Scale' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Schematic' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onSelectMode when a mode button is clicked', () => {
    const props = renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'To Scale' }));
    expect(props.onSelectMode).toHaveBeenCalledWith('toScale');
    fireEvent.click(screen.getByRole('button', { name: 'Schematic' }));
    expect(props.onSelectMode).toHaveBeenCalledWith('schematic');
  });

  it('renders the Comets toggle and reflects its state', () => {
    renderToolbar({ cometsEnabled: true });
    const btn = screen.getByRole('button', { name: 'Comets' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onToggleComets when the Comets button is clicked', () => {
    const props = renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Comets' }));
    expect(props.onToggleComets).toHaveBeenCalled();
  });

  it('renders a speed dropdown reflecting the multiplier and fires onSelectSpeed on change', () => {
    const props = renderToolbar({ multiplier: 100 });
    const select = screen.getByRole('combobox', { name: 'Speed' }) as HTMLSelectElement;
    expect(select.value).toBe('100');
    expect(select.querySelectorAll('option')).toHaveLength(5);
    fireEvent.change(select, { target: { value: '0.5' } });
    expect(props.onSelectSpeed).toHaveBeenCalledWith(0.5);
  });

  it('renders a mode dropdown reflecting the mode and fires onSelectMode on change', () => {
    const props = renderToolbar({ mode: 'toScale' });
    const select = screen.getByRole('combobox', { name: 'Scale mode' }) as HTMLSelectElement;
    expect(select.value).toBe('toScale');
    expect(select.querySelectorAll('option')).toHaveLength(2);
    fireEvent.change(select, { target: { value: 'schematic' } });
    expect(props.onSelectMode).toHaveBeenCalledWith('schematic');
  });
});
