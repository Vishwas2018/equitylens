'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { switchOrg } from '../../../../server/actions/org/switchOrg';

export default function SwitchOrgPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const orgId = params.get('orgId') ?? '';

  async function handleSwitch() {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    const result = await switchOrg(orgId);
    if (result.error) {
      setError(result.error);
    } else {
      router.replace('/');
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto' }}>
      <h1>Switch organisation</h1>
      {orgId ? (
        <>
          <p>
            Switch to org: <code>{orgId}</code>
          </p>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button onClick={handleSwitch} disabled={loading}>
            {loading ? 'Switching…' : 'Confirm switch'}
          </button>
        </>
      ) : (
        <p>No org specified.</p>
      )}
    </div>
  );
}
