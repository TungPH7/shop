import { describe, expect, it } from 'vitest';

import { PlaceholderTile } from '@/components/ui/placeholder-tile';
import { renderWithProviders } from '@/testing/render';

// The tile is decorative (aria-hidden), so these tests read it through its test id.
function renderTile(id: string, name: string) {
  renderWithProviders(
    <div data-testid="host">
      <PlaceholderTile id={id} name={name} />
    </div>,
  );
  const tile = document.querySelector('[data-testid="host"] > *');
  if (!(tile instanceof HTMLElement)) throw new Error('no tile rendered');
  return tile;
}

describe('PlaceholderTile', () => {
  it('picks the group from the last 8 hex digits of the id: 0x3c4d5e6f % 6 = 3, orange', () => {
    const tile = renderTile('019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f', 'Áo thun cổ tròn');

    expect(tile).toHaveAttribute('data-group', 'orange');
  });

  it.each([
    ['00000000', 'blue'],
    ['00000001', 'coral'],
    ['00000002', 'green'],
    ['00000003', 'orange'],
    ['00000004', 'teal'],
    ['00000005', 'ink'],
    ['ffffffff', 'orange'], // 4294967295 = 6 × 715827882 + 3
  ])('maps the id tail %s to the %s group', (tail, group) => {
    const tile = renderTile(`019a8f2e-5b7c-7d10-9e3f-1a2b${tail}`, 'X');

    expect(tile).toHaveAttribute('data-group', group);
  });

  it('keeps the colour when the name changes, since the group comes from the id only', () => {
    const id = '019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e60';
    const first = renderTile(id, 'Quần jean nam').getAttribute('data-group');
    const second = renderTile(id, 'Bao tay len').getAttribute('data-group');

    expect(second).toBe(first);
  });

  it('shows the first letter of the name, upper-cased the Vietnamese way', () => {
    const tile = renderTile('019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f', 'đầm maxi đỏ 2026');

    expect(tile).toHaveTextContent(/^Đ$/);
  });

  it('skips leading whitespace before taking the first letter', () => {
    const tile = renderTile('019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f', '   \táo thun');

    expect(tile).toHaveTextContent(/^Á$/);
  });

  it('keeps a decomposed letter with its tone marks (NFD “ả” stays “Ả”)', () => {
    const tile = renderTile('019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f', 'ảo len');

    expect(tile.textContent.normalize('NFC')).toBe('Ả');
  });

  it('is hidden from assistive technology, since the name is shown next to it', () => {
    const tile = renderTile('019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f', 'Áo');

    expect(tile).toHaveAttribute('aria-hidden', 'true');
  });

  it('falls back to the first group and no letter for an id that is not hex and a blank name', () => {
    const tile = renderTile('not-a-uuid', '   ');

    expect(tile).toHaveAttribute('data-group', 'blue');
    expect(tile).toBeEmptyDOMElement();
  });
});
