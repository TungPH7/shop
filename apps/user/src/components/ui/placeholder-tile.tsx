// The placeholder image of a product: the initial of its name on a group colour (design.md, Design System, "Ô giữ
// chỗ"). The rule is the same as in admin (plan of SHOP-7, Architecture Decisions 15), so a product looks the same in
// both apps. Styles: `.tile` in src/styles/components.css; docs/design-system/user.md.

export const PLACEHOLDER_GROUPS = ['blue', 'coral', 'green', 'orange', 'teal', 'ink'] as const;

export type PlaceholderGroup = (typeof PLACEHOLDER_GROUPS)[number];

/** Card 4:3 (S4.6), detail 1:1 (S5), row 40×40. */
export type PlaceholderVariant = 'card' | 'detail' | 'row';

/**
 * The group colour of a product. The last 8 hex digits of a UUIDv7 are random, so the colours spread evenly, and the
 * colour stays when the name or the slug changes. An id that does not end in hex gets the first group.
 */
export function placeholderGroup(id: string): PlaceholderGroup {
  const value = Number.parseInt(id.slice(-8), 16);
  return PLACEHOLDER_GROUPS[value % PLACEHOLDER_GROUPS.length] ?? PLACEHOLDER_GROUPS[0];
}

/**
 * The first character of the name without white space, in upper case by the Vietnamese rules. The name is put in NFC
 * first, so a letter typed as a base and combining marks stays one letter with its marks.
 */
export function placeholderInitial(name: string): string {
  const [first = ''] = name.replace(/\s+/gu, '').normalize('NFC');
  return first.toLocaleUpperCase('vi');
}

export function PlaceholderTile({
  id,
  name,
  variant = 'card',
}: {
  id: string;
  name: string;
  variant?: PlaceholderVariant;
}) {
  const group = placeholderGroup(id);
  return (
    <span
      className={`tile tile--${variant} tile--${group}`}
      data-group={group}
      data-variant={variant}
      aria-hidden="true"
    >
      <span className="tile__initial">{placeholderInitial(name)}</span>
    </span>
  );
}
