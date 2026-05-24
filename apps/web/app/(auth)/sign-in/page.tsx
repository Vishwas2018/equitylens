'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { signIn } from '../../../server/actions/auth/signIn';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await signIn(
      fd.get('email') as string,
      fd.get('password') as string,
      navigator.userAgent,
    );
    if (result.error) {
      setError(result.error);
    } else {
      router.replace('/');
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-5)]">
      {/* Heading */}
      <div className="flex flex-col gap-[var(--space-1)]">
        <h1 className="[font-size:var(--text-xl)] font-semibold text-[var(--fg-default)]">
          Sign in
        </h1>
        <p className="[font-size:var(--text-sm)] text-[var(--fg-muted)]">
          Welcome back to EquityLens
        </p>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-[var(--space-3)]">
        <Input name="email" type="email" placeholder="Email" required autoComplete="email" />
        <Input
          name="password"
          type="password"
          placeholder="Password"
          required
          autoComplete="current-password"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="[font-size:var(--text-sm)] text-[var(--fg-negative)]" role="alert">
          {error}
        </p>
      )}

      {/* Submit */}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>

      {/* Footer links */}
      <div className="flex flex-col items-center gap-[var(--space-2)] text-center [font-size:var(--text-sm)]">
        <span className="text-[var(--fg-subtle)]">
          Forgot password?{' '}
          <span aria-disabled="true" className="cursor-not-allowed text-[var(--fg-subtle)]">
            Available soon
          </span>
        </span>
        <span className="text-[var(--fg-muted)]">
          Don&apos;t have an account?{' '}
          <Link href="/sign-up" className="text-[var(--color-accent-600)] hover:underline">
            Sign up
          </Link>
        </span>
      </div>
    </form>
  );
}
