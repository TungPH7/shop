import { type ChangeEvent, type FocusEvent, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { InputField, TextAreaField } from '@/components/ui/field';
import { SegmentedChoice } from '@/components/ui/segmented-control';
import { paths } from '@/config/paths';
import { createProductErrorOf, useCreateProduct } from '@/features/product/api/create-product';
import { formatPrice } from '@/features/product/model/product';
import {
  type CreateProductInput,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  parsePriceInput,
  productFormDefaults,
  productFormSchema,
  type ProductFormValues,
  slugFromName,
} from '@/features/product/model/product-form';
import type productEn from '@/lib/i18n/locales/en/product.json';
import { notify } from '@/lib/notifications/notification-store';

// S2 of docs/specs/SHOP-7/design.md in add mode (US2): the back link (S2.2), the title
// (S2.3), the card (S2.4) with the banner (S2.5), the fields (S2.6–S2.12) and the
// buttons (S2.13, S2.14). Outside ProtectedRoute: until the login Epic, the basic auth
// of the host guards admin.
//
// The schema checks every field on save; the api is the final check, and its errors go
// under their field ("Cách admin hiện lỗi" of the API Contract). Saved, the form goes
// back to the list and says "Đã thêm sản phẩm" (S1.12).

type FormErrorKey = keyof typeof productEn.form.errors;

const STATUSES = ['ACTIVE', 'HIDDEN'] as const;
const AVAILABILITIES = ['IN_STOCK', 'OUT_OF_STOCK'] as const;

function AlertIcon() {
  return (
    <svg className="banner__icon" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 5v5M9 12.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ProductForm() {
  const { t } = useTranslation('product');
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useCreateProduct();
  const [saveFailed, setSaveFailed] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ProductFormValues, unknown, CreateProductInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: productFormDefaults,
  });
  const [name, description, slugEdited] = useWatch({
    control,
    name: ['name', 'description', 'slugEdited'],
  });

  function errorText(message: string | undefined): string | undefined {
    return message === undefined ? undefined : t(`form.errors.${message as FormErrorKey}`);
  }

  async function save(input: CreateProductInput) {
    setSaveFailed(false);
    try {
      await mutateAsync(input);
    } catch (error) {
      const failure = createProductErrorOf(error, input);
      if (failure.kind === 'fields') {
        failure.fields.forEach((field, index) => {
          setError(field, { type: 'server', message: 'invalid' }, { shouldFocus: index === 0 });
        });
      } else if (failure.kind === 'slugTaken' || failure.kind === 'slugNotGenerated') {
        setError('slug', { type: 'server', message: failure.kind }, { shouldFocus: true });
      } else {
        setSaveFailed(true);
      }
      return;
    }
    notify.success(t('form.added'));
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
          <h1>{t('form.addTitle')}</h1>
          <p className="product-form__subtitle">{t('form.subtitle')}</p>
        </header>

        {saveFailed ? (
          <div className="banner banner--error" role="alert">
            <AlertIcon />
            <p>{t('form.saveFailed')}</p>
          </div>
        ) : null}

        <InputField
          label={t('form.name.label')}
          placeholder={t('form.name.placeholder')}
          required
          autoComplete="off"
          error={errorText(errors.name?.message)}
          counter={{ count: name.trim().length, max: NAME_MAX_LENGTH }}
          {...register('name', {
            // The slug follows the name until the admin types it (S2.7).
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
          error={errorText(errors.slug?.message)}
          {...register('slug', {
            // Emptied, the slug is generated again: the form sends slug null.
            onChange: (event: ChangeEvent<HTMLInputElement>) => {
              setValue('slugEdited', event.target.value !== '');
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
            {isPending ? t('form.saving') : t('form.submitAdd')}
          </button>
        </div>
      </form>
    </section>
  );
}
