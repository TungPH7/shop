import { type ChangeEvent, type FocusEvent, useEffect, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { type z } from 'zod';

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
  type ProductEditInput,
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
//
// Everything the two modes do differently is one FormMode, built once by AddProductForm
// or EditProductForm; ProductFormView renders S2 from it and never asks which mode.

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

/** What add mode and edit mode both have; `Input` is what a save sends. */
interface FormModeBase<Input extends CreateProductInput> {
  /** Checks the fields on save and turns them into `Input`. */
  schema: z.ZodType<Input, ProductFormValues>;
  defaultValues: ProductFormValues;
  titleKey: 'form.addTitle' | 'form.editTitle';
  submitKey: 'form.submitAdd' | 'form.submitEdit';
  /** The toast once saved (S1.12). */
  savedKey: 'form.added' | 'form.saved';
  /** Whether typing a slug stops it following the name, and emptying it resumes (S2.7). */
  slugFollowsName: boolean;
  /** The saved slug: another one warns that the old link stops working (S2.7). */
  savedSlug: string | null;
  isPending: boolean;
  submit: (input: Input) => Promise<unknown>;
}

/**
 * What add mode and edit mode do differently, told apart by `kind`: only an edit can
 * conflict or find the product gone, so only edit mode has, and must have, Reload and
 * the not-found state. Add mode has no conflict banner to show.
 */
type FormMode<Input extends CreateProductInput> = FormModeBase<Input> &
  (
    | {
        kind: 'add';
        errorOf: (error: unknown, input: Input) => CreateProductError;
      }
    | {
        kind: 'edit';
        errorOf: (error: unknown, input: Input) => UpdateProductError;
        /** The product is gone: the not-found state of S2.3. */
        onMissing: () => void;
        /** Reload of the conflict banner (AC13). */
        onReload: () => void;
      }
  );

/** A failure both modes show the same way: under a field, or the general banner. */
type FieldFailure = Exclude<
  CreateProductError | UpdateProductError,
  { kind: 'conflict' | 'notFound' }
>;

function AlertIcon() {
  return (
    <svg className="banner__icon" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 5v5M9 12.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ProductForm(props: ProductFormProps) {
  return props.product === undefined ? <AddProductForm /> : <EditProductForm {...props} />;
}

/** US2: a new product, its slug generated from the name until it is typed. */
function AddProductForm() {
  const create = useCreateProduct();
  return (
    <ProductFormView<CreateProductInput>
      mode={{
        kind: 'add',
        schema: productFormSchema,
        defaultValues: productFormDefaults,
        titleKey: 'form.addTitle',
        submitKey: 'form.submitAdd',
        savedKey: 'form.added',
        slugFollowsName: true,
        savedSlug: null,
        isPending: create.isPending,
        submit: create.mutateAsync,
        errorOf: createProductErrorOf,
      }}
    />
  );
}

/** US3: the product loaded, saved with the version it was opened with (AC13). */
function EditProductForm({
  product,
  onMissing,
  onReload,
}: Extract<ProductFormProps, { product: AdminProduct }>) {
  const update = useUpdateProduct();
  // Edit mode checks a slug only when it is not the saved one (NFR16). The page mounts
  // a new form for each version it loads, so the product never changes under the form.
  const [schema] = useState(() => productEditSchema(product.slug));
  return (
    <ProductFormView<ProductEditInput>
      mode={{
        kind: 'edit',
        schema,
        // The slug counts as typed from the start, so it never follows the name.
        defaultValues: productFormValuesOf(product),
        titleKey: 'form.editTitle',
        submitKey: 'form.submitEdit',
        savedKey: 'form.saved',
        slugFollowsName: false,
        savedSlug: product.slug,
        isPending: update.isPending,
        submit: (input) =>
          update.mutateAsync({ id: product.id, input: { ...input, version: product.version } }),
        errorOf: updateProductErrorOf,
        onMissing,
        onReload,
      }}
    />
  );
}

function ProductFormView<Input extends CreateProductInput>({ mode }: { mode: FormMode<Input> }) {
  const { t } = useTranslation('product');
  const navigate = useNavigate();
  const [banner, setBanner] = useState<Banner>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  // The banner sits over the fields, off screen while the person is at Save: bring it
  // into view. Scrolling moves no focus, which stays where it is (S2.5).
  useEffect(() => {
    if (banner !== null) bannerRef.current?.scrollIntoView({ block: 'nearest' });
  }, [banner]);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ProductFormValues, unknown, Input>({
    resolver: zodResolver(mode.schema),
    defaultValues: mode.defaultValues,
  });
  const [name, slug, description, slugEdited] = useWatch({
    control,
    name: ['name', 'slug', 'description', 'slugEdited'],
  });
  // S2.7: the old link of the product stops working once the new slug is saved.
  const slugWarning =
    mode.savedSlug === null || isSameSlug(slug, mode.savedSlug)
      ? undefined
      : t('form.slug.changed', { slug: mode.savedSlug });

  function errorText(message: string | undefined): string | undefined {
    return message === undefined ? undefined : t(`form.errors.${message as FormErrorKey}`);
  }

  function showFailure(failure: FieldFailure) {
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
      case 'general':
        setBanner('saveFailed');
    }
  }

  async function save(input: Input) {
    setBanner(null);
    try {
      await mode.submit(input);
    } catch (error) {
      if (mode.kind === 'add') {
        showFailure(mode.errorOf(error, input));
        return;
      }
      const failure = mode.errorOf(error, input);
      if (failure.kind === 'conflict') setBanner('conflict');
      else if (failure.kind === 'notFound') mode.onMissing();
      else showFailure(failure);
      return;
    }
    notify.success(t(mode.savedKey));
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
          if (mode.isPending) {
            event.preventDefault();
            return;
          }
          void handleSubmit(save)(event);
        }}
      >
        <header className="product-form__header">
          <h1>{t(mode.titleKey)}</h1>
          <p className="product-form__subtitle">{t('form.subtitle')}</p>
        </header>

        {/* role=alert reads the banner out; focus stays where it is (S2.5). */}
        {banner === null ? null : (
          <div ref={bannerRef} className="banner banner--error" role="alert">
            <AlertIcon />
            <p>{t(banner === 'conflict' ? 'form.conflict' : 'form.saveFailed')}</p>
            {banner === 'conflict' && mode.kind === 'edit' ? (
              <button
                type="button"
                className="btn btn--secondary btn--sm banner__action"
                onClick={mode.onReload}
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
          warning={slugWarning}
          error={errorText(errors.slug?.message)}
          {...register('slug', {
            // Emptied, the slug is generated again, and the form sends slug null.
            onChange: (event: ChangeEvent<HTMLInputElement>) => {
              if (mode.slugFollowsName) setValue('slugEdited', event.target.value !== '');
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
            aria-busy={mode.isPending || undefined}
            aria-disabled={mode.isPending || undefined}
          >
            {mode.isPending ? t('form.saving') : t(mode.submitKey)}
          </button>
        </div>
      </form>
    </section>
  );
}
