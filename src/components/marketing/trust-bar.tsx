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
    <div className="mt-5 flex gap-7 rounded-xl bg-ink px-4 py-3.5 text-[#cdd6d3]">
      {appearances !== null && (
        <div>
          <span className="block text-[9.5px] uppercase tracking-widest text-[#7d8a86]">Apparitions analysées</span>
          <b className="text-base font-bold tracking-tight text-white">{number.format(appearances)}</b>
        </div>
      )}
      {rankedChampions !== null && (
        <div>
          <span className="block text-[9.5px] uppercase tracking-widest text-[#7d8a86]">Paires champion / rôle</span>
          <b className="text-base font-bold tracking-tight text-white">{rankedChampions}</b>
        </div>
      )}
      {patch !== null && (
        <div>
          <span className="block text-[9.5px] uppercase tracking-widest text-[#7d8a86]">Patch</span>
          <b className="text-base font-bold tracking-tight text-white">{patch}</b>
        </div>
      )}
      <div>
        <span className="block text-[9.5px] uppercase tracking-widest text-[#7d8a86]">Région / élo</span>
        <b className="text-base font-bold tracking-tight text-white">{context}</b>
      </div>
      {updatedAt !== null && (
        <div>
          <span className="block text-[9.5px] uppercase tracking-widest text-[#7d8a86]">À jour au</span>
          <b className="text-base font-bold tracking-tight text-white">{date.format(new Date(updatedAt))}</b>
        </div>
      )}
    </div>
  );
}
