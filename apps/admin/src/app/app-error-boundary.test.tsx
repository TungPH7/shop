import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorBoundary } from '@/app/app-error-boundary';
import { renderWithProviders, screen } from '@/testing/render';

let shouldCrash = true;
function Bomb() {
  if (shouldCrash) {
    throw new Error('boom-in-render');
  }
  return <p>recovered content</p>;
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    shouldCrash = true;
    // Silence React's boundary log + the captureError report path for clean output.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('catches a render crash and shows the fallback (never a blank page)', () => {
    renderWithProviders(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('"Try again" resets the boundary and recovers', async () => {
    const { user } = renderWithProviders(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    shouldCrash = false; // the next render will not throw
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('recovered content')).toBeInTheDocument();
  });
});
