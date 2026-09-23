// Riot's developer policy requires this exact text, in English, somewhere
// readily visible. Do not translate or paraphrase it.
export const RIOT_DISCLAIMER =
  "DraftForMe isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";

export function RiotDisclaimer({ className }: { className?: string }) {
  return (
    <p lang="en" className={className}>
      {RIOT_DISCLAIMER}
    </p>
  );
}
