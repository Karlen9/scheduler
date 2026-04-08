/***************************************************************************************************
 * Defines the avatar colors value used by the shared utility layer.
 *
 * Usage context:
 * - Reused by the shared utility layer to keep shared values centralized.
 ***************************************************************************************************/
const AVATAR_COLORS = [
  'bg-[#f87171] text-white',
  'bg-[#fb923c] text-white',
  'bg-[#fbbf24] text-white',
  'bg-[#34d399] text-white',
  'bg-[#22d3ee] text-white',
  'bg-[#60a5fa] text-white',
  'bg-[#818cf8] text-white',
  'bg-[#a78bfa] text-white',
  'bg-[#f472b6] text-white',
  'bg-[#fb7185] text-white',
];

/***************************************************************************************************
 * Returns avatar color.
 *
 * Parameters:
 * - name: Name used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as string.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function getAvatarColor(name: string): string {
  /***************************************************************************************************
   * Defines the hash value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export const scheduleStatusColors: Record<string, { color: string; border: string }> = {
  pending: {
    color: 'bg-status-pending-bg text-status-pending-text',
    border: 'border-status-pending-border',
  },
  active: {
    color: 'bg-status-confirmed-bg text-status-confirmed-text',
    border: 'border-status-confirmed-border',
  },
  declined: {
    color: 'bg-status-rejected-bg text-status-rejected-text',
    border: 'border-status-rejected-border',
  },
  cancelled: {
    color: 'bg-status-cancelled-bg text-status-cancelled-text',
    border: 'border-status-cancelled-border',
  },
};
