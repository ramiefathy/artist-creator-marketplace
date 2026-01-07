import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const THEME_COOKIE = 'mcmp-theme-v1';
const VALID_THEMES = ['noir', 'analog', 'luma', 'flux'];

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const themeCookie = request.cookies.get(THEME_COOKIE)?.value;
  if (!themeCookie || !VALID_THEMES.includes(themeCookie)) {
    response.cookies.set(THEME_COOKIE, 'luma', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};

