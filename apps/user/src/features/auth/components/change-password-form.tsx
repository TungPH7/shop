'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { changePasswordAction } from '~/features/auth/actions/profile-actions';
import { changePasswordSchema, type ChangePasswordInput } from '~/features/auth/model/profile-form';

interface ChangePasswordFormProps {
  labels: {
    password: string;
    newPassword: string;
    confirmNewPassword: string;
    submit: string;
    submitting: string;
    saved: string;
  };
  errorMessages: Record<string, string>;
}

/**
 * Form đổi mật khẩu — RHF + zodResolver (folder 16 Stage B). KHÁC form sửa hồ sơ: KHÔNG prefill (field
 * mật khẩu luôn rỗng) + thành công thì `reset()` (xoá field) thay vì `router.refresh()` (không có data
 * hiển thị đổi). ⭐ `superRefine` của schema chạy ở client qua resolver → lệch confirm hiện lỗi TỨC THÌ.
 */
export function ChangePasswordForm({ labels, errorMessages }: ChangePasswordFormProps) {
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { password: '', newPassword: '', confirmNewPassword: '' },
  });

  const submitHandler = handleSubmit(async (values) => {
    setSaved(false);
    const result = await changePasswordAction(values);
    if (result.status === 'success') {
      setSaved(true);
      reset(); // xoá field mật khẩu sau khi đổi
      return;
    }
    if (result.status === 'error' && result.reason === 'validation') {
      for (const [field, code] of Object.entries(result.fieldErrors)) {
        setError(field as keyof ChangePasswordInput, { message: code });
      }
      return;
    }
    setError('root', { message: result.reason === 'auth' ? 'authError' : 'unknownError' });
  });

  const show = (code: string | undefined): string | undefined =>
    code === undefined ? undefined : (errorMessages[code] ?? code);

  return (
    <form onSubmit={(event) => void submitHandler(event)}>
      <p>
        <label>
          {labels.password}{' '}
          <input type="password" autoComplete="current-password" {...register('password')} />
        </label>
        {errors.password && <span role="alert"> {show(errors.password.message)}</span>}
      </p>
      <p>
        <label>
          {labels.newPassword}{' '}
          <input type="password" autoComplete="new-password" {...register('newPassword')} />
        </label>
        {errors.newPassword && <span role="alert"> {show(errors.newPassword.message)}</span>}
      </p>
      <p>
        <label>
          {labels.confirmNewPassword}{' '}
          <input type="password" autoComplete="new-password" {...register('confirmNewPassword')} />
        </label>
        {errors.confirmNewPassword && (
          <span role="alert"> {show(errors.confirmNewPassword.message)}</span>
        )}
      </p>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? labels.submitting : labels.submit}
      </button>
      {errors.root && <p role="alert">{show(errors.root.message)}</p>}
      {saved && <p role="status">{labels.saved}</p>}
    </form>
  );
}
