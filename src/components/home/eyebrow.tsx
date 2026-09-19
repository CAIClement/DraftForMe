import type { ReactNode } from "react";

export function Eyebrow({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "inverse" }) {
  return (
    <span
      className={`block text-xs font-semibold uppercase tracking-[0.12em] ${
        tone === "default" ? "text-accent" : "text-accent-pale"
      }`}
    >
      {children}
    </span>
  );
}

/** Section heading: a strong first line and a quieter second one. */
export function SectionTitle({
  id,
  lead,
  follow,
  tone = "default"
}: {
  id?: string;
  lead: string;
  follow?: string;
  tone?: "default" | "inverse";
}) {
  return (
    <h2
      id={id}
      className="mb-4 mt-3 max-w-[20ch] text-[clamp(1.875rem,3.4vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.03em]"
    >
      {lead}
      {follow && (
        <span className={`block ${tone === "default" ? "text-ink-faint" : "text-stone-400"}`}>{follow}</span>
      )}
    </h2>
  );
}
