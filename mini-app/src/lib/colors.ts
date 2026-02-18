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

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
