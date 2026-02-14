import { type LucideIcon } from "lucide-react";

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
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center justify-between pr-6 mt-4">
        <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
      </div>
    </button>
  );
}
