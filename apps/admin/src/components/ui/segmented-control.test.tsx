import { describe, expect, it, vi } from 'vitest';

import { SegmentedChoice, SegmentedFilter } from '@/components/ui/segmented-control';
import { renderWithProviders, screen, within } from '@/testing/render';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'hidden', label: 'Hidden' },
] as const;

const STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'HIDDEN', label: 'Hidden' },
] as const;

describe('SegmentedFilter', () => {
  it('is a labelled group of toggle buttons with the current one pressed', () => {
    renderWithProviders(
      <SegmentedFilter
        label="Filter by status"
        options={STATUS_FILTERS}
        value="active"
        onChange={vi.fn()}
      />,
    );

    const group = screen.getByRole('group', { name: 'Filter by status' });
    expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(within(group).getByRole('button', { name: 'Active' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: 'Hidden' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('reports the option chosen with the mouse', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <SegmentedFilter
        label="Filter by status"
        options={STATUS_FILTERS}
        value="all"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Hidden' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('hidden');
  });

  it('reports the option chosen with the keyboard', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <SegmentedFilter
        label="Filter by status"
        options={STATUS_FILTERS}
        value="all"
        onChange={onChange}
      />,
    );

    await user.tab();
    await user.tab();
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledExactlyOnceWith('active');
  });

  it('does not report the option that is already pressed', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <SegmentedFilter
        label="Filter by status"
        options={STATUS_FILTERS}
        value="all"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'All' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SegmentedChoice', () => {
  it('is a fieldset named by its legend, with one radio per option and the value checked', () => {
    renderWithProviders(
      <SegmentedChoice legend="Status" options={STATUSES} value="ACTIVE" onChange={vi.fn()} />,
    );

    const group = screen.getByRole('group', { name: 'Status' });
    expect(group.tagName).toBe('FIELDSET');
    expect(within(group).getByRole('radio', { name: 'Active' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: 'Hidden' })).not.toBeChecked();
  });

  it('reports the option chosen with the mouse', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <SegmentedChoice legend="Status" options={STATUSES} value="ACTIVE" onChange={onChange} />,
    );

    await user.click(screen.getByRole('radio', { name: 'Hidden' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('HIDDEN');
  });

  it('moves the choice with the arrow keys, as a radio group does', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <SegmentedChoice legend="Status" options={STATUSES} value="ACTIVE" onChange={onChange} />,
    );

    await user.tab();
    expect(screen.getByRole('radio', { name: 'Active' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledWith('HIDDEN');
  });

  it('describes the group with its hint', () => {
    renderWithProviders(
      <SegmentedChoice
        legend="Status"
        hint="Hidden: customers can't see the product."
        options={STATUSES}
        value="ACTIVE"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('group', { name: 'Status' })).toHaveAccessibleDescription(
      "Hidden: customers can't see the product.",
    );
  });

  it('keeps two groups apart on one form', async () => {
    const onStatus = vi.fn();
    const { user } = renderWithProviders(
      <>
        <SegmentedChoice legend="Status" options={STATUSES} value="ACTIVE" onChange={onStatus} />
        <SegmentedChoice
          legend="Availability"
          options={[
            { value: 'IN_STOCK', label: 'In stock' },
            { value: 'OUT_OF_STOCK', label: 'Out of stock' },
          ]}
          value="IN_STOCK"
          onChange={vi.fn()}
        />
      </>,
    );

    await user.click(screen.getByRole('radio', { name: 'Out of stock' }));

    expect(screen.getByRole('radio', { name: 'Active' })).toBeChecked();
    expect(onStatus).not.toHaveBeenCalled();
  });
});
