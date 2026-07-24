import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlanetPicker } from './PlanetPicker';

const planets = ['Sun', 'Mercury', 'Earth', 'Jupiter', 'Pluto'];

describe('PlanetPicker', () => {
  it('renders a dropdown with a placeholder plus every planet', () => {
    render(<PlanetPicker planets={planets} selected={null} onSelect={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: 'Planet' }) as HTMLSelectElement;
    expect(select.querySelectorAll('option')).toHaveLength(planets.length + 1);
    expect(screen.getByRole('option', { name: 'Sun' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Jupiter' })).toBeTruthy();
  });

  it('reflects the selected planet as the dropdown value', () => {
    render(<PlanetPicker planets={planets} selected={'Jupiter'} onSelect={vi.fn()} />);
    expect((screen.getByRole('combobox', { name: 'Planet' }) as HTMLSelectElement).value).toBe('Jupiter');
  });

  it('calls onSelect with the planet name when one is chosen', () => {
    const onSelect = vi.fn();
    render(<PlanetPicker planets={planets} selected={null} onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Planet' }), { target: { value: 'Jupiter' } });
    expect(onSelect).toHaveBeenCalledWith('Jupiter');
  });

  it('calls onSelect(null) when the placeholder is chosen', () => {
    const onSelect = vi.fn();
    render(<PlanetPicker planets={planets} selected={'Jupiter'} onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Planet' }), { target: { value: '' } });
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
