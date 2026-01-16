import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AuthProvider } from '@/components/AuthProvider';
import { ThemeProvider, ToastProvider, type ThemeType } from '@/design-system/providers';
import { NavBar } from '@/design-system/components/composite';
import { ThemeSwitcher } from '@/design-system/components/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'MCMP',
  description: 'Music Campaign Marketplace Platform'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const THEME_COOKIE = 'mcmp-theme-v1';
  const VALID_THEMES: ThemeType[] = ['noir', 'analog', 'luma', 'flux'];
  const DEFAULT_THEME: ThemeType = 'luma';

  const cookieStore = cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE)?.value;
  const theme: ThemeType = VALID_THEMES.includes(themeCookie as ThemeType) ? (themeCookie as ThemeType) : DEFAULT_THEME;

  return (
    <html lang="en" data-theme={theme}>
      <body>
        <AuthProvider>
          <ThemeProvider initialTheme={theme}>
            <ToastProvider>
              <NavBar />
              <ThemeSwitcher />
              <main>{children}</main>
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
