import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { act, screen } from '@/testing/render';

// main.tsx is the entry: importing it boots the app. Each test imports a fresh copy
// (resetModules), so the store singleton reads the localStorage the test sets.
async function bootApp(): Promise<void> {
  await act(async () => {
    await import('@/main');
  });
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  document.getElementById('root')?.remove();
  document.documentElement.removeAttribute('data-theme');
});

function addRootElement(): void {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);
}

describe('main.tsx', () => {
  it('applies the stored theme to <html> as data-theme when it boots', async () => {
    localStorage.setItem('tungph7.theme', JSON.stringify({ v: 1, theme: 'dark' }));
    addRootElement();

    await bootApp();

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('leaves data-theme off <html> when no theme is stored, so the CSS follows the system', async () => {
    addRootElement();

    await bootApp();

    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('renders the app shell into #root', async () => {
    addRootElement();

    await bootApp();

    expect(await screen.findByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('fails loudly when index.html has no #root', async () => {
    await expect(import('@/main')).rejects.toThrow('Root element #root not found in index.html');
  });
});
