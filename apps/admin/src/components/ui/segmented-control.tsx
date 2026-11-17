import { useId } from 'react';

// Segmented controls of admin (Design System: "Nút phân đoạn"). One look, two
// behaviours:
// - SegmentedFilter: toggle buttons with aria-pressed, for a filter that acts at once,
//   as the status filter of S1.4. Each button is a tab stop.
// - SegmentedChoice: a radio group in a <fieldset>, for a value of a form, as Status
//   and Availability of S2.11 and S2.12. Native radios give one tab stop and the arrow
//   keys; the inputs are visually hidden and the labels draw the segments.
// Both are controlled: the caller owns `value` (the URL, or a react-hook-form
// Controller) and gets `onChange(value)`.

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedFilterProps<T extends string> {
  /** Accessible name of the group, e.g. "Lọc theo trạng thái". */
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedFilter<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedFilterProps<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__item"
          aria-pressed={option.value === value}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface SegmentedChoiceProps<T extends string> {
  /** The visible name of the group, e.g. "Trạng thái". */
  legend: string;
  hint?: string | undefined;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Name of the radios; generated when absent. */
  name?: string | undefined;
}

export function SegmentedChoice<T extends string>({
  legend,
  hint,
  options,
  value,
  onChange,
  name,
}: SegmentedChoiceProps<T>) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <fieldset className="choice" aria-describedby={hint !== undefined ? hintId : undefined}>
      <legend className="label">{legend}</legend>
      <div className="segmented">
        {options.map((option) => (
          <label key={option.value} className="segmented__item">
            <input
              className="segmented__radio"
              type="radio"
              name={name ?? id}
              value={option.value}
              checked={option.value === value}
              onChange={() => {
                onChange(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
      {hint !== undefined ? (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}
