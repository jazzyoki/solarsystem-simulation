import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Toolbar, type ToolbarProps } from './Toolbar';

function renderToolbar(overrides: Partial<ToolbarProps> = {}) {
  const props: ToolbarProps = {
    multiplier: 86_400,
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
    const props = renderToolbar({ multiplier: 2_592_000 });
    const select = screen.getByRole('combobox', { name: 'Speed' }) as HTMLSelectElement;
    expect(select.value).toBe('2592000');
    expect(select.querySelectorAll('option')).toHaveLength(9);
    fireEvent.change(select, { target: { value: '1200' } });
    expect(props.onSelectSpeed).toHaveBeenCalledWith(1_200);
  });

  it('renders a mode dropdown reflecting the mode and fires onSelectMode on change', () => {
    const props = renderToolbar({ mode: 'toScale' });
    const select = screen.getByRole('combobox', { name: 'Scale mode' }) as HTMLSelectElement;
    expect(select.value).toBe('toScale');
    expect(select.querySelectorAll('option')).toHaveLength(3);
    fireEvent.change(select, { target: { value: 'schematic' } });
    expect(props.onSelectMode).toHaveBeenCalledWith('schematic');
  });

  it('shows the human-readable scale in the dropdown and the factor beside it', () => {
    renderToolbar({ multiplier: 31_536_000 });
    const select = screen.getByRole('combobox', { name: 'Speed' }) as HTMLSelectElement;
    expect(select.selectedOptions[0].textContent).toBe('1s = 1 year');
    expect(screen.getByText('31,536,000×')).toBeTruthy();
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
