'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createOrg } from '../../../../server/actions/org/createOrg';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    <div className="mx-auto max-w-sm">
      <h1 className="mb-[var(--space-5)] [font-size:var(--text-2xl)] font-semibold text-[var(--fg-default)]">
        New organisation
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-4)]">
        <Input name="name" placeholder="Organisation name" required />
        <Input name="abn" placeholder="ABN (optional, 11 digits)" pattern="\d{11}" />
        {error && (
          <p className="[font-size:var(--text-sm)] text-[var(--fg-negative)]" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create'}
        </Button>
      </form>
    </div>
  );
}
