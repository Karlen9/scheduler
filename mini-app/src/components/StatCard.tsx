import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  value: number;
  label: string;
  onClick?: () => void;
}

export function StatCard({ icon: Icon, iconColor, iconBg, value, label, onClick }: StatCardProps) {
  return (
    <button onClick={onClick} className="bg-card rounded-xl p-4 text-left">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-4 flex items-center justify-between pr-6">
        <div className={`h-8 w-8 rounded-full ${iconBg} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <p className="text-foreground text-2xl font-semibold">{value}</p>
      </div>
    </button>
  );
}
