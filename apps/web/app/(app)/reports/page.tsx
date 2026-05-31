import { redirect } from 'next/navigation';

import { getApiSession } from '../../../server/auth/api-guard';
import { getRlsAwareClient } from '../../../server/db/client';

interface ReportJob {
  id: string;
  template_id: string;
  format: string;
  status: string;
  presigned_url: string | null;
  presigned_url_expires_at: string | null;
  requested_at: string;
  completed_at: string | null;
  error_detail: string | null;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; classes: string }> = {
    queued: {
      label: 'Queued',
      classes: 'bg-[var(--bg-muted)] text-[var(--fg-muted)]',
    },
    running: {
      label: 'Running',
      classes: 'bg-[var(--bg-muted)] text-[var(--fg-default)]',
    },
    succeeded: {
      label: 'Ready',
      classes: 'bg-[color:oklch(0.93_0.07_145)] text-[color:oklch(0.35_0.1_145)]',
    },
    failed: {
      label: 'Failed',
      classes: 'bg-[color:oklch(0.94_0.05_25)] text-[color:oklch(0.45_0.12_25)]',
    },
  };
  const { label, classes } = map[status] ?? {
    label: status,
    classes: 'bg-[var(--bg-muted)] text-[var(--fg-muted)]',
  };
  return (
    <span
      className={`inline-block rounded-full px-[var(--space-2)] py-[var(--space-1)] [font-size:var(--text-xs)] font-medium ${classes}`}
    >
      {label}
    </span>
  );
}

function humanName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default async function ReportsPage() {
  const sess = await getApiSession();
  if (!sess) redirect('/sign-in');

  const client = getRlsAwareClient(sess.accessToken);
  const { data: jobs } = await client
    .from('report_jobs')
    .select(
      'id, template_id, format, status, presigned_url, presigned_url_expires_at, requested_at, completed_at, error_detail',
    )
    .eq('user_id', sess.userId)
    .order('requested_at', { ascending: false })
    .limit(50);

  const rows = (jobs ?? []) as ReportJob[];

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* Header */}
      <div>
        <h1 className="[font-size:var(--text-2xl)] font-semibold text-[var(--fg-default)]">
          Reports
        </h1>
        <p className="mt-[var(--space-1)] [font-size:var(--text-sm)] text-[var(--fg-muted)]">
          Generated exports — download links are valid for 7 days.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-6)] text-center">
          <p className="[font-size:var(--text-sm)] text-[var(--fg-muted)]">No reports yet.</p>
          <p className="[font-size:var(--text-xs)] text-[var(--fg-subtle)]">
            Exports generated from scenario or portfolio pages will appear here.
          </p>
        </div>
      ) : (
        <section
          aria-label="Generated reports"
          className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]"
        >
          <div className="overflow-x-auto">
            <table className="w-full [font-size:var(--text-sm)]">
              <thead>
                <tr className="border-b border-[var(--border-muted)]">
                  <th
                    scope="col"
                    className="px-[var(--space-5)] py-[var(--space-3)] text-left font-medium text-[var(--fg-subtle)]"
                  >
                    Report
                  </th>
                  <th
                    scope="col"
                    className="px-[var(--space-5)] py-[var(--space-3)] text-left font-medium text-[var(--fg-subtle)]"
                  >
                    Format
                  </th>
                  <th
                    scope="col"
                    className="px-[var(--space-5)] py-[var(--space-3)] text-left font-medium text-[var(--fg-subtle)]"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-[var(--space-5)] py-[var(--space-3)] text-left font-medium text-[var(--fg-subtle)]"
                  >
                    Requested
                  </th>
                  <th
                    scope="col"
                    className="px-[var(--space-5)] py-[var(--space-3)] text-right font-medium text-[var(--fg-subtle)]"
                  >
                    Download
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((job) => {
                  const isExpired =
                    job.presigned_url_expires_at != null &&
                    new Date(job.presigned_url_expires_at) < new Date();
                  const downloadable =
                    job.status === 'succeeded' && job.presigned_url && !isExpired;

                  return (
                    <tr key={job.id} className="border-b border-[var(--border-muted)]">
                      <td className="px-[var(--space-5)] py-[var(--space-3)]">
                        {humanName(job.template_id)}
                      </td>
                      <td className="px-[var(--space-5)] py-[var(--space-3)] uppercase text-[var(--fg-muted)]">
                        {job.format}
                      </td>
                      <td className="px-[var(--space-5)] py-[var(--space-3)]">
                        {statusBadge(job.status)}
                        {job.error_detail && (
                          <p className="mt-[var(--space-1)] [font-size:var(--text-xs)] text-[var(--fg-muted)]">
                            {job.error_detail.slice(0, 80)}
                          </p>
                        )}
                      </td>
                      <td className="px-[var(--space-5)] py-[var(--space-3)] text-[var(--fg-muted)]">
                        {new Date(job.requested_at).toLocaleDateString('en-AU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-[var(--space-5)] py-[var(--space-3)] text-right">
                        {downloadable ? (
                          <a
                            href={job.presigned_url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="[font-size:var(--text-xs)] text-[var(--fg-default)] hover:underline"
                          >
                            Download
                          </a>
                        ) : isExpired ? (
                          <span className="[font-size:var(--text-xs)] text-[var(--fg-muted)]">
                            Link expired
                          </span>
                        ) : (
                          <span className="[font-size:var(--text-xs)] text-[var(--fg-subtle)]">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
