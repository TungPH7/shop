'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { updateProfileAction } from '~/features/auth/actions/profile-actions';
import { updateProfileSchema, type UpdateProfileInput } from '~/features/auth/model/profile-form';
import { useRouter } from '~/i18n/navigation';

interface ProfileEditFormProps {
  /** Prefill từ server (`getProfile`). RHF `defaultValues` chỉ áp lúc mount. */
  defaultValues: UpdateProfileInput;
  labels: {
    name: string;
    phoneNumber: string;
    avatar: string;
    submit: string;
    submitting: string;
    saved: string;
  };
  /** code → chuỗi đã dịch (server map sẵn): `Validation.*` + `authError`/`unknownError`. */
  errorMessages: Record<string, string>;
}

/**
 * Form sửa hồ sơ — island `'use client'` dùng **RHF + zodResolver** (folder 16):
 *  - `resolver: zodResolver(updateProfileSchema)` → validate CLIENT tức thì (UX); CÙNG schema action dùng;
 *  - `defaultValues` prefill bơm từ server qua prop;
 *  - submit → gọi **Server Action** (re-validate ở server) → success thì `router.refresh()` (RSC đọc lại
 *    `getProfile` → /account mới; getProfile request-scoped nên KHÔNG cần revalidateTag).
 *
 * ⚠️ RHF cần JS → submit này MẤT progressive enhancement (khác form `useActionState` folder 15 chạy cả khi
 * JS chưa tải). Đánh đổi: RHF cho UX form phức tạp (validate tức thì, field array…). Label + code lỗi map
 * sẵn ở server rồi truyền xuống → giữ `t()` type-safe (không gọi `t(dynamicKey)`).
 */
export function ProfileEditForm({ defaultValues, labels, errorMessages }: ProfileEditFormProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({ resolver: zodResolver(updateProfileSchema), defaultValues });

  const submitHandler = handleSubmit(async (values) => {
    setSaved(false);
    const result = await updateProfileAction(values);
    if (result.status === 'success') {
      setSaved(true);
      router.refresh();
      return;
    }
    if (result.status === 'error' && result.reason === 'validation') {
      for (const [field, code] of Object.entries(result.fieldErrors)) {
        setError(field as keyof UpdateProfileInput, { message: code });
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
          {labels.name} <input type="text" {...register('name')} />
        </label>
        {errors.name && <span role="alert"> {show(errors.name.message)}</span>}
      </p>
      <p>
        <label>
          {labels.phoneNumber} <input type="tel" {...register('phoneNumber')} />
        </label>
        {errors.phoneNumber && <span role="alert"> {show(errors.phoneNumber.message)}</span>}
      </p>
      <p>
        <label>
          {labels.avatar} <input type="url" {...register('avatar')} />
        </label>
        {errors.avatar && <span role="alert"> {show(errors.avatar.message)}</span>}
      </p>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? labels.submitting : labels.submit}
      </button>
      {errors.root && <p role="alert">{show(errors.root.message)}</p>}
      {saved && <p role="status">{labels.saved}</p>}
    </form>
  );
}
