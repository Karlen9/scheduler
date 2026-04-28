import { adminApi } from './api/admin';
import { clientApi } from './api/client';

export { getPhotoUrl } from './api/shared';

export const api = {
  ...clientApi,
  admin: adminApi,
};
