import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AboutRoute } from '@/app/routes/about/about-route';

describe('AboutRoute', () => {
  it('owns the single h1 of the page, since the app name in the shell is a link', () => {
    render(<AboutRoute />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'About' })).toBeInTheDocument();
  });
});
