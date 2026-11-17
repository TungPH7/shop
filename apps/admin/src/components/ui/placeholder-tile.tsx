// Placeholder tile of a product (Design System, "Ô giữ chỗ"): a gradient in one of six
// group colours, with the first letter of the name. Products have no images in SHOP-7.
// The algorithm is plan.md, Architecture Decisions 15, and `user` uses the same one, so
// a product has the same colour in both apps:
// - group: GROUPS[parseInt(id.slice(-8), 16) % 6]. The last 8 hex digits of a UUIDv7
//   are random, and the id never changes, so renaming a product keeps its colour;
// - letter: the first character of the name without leading whitespace, upper-cased
//   with the Vietnamese rules. A character is a grapheme, so a decomposed "ả" keeps
//   its tone mark.
// Decorative: the product name is always shown next to the tile.

const GROUPS = ['blue', 'coral', 'green', 'orange', 'teal', 'ink'] as const;

type PlaceholderGroup = (typeof GROUPS)[number];

interface PlaceholderTileProps {
  /** The product id, a UUIDv7. */
  id: string;
  /** The current product name. */
  name: string;
}

const graphemes = new Intl.Segmenter('vi', { granularity: 'grapheme' });

function groupOf(id: string): PlaceholderGroup {
  // An id that is not hex gives NaN, and GROUPS[NaN] falls back to the first group.
  return GROUPS[Number.parseInt(id.slice(-8), 16) % GROUPS.length] ?? GROUPS[0];
}

function initialOf(name: string): string {
  const first = graphemes.segment(name.trimStart())[Symbol.iterator]().next();
  return first.done === true ? '' : first.value.segment.toLocaleUpperCase('vi');
}

export function PlaceholderTile({ id, name }: PlaceholderTileProps) {
  return (
    <span className="tile" data-group={groupOf(id)} aria-hidden="true">
      {initialOf(name)}
    </span>
  );
}
