'use client';

import { useEffect } from 'react';

type ThemePreference = 'light' | 'dark' | 'system';

function applyTheme(preference: ThemePreference) {
  const resolved =
    preference === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : preference;
  document.documentElement.dataset.theme = resolved;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: {
  children: React.ReactNode;
  defaultTheme?: ThemePreference;
}) {
  useEffect(() => {
    applyTheme(defaultTheme);
    if (defaultTheme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
  }, [defaultTheme]);

  return <>{children}</>;
}
