import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get('lang');

  if (lang && ['ru', 'en'].includes(lang)) {
    const url = new URL(request.url);
    url.searchParams.delete('lang');
    const response = NextResponse.redirect(url);
    response.cookies.set('locale', lang, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};
