export function TimeSlotLegend({
  availableLabel,
  occupiedLabel,
}: {
  availableLabel: string;
  occupiedLabel: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-4">
      <div className="flex items-center gap-1.5">
        <span className="bg-brand h-2.5 w-2.5 rounded-full" />
        <span className="text-muted-foreground text-xs">{availableLabel}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="bg-error h-2.5 w-2.5 rounded-full" />
        <span className="text-muted-foreground text-xs">{occupiedLabel}</span>
      </div>
    </div>
  );
}
