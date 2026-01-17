import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const THEME_COOKIE_V2 = 'mcmp-theme-v2';
const LEGACY_THEME_COOKIE = 'mcmp-theme-v1';
const DEFAULT_THEME = 'studio';
const VALID_THEMES = ['studio', 'liner'] as const;

type ThemeType = (typeof VALID_THEMES)[number];

function normalizeTheme(raw: string | undefined): ThemeType {
  if (raw === 'studio' || raw === 'liner') return raw;
  // Legacy mapping from removed themes
  if (raw === 'analog') return 'liner';
  return DEFAULT_THEME;
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const themeCookieV2 = request.cookies.get(THEME_COOKIE_V2)?.value;
  const legacyCookie = request.cookies.get(LEGACY_THEME_COOKIE)?.value;
  const normalized = normalizeTheme(themeCookieV2 ?? legacyCookie);

  if (themeCookieV2 !== normalized) {
    response.cookies.set(THEME_COOKIE_V2, normalized, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/'
    });
  }

  // Best-effort cleanup: we no longer use this cookie, and it referenced removed themes.
  if (legacyCookie) {
    response.cookies.set(LEGACY_THEME_COOKIE, '', { path: '/', maxAge: 0 });
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and API routes
    '/((?!_next/static|_next/image|favicon.ico|api).*)'
  ]
};
