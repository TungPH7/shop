import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, type ReactNode } from 'react';

interface VirtualListProps<T> {
  /** Full dataset — only the on-screen window is mounted to the DOM. */
  items: readonly T[];
  /** Height of the scroll viewport in px (bounds the rendered window). */
  height: number;
  /** Estimated row height in px, used before a row is measured. */
  estimateSize?: number;
  /** Rows rendered just outside the viewport to smooth fast scrolling. */
  overscan?: number;
  /** Render one row; `index` is its position in `items`. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Stable React key for a row (defaults to its index). */
  getItemKey?: (item: T, index: number) => string | number;
  className?: string;
}

/**
 * Headless, UI-agnostic windowing primitive (folder 17). Renders only the rows
 * visible in the viewport (+overscan) regardless of dataset size, so a list of
 * 10k+ rows stays at a roughly constant DOM cost. Wraps @tanstack/react-virtual.
 *
 * The inline styles here are FUNCTIONAL — the scroll container and absolute
 * positioning the technique requires — not cosmetic. Phase 1.2 themes the look
 * (via `className`), not this layout. Consumers add semantics/labels around
 * `renderItem`; keyboard-scroll a11y for the viewport is a Phase 1.2 concern.
 */
export function VirtualList<T>({
  items,
  height,
  estimateSize = 40,
  overscan = 8,
  renderItem,
  getItemKey,
  className,
}: VirtualListProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // React Compiler skips memoizing this component because @tanstack/react-virtual
  // returns non-memoizable functions — expected and safe: the virtualizer manages
  // its own updates. Silence the informational compiler warning.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
    // index is always within [0, count) → the assertion is safe under
    // noUncheckedIndexedAccess. Falls back to the index when no key fn is given.
    getItemKey: (index) => getItemKey?.(items[index]!, index) ?? index,
  });

  return (
    <div ref={scrollRef} className={className} style={{ height, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {/* index is always within [0, items.length) → assertion is safe */}
            {renderItem(items[virtualRow.index]!, virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
