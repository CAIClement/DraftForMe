export const ROLES = [
  { id: "top", label: "Top" },
  { id: "jungle", label: "Jungle" },
  { id: "mid", label: "Mid" },
  { id: "adc", label: "ADC" },
  { id: "support", label: "Support" }
] as const;

export function RoleSelector({ role, onChange }: { role: string; onChange: (role: string) => void }) {
  return (
    <div className="flex gap-1.5">
      {ROLES.map((entry) => (
        <button
          key={entry.id}
          type="button"
          aria-pressed={entry.id === role}
          onClick={() => onChange(entry.id)}
          className={
            entry.id === role
              ? "flex-1 rounded-lg border border-accent bg-accent py-2 text-xs font-semibold text-on-accent"
              : "flex-1 rounded-lg border border-rule py-2 text-xs font-semibold text-ink-muted hover:border-ink-faint"
          }
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
