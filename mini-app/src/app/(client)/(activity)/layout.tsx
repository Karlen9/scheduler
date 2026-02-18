import { ActivityBackButton } from '@/components/ActivityBackButton';

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ActivityBackButton href="/" />
      {children}
    </>
  );
}
