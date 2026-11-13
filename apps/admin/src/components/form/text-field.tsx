import { type ComponentProps } from 'react';

interface TextFieldProps extends ComponentProps<'input'> {
  label: string;
  /** Validation message (e.g. react-hook-form `errors.x?.message`). */
  error?: string | undefined;
}

// Reusable, UI-agnostic field: label + input + error, wired for accessibility
// (htmlFor/id, aria-invalid, aria-describedby). Designed to spread react-hook-form's
// `register(...)` output (name/onChange/onBlur/ref via React 19 ref-as-prop), so a
// form is just `<TextField label=… error={errors.x?.message} {...register('x')} />`.
// A real UI library swaps this markup in Phase 1.2; the props contract stays.
export function TextField({ label, error, id, name, ...inputProps }: TextFieldProps) {
  const fieldId = id ?? name;
  const errorId = error !== undefined ? `${fieldId ?? 'field'}-error` : undefined;
  return (
    <div>
      <label htmlFor={fieldId}>{label}</label>{' '}
      <input
        id={fieldId}
        name={name}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={errorId}
        {...inputProps}
      />
      {error !== undefined ? (
        <p id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
