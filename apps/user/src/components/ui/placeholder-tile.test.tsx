import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { PlaceholderTile, placeholderGroup, placeholderInitial } from './placeholder-tile';

// The rule is the same in admin and user (plan of SHOP-7, Architecture Decisions 15): the group colour comes from the
// last 8 hex digits of the UUIDv7 id, the random part, and the letter from the current name.
const idEndingWith = (last8: string) => `0192f1c4-7a3b-7c2d-8e9f-0123${last8}`;

describe('placeholderGroup', () => {
  test('picks GROUPS[last 8 hex digits % 6], in the order blue, coral, green, orange, teal, ink', () => {
    expect(placeholderGroup(idEndingWith('00000000'))).toBe('blue');
    expect(placeholderGroup(idEndingWith('00000001'))).toBe('coral');
    expect(placeholderGroup(idEndingWith('00000002'))).toBe('green');
    expect(placeholderGroup(idEndingWith('00000003'))).toBe('orange');
    expect(placeholderGroup(idEndingWith('00000004'))).toBe('teal');
    expect(placeholderGroup(idEndingWith('00000005'))).toBe('ink');
  });

  test('wraps around after six groups', () => {
    expect(placeholderGroup(idEndingWith('00000006'))).toBe('blue');
    expect(placeholderGroup(idEndingWith('0000000b'))).toBe('ink');
  });

  test('reads the largest 8-digit value without overflow: 0xffffffff % 6 is 3, orange', () => {
    expect(placeholderGroup(idEndingWith('ffffffff'))).toBe('orange');
  });

  test('reads upper-case hex like lower-case', () => {
    expect(placeholderGroup(idEndingWith('0000000B'))).toBe(
      placeholderGroup(idEndingWith('0000000b')),
    );
  });

  // Real UUIDv7 ids, one per group. The ids above share the fixed prefix 0123 and give the same group for any length
  // of the slice (16^k ≡ 4 mod 6), so only these pin the 8 digits: each one gets another group from slice(-1) to
  // slice(-12) except slice(-8). docs/design-system/user.md lists them as the shared samples for admin (SHOP-9).
  test.each([
    ['0192f1c4-7a3b-7c2d-8e9f-a1b2c3d4e5f6', 'blue'],
    ['0193a2b5-29ba-7b09-a5ad-06c7400a60ee', 'blue'],
    ['0193a2b5-fce1-786a-b348-e4314aad4353', 'coral'],
    ['0193a2b5-c906-7d72-8299-4a1d1f241b6a', 'green'],
    ['0193a2b5-0091-770e-851f-c07d23ef7c9d', 'orange'],
    ['0193a2b5-0da4-72b1-bdb4-0727dd873f80', 'teal'],
    ['0193a2b5-02b2-7292-afeb-59babb00064f', 'ink'],
  ])('reads exactly the last 8 hex digits of the UUIDv7 %s: %s', (id, group) => {
    expect(placeholderGroup(id)).toBe(group);
  });

  test('falls back to the first group when the end of the id is not hex', () => {
    expect(placeholderGroup('not-a-uuid-zzzzzzzz')).toBe('blue');
  });
});

describe('placeholderInitial', () => {
  test('takes the first letter of the name in upper case, with its Vietnamese marks', () => {
    expect(placeholderInitial('áo thun cổ tròn')).toBe('Á');
    expect(placeholderInitial('ứng dụng')).toBe('Ứ');
    expect(placeholderInitial('đèn bàn')).toBe('Đ');
  });

  test('skips leading white space', () => {
    expect(placeholderInitial('   \t\n  bình gốm')).toBe('B');
  });

  test('keeps a letter made of a base and combining marks (NFD) as one letter', () => {
    expect(placeholderInitial('áo len')).toBe('Á');
  });

  test('keeps a character outside the BMP whole', () => {
    expect(placeholderInitial('🍎 táo')).toBe('🍎');
  });

  test('gives an empty string for a blank name', () => {
    expect(placeholderInitial('   ')).toBe('');
  });
});

describe('PlaceholderTile', () => {
  test('shows the initial of the name, hidden from assistive technology', () => {
    render(<PlaceholderTile id={idEndingWith('00000002')} name="ấm trà" />);

    const tile = screen.getByText('Ấ').closest('[data-group]');
    expect(tile).toHaveAttribute('aria-hidden', 'true');
    expect(tile).toHaveAttribute('data-group', 'green');
  });

  test('keeps its colour when the product is renamed, and changes its letter', () => {
    const id = idEndingWith('00000004');
    const { rerender } = render(<PlaceholderTile id={id} name="Bình gốm" />);
    rerender(<PlaceholderTile id={id} name="Chén gốm" />);

    expect(screen.getByText('C').closest('[data-group]')).toHaveAttribute('data-group', 'teal');
    expect(screen.queryByText('B')).not.toBeInTheDocument();
  });

  test('is the 4:3 card tile by default, and takes the detail and row shapes', () => {
    const id = idEndingWith('00000000');
    const { rerender } = render(<PlaceholderTile id={id} name="Ly" />);
    expect(screen.getByText('L').closest('[data-group]')).toHaveAttribute('data-variant', 'card');

    rerender(<PlaceholderTile id={id} name="Ly" variant="detail" />);
    expect(screen.getByText('L').closest('[data-group]')).toHaveAttribute('data-variant', 'detail');

    rerender(<PlaceholderTile id={id} name="Ly" variant="row" />);
    expect(screen.getByText('L').closest('[data-group]')).toHaveAttribute('data-variant', 'row');
  });
});
