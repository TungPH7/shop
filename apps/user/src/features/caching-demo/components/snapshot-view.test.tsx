import { expect, test } from 'vitest';

import { renderWithProviders, screen } from '~/testing/render';

import { SnapshotView } from './snapshot-view';

// SnapshotView = view THUẦN sync (không hook) → RTL render thẳng. Phần async/`use cache`/
// `connection()` (orchestrator, live-panel) cover bằng build + curl (verify.md Lớp 1).

test('render tiêu đề (h2), gợi ý và mốc thời gian từ props', () => {
  renderWithProviders(
    <SnapshotView
      title="Cached data"
      hint="stable across reloads"
      generatedAtLabel="Generated at:"
      generatedAt="2026-01-01T00:00:00.000Z"
      timeId="cached-time"
    />,
  );

  expect(screen.getByRole('heading', { level: 2, name: 'Cached data' })).toBeInTheDocument();
  expect(screen.getByText('stable across reloads')).toBeInTheDocument();
  expect(screen.getByText('2026-01-01T00:00:00.000Z')).toBeInTheDocument();
});

test('mốc thời gian là <time> máy đọc được (dateTime + id để curl/E2E chọn)', () => {
  renderWithProviders(
    <SnapshotView
      title="Live data"
      hint="changes each request"
      generatedAtLabel="Generated at:"
      generatedAt="2026-06-27T10:00:00.000Z"
      timeId="live-time"
    />,
  );

  const time = screen.getByText('2026-06-27T10:00:00.000Z');
  expect(time.tagName).toBe('TIME');
  expect(time).toHaveAttribute('datetime', '2026-06-27T10:00:00.000Z');
  expect(time).toHaveAttribute('id', 'live-time');
});
