# DraftForMe ML

This folder contains the first machine-learning pipeline for DraftForMe champion recommendations.

The V1 model is a tabular scikit-learn regressor trained from expert labels produced by the existing DraftForMe recommendation engine. It combines player profile, draft context, and meta statistics.

## Setup

```powershell
python -m venv .venv-ml
.\.venv-ml\Scripts\Activate.ps1
pip install -r ml\requirements.txt
```

## Build Dataset

```powershell
python -m ml.build_dataset
```

This writes:

```text
ml/artifacts/training_dataset.csv
```

## Train

```powershell
python -m ml.train
```

This writes:

```text
ml/artifacts/champion_recommender.joblib
ml/artifacts/champion_recommender_metadata.json
```

## Evaluate

```powershell
python -m ml.evaluate
```

The evaluator reports MAE and simple top-k overlap against the expert labels.

## Predict Locally

```powershell
python -m ml.predict --role mid --enemy Zed --bans Yasuo --top-n 5
```

## Run The Gradio Space Locally

```powershell
python ml\space\app.py
```

## Hugging Face Space

For the first publish, create a Hugging Face Space with the Gradio SDK and upload:

- `ml/space/app.py` as `app.py`
- `ml/space/requirements.txt` as `requirements.txt`
- `ml/features.py`
- `ml/predict.py`
- `ml/paths.py`
- `ml/artifacts/champion_recommender.joblib`
- `data/champion_stats_euw_emerald_plus_top.json`
- `data/champion_stats_euw_emerald_plus_jungle.json`
- `data/champion_stats_euw_emerald_plus_mid.json`
- `data/champion_stats_euw_emerald_plus_adc.json`
- `data/champion_stats_euw_emerald_plus_support.json`

Keep the main Next.js app on the expert TypeScript engine until the ML model has been evaluated and manually tested.

## Win Model

Trains a win-probability model on the ranked matches collected by `ml.collect`, and compares it with the site's rule engine and plain champion win rates. Design: `docs/superpowers/specs/2026-09-17-draftforme-win-model-design.md`.

```powershell
python -m ml.win.select --db "$env:LOCALAPPDATA\DraftForMe\matches.sqlite"
python -m ml.win.test
```

`ml.win.select` splits the matches, trains every candidate and keeps the best on validation. It can be run again freely until `ml.win.test` has been run. `ml.win.test` evaluates the test set once; afterwards it only prints the saved report, and `ml.win.select` refuses to choose a new model. This lock is a convention, not something the code can enforce: deleting only `test_report.json` lets `ml.win.select` choose a new model and `ml.win.test` evaluate the same test set again, after its verdict has already been seen. Starting over means deleting the whole `ml/artifacts/win/` directory, and a second verdict on the same matches is worth less than the first whatever the files say.
