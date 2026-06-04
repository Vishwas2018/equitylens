'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { signUp } from '../../../server/actions/auth/signUp';

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await signUp(fd.get('email') as string, fd.get('password') as string);
    if (result.error) {
      setError(result.error);
    } else {
      router.replace('/sign-in');
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-5)]">
      {/* Heading */}
      <div className="flex flex-col gap-[var(--space-1)]">
        <h1 className="[font-size:var(--text-xl)] font-semibold text-[var(--fg-default)]">
          Create account
        </h1>
        <p className="[font-size:var(--text-sm)] text-[var(--fg-muted)]">
          Preview the EquityLens closed beta (invite only)
        </p>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-[var(--space-3)]">
        <Input name="email" type="email" placeholder="Email" required autoComplete="email" />
        <Input
          name="password"
          type="password"
          placeholder="Password (min 12 characters)"
          required
          minLength={12}
          autoComplete="new-password"
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
        {loading ? 'Creating account…' : 'Create account'}
      </Button>

      {/* Footer */}
      <p className="text-center [font-size:var(--text-sm)] text-[var(--fg-muted)]">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-[var(--color-accent-600)] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
