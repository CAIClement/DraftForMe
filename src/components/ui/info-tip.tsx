"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * An "i" that explains a label. Opened by click rather than hover so it works
 * on touch screens and from the keyboard; closed by a second click, Escape, or
 * a click anywhere else. Because a click elsewhere closes it, opening another
 * one closes this one: at most one is open at a time without shared state.
 */
export function InfoTip({ label, text, align = "start" }: { label: string; text: string; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onMouseDown(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  return (
    <span ref={root} className="relative inline-flex normal-case tracking-normal">
      <button
        type="button"
        aria-label={`Qu'est-ce que ${label} ?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(event) => {
          // Rows of the comparison table are clickable; asking what a column
          // means must not also select a champion.
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="grid h-4 w-4 place-items-center rounded-full border border-rule text-[9px] font-bold text-ink-faint hover:border-accent hover:text-accent"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={`absolute top-full z-20 mt-1.5 w-60 rounded-lg border border-rule bg-surface p-2.5 text-left text-[11px] font-normal leading-relaxed text-ink-muted shadow-[0_8px_24px_var(--shadow)] ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
