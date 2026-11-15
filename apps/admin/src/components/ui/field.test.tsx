import { createRef } from 'react';

import { describe, expect, it } from 'vitest';

import { InputField, SelectField, TextAreaField } from '@/components/ui/field';
import { renderWithProviders, screen } from '@/testing/render';

describe('InputField', () => {
  it('names the input with its label', () => {
    renderWithProviders(<InputField label="Product name" name="name" />);

    expect(screen.getByRole('textbox', { name: 'Product name' })).toBeInTheDocument();
  });

  it('marks a required field with an asterisk that is not part of the accessible name', () => {
    renderWithProviders(<InputField label="Product name" name="name" required />);

    const input = screen.getByRole('textbox', { name: 'Product name' });
    expect(input).toBeRequired();
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  it('describes the input with its hint', () => {
    renderWithProviders(
      <InputField label="URL slug" name="slug" hint="Generated from the name." />,
    );

    expect(screen.getByRole('textbox', { name: 'URL slug' })).toHaveAccessibleDescription(
      'Generated from the name.',
    );
  });

  it('is valid and has no error line when there is no error', () => {
    renderWithProviders(<InputField label="Product name" name="name" />);

    expect(screen.getByRole('textbox', { name: 'Product name' })).not.toHaveAttribute(
      'aria-invalid',
    );
  });

  it('shows an error under the input, marks it invalid and describes it with the error first', () => {
    renderWithProviders(
      <InputField
        label="Product name"
        name="name"
        hint="Shown to customers."
        error="Enter a product name"
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Product name' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a product name Shown to customers.');
    expect(screen.getByText('Enter a product name')).toBeVisible();
  });

  it('shows a counter of the characters typed and the maximum', () => {
    renderWithProviders(
      <InputField label="Product name" name="name" counter={{ count: 12, max: 150 }} />,
    );

    expect(screen.getByRole('textbox', { name: 'Product name' })).toHaveAccessibleDescription(
      '12/150',
    );
  });

  it('flags the counter once the text is over the maximum', () => {
    renderWithProviders(
      <InputField label="Product name" name="name" counter={{ count: 151, max: 150 }} />,
    );

    expect(screen.getByText('151/150')).toHaveAttribute('data-over', 'true');
  });

  it('announces a warning in a status region and describes the input with it', () => {
    renderWithProviders(
      <InputField
        label="URL slug"
        name="slug"
        warning="The old link /products/ao-thun will stop working."
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'The old link /products/ao-thun will stop working.',
    );
    expect(screen.getByRole('textbox', { name: 'URL slug' })).toHaveAccessibleDescription(
      'The old link /products/ao-thun will stop working.',
    );
  });

  it('keeps an empty status region when there is no warning, so a later warning is announced', () => {
    renderWithProviders(<InputField label="URL slug" name="slug" />);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('keeps the descriptions the caller adds', () => {
    renderWithProviders(
      <>
        <p id="extra">Extra help</p>
        <InputField label="URL slug" name="slug" hint="Hint" aria-describedby="extra" />
      </>,
    );

    expect(screen.getByRole('textbox', { name: 'URL slug' })).toHaveAccessibleDescription(
      'Hint Extra help',
    );
  });

  it('shows a fixed prefix and suffix next to the value', () => {
    renderWithProviders(<InputField label="URL slug" name="slug" prefix="/products/" suffix="₫" />);

    expect(screen.getByText('/products/')).toBeVisible();
    expect(screen.getByText('₫')).toBeVisible();
  });

  it('uses the id it is given, and generates one otherwise', () => {
    renderWithProviders(
      <>
        <InputField label="With id" id="product-name" />
        <InputField label="Without id" />
      </>,
    );

    expect(screen.getByLabelText('With id')).toHaveAttribute('id', 'product-name');
    expect(screen.getByLabelText('Without id').id).not.toBe('');
  });

  it('passes the ref and the events to the input, as register() of react-hook-form needs', async () => {
    const ref = createRef<HTMLInputElement>();
    const { user } = renderWithProviders(<InputField label="Product name" name="name" ref={ref} />);

    await user.type(screen.getByRole('textbox', { name: 'Product name' }), 'Áo thun');

    expect(ref.current).toBe(screen.getByRole('textbox', { name: 'Product name' }));
    expect(ref.current?.value).toBe('Áo thun');
  });

  it('can be disabled', () => {
    renderWithProviders(<InputField label="Product name" name="name" disabled />);

    expect(screen.getByRole('textbox', { name: 'Product name' })).toBeDisabled();
  });
});

describe('TextAreaField', () => {
  it('is a text area with its label, counter and error', () => {
    renderWithProviders(
      <TextAreaField
        label="Description (optional)"
        name="description"
        rows={6}
        counter={{ count: 5001, max: 5000 }}
        error="Description must be 5,000 characters or fewer"
      />,
    );

    const textarea = screen.getByRole('textbox', { name: 'Description (optional)' });
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveAttribute('rows', '6');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAccessibleDescription(
      'Description must be 5,000 characters or fewer 5001/5000',
    );
  });
});

describe('SelectField', () => {
  it('is a select with its label and options, and reports the choice', async () => {
    const { user } = renderWithProviders(
      <SelectField label="Sort by" name="sort" defaultValue="newest" hint="Applies at once.">
        <option value="newest">Newest</option>
        <option value="price-asc">Price: low to high</option>
      </SelectField>,
    );

    const select = screen.getByRole('combobox', { name: 'Sort by' });
    expect(select).toHaveAccessibleDescription('Applies at once.');

    await user.selectOptions(select, 'price-asc');

    expect(select).toHaveValue('price-asc');
  });
});
