import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

/***************************************************************************************************
 * Implements the middleware logic used by this module.
 *
 * Parameters:
 * - request: Request used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as NextResponse.
 *
 * Side effects:
 * - Keeps work scoped to the current module unless downstream helpers perform I/O.
 ***************************************************************************************************/
export function middleware(request: NextRequest): NextResponse {
  /***************************************************************************************************
   * Defines the lang value used by the current module.
   *
   * Usage context:
   * - Reused by the current module to keep shared values centralized.
   ***************************************************************************************************/
  const lang = request.nextUrl.searchParams.get('lang');

  if (lang && ['ru', 'en'].includes(lang)) {
    /***************************************************************************************************
     * Defines the url value used by the current module.
     *
     * Usage context:
     * - Reused by the current module to keep shared values centralized.
     ***************************************************************************************************/
    const url = new URL(request.url);
    url.searchParams.delete('lang');
    /***************************************************************************************************
     * Defines the response value used by the current module.
     *
     * Usage context:
     * - Reused by the current module to keep shared values centralized.
     ***************************************************************************************************/
    const response = NextResponse.redirect(url);
    response.cookies.set('locale', lang, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  return NextResponse.next();
}

/***************************************************************************************************
 * Defines configuration reused by the current module.
 *
 * Usage context:
 * - Reused by the current module to keep shared values centralized.
 ***************************************************************************************************/
export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};
