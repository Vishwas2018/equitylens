'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { signIn } from '../../../server/actions/auth/signIn';

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
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: 360,
        margin: '80px auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <h1>Sign in</h1>
      <input name="email" type="email" placeholder="Email" required autoComplete="email" />
      <input
        name="password"
        type="password"
        placeholder="Password"
        required
        autoComplete="current-password"
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
