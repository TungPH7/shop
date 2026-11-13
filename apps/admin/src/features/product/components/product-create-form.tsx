import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { TextField } from '@/components/form/text-field';
import { useCreateProduct } from '@/features/product/api/create-product';
import { createProductSchema, type NewProduct } from '@/features/product/model/product';
import { isApiError } from '@/lib/api/api-error';

// Second form sharing the exact same pattern as LoginForm — proves it generalizes.
// Reuses `createProductSchema` (folder 08) as the resolver and `useCreateProduct`
// (folder 08, which invalidates the product list on success). `valueAsNumber`
// converts the price input to a number so the schema's int/nonnegative check applies.
export function ProductCreateForm() {
  const createProduct = useCreateProduct();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewProduct>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { name: '', priceCents: 0, inStock: true },
  });

  const submit = handleSubmit((values) => {
    createProduct.mutate(values, { onSuccess: () => reset() });
  });

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <TextField label="Name" error={errors.name?.message} {...register('name')} />
      <TextField
        label="Price (cents)"
        type="number"
        min={0}
        error={errors.priceCents?.message}
        {...register('priceCents', { valueAsNumber: true })}
      />
      <label>
        <input type="checkbox" {...register('inStock')} /> In stock
      </label>{' '}
      <button type="submit" disabled={createProduct.isPending}>
        {createProduct.isPending ? 'Creating…' : 'Create product'}
      </button>
      {createProduct.isError ? (
        <p role="alert">
          {isApiError(createProduct.error)
            ? createProduct.error.message
            : 'Failed to create product'}
        </p>
      ) : null}
      {createProduct.isSuccess ? <p role="status">Product created.</p> : null}
    </form>
  );
}
