'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { acceptInvite } from '../../../../server/actions/org/acceptInvite';

export default function AcceptInvitePage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setLoading(true);
    setError(null);
    const result = await acceptInvite(token);
    if (result.error) {
      setError(result.error);
    } else {
      router.replace('/');
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto' }}>
      <h1>Accept invitation</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button onClick={handleAccept} disabled={loading}>
        {loading ? 'Accepting…' : 'Accept invitation'}
      </button>
    </div>
  );
}
