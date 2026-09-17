# DraftForMe Win Model Design

Date: 2026-09-17

## Summary

Train a win-probability model on the ranked EUW matches collected by project 1, and decide, on matches it has never seen, whether it predicts the winner of a draft better than two references: the rule engine the site runs today, and plain champion win rates.

This is project 2 of 3 (see `2026-09-17-draftforme-match-collection-design.md`). It is the decision point: if the model does not beat both references, work stops here and the website is never touched. It produces a model file, a validation report and a one-time test report. It changes nothing on the site.

## Decisions

| Question | Decision |
|---|---|
| What does "better" mean | Predicting the winner of a held-out match from its draft |
| References to beat | The site's rule engine **and** a champion win-rate baseline |
| Decision rule | Lower test log loss than each reference, with the 95 % bootstrap interval of the difference above zero |
| Partial drafts | Supported from training onwards; the decision is taken on full drafts |
| Models | Regularised logistic regression in stages (main candidate) and gradient boosting (comparison), both scikit-learn |

### Why these choices

- **Winner prediction** is directly measurable on every held-out match. Recommendation-style checks were set aside: recovering the champion a winner picked rewards popular champions rather than winning ones, and the win rate of matches that "followed" a recommendation is confounded by player skill and needs far more matches.
- **Two references.** Beating only the site engine would mostly show that its OP.GG statistics are from patch 16.3. The win-rate baseline, fitted on the same training matches, makes sure the model adds something beyond fresher numbers.
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

### Logistic regression stages

Each stage adds features to the previous one:

1. **Champions:** the signed champion-by-role features.
2. **Lane matchups:** one feature per pair of champions facing each other in the same role, +1 when the pair's first champion (by champion id) is blue and -1 when it is red. Kept only for pairs seen at least 5 times in training.
3. **Synergies:** one feature per same-team pair for bottom + support and jungle + mid, signed by side. Same threshold of 5.
4. **Elo:** champion-by-role features crossed with a tier group: Iron-Silver, Gold-Emerald, Diamond and above.

A matchup or synergy feature is 0 when either of its champions is hidden.

### Partial drafts

Training uses every training match once as a full draft, plus 2 copies with 1 to 9 picks hidden at random (fixed seed). Selection and the decision use full drafts; results on partial drafts are reported for information.

## Models

### A. Logistic regression (main candidate)

`LogisticRegression` with L2 regularisation. For each stage, the regularisation strength is chosen from a small grid on validation log loss; the best stage is then chosen the same way.

### B. Gradient boosting (comparison)

`HistGradientBoostingClassifier` on:

- the stage 1 features;
- per team, the mean smoothed win rate of its champions;
- per role, the smoothed win-rate difference of the lane matchup.

The aggregated win rates are computed **out of fold** (5 folds over training) and smoothed towards 50 %, so a match never sees its own outcome. Settings (learning rate, maximum leaf nodes, L2) come from a small grid on validation. Training includes the same masked copies.

The decision applies to the better of A and B on validation. If B is chosen, project 3 must first settle how to run it (a model server or a conversion), since only A runs inside the site as it is.

## References

Neither reference produces a probability, so each one's team score is turned into a probability with a **two-parameter logistic calibration** (slope and intercept) fitted on training. This is what makes log loss comparable.

### 1. The site's rule engine

A Python port of `src/lib/recommendation/engine.ts` and `counter.ts`, restricted to what a match can supply:

- **Data:** read from `supabase/seed.sql`. That covers `champions` (for the `riot_key` to champion id mapping), `champion_stats` (OP.GG, EUW, Emerald+, patch 16.3) and `counter_relations`.
- **Meta score:** as on the site, a champion's rank is its position in its role ordered by win rate, and the score is `100 - (rank - 1) / total * 90`.
- **Counter score:** `scoreCounter` against the enemy picks, using the relations of the champion's role.
- **Player score:** the engine's neutral value of 5, since there is no pool.
- **Weights:** `computeWeights` exactly as the engine does with no pool: meta 0.57, player 0.03, counter 0.40 once an enemy pick is known; meta 0.95 and player 0.05 otherwise.
- **Team score:** the mean of its known champions' total scores.
- **Missing champions:** a champion absent from the 16.3 statistics gets a neutral meta score of 55 (the midpoint of the scale). Their count is reported.

Tests replay the cases of `engine.test.ts` and `counter.test.ts` against the port and expect the same scores.

### 2. Champion win rates

The win rate of each champion in each role over the training matches, smoothed towards 50 % with a prior of 20 games. A team's score is the sum of the log-odds of its known champions' win rates.

## Metrics and Decision

On the test set, for the chosen model and both references:

- log loss, AUC and accuracy;
- for each reference, the log-loss difference (reference minus model) with its **95 % interval from a paired bootstrap of 2,000 resamples** over test matches, fixed seed.

**The model beats the references when both intervals lie entirely above zero.** AUC and accuracy are reported but do not decide.

Reported for information only, never deciding:

- the same metrics per tier group;
- the same metrics on partial drafts (3, 5 and 8 known picks);
- a calibration table (10 probability bins);
- the largest weights of the logistic regression, as a sanity check.

## Architecture

A package `ml/win/`, following `ml/collect/`: constants in `ml/paths.py`, tests flat in `test/ml/`.

| Module | Responsibility |
|---|---|
| `data.py` | Read-only loading, refusals, grouped and stratified split, split file |
| `encoding.py` | Signed encoding, matchups, synergies, elo crossing, masking |
| `baselines.py` | Engine port reading `seed.sql`, win-rate baseline, logistic calibration |
| `models.py` | Logistic stages with their grids, gradient boosting with its grid |
| `metrics.py` | Log loss, AUC, accuracy, paired bootstrap |
| `select.py` | Command: trains everything, chooses on validation, saves the model and the validation report |
| `test.py` | Command: evaluates the chosen model and both references on the test set, once |

Commands:

```
python -m ml.win.select --db <path to matches.sqlite> [--seed 42]
python -m ml.win.test
```

No new dependency: `scikit-learn`, `numpy`, `pandas` and `joblib` are already in `ml/requirements.txt`.

## Outputs

In `ml/artifacts/win/`, ignored by git:

- `split.json`: the match ids of each set, the seed, and the patch.
- `model.joblib`, plus `model_weights.json` when logistic regression is chosen.
- `validation_report.json`: every stage, the boosting model and both references on validation.
- `test_report.json`: the test report, with its date and the decision.

**The test lock.** If `test_report.json` exists, `ml.win.test` prints the recorded result and recomputes nothing. Running the test again requires deleting the file deliberately.

The outcome is then copied by hand into a `Results` section of this spec.

## Error Handling

Command output is in French and never contains characters outside cp1252. Each expected failure ends with a message and an explicit exit code, never a traceback:

| Code | Situation |
|---|---|
| 0 | Finished |
| 2 | Invalid arguments, or a missing database |
| 3 | The database holds more than one patch, or fewer than 1,000 matches |
| 4 | `seed.sql` is missing or cannot be parsed |
| 5 | `ml.win.test` run before `ml.win.select` has produced a model |

A champion present at test time but never seen in training contributes 0; their count is reported.

## Testing

Unit tests in `test/ml/`, without network, on small synthetic datasets:

- **Split:** no seed player appears in two sets; per-tier proportions hold.
- **Encoding:** swapping teams negates every feature; a hidden pick zeroes its matchup and synergy features.
- **Engine port:** the cases of `engine.test.ts` and `counter.test.ts` give the same scores.
- **Bootstrap:** the interval is correct on a case with a known answer.
- **End to end:** on synthetic matches with a planted synergy, stage 3 recovers it and beats the win-rate baseline.
- **Test lock:** a second run of `ml.win.test` recomputes nothing.

## Follow-Up Work

- **If the model wins:** project 3, integration on the site with the rule engine as fallback, still gated on Riot's answer about using a model trained on API data in the public product.
- **If it does not:** record why in `Results` (no signal in drafts alone, not enough matches, or a baseline already capturing it), and decide whether more matches or player-level data would change the answer before any further work.
