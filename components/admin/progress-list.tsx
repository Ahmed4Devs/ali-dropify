function ProgressList({
  items,
  formatValue,
  emptyMessage,
}: {
  items: { label: string; value: number; detail: string }[];
  formatValue: (value: number) => string;
  emptyMessage: string;
}) {
  const maximum = Math.max(...items.map((item) => item.value), 1);
  if (!items.length) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium">{item.label}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatValue(item.value)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, (item.value / maximum) * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

export { ProgressList };
