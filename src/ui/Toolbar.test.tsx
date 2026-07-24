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
    expect(select.querySelectorAll('option')).toHaveLength(3);
    fireEvent.change(select, { target: { value: 'schematic' } });
    expect(props.onSelectMode).toHaveBeenCalledWith('schematic');
  });

  it('shows the time-scale label for the current multiplier', () => {
    renderToolbar({ multiplier: 10 });
    expect(screen.getByText('1s = 10 days')).toBeTruthy();
  });

  it('shows Resume while paused and toggles on click', () => {
    const props = renderToolbar({ paused: true });
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(props.onTogglePause).toHaveBeenCalledTimes(1);
  });

  it('renders the Comets toggle and reflects its state', () => {
    renderToolbar({ cometsEnabled: true });
    expect(screen.getByRole('button', { name: 'Comets' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onToggleComets when the Comets button is clicked', () => {
    const props = renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Comets' }));
    expect(props.onToggleComets).toHaveBeenCalled();
  });
});
