const COLUMNS = [
  {
    title: "Ce qu'on regarde",
    body: "Trois signaux : la force du champion dans le patch, sa lecture du matchup, et votre aisance dessus. Le poids de chacun est affiché."
  },
  {
    title: "Trois options, pas une",
    body: "Le pick principal, puis deux alternatives. À vous de choisir votre niveau de risque."
  },
  {
    title: "Pour qui",
    body: "Si vous jouez quelques games par semaine et que la draft vous perd, c'est fait pour vous."
  }
];

export function Explainer() {
  return (
    <section id="comment-ca-marche" className="mt-7 border-t border-rule pt-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h4 className="mb-1.5 text-sm font-bold tracking-tight">{column.title}</h4>
            <p className="text-xs leading-relaxed text-ink-muted">{column.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
