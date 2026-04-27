const testClientBasePath = '/test/client';
const testAdminBasePath = '/test/admin';
const previewClientBasePath = '/preview/client';

function getBrowserPathname(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.location.pathname;
}

function getEffectivePathname(pathname?: string | null): string | null {
  if (pathname && (isTestPathname(pathname) || isPreviewPathname(pathname))) {
    return pathname;
  }

  return getBrowserPathname() ?? pathname ?? null;
}

function splitHref(href: string): { path: string; suffix: string } {
  const queryIndex = href.indexOf('?');
  const hashIndex = href.indexOf('#');
  const suffixIndex =
    queryIndex === -1 ? hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);

  if (suffixIndex === -1) {
    return { path: href, suffix: '' };
  }

  return {
    path: href.slice(0, suffixIndex),
    suffix: href.slice(suffixIndex),
  };
}

function isClientPath(path: string): boolean {
  return (
    path === '/' ||
    path === '/book' ||
    path.startsWith('/book/') ||
    path === '/bookings' ||
    path.startsWith('/bookings/') ||
    path === '/recurring' ||
    path.startsWith('/recurring/') ||
    path === '/services' ||
    path.startsWith('/services/') ||
    path === '/profile' ||
    path.startsWith('/profile/')
  );
}

export function isTestPathname(pathname?: string | null): boolean {
  return (
    pathname === testClientBasePath ||
    pathname?.startsWith(`${testClientBasePath}/`) ||
    pathname === testAdminBasePath ||
    pathname?.startsWith(`${testAdminBasePath}/`) ||
    false
  );
}

export function isPreviewPathname(pathname?: string | null): boolean {
  return (
    pathname === previewClientBasePath || pathname?.startsWith(`${previewClientBasePath}/`) || false
  );
}

export function isTestRoute(pathname?: string | null): boolean {
  return isTestPathname(getEffectivePathname(pathname));
}

export function isPreviewRoute(pathname?: string | null): boolean {
  return isPreviewPathname(getEffectivePathname(pathname));
}

export function getDataScope(): string {
  const pathname = getEffectivePathname();

  if (pathname === testAdminBasePath || pathname?.startsWith(`${testAdminBasePath}/`)) {
    return 'test-admin';
  }

  if (pathname === testClientBasePath || pathname?.startsWith(`${testClientBasePath}/`)) {
    return 'test-client';
  }

  if (pathname === previewClientBasePath || pathname?.startsWith(`${previewClientBasePath}/`)) {
    return 'preview-client';
  }

  return 'live';
}

export function isRootTabHref(href: string): boolean {
  return (
    href === '/' ||
    href === '/admin' ||
    href === testClientBasePath ||
    href === testAdminBasePath ||
    href === previewClientBasePath
  );
}

export function resolveTestAwareHref(pathname: string | null, href: string): string {
  if (
    !href.startsWith('/') ||
    href.startsWith('//') ||
    href.startsWith('/test/') ||
    href.startsWith('/preview/')
  ) {
    return href;
  }

  const effectivePathname = getEffectivePathname(pathname);
  if (!isTestPathname(effectivePathname) && !isPreviewPathname(effectivePathname)) {
    return href;
  }

  const { path, suffix } = splitHref(href);

  if (
    effectivePathname === testAdminBasePath ||
    effectivePathname?.startsWith(`${testAdminBasePath}/`)
  ) {
    if (path === '/admin') {
      return `${testAdminBasePath}${suffix}`;
    }
    if (path.startsWith('/admin/')) {
      return `${testAdminBasePath}${path.slice('/admin'.length)}${suffix}`;
    }
    if (isClientPath(path)) {
      return `${testClientBasePath}${path === '/' ? '' : path}${suffix}`;
    }
  }

  if (
    effectivePathname === testClientBasePath ||
    effectivePathname?.startsWith(`${testClientBasePath}/`)
  ) {
    if (path === '/admin') {
      return `${testAdminBasePath}${suffix}`;
    }
    if (path.startsWith('/admin/')) {
      return `${testAdminBasePath}${path.slice('/admin'.length)}${suffix}`;
    }
    if (isClientPath(path)) {
      return `${testClientBasePath}${path === '/' ? '' : path}${suffix}`;
    }
  }

  if (
    effectivePathname === previewClientBasePath ||
    effectivePathname?.startsWith(`${previewClientBasePath}/`)
  ) {
    if (isClientPath(path)) {
      return `${previewClientBasePath}${path === '/' ? '' : path}${suffix}`;
    }
  }

  return href;
}
