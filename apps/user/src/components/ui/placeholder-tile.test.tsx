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
