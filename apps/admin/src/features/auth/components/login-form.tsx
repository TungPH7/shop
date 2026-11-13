import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { TextField } from '@/components/form/text-field';
import { paths } from '@/config/paths';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { loginCredentialsSchema, type LoginCredentials } from '@/features/auth/model/auth';
import { isApiError } from '@/lib/api/api-error';

// react-hook-form (uncontrolled `register` → minimal re-renders) + zod resolver:
// the SAME `loginCredentialsSchema` validates the form (client) and the request
// body (boundary, §11) — one schema, no drift. The `useAuth().login` wiring from
// folder 10 is unchanged; folder 11 only upgrades the form UX (field errors).
export function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>({
    resolver: zodResolver(loginCredentialsSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit((values) => {
    login.mutate(values, { onSuccess: () => void navigate(paths.home.getHref()) });
  });

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <button type="submit" disabled={login.isPending}>
        {login.isPending ? 'Signing in…' : 'Sign in'}
      </button>
      {login.isError ? (
        <p role="alert">{isApiError(login.error) ? login.error.message : 'Login failed'}</p>
      ) : null}
    </form>
  );
}
