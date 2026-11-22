import { type ChangeEvent, useEffect, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { type z } from 'zod';

import { InputField } from '@/components/ui/field';
import { SegmentedChoice } from '@/components/ui/segmented-control';
import { paths } from '@/config/paths';
import {
  categoryFailureOf,
  type CategoryFormFailure,
  useCreateCategory,
  useUpdateCategory,
} from '@/features/category/api/categories';
import {
  type AdminCategory,
  CATEGORY_NAME_MAX_LENGTH,
  CATEGORY_SLUG_FALLBACK,
  CATEGORY_STATUSES,
  categoryEditSchema,
  type CategoryEditInput,
  categoryFormDefaults,
  categoryFormSchema,
  categoryFormValuesOf,
  type CategoryFormValues,
  type CreateCategoryInput,
} from '@/features/category/model/category';
import type categoryEn from '@/lib/i18n/locales/en/category.json';
import { notify } from '@/lib/notifications/notification-store';
import { isSameSlug, slugFromName } from '@/lib/text/slug';

// S2 of docs/specs/SHOP-81/design.md, in add or edit mode: the back link (S2.2), the
// title (S2.3), the banner (S2.4), the name (S2.5), the slug (S2.6), the status (S2.7),
// Cancel and Save (S2.8, S2.9). Outside ProtectedRoute: until the login Epic, the basic
// auth of the host guards admin.
//
// The schema checks every field on save (AC3); the api is the final check, and its
// errors go under their field ("Cách admin hiện lỗi" of the API Contract). Saved, the
// form goes back to S1 and says "Category added" or "Category saved" (S1.10).
//
// Add mode: the slug follows the name until the admin types it; until then the form
// sends slug null and the api generates it, adding -2, -3… when taken (AC4). Edit mode:
// the slug never follows the name (AC5), a slug other than the saved one shows the
// warning of S2.6, and the PUT sends the version the form was opened with: a conflict
// keeps every field as typed, and only Reload loads the latest version.

type FormErrorKey = keyof typeof categoryEn.form.errors;

/** S2 in add mode, or in edit mode for `category`. */
export type CategoryFormProps =
  | { category?: undefined }
  | {
      category: AdminCategory;
      /** The category is gone: the not-found state of S2.3. */
      onMissing: () => void;
      /** Reload of the conflict banner: loads the latest version. */
      onReload: () => void;
    };

/** The banner of S2.4 over the fields, if any. */
type Banner = 'saveFailed' | 'conflict' | null;

/** What the two modes do differently, built once by AddCategoryForm or EditCategoryForm. */
interface FormMode<Input extends CreateCategoryInput | CategoryEditInput> {
  schema: z.ZodType<Input, CategoryFormValues>;
  defaultValues: CategoryFormValues;
  titleKey: 'form.addTitle' | 'form.editTitle';
  submitKey: 'form.submitAdd' | 'form.submitEdit';
  /** The toast once saved (S1.10). */
  savedKey: 'form.added' | 'form.saved';
  /** The saved slug, in edit mode: another one warns that the old link stops working. */
  savedSlug: string | null;
  isPending: boolean;
  submit: (input: Input) => Promise<unknown>;
  /** Edit mode only: the category is gone (S2.3). */
  onMissing?: () => void;
  /** Edit mode only: Reload of the conflict banner. */
  onReload?: () => void;
}

function AlertIcon() {
  return (
    <svg className="banner__icon" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 5v5M9 12.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CategoryForm(props: CategoryFormProps) {
  return props.category === undefined ? <AddCategoryForm /> : <EditCategoryForm {...props} />;
}

function AddCategoryForm() {
  const create = useCreateCategory();
  return (
    <CategoryFormView<CreateCategoryInput>
      mode={{
        schema: categoryFormSchema,
        defaultValues: categoryFormDefaults,
        titleKey: 'form.addTitle',
        submitKey: 'form.submitAdd',
        savedKey: 'form.added',
        savedSlug: null,
        isPending: create.isPending,
        submit: create.mutateAsync,
      }}
    />
  );
}

function EditCategoryForm({
  category,
  onMissing,
  onReload,
}: Extract<CategoryFormProps, { category: AdminCategory }>) {
  const update = useUpdateCategory();
  return (
    <CategoryFormView<CategoryEditInput>
      mode={{
        schema: categoryEditSchema,
        defaultValues: categoryFormValuesOf(category),
        titleKey: 'form.editTitle',
        submitKey: 'form.submitEdit',
        savedKey: 'form.saved',
        savedSlug: category.slug,
        isPending: update.isPending,
        submit: (input) =>
          update.mutateAsync({ id: category.id, input: { ...input, version: category.version } }),
        onMissing,
        onReload,
      }}
    />
  );
}

function CategoryFormView<Input extends CreateCategoryInput | CategoryEditInput>({
  mode,
}: {
  mode: FormMode<Input>;
}) {
  const { t } = useTranslation('category');
  const navigate = useNavigate();
  const [banner, setBanner] = useState<Banner>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const isEdit = mode.savedSlug !== null;
  // The banner sits over the fields: bring it into view. Scrolling moves no focus,
  // which stays where it is (S2.4).
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
  } = useForm<CategoryFormValues, unknown, Input>({
    resolver: zodResolver(mode.schema),
    defaultValues: mode.defaultValues,
  });
  const [name, slug, slugEdited] = useWatch({ control, name: ['name', 'slug', 'slugEdited'] });
  // S2.6: the old link of the category stops working once the new slug is saved (AC5).
  const slugWarning =
    mode.savedSlug === null || isSameSlug(slug, mode.savedSlug)
      ? undefined
      : t('form.slug.changed', { slug: mode.savedSlug });
  let slugHint: string | undefined;
  if (isEdit) slugHint = t('form.slug.editHint');
  else if (!slugEdited) slugHint = t('form.slug.hint');

  function errorText(message: string | undefined): string | undefined {
    return message === undefined ? undefined : t(`form.errors.${message as FormErrorKey}`);
  }

  function showFailure(failure: CategoryFormFailure) {
    switch (failure.kind) {
      case 'fields':
        failure.fields.forEach((field, index) => {
          setError(field, { type: 'server', message: 'invalid' }, { shouldFocus: index === 0 });
        });
        return;
      case 'nameTaken':
        setError('name', { type: 'server', message: 'nameTaken' }, { shouldFocus: true });
        return;
      case 'slugTaken':
      case 'slugNotGenerated':
        setError('slug', { type: 'server', message: failure.kind }, { shouldFocus: true });
        return;
      case 'conflict':
        setBanner(mode.onReload === undefined ? 'saveFailed' : 'conflict');
        return;
      case 'notFound':
        if (mode.onMissing === undefined) setBanner('saveFailed');
        else mode.onMissing();
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
      showFailure(categoryFailureOf(error, input.slug));
      return;
    }
    notify.success(t(mode.savedKey));
    void navigate(paths.categories.getHref());
  }

  return (
    <section className="form-page">
      <Link className="form-page__back" to={paths.categories.getHref()}>
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

        {/* role=alert reads the banner out; focus stays where it is (S2.4). */}
        {banner === null ? null : (
          <div ref={bannerRef} className="banner banner--error" role="alert">
            <AlertIcon />
            <p>{t(banner === 'conflict' ? 'form.conflict' : 'form.saveFailed')}</p>
            {banner === 'conflict' && mode.onReload !== undefined ? (
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
          counter={{ count: name.trim().length, max: CATEGORY_NAME_MAX_LENGTH }}
          {...register('name', {
            // The slug follows the name until the admin types it (S2.6).
            onChange: (event: ChangeEvent<HTMLInputElement>) => {
              if (!getValues('slugEdited')) {
                setValue('slug', slugFromName(event.target.value, CATEGORY_SLUG_FALLBACK));
              }
            },
          })}
        />

        <InputField
          label={t('form.slug.label')}
          prefix="/categories/"
          autoComplete="off"
          spellCheck={false}
          hint={slugHint}
          warning={slugWarning}
          error={errorText(errors.slug?.message)}
          {...register('slug', {
            // Add mode: emptied, the slug is generated again, and the form sends null.
            onChange: (event: ChangeEvent<HTMLInputElement>) => {
              if (!isEdit) setValue('slugEdited', event.target.value !== '');
            },
          })}
        />

        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <SegmentedChoice
              legend={t('form.status.legend')}
              hint={t('form.status.hint')}
              options={CATEGORY_STATUSES.map((value) => ({ value, label: t(`status.${value}`) }))}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <div className="product-form__actions">
          <Link className="btn btn--secondary" to={paths.categories.getHref()}>
            {t('form.cancel')}
          </Link>
          {/* Never disabled before a save: AC3 shows the errors on save (S2.9). */}
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
