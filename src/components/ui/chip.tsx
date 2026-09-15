import { ChampionAvatar } from "./champion-avatar";

export function Chip({
  name,
  imageUrl,
  onRemove
}: {
  name: string;
  imageUrl?: string;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-rule bg-surface py-1 pl-1 pr-3 text-sm font-semibold">
      <ChampionAvatar name={name} imageUrl={imageUrl} size={22} />
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Retirer ${name}`}
          className="text-ink-faint hover:text-ink"
        >
          ×
        </button>
      )}
    </span>
  );
}
