const number = new Intl.NumberFormat("fr-FR");

/**
 * The numbers here exist to establish that real data sits behind the product,
 * so each one has to say exactly what it counts.
 *
 * `appearances` is the sum of `games` across the role's ranked champions. That
 * is NOT a number of matches: every game fields two midlaners, so the sum
 * counts champion appearances. It is also not divisible by two to recover
 * matches, because the ranked list is not exhaustive - the mid pick rates sum
 * to 188%, not 200%, so roughly an eighth of picks fall outside it. Labelling
 * it "parties" would be the one kind of error this bar exists to rule out.
 */
export function TrustBar({
  appearances,
  rankedChampions,
  patch,
  context
}: {
  appearances: number | null;
  rankedChampions: number;
  patch: string;
  context: string;
}) {
  return (
    <div className="mt-5 flex gap-7 rounded-xl bg-ink px-4 py-3.5 text-[#cdd6d3]">
      {appearances !== null && (
        <div>
          <span className="block text-[9.5px] uppercase tracking-widest text-[#7d8a86]">Apparitions analysées</span>
          <b className="text-base font-bold tracking-tight text-white">{number.format(appearances)}</b>
        </div>
      )}
      <div>
        <span className="block text-[9.5px] uppercase tracking-widest text-[#7d8a86]">Champions classés</span>
        <b className="text-base font-bold tracking-tight text-white">{rankedChampions}</b>
      </div>
      <div>
        <span className="block text-[9.5px] uppercase tracking-widest text-[#7d8a86]">Patch</span>
        <b className="text-base font-bold tracking-tight text-white">{patch}</b>
      </div>
      <div>
        <span className="block text-[9.5px] uppercase tracking-widest text-[#7d8a86]">Région / élo</span>
        <b className="text-base font-bold tracking-tight text-white">{context}</b>
      </div>
    </div>
  );
}
