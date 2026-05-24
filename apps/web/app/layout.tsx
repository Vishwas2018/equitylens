import './globals.css';

import { ThemeProvider } from '@/components/theme-provider';

export const metadata = {
  title: 'EquityLens',
  description: 'Property investment analysis',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <body>
        <ThemeProvider defaultTheme="system">{children}</ThemeProvider>
      </body>
    </html>
  );
}
