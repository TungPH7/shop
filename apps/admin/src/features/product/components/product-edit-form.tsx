import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { TextField } from '@/components/form/text-field';
import { paths } from '@/config/paths';
import { useUpdateProduct } from '@/features/product/api/update-product';
import {
  createProductSchema,
  type NewProduct,
  type Product,
} from '@/features/product/model/product';
import { isApiError } from '@/lib/api/api-error';

interface ProductEditFormProps {
  product: Product;
}

// Same pattern + schema as ProductCreateForm (folder 11), but pre-filled from the
// existing product and wired to `useUpdateProduct`. On success it navigates to the
// detail page — which renders instantly because the mutation seeded its cache.
export function ProductEditForm({ product }: ProductEditFormProps) {
  const navigate = useNavigate();
  const updateProduct = useUpdateProduct(product.id);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewProduct>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { name: product.name, priceCents: product.priceCents, inStock: product.inStock },
  });

  const submit = handleSubmit((values) => {
    updateProduct.mutate(values, {
      onSuccess: () => {
        void navigate(paths.productDetail.getHref(product.id));
      },
    });
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
      <button type="submit" disabled={updateProduct.isPending}>
        {updateProduct.isPending ? 'Saving…' : 'Save changes'}
      </button>
      {updateProduct.isError ? (
        <p role="alert">
          {isApiError(updateProduct.error)
            ? updateProduct.error.message
            : 'Failed to update product'}
        </p>
      ) : null}
    </form>
  );
}
