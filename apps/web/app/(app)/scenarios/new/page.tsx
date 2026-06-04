import { redirect } from 'next/navigation';

import { getApiSession } from '../../../../server/auth/api-guard';
import { getProperties } from '../../../../server/data/properties';

import { ScenarioNewForm } from './form';

export default async function ScenarioNewPage() {
  const sess = await getApiSession();
  if (!sess) redirect('/sign-in');

  const { data: properties } = await getProperties(sess);

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div>
        <h1 className="[font-size:var(--text-2xl)] font-semibold text-[var(--fg-default)]">
          New scenario
        </h1>
        <p className="mt-[var(--space-1)] [font-size:var(--text-sm)] text-[var(--fg-muted)]">
          Enter disposal details to estimate CGT under the selected financial year rules.
        </p>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-6)]">
        <ScenarioNewForm properties={properties ?? []} />
      </div>
    </div>
  );
}
