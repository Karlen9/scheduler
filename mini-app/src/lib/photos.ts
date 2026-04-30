const TELEGRAM_PROFILE_PHOTO_PREFIX = 'telegram:';

export function isTelegramProfilePhotoUrl(photoUrl: string): boolean {
  if (!photoUrl.startsWith('http')) {
    return false;
  }

  try {
    const { hostname } = new URL(photoUrl);
    return (
      hostname === 't.me' ||
      hostname === 'telegram.org' ||
      hostname.endsWith('.telegram.org') ||
      hostname.endsWith('.telegram-cdn.org') ||
      hostname.endsWith('.cdn-telegram.org')
    );
  } catch {
    return false;
  }
}

export function isStoredTelegramProfilePhoto(photoUrl: string | undefined | null): boolean {
  return Boolean(
    photoUrl &&
    (photoUrl.startsWith(TELEGRAM_PROFILE_PHOTO_PREFIX) || isTelegramProfilePhotoUrl(photoUrl)),
  );
}

export function isCustomProfilePhoto(photoUrl: string | undefined | null): boolean {
  return Boolean(photoUrl && !isStoredTelegramProfilePhoto(photoUrl));
}

export function stripTelegramProfilePhotoPrefix(photoUrl: string): string {
  return photoUrl.startsWith(TELEGRAM_PROFILE_PHOTO_PREFIX)
    ? photoUrl.slice(TELEGRAM_PROFILE_PHOTO_PREFIX.length)
    : photoUrl;
}

export function getTelegramPhotoDisplayUrl(photoUrl: string, version: string): string {
  if (!isTelegramProfilePhotoUrl(photoUrl)) {
    return photoUrl;
  }

  try {
    const url = new URL(photoUrl);
    url.searchParams.set('v', version);
    return url.toString();
  } catch {
    return photoUrl;
  }
}
