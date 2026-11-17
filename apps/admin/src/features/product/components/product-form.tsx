import { type ChangeEvent, type FocusEvent, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { InputField, TextAreaField } from '@/components/ui/field';
import { SegmentedChoice } from '@/components/ui/segmented-control';
import { paths } from '@/config/paths';
import {
  type CreateProductError,
  createProductErrorOf,
  useCreateProduct,
} from '@/features/product/api/create-product';
import {
  type UpdateProductError,
  updateProductErrorOf,
  useUpdateProduct,
} from '@/features/product/api/update-product';
import { type AdminProduct, formatPrice } from '@/features/product/model/product';
import {
  type CreateProductInput,
  DESCRIPTION_MAX_LENGTH,
  isSameSlug,
  NAME_MAX_LENGTH,
  parsePriceInput,
  productEditSchema,
  productFormDefaults,
  productFormSchema,
  productFormValuesOf,
  type ProductFormValues,
  slugFromName,
} from '@/features/product/model/product-form';
import type productEn from '@/lib/i18n/locales/en/product.json';
import { notify } from '@/lib/notifications/notification-store';

// S2 of docs/specs/SHOP-7/design.md, in add mode (US2) or edit mode (US3): the back
// link (S2.2), the title (S2.3), the card (S2.4) with the banner (S2.5), the fields
// (S2.6–S2.12) and the buttons (S2.13, S2.14). Outside ProtectedRoute: until the login
// Epic, the basic auth of the host guards admin.
//
// The schema checks every field on save; the api is the final check, and its errors go
// under their field ("Cách admin hiện lỗi" of the API Contract). Saved, the form goes
// back to the list and says "Đã thêm sản phẩm" or "Đã lưu sản phẩm" (S1.12).
//
// In edit mode the slug never follows the name, and a slug other than the saved one
// shows the warning of S2.7. The PUT sends the version the form was opened with: a 409
// conflict keeps every field as typed, and only Reload loads the latest version
// (AC13), through the page that loaded the product.

type FormErrorKey = keyof typeof productEn.form.errors;

const STATUSES = ['ACTIVE', 'HIDDEN'] as const;
const AVAILABILITIES = ['IN_STOCK', 'OUT_OF_STOCK'] as const;

/** S2 in add mode, or in edit mode for `product`. */
export type ProductFormProps =
  | { product?: undefined }
  | {
      product: AdminProduct;
      /** The product is gone: the not-found state of S2.3. */
      onMissing: () => void;
      /** Reload of the conflict banner: loads the latest version (AC13). */
      onReload: () => void;
    };

/** The banner of S2.5 over the fields, if any. */
type Banner = 'saveFailed' | 'conflict' | null;

function AlertIcon() {
  return (
    <svg className="banner__icon" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 5v5M9 12.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ProductForm(props: ProductFormProps) {
  const { product } = props;
  const { t } = useTranslation('product');
  const navigate = useNavigate();
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const isPending = create.isPending || update.isPending;
  const [banner, setBanner] = useState<Banner>(null);
  // Edit mode checks a slug only when it is not the saved one (NFR16). The page mounts
  // a new form for each version it loads, so the product never changes under the form.
  const [schema] = useState(() =>
    product === undefined ? productFormSchema : productEditSchema(product.slug),
  );
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ProductFormValues, unknown, CreateProductInput>({
    resolver: zodResolver(schema),
    defaultValues: product === undefined ? productFormDefaults : productFormValuesOf(product),
  });
  const [name, slug, description, slugEdited] = useWatch({
    control,
    name: ['name', 'slug', 'description', 'slugEdited'],
  });
  // S2.7: the old link of the product stops working once the new slug is saved.
  const slugWarning =
    product === undefined || isSameSlug(slug, product.slug)
      ? undefined
      : t('form.slug.changed', { slug: product.slug });

  function errorText(message: string | undefined): string | undefined {
    return message === undefined ? undefined : t(`form.errors.${message as FormErrorKey}`);
  }

  function showFailure(failure: CreateProductError | UpdateProductError) {
    switch (failure.kind) {
      case 'fields':
        failure.fields.forEach((field, index) => {
          setError(field, { type: 'server', message: 'invalid' }, { shouldFocus: index === 0 });
        });
        return;
      case 'slugTaken':
      case 'slugNotGenerated':
        setError('slug', { type: 'server', message: failure.kind }, { shouldFocus: true });
        return;
      case 'conflict':
        setBanner('conflict');
        return;
      case 'notFound':
        if (props.product !== undefined) props.onMissing();
        return;
      case 'general':
        setBanner('saveFailed');
    }
  }

  async function save(input: CreateProductInput) {
    setBanner(null);
    try {
      if (product === undefined) {
        await create.mutateAsync(input);
      } else {
        await update.mutateAsync({
          id: product.id,
          input: { ...input, slug: input.slug ?? product.slug, version: product.version },
        });
      }
    } catch (error) {
      showFailure(
        product === undefined ? createProductErrorOf(error, input) : updateProductErrorOf(error),
      );
      return;
    }
    notify.success(t(product === undefined ? 'form.added' : 'form.saved'));
    void navigate(paths.products.getHref());
  }

  const priceOptions = {
    // Shows the grouping once the field is left: 450000 as 450.000 (S2.9).
    onBlur: (event: FocusEvent<HTMLInputElement>) => {
      const price = parsePriceInput(event.target.value);
      if (price.kind === 'number') {
        setValue(
          event.target.name as 'price' | 'compareAtPrice',
          formatPrice(price.value, { sign: false }),
        );
      }
    },
  };

  return (
    <section className="form-page">
      <Link className="form-page__back" to={paths.products.getHref()}>
        <span aria-hidden="true">←</span>
        {t('form.back')}
      </Link>

      <form
        className="card product-form"
        noValidate
        onSubmit={(event) => {
          if (isPending) {
            event.preventDefault();
            return;
          }
          void handleSubmit(save)(event);
        }}
      >
        <header className="product-form__header">
          <h1>{t(product === undefined ? 'form.addTitle' : 'form.editTitle')}</h1>
          <p className="product-form__subtitle">{t('form.subtitle')}</p>
        </header>

        {/* role=alert reads the banner out; focus stays where it is (S2.5). */}
        {banner === null ? null : (
          <div className="banner banner--error" role="alert">
            <AlertIcon />
            <p>{t(banner === 'conflict' ? 'form.conflict' : 'form.saveFailed')}</p>
            {banner === 'conflict' && props.product !== undefined ? (
              <button
                type="button"
                className="btn btn--secondary btn--sm banner__action"
                onClick={props.onReload}
              >
                {t('form.reload')}
              </button>
            ) : null}
          </div>
        )}

        <InputField
          label={t('form.name.label')}
          placeholder={t('form.name.placeholder')}
          required
          autoComplete="off"
          error={errorText(errors.name?.message)}
          counter={{ count: name.trim().length, max: NAME_MAX_LENGTH }}
          {...register('name', {
            // The slug follows the name until the admin types it (S2.7); in edit mode it
            // counts as typed from the start, so it never follows.
            onChange: (event: ChangeEvent<HTMLInputElement>) => {
              if (!getValues('slugEdited')) setValue('slug', slugFromName(event.target.value));
            },
          })}
        />

        <InputField
          label={t('form.slug.label')}
          prefix="/products/"
          autoComplete="off"
          spellCheck={false}
          hint={slugEdited ? undefined : t('form.slug.hint')}
          warning={slugWarning}
          error={errorText(errors.slug?.message)}
          {...register('slug', {
            // Add mode: emptied, the slug is generated again, and the form sends slug null.
            onChange: (event: ChangeEvent<HTMLInputElement>) => {
              if (product === undefined) setValue('slugEdited', event.target.value !== '');
            },
          })}
        />

        <TextAreaField
          label={t('form.description.label')}
          rows={6}
          hint={t('form.description.hint')}
          error={errorText(errors.description?.message)}
          counter={{ count: description.length, max: DESCRIPTION_MAX_LENGTH }}
          {...register('description')}
        />

        <div className="product-form__pair">
          <InputField
            label={t('form.price.label')}
            suffix="₫"
            inputMode="numeric"
            autoComplete="off"
            required
            error={errorText(errors.price?.message)}
            {...register('price', priceOptions)}
          />
          <InputField
            label={t('form.compareAtPrice.label')}
            suffix="₫"
            inputMode="numeric"
            autoComplete="off"
            hint={t('form.compareAtPrice.hint')}
            error={errorText(errors.compareAtPrice?.message)}
            {...register('compareAtPrice', priceOptions)}
          />
        </div>

        <div className="product-form__pair">
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SegmentedChoice
                legend={t('form.status.legend')}
                hint={t('form.status.hint')}
                options={STATUSES.map((value) => ({ value, label: t(`status.${value}`) }))}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="availability"
            render={({ field }) => (
              <SegmentedChoice
                legend={t('form.availability.legend')}
                hint={t('form.availability.hint')}
                options={AVAILABILITIES.map((value) => ({
                  value,
                  label: t(`availability.${value}`),
                }))}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        <div className="product-form__actions">
          <Link className="btn btn--secondary" to={paths.products.getHref()}>
            {t('form.cancel')}
          </Link>
          {/* Never disabled before a save: AC6 shows the errors on save (S2.14). */}
          <button
            type="submit"
            className="btn btn--primary"
            aria-busy={isPending || undefined}
            aria-disabled={isPending || undefined}
          >
            {isPending
              ? t('form.saving')
              : t(product === undefined ? 'form.submitAdd' : 'form.submitEdit')}
          </button>
        </div>
      </form>
    </section>
  );
}
