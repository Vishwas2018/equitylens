'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
      <h1>Create account</h1>
      <input name="email" type="email" placeholder="Email" required autoComplete="email" />
      <input
        name="password"
        type="password"
        placeholder="Password (min 12 chars)"
        required
        minLength={12}
        autoComplete="new-password"
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
