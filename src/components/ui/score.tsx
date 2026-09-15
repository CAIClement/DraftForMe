export function Score({ value }: { value: number }) {
  return (
    <span className="text-right">
      <b className="block text-3xl font-extrabold leading-none tracking-tight text-accent">
        {Math.round(value)}
      </b>
      <span className="text-[10px] font-semibold text-ink-faint">/ 100</span>
    </span>
  );
}
