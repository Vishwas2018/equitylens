'use client';

import { BarChart2, Building2, FileText, LayoutDashboard, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/portfolio', label: 'Portfolio', Icon: LayoutDashboard },
  { href: '/properties', label: 'Properties', Icon: Building2 },
  { href: '/scenarios', label: 'Scenarios', Icon: BarChart2 },
  { href: '/reports', label: 'Reports', Icon: FileText },
  { href: '/settings', label: 'Settings', Icon: Settings },
] as const;

interface SideNavProps {
  className?: string;
}

export function SideNav({ className }: SideNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        'fixed bottom-0 left-0 top-14 z-40 flex w-56 flex-col border-r border-[var(--border-default)] bg-[var(--bg-surface)] py-[var(--space-3)]',
        className,
      )}
    >
      <ul className="flex flex-col gap-[var(--space-1)] px-[var(--space-2)]" role="list">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] transition-colors duration-[var(--motion-duration-quick)]',
                  active
                    ? 'bg-[var(--color-accent-600)]/10 text-[var(--color-accent-600)] font-medium'
                    : 'text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg-default)]',
                )}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
