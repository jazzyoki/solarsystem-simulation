import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DateDisplay } from './DateDisplay';

describe('DateDisplay', () => {
  it('renders the date string', () => {
    render(<DateDisplay date="2000-01-01" />);
    expect(screen.getByText('2000-01-01')).toBeTruthy();
  });
});
