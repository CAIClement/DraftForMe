const number = new Intl.NumberFormat("fr-FR");
const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

/**
 * The numbers here exist to establish that real data sits behind the product,
 * so each one has to say exactly what it counts.
 *
 * `appearances` is the sum of `games` across every indexed (champion, role)
 * pair. That is NOT a number of matches: every game fields ten champions, so
 * the sum counts champion appearances. It is also not divisible by ten to
 * recover matches, because the ranked list is not exhaustive - the mid pick
 * rates sum to 188%, not 200%, so about 6% of picks fall outside it. Labelling
 * it "parties" would be the one kind of error this bar exists to rule out.
 *
 * Every tile is guarded: a fact we do not have is omitted, never rendered as a
 * zero, a dash or a plausible-looking constant.
 */
export function TrustBar({
  appearances,
  rankedChampions,
  patch,
  context,
  updatedAt
}: {
  appearances: number | null;
  rankedChampions: number | null;
  patch: string | null;
  context: string;
  updatedAt: string | null;
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
      {appearances !== null && <Tile label="Apparitions analysées" value={number.format(appearances)} />}
      {rankedChampions !== null && <Tile label="Paires champion / rôle" value={String(rankedChampions)} />}
      {patch !== null && <Tile label="Patch" value={patch} />}
      <Tile label="Région / élo" value={context} />
      {updatedAt !== null && <Tile label="À jour au" value={date.format(new Date(updatedAt))} />}
    </dl>
  );
}

// Laid out for the landing page's dark data band: the value inherits the text
// colour of the panel it sits in.
function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="mb-1 text-xs text-stone-400">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums tracking-tight text-white">{value}</dd>
    </div>
  );
}
