# DraftForMe Win Model Design

Date: 2026-09-17

## Summary

Train a win-probability model on the ranked EUW matches collected by project 1, and decide, on matches it has never seen, whether it predicts the winner of a draft better than three references: the rule engine the site runs today, plain champion win rates learned from the training matches, and public statistics alone.

This is project 2 of 3 (see `2026-09-17-draftforme-match-collection-design.md`). It is the decision point: if the model does not beat all three references, work stops here and the website is never touched. It produces a model file, a validation report and a one-time test report. It changes nothing on the site.

## Decisions

| Question | Decision |
|---|---|
| What does "better" mean | Predicting the winner of a held-out match from its draft |
| References to beat | The site's rule engine, a champion win-rate baseline learned from the training matches, **and** public statistics alone |
| Decision rule | Lower test log loss than each reference, with the 95 % bootstrap interval of the difference above zero |
| Partial drafts | Supported from training onwards; the decision is taken on full drafts |
| Models | Regularised logistic regression in stages (main candidate) and gradient boosting (comparison), both scikit-learn |
| Champion priors | Every model reads the public win rates the rule engine uses, so the question becomes what learning from real drafts adds on top of them |

### Why these choices

- **Winner prediction** is directly measurable on every held-out match. Recommendation-style checks were set aside: recovering the champion a winner picked rewards popular champions rather than winning ones, and the win rate of matches that "followed" a recommendation is confounded by player skill and needs far more matches.
- **Three references.** Beating only the site engine would mostly show that its OP.GG statistics are from patch 16.3. The win-rate baseline, fitted on the same training matches, makes sure the model adds something beyond fresher numbers. The third, public statistics alone, closes a fairness gap the other two do not: the model's own prior falls back to a champion's mean log-odds across the roles the statistics do rank it in when it is played off-role, while the site engine's fallback is a flat neutral 55 regardless of role. A win over the engine could then come from that better fallback rather than from anything learned on drafts. Comparing against a priors-only model that uses the exact same fallback removes that confound: if the model cannot beat it, project 3 could simply ship calibrated public statistics and skip training on drafts at all.
- **A significance interval, not a raw comparison.** Draft-only winner prediction is hard; realistic accuracies sit around 52 to 56 %, so the gaps being measured are of the order of a percent and could be noise.
- **Logistic regression first.** It is robust with about 30,000 matches for 170 champions across 5 roles, well calibrated (the criterion is log loss), explainable per champion and matchup, and its weights can be exported as JSON and evaluated in a few lines of TypeScript. Project 3 would need no model server.

## Scope

- **Input:** the SQLite database produced by project 1, opened read-only.
- **Output:** a chosen model, a validation report, a test report, and for logistic regression a JSON export of its weights.

### Non-goals

- Any change to the website, Supabase or the rule engine (project 3).
- Hosting or serving the model.
- Player-level features (mastery, recent form): the dataset does not collect them.
- Hyperparameter searches beyond the small grids described below.

## Data and Split

`data.py` loads the `matches` table and, for each match, the `seed_puuid` from `match_ids`. It refuses:

- a missing database;
- a `--db` that is not a readable collection database (a wrong file, or a SQLite file without the schema);
- a database holding no matches at all;
- a database holding more than one patch;
- fewer than 1,000 matches.

**Split: 70 % training, 15 % validation, 15 % test.**

- **Grouped by seed player.** Every match found through the same seed player lands in the same set. A single seed player can contribute dozens of matches (64 in the first minutes of the real collection); spread across sets, they would let the model be tested on near-duplicates of what it trained on.
- **Stratified by `seed_tier`.** Each set keeps the Iron-to-Challenger mix.
- **Seeded and recorded.** The split uses a fixed seed, and the match ids of each set are written to a file, so it can be reproduced and audited.

**The test set is used once.** Validation drives every choice (logistic stage, regularisation, boosting settings). The test command evaluates once and records its report; see Outputs.

**Validity.** Results hold for patch 16.18 and for the sampling of project 1. The elo of a match is the seed player's tier, an approximation (see the collection spec).

## Encoding

### Signed champion encoding

One feature per champion and role, taking **+1** when that champion plays that role on the blue side, **-1** on the red side, and **0** when absent or unknown.

- Swapping the two teams flips the sign of every feature, so the model treats both sides alike.
- The blue-side advantage is carried by the intercept alone.
- A hidden pick is simply 0, which is what makes partial drafts possible.

### Champion priors from public statistics

Every model also receives the public win rate of each drafted champion, read from the same `champion_stats` rows in `supabase/seed.sql` that the rule engine uses. Those rates come from millions of games, so they carry far more evidence about a champion's strength than 30,000 matches can hold.

Per draft this is six numbers, all antisymmetric like the rest of the encoding:

- one per role: the log-odds of the blue champion's public win rate minus the log-odds of the red one's;
- their total.

A champion the statistics do not rank in the role it was played falls back to its mean across the roles they do rank it in, then to neutral (log-odds 0). A hidden pick contributes 0.

**Why.** A first real run on 11,124 collected matches showed the rule engine beating the learned model (test log loss 0.6881 against 0.6910, AUC 0.5465 against 0.5206), while the same win rates recomputed from the collected matches were clearly worse (0.7088). The gap was not the rules: it was the evidence behind them. Handing the model those public rates makes the question a fair one, and changes what a win means: not "do public statistics beat the rules", but **"does learning from real drafts add anything on top of public statistics"**. The references are unchanged, so the comparison still answers the project's original question too.

### Logistic regression stages

Each stage adds features to the previous one, and every stage includes the champion priors above:

0. **Priors only:** no champion columns at all, so this stage measures what the public statistics alone are worth once calibrated. It is the floor every other stage must beat.
1. **Champions:** the signed champion-by-role features.
2. **Lane matchups:** one feature per pair of champions facing each other in the same role, +1 when the pair's first champion (by champion id) is blue and -1 when it is red. Kept only for pairs seen at least 5 times in training.
3. **Synergies:** one feature per same-team pair for bottom + support and jungle + mid, signed by side. Same threshold of 5.
4. **Elo:** champion-by-role features crossed with a tier group: Iron-Silver, Gold-Emerald, Diamond and above.

A matchup or synergy feature is 0 when either of its champions is hidden.

### Partial drafts

Training uses every training match once as a full draft, plus 2 copies with 1 to 9 picks hidden (fixed seed). A draft in progress always hides a suffix of the real pick order B, R, R, B, B, R, R, B, B, R, so the number hidden on each side follows from the total hidden; only which slots inside each side are hidden is random. The partial-draft reports at 3, 5 and 8 known picks (see Metrics and Decision) therefore describe states a real draft can reach. Selection and the decision use full drafts; results on partial drafts are reported for information.

**Training weights.** In both models below, a match's two masked copies each weigh half, so every match and its copies carry equal total weight and full drafts are half the training objective instead of a third. Measured on a synthetic world with a planted synergy, this improved the full-draft validation log loss by about 0.0017 over weighting every row equally.

## Models

### A. Logistic regression (main candidate)

`LogisticRegression` with L2 regularisation. For each stage, the regularisation strength C is chosen on validation log loss from 0.0003, 0.001, 0.003, 0.01, 0.03, 0.1, 0.3 and 1.0; the best stage is then chosen the same way. The grid reaches below 0.003 because the first real run picked that value, the lowest then available, at every stage.

### B. Gradient boosting (comparison)

`HistGradientBoostingClassifier` on:

- the stage 1 features, champion priors included;
- per team, the mean smoothed win rate of its champions;
- per role, the smoothed win-rate difference of the lane matchup.

The aggregated win rates are computed **out of fold** (5 folds over training) and smoothed towards 50 %, so a match never sees its own outcome. Settings (learning rate, maximum leaf nodes, L2) come from a small grid on validation. Training includes the same masked copies, weighted as described above.

The decision applies to the better of A and B on validation. If B is chosen, project 3 must first settle how to run it (a model server or a conversion), since only A runs inside the site as it is.

## References

The first two references do not produce a probability, so each one's team score is turned into a probability with a **two-parameter logistic calibration** (slope and intercept) fitted on training. This is what makes log loss comparable. The third is itself a logistic model and needs no calibration.

### 1. The site's rule engine

A Python port of `src/lib/recommendation/engine.ts` and `counter.ts`, restricted to what a match can supply:

- **Data:** read from `supabase/seed.sql`. That covers `champions` (for the `riot_key` to champion id mapping), `champion_stats` (OP.GG, EUW, Emerald+, patch 16.3) and `counter_relations`.
- **Meta score:** as on the site, a champion's rank is its position in its role ordered by win rate, and the score is `100 - (rank - 1) / total * 90`. Champions tied on win rate are ranked alphabetically by slug, to keep the port reproducible; the site's own order on ties is undefined, so a tied champion's meta score can differ from the site's by about one rank step.
- **Counter score:** `scoreCounter` against the enemy picks, using the relations of the champion's role.
- **Player score:** the engine's neutral value of 5, since there is no pool.
- **Weights:** `computeWeights` exactly as the engine does with no pool: meta 0.57, player 0.03, counter 0.40 once an enemy pick is known; meta 0.95 and player 0.05 otherwise.
- **Team score:** the mean of its known champions' total scores.
- **Missing champions:** a champion absent from the 16.3 statistics gets a neutral meta score of 55 (the midpoint of the scale). Their count is reported.

Tests replay the cases of `engine.test.ts` and `counter.test.ts` against the port and expect the same scores.

### 2. Champion win rates

The win rate of each champion in each role over the training matches, smoothed towards 50 % with a prior of 20 games. A team's score is the sum of the log-odds of its known champions' win rates.

### 3. Public statistics alone

A stage-0 logistic model (`LogisticDraftModel(0, c, seed, prior)`): no champion columns, only the same six champion-prior features every other model gets, with the same off-role fallback. Its C is chosen on validation log loss from `LOGISTIC_C_GRID`, the same way a candidate is chosen, and it is fitted on the same training matches as everything else. This is the fairness reference: the model's prior falls back to a champion's mean log-odds across the roles the statistics do rank it in when it is played off-role, while the site engine's fallback is a flat neutral 55 regardless of role. Beating the engine could therefore come from that better fallback alone rather than from anything learned on drafts; beating this reference instead rules that out, since it uses the identical fallback.

## Metrics and Decision

On the test set, for the chosen model and all three references:

- log loss, AUC and accuracy (a predicted probability of exactly 0.5 counts as half a correct guess);
- for each reference, the log-loss difference (reference minus model) with its **95 % interval from a paired bootstrap of 10,000 resamples** over test matches, fixed seed.

**The deciding interval.** Matches are resampled by whole seed player (a cluster bootstrap), not individually: a seed player contributes many matches that share a tier and a champion, so resampling them independently understates how much the gap over a reference varies. The report carries both `comparisons` (grouped by seed player, which decides) and `comparisons_by_match` (matches resampled independently, kept for information only). The bootstrap uses 10,000 resamples rather than 2,000: at 2,000 the noise on the deciding endpoint was about 3 % of the interval's half-width.

**The model beats the references when all three grouped intervals lie entirely above zero.** AUC and accuracy are reported but do not decide.

Reported for information only, never deciding:

- the same metrics per tier group;
- the same metrics on partial drafts (3, 5 and 8 known picks);
- for each comparison, a 0.5 % trimmed difference alongside the mean one, and, for each summary, the share of its total log loss carried by the 10 worst matches, so a reader can see when a verdict rests on a handful of matches;
- a calibration table, using quantile bins rather than equal-width ones, because draft probabilities sit in a narrow band around 0.5 and equal-width bins would leave most of them empty;
- the largest weights of the logistic regression, as a sanity check.

## Architecture

A package `ml/win/`, following `ml/collect/`: constants in `ml/paths.py`, tests flat in `test/ml/`.

| Module | Responsibility |
|---|---|
| `data.py` | Read-only loading, refusals, grouped and stratified split, split file |
| `encoding.py` | Signed encoding, matchups, synergies, elo crossing, masking |
| `baselines.py` | Engine port reading `seed.sql`, champion priors from the same public win rates, win-rate baseline, logistic calibration |
| `models.py` | Logistic stages with their grids, gradient boosting with its grid |
| `metrics.py` | Log loss, AUC, accuracy, paired bootstrap |
| `select.py` | Command: trains everything, chooses on validation, saves the model, the priors-only reference and the validation report |
| `test.py` | Command: evaluates the chosen model and all three references on the test set, once |

Commands:

```
python -m ml.win.select --db <path to matches.sqlite> [--seed 42] [--artifacts <dir>] [--seed-sql <path>]
python -m ml.win.test [--artifacts <dir>] [--seed-sql <path>]
```

`scikit-learn`, `numpy`, `pandas` and `joblib` are already in `ml/requirements.txt`. `scipy` (sparse matrices, the trimmed mean) was already installed transitively through scikit-learn; it is now declared in `ml/requirements.txt` in its own right.

## Outputs

In `ml/artifacts/win/`, ignored by git:

- `split.json`: the match ids of each set, the seed, the patch, and the database path that `ml.win.test` reads back.
- `model.joblib`: the chosen model under `"model"`, plus the fitted priors-only reference model under `"priors_reference"` so `ml.win.test` can predict with it without rebuilding it; `model_weights.json` when logistic regression is chosen.
- `model_weights.json`: alongside the feature weights, a `prior_table` listing, for every champion the prior knows, the log-odds it uses in each role (its off-role fallback already applied) — enough for project 3 to recompute the champion-prior features by lookups alone, with no `ChampionPrior` and no `seed.sql`.
- `validation_report.json`: every stage, the boosting model and all three references on validation, and the sizes of the training, validation and test splits.
- `test_report.json`: the test report, with its date, the seed, the number of training matches, and the decision.

**The test lock.** If `test_report.json` exists, `ml.win.test` prints the recorded result and recomputes nothing, and `ml.win.select` refuses to choose a new model, since choosing after seeing the test would bias it. The lock is a convention, not something the code can enforce: deleting only `test_report.json` lets `ml.win.select` choose a new model and `ml.win.test` evaluate the same test set again, after its verdict has already been seen. Starting over means deleting the whole `ml/artifacts/win/` directory deliberately, and a second verdict on the same matches is worth less than the first whatever the files say.

**Corrupt artifacts.** A `test_report.json` that cannot be parsed is reported and exits 3, naming the file, rather than crashing. A `model.joblib` that cannot be loaded (or was produced by an incompatible version) is reported and exits 5, telling the person to rerun `ml.win.select`. A `model.joblib` saved before the priors-only reference existed (missing the `"priors_reference"` key) gets the same treatment: reported and exits 5, asking to rerun `ml.win.select`, rather than a `KeyError`. A well-formed `model.joblib` of the wrong shape otherwise (for instance holding something other than the expected dict, or missing `"model"` itself) is left to raise, since that is a real defect and not a symptom of a corrupt file.

The outcome is then copied by hand into a `Results` section of this spec.

## Error Handling

Command output is in French and never contains characters outside cp1252. Each expected failure ends with a message and an explicit exit code, never a traceback:

| Code | Situation |
|---|---|
| 0 | Finished |
| 2 | Invalid arguments, a missing database, or, for `ml.win.select`, an `--artifacts` path that cannot be made into a directory |
| 3 | The database holds more than one patch or fewer than 1,000 matches, or is not a readable collection database, or holds no matches at all, or, for `ml.win.test`, no longer holds the recorded patch or every match of the split, or `test_report.json` exists but cannot be parsed |
| 4 | `seed.sql` is missing or cannot be parsed |
| 5 | `ml.win.test` run before `ml.win.select` has produced a model, or `ml.win.select` run after the test set was evaluated, or `model.joblib` cannot be loaded, or `model.joblib` was saved before the priors-only reference existed |

A champion present at test time but never seen in training contributes 0; their count is reported.

## Testing

Unit tests in `test/ml/`, without network, on small synthetic datasets:

- **Split:** no seed player appears in two sets; per-tier proportions hold, even when players contribute very different numbers of matches.
- **Data refusals:** a missing database, a file that is not a collection database, a database with no matches at all, one with too few matches, and one with more than one patch each give their own message and exit code.
- **Encoding:** swapping teams negates every feature; a hidden pick zeroes its matchup and synergy features; hiding picks always hides a suffix of the real pick order.
- **Engine port:** the cases of `engine.test.ts` and `counter.test.ts` give the same scores; ties in win rate are broken by slug.
- **Metrics:** accuracy does not credit a tied prediction; the calibration table's quantile bins hold similar numbers of matches instead of leaving most of them empty.
- **Bootstrap:** the interval is correct on a case with a known answer; grouping by seed player widens the interval when the gap over a reference varies by player, and weights groups by their size.
- **Training weights:** a match's masked copies carry half weight each.
- **Champion priors:** swapping teams negates them; a hidden pick contributes 0; a champion the statistics do not rank in the role it was played falls back to its mean across ranked roles, then to neutral; on a synthetic world where only the public rates decide the outcome, a logistic model with the priors beats the same model without them, and the boosting model likewise (verified by mutation: dropping the prior from `BoostingDraftModel._matrix` makes that test fail); `win_rate_log_odds` stays finite at an exact 0 % or 100 % win rate; `ChampionPrior.features` is computed once per distinct input and returns a copy the caller cannot use to corrupt the cache.
- **Priors-only reference:** an end-to-end run of both commands shows all three references in the validation and test reports, and the verdict is computed from all three; a `model.joblib` saved before this reference existed is reported and exits 5 rather than raising `KeyError`; when the chosen model is itself a stage-0 model built the same way, its comparison with this reference is exactly zero and the verdict is negative without crashing.
- **Weights export:** `model_weights.json`'s `prior_table` lets a probability be recomputed by lookups alone (feature weights, intercept, and the table), matching `predict()` on a few drafts including a partially hidden one.
- **End to end:** on synthetic matches with a planted synergy, stage 3 recovers it and beats the win-rate baseline.
- **Test lock:** a second run of `ml.win.test` recomputes nothing, and `ml.win.select` refuses to run once the test has been evaluated.
- **Corrupt artifacts:** a `test_report.json` that cannot be parsed and a `model.joblib` that cannot be loaded are each reported with a message instead of crashing; a well-formed model file of the wrong shape still raises.

## Follow-Up Work

- **If the model wins:** project 3, integration on the site with the rule engine as fallback, still gated on Riot's answer about using a model trained on API data in the public product.
- **If it does not:** record why in `Results` (no signal in drafts alone, not enough matches, or a baseline already capturing it), and decide whether more matches or player-level data would change the answer before any further work.
