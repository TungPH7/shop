import { type ComponentProps, type ReactNode, useId } from 'react';

// Form fields of admin (Design System: "Ô nhập, vùng văn bản, ô chọn", "Nhãn trường"),
// for the form of S2. Each one is a label over its control, then the error, the
// warning, the hint and the counter, all tied to the control with aria-describedby.
// The props of the native element pass through, ref included (React 19), so a form
// spreads register() of react-hook-form: <InputField label=… {...register('name')} />.
//
// Errors carry no live role: the form moves focus to the first invalid field on save
// (S2.6), and the focused control reads its description, error first. A warning is a
// status (S2.7), so its live region is always there, empty, to be announced when
// it fills.

interface Counter {
  /** Characters typed, in UTF-16 units like the API counts them (plan, API Contract). */
  count: number;
  max: number;
}

interface FieldOwnProps {
  label: string;
  hint?: string | undefined;
  /** Validation message, e.g. errors.name?.message. */
  error?: string | undefined;
  /** A non-blocking warning, e.g. the slug change of S2.7. */
  warning?: string | undefined;
  /** Shows "count/max" under the control. */
  counter?: Counter | undefined;
}

interface FieldFrameProps extends FieldOwnProps {
  id: string;
  required: boolean | undefined;
  children: ReactNode;
}

function ErrorIcon() {
  return (
    <svg className="field-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5v4M8 10.75v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="field-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M8 1.75 14.75 13.5H1.25z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8 6v3.5M8 11.25v.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// The ids of the lines a control is described by, in reading order.
function describedBy(id: string, props: FieldOwnProps, extra: string | undefined) {
  const ids = [
    props.error !== undefined ? `${id}-error` : undefined,
    props.warning !== undefined ? `${id}-warning` : undefined,
    props.hint !== undefined ? `${id}-hint` : undefined,
    props.counter !== undefined ? `${id}-counter` : undefined,
    extra,
  ].filter((value) => value !== undefined && value !== '');
  return ids.length > 0 ? ids.join(' ') : undefined;
}

function FieldFrame({
  id,
  label,
  hint,
  error,
  warning,
  counter,
  required,
  children,
}: FieldFrameProps) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
        {required === true ? (
          <span className="label__required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      <div className="field__meta">
        <div className="field__messages">
          {error !== undefined ? (
            <p className="field-error" id={`${id}-error`}>
              <ErrorIcon />
              <span>{error}</span>
            </p>
          ) : null}
          <div role="status">
            {warning !== undefined ? (
              <p className="field-warning" id={`${id}-warning`}>
                <WarningIcon />
                <span>{warning}</span>
              </p>
            ) : null}
          </div>
          {hint !== undefined ? (
            <p className="field-hint" id={`${id}-hint`}>
              {hint}
            </p>
          ) : null}
        </div>
        {counter !== undefined ? (
          <p
            className="field-counter"
            id={`${id}-counter`}
            data-over={counter.count > counter.max || undefined}
          >
            {counter.count}/{counter.max}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// No field takes className: its look is the one of the design system (UI-008).
interface InputFieldProps
  extends FieldOwnProps, Omit<ComponentProps<'input'>, 'className' | 'prefix'> {
  /** Fixed text before the value, such as "/products/" of the slug (S2.7). */
  prefix?: string | undefined;
  /** Fixed text after the value, such as "₫" of a price (S2.9). */
  suffix?: string | undefined;
}

export function InputField({
  label,
  hint,
  error,
  warning,
  counter,
  prefix,
  suffix,
  id,
  required,
  'aria-describedby': extraDescribedBy,
  ...inputProps
}: InputFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const own = { label, hint, error, warning, counter };
  const input = (
    <input
      id={fieldId}
      className={prefix !== undefined || suffix !== undefined ? 'input-group__input' : 'input'}
      required={required}
      aria-invalid={error !== undefined || undefined}
      aria-describedby={describedBy(fieldId, own, extraDescribedBy)}
      {...inputProps}
    />
  );

  return (
    <FieldFrame id={fieldId} required={required} {...own}>
      {prefix !== undefined || suffix !== undefined ? (
        // The affixes repeat what the label says (₫) or only frame the value
        // (/products/), so they stay out of the accessibility tree.
        <div className="input input-group">
          {prefix !== undefined ? (
            <span className="input-group__affix" aria-hidden="true">
              {prefix}
            </span>
          ) : null}
          {input}
          {suffix !== undefined ? (
            <span className="input-group__affix" aria-hidden="true">
              {suffix}
            </span>
          ) : null}
        </div>
      ) : (
        input
      )}
    </FieldFrame>
  );
}

type TextAreaFieldProps = FieldOwnProps & Omit<ComponentProps<'textarea'>, 'className'>;

export function TextAreaField({
  label,
  hint,
  error,
  warning,
  counter,
  id,
  required,
  'aria-describedby': extraDescribedBy,
  ...textareaProps
}: TextAreaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const own = { label, hint, error, warning, counter };

  return (
    <FieldFrame id={fieldId} required={required} {...own}>
      <textarea
        id={fieldId}
        className="input"
        required={required}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedBy(fieldId, own, extraDescribedBy)}
        {...textareaProps}
      />
    </FieldFrame>
  );
}

type SelectFieldProps = Omit<FieldOwnProps, 'counter'> &
  Omit<ComponentProps<'select'>, 'className'>;

export function SelectField({
  label,
  hint,
  error,
  warning,
  id,
  required,
  'aria-describedby': extraDescribedBy,
  children,
  ...selectProps
}: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const own = { label, hint, error, warning };

  return (
    <FieldFrame id={fieldId} required={required} {...own}>
      <select
        id={fieldId}
        className="input input--select"
        required={required}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedBy(fieldId, own, extraDescribedBy)}
        {...selectProps}
      >
        {children}
      </select>
    </FieldFrame>
  );
}
