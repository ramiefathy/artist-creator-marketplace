import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Azeret_Mono, Instrument_Serif, Sora, Source_Serif_4, Spline_Sans } from 'next/font/google';
import { AuthProvider } from '@/components/AuthProvider';
import { ThemeProvider, ToastProvider, type ThemeType } from '@/design-system/providers';
import { NavBar } from '@/design-system/components/composite';
import './globals.css';

export const metadata: Metadata = {
  title: 'MCMP',
  description: 'Music Campaign Marketplace Platform'
};

const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-sora',
  display: 'swap'
});

const splineSans = Spline_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-spline-sans',
  display: 'swap'
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-instrument-serif',
  display: 'swap'
});

const sourceSerif4 = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-source-serif-4',
  display: 'swap'
});

const azeretMono = Azeret_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-azeret-mono',
  display: 'swap'
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const THEME_COOKIE = 'mcmp-theme-v2';
  const VALID_THEMES: ThemeType[] = ['studio', 'liner'];
  const DEFAULT_THEME: ThemeType = 'studio';
  const LEGACY_THEME_COOKIE = 'mcmp-theme-v1';

  function normalizeTheme(raw: string | undefined): ThemeType {
    if (VALID_THEMES.includes(raw as ThemeType)) return raw as ThemeType;
    // Legacy mapping from removed themes
    if (raw === 'analog') return 'liner';
    return 'studio';
  }

  const cookieStore = cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE)?.value ?? cookieStore.get(LEGACY_THEME_COOKIE)?.value;
  const theme: ThemeType = normalizeTheme(themeCookie) ?? DEFAULT_THEME;

  return (
    <html
      lang="en"
      data-theme={theme}
      className={[
        sora.variable,
        splineSans.variable,
        instrumentSerif.variable,
        sourceSerif4.variable,
        azeretMono.variable
      ].join(' ')}
    >
      <body>
        <AuthProvider>
          <ThemeProvider initialTheme={theme}>
            <ToastProvider>
              <NavBar />
              <main>{children}</main>
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
