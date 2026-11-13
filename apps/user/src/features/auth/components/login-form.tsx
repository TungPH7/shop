'use client';

import { useActionState } from 'react';

import { loginAction } from '~/features/auth/actions/auth-actions';
import { initialLoginState } from '~/features/auth/model/auth';

interface LoginFormProps {
  labels: { email: string; password: string; submit: string; submitting: string };
  /** code → chuỗi đã dịch (server map sẵn): field codes (`Validation.*`) + reason codes (`Auth.*`). */
  errorMessages: Record<string, string>;
}

/**
 * Form đăng nhập (island `'use client'`) qua `useActionState(loginAction)`:
 *  - `<form action={action}>` = progressive enhancement (submit chạy được cả khi JS chậm tải);
 *  - `pending` (phần tử thứ 3) → khoá nút lúc đang gửi;
 *  - lỗi server trả về dạng CODE → map sang chuỗi đã dịch (`errorMessages`) — schema không dính i18n.
 *
 * KHÔNG validate trùng lặp ở client cho demo này (server validate là chốt thật); `required`/`type`
 * của input cho UX cơ bản. (folder 16 = RHF + zodResolver cho form phức tạp.)
 */
export function LoginForm({ labels, errorMessages }: LoginFormProps) {
  const [state, action, pending] = useActionState(loginAction, initialLoginState);

  const fieldError = (field: string): string | undefined => {
    if (state.status !== 'error' || state.reason !== 'validation') return undefined;
    const code = state.fieldErrors[field];
    return code === undefined ? undefined : (errorMessages[code] ?? code);
  };
  const formError =
    state.status === 'error' && state.reason !== 'validation'
      ? (errorMessages[state.reason] ?? state.reason)
      : undefined;

  return (
    <form action={action}>
      <p>
        <label>
          {labels.email} <input type="email" name="email" required autoComplete="email" />
        </label>
        {fieldError('email') !== undefined && <span role="alert"> {fieldError('email')}</span>}
      </p>
      <p>
        <label>
          {labels.password}{' '}
          <input type="password" name="password" required autoComplete="current-password" />
        </label>
        {fieldError('password') !== undefined && (
          <span role="alert"> {fieldError('password')}</span>
        )}
      </p>
      <button type="submit" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </button>
      {formError !== undefined && <p role="alert">{formError}</p>}
    </form>
  );
}
