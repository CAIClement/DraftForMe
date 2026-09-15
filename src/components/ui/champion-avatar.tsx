"use client";

import { useState } from "react";

export function ChampionAvatar({
  name,
  imageUrl,
  size = 38
}: {
  name: string;
  imageUrl?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };

  if (!imageUrl || failed) {
    return (
      <span
        style={style}
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-surface-sunk text-xs font-semibold text-ink-faint"
      >
        {name.slice(0, 2)}
      </span>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={`Portrait de ${name}`}
      style={style}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-lg object-cover"
    />
  );
}
