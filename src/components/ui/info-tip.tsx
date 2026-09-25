"use client";

import { useEffect, useId, useRef, useState } from "react";

const POPOVER_WIDTH = 240;

/**
 * An "i" that explains a label. Opened by click rather than hover so it works
 * on touch screens and from the keyboard; closed by a second click, Escape, a
 * click elsewhere, focus moving elsewhere, or a scroll/resize. Because those
 * close it, opening another one (by click or by tabbing to it) closes this
 * one: at most one is open at a time without shared state.
 *
 * The popover is `fixed`-positioned from the button's own bounding rect
 * (computed when it opens) rather than `absolute`, so it escapes a scrolling
 * ancestor such as the comparison table's `overflow-x-auto` wrapper instead
 * of being clipped by it.
 */
export function InfoTip({ label, text, align = "start" }: { label: string; text: string; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function close() {
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onMouseDown(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }

    function onFocusIn(event: FocusEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("focusin", onFocusIn);
    // A fixed popover doesn't follow its button, so any scroll or resize
    // would leave it floating over the wrong spot; closing it is simplest.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function toggle(event: React.MouseEvent) {
    // Rows of the comparison table are clickable; asking what a column
    // means must not also select a champion.
    event.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const rawLeft = align === "end" ? rect.right - POPOVER_WIDTH : rect.left;
      const left = Math.min(Math.max(rawLeft, 8), window.innerWidth - POPOVER_WIDTH - 8);
      setPosition({ top: rect.bottom + 6, left });
    }
    setOpen((current) => !current);
  }

  return (
    <span ref={root} className="relative inline-flex normal-case tracking-normal">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Qu'est-ce que ${label} ?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={toggle}
        className="grid h-4 w-4 place-items-center rounded-full border border-rule text-[9px] font-bold text-ink-faint hover:border-accent hover:text-accent"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          style={{ top: position.top, left: position.left }}
          className="fixed z-20 w-60 rounded-lg border border-rule bg-surface p-2.5 text-left text-[11px] font-normal leading-relaxed text-ink-muted shadow-[0_8px_24px_var(--shadow)]"
        >
          {text}
        </span>
      )}
    </span>
  );
}
