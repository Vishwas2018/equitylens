'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createOrg } from '../../../../server/actions/org/createOrg';

export default function NewOrgPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const result = await createOrg(
      fd.get('name') as string,
      (fd.get('abn') as string) || undefined,
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
      <h1>New organisation</h1>
      <input name="name" placeholder="Organisation name" required />
      <input name="abn" placeholder="ABN (optional, 11 digits)" pattern="\d{11}" />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create'}
      </button>
    </form>
  );
}
