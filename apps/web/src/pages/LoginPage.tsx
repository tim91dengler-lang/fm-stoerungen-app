import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const loginSchema = z.object({
  email: z.string().email('Bitte gültige E-Mail eingeben'),
  password: z.string().min(1, 'Passwort fehlt'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (isAuthenticated) {
    return <Navigate to="/tickets" replace />;
  }

  const from = (location.state as { from?: { pathname?: string } } | null)?.from
    ?.pathname;

  async function onSubmit(values: LoginForm) {
    setServerError(null);
    try {
      await login(values.email, values.password);
      navigate(from ?? '/tickets', { replace: true });
    } catch (err: unknown) {
      const status =
        (err as { response?: { status?: number } }).response?.status ?? 0;
      if (status === 401) {
        setServerError('E-Mail oder Passwort ungültig.');
      } else if (status === 403) {
        setServerError('Dieser Benutzer ist inaktiv. Bitte beim Admin melden.');
      } else {
        setServerError('Anmeldung fehlgeschlagen. Bitte später erneut versuchen.');
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600">
            <Activity className="h-6 w-6 text-zinc-950" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-semibold text-zinc-100">FM-Störungen</h1>
          <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
            Stufe 1 · Anmeldung
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-300"
            >
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              {...register('email')}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 shadow-sm focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-300"
            >
              Passwort
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 shadow-sm focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <div
              role="alert"
              className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {isSubmitting ? 'Anmelden …' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}
