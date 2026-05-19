# DraftForMe ML Hugging Face MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first trainable champion recommendation model, evaluate it against the current expert engine, and prepare a Hugging Face Gradio Space.

**Architecture:** Add a separate Python `ml/` package that reads current JSON data, builds tabular features, labels examples with the existing Python expert recommendation logic, trains a scikit-learn regressor, and exposes local/Space inference. The existing Next.js app remains unchanged for V1.

**Tech Stack:** Python 3.11+, pandas, numpy, scikit-learn, joblib, pytest, Gradio, existing `recommendation.py`, current `data/*.json` cache files.

---

## File Structure

- Create `ml/__init__.py`: package marker.
- Create `ml/paths.py`: central filesystem paths for data, artifacts, and default filenames.
- Create `ml/features.py`: JSON loading, numeric parsing, feature row construction, candidate filtering, and explanation helpers.
- Create `ml/build_dataset.py`: deterministic dataset generation from current local data.
- Create `ml/train.py`: model training and artifact serialization.
- Create `ml/predict.py`: local model loading and recommendation inference.
- Create `ml/evaluate.py`: evaluation against expert labels.
- Create `ml/README.md`: commands for training, evaluating, running the Space, and publishing.
- Create `ml/requirements.txt`: local ML dependencies.
- Create `ml/space/app.py`: Gradio UI for Hugging Face Spaces.
- Create `ml/space/requirements.txt`: minimal Space runtime dependencies.
- Create `test/ml/test_features.py`: feature and filtering tests.
- Create `test/ml/test_dataset.py`: dataset generation tests with temporary fixtures.
- Create `test/ml/test_predict.py`: prediction tests with a tiny fake model.

No commit steps are included because the user explicitly asked not to commit.

---

### Task 1: Add ML Dependencies And Paths

**Files:**
- Create: `ml/__init__.py`
- Create: `ml/paths.py`
- Create: `ml/requirements.txt`
- Create: `ml/space/requirements.txt`

- [ ] **Step 1: Create package marker**

Create `ml/__init__.py`:

```python
"""Machine-learning helpers for DraftForMe champion recommendations."""
```

- [ ] **Step 2: Create path helpers**

Create `ml/paths.py`:

```python
from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
ML_DIR = PROJECT_ROOT / "ml"
ARTIFACT_DIR = ML_DIR / "artifacts"
DATASET_PATH = ARTIFACT_DIR / "training_dataset.csv"
MODEL_PATH = ARTIFACT_DIR / "champion_recommender.joblib"
METADATA_PATH = ARTIFACT_DIR / "champion_recommender_metadata.json"

DEFAULT_REGION = "euw"
DEFAULT_TIER = "emerald_plus"
ROLES = ("top", "jungle", "mid", "adc", "support")
```

- [ ] **Step 3: Create local ML requirements**

Create `ml/requirements.txt`:

```text
gradio>=4.44.0
joblib>=1.4.2
numpy>=1.26.4
pandas>=2.2.2
pytest>=8.3.2
scikit-learn>=1.5.1
```

- [ ] **Step 4: Create Space requirements**

Create `ml/space/requirements.txt`:

```text
gradio>=4.44.0
joblib>=1.4.2
numpy>=1.26.4
pandas>=2.2.2
scikit-learn>=1.5.1
```

- [ ] **Step 5: Verify imports**

Run:

```powershell
python -m py_compile ml\paths.py
```

Expected: command exits with code 0 and prints no errors.

---

### Task 2: Implement Feature Construction

**Files:**
- Create: `ml/features.py`
- Test: `test/ml/test_features.py`

- [ ] **Step 1: Write failing feature tests**

Create `test/ml/test_features.py`:

```python
from ml.features import (
    build_candidate_features,
    filter_candidate_names,
    parse_float,
    player_lookup,
)


def test_parse_float_accepts_numbers_and_percent_strings():
    assert parse_float(51.2) == 51.2
    assert parse_float("51.2%") == 51.2
    assert parse_float(None, default=7.0) == 7.0


def test_player_lookup_normalizes_champion_names():
    pool = [{"champion": "Kai'Sa", "games": 24, "win_rate": 58.0}]
    lookup = player_lookup(pool)
    assert lookup["kai'sa"]["games"] == 24
    assert lookup["kai'sa"]["win_rate"] == 58.0


def test_filter_candidate_names_excludes_bans_and_picks():
    champions = [{"name": "Ahri"}, {"name": "Zed"}, {"name": "Lux"}]
    result = filter_candidate_names(champions, bans=["zed"], already_picked=["Lux"])
    assert result == ["Ahri"]


def test_build_candidate_features_marks_player_and_draft_context():
    champion = {
        "rank": 2,
        "name": "Ahri",
        "games_played": "714379",
        "win_rate": 50.11,
        "pick_rate": 9.59,
        "ban_rate": 3.21,
    }
    pool = [{"champion": "Ahri", "games": 32, "win_rate": 56.0}]
    row = build_candidate_features(
        champion=champion,
        role="mid",
        region="euw",
        tier="emerald_plus",
        player_pool=pool,
        enemy_picks=["Zed"],
        bans=["Yasuo"],
        already_picked=["Lux"],
        total_champions=55,
        priority=50,
    )

    assert row["champion"] == "Ahri"
    assert row["role_mid"] == 1
    assert row["candidate_rank"] == 2
    assert row["candidate_win_rate"] == 50.11
    assert row["player_has_champion"] == 1
    assert row["player_games"] == 32
    assert row["player_win_rate"] == 56.0
    assert row["enemy_pick_count"] == 1
    assert row["ban_count"] == 1
    assert row["already_picked_count"] == 1
    assert row["is_banned"] == 0
    assert row["is_already_picked"] == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
python -m pytest test\ml\test_features.py -v
```

Expected: FAIL because `ml.features` does not exist.

- [ ] **Step 3: Implement feature helpers**

Create `ml/features.py`:

```python
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROLES = ("top", "jungle", "mid", "adc", "support")


def normalize_name(value: str) -> str:
    return value.strip().lower()


def parse_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).replace("%", "").replace(",", "").strip())
    except (TypeError, ValueError):
        return default


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def player_lookup(player_pool: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {
        normalize_name(entry.get("champion", "")): entry
        for entry in player_pool
        if entry.get("champion")
    }


def filter_candidate_names(
    champions: list[dict[str, Any]],
    bans: list[str] | None = None,
    already_picked: list[str] | None = None,
) -> list[str]:
    banned = {normalize_name(name) for name in (bans or [])}
    picked = {normalize_name(name) for name in (already_picked or [])}
    names: list[str] = []

    for champion in champions:
        name = champion.get("name", "")
        normalized = normalize_name(name)
        if name and normalized not in banned and normalized not in picked:
            names.append(name)

    return names


def one_hot_role(role: str) -> dict[str, int]:
    normalized = role.strip().lower()
    return {f"role_{item}": int(normalized == item) for item in ROLES}


def build_candidate_features(
    champion: dict[str, Any],
    role: str,
    region: str,
    tier: str,
    player_pool: list[dict[str, Any]],
    enemy_picks: list[str],
    bans: list[str],
    already_picked: list[str],
    total_champions: int,
    priority: int,
) -> dict[str, Any]:
    name = champion.get("name", "")
    normalized_name = normalize_name(name)
    pool = player_lookup(player_pool)
    player_entry = pool.get(normalized_name, {})
    banned = {normalize_name(item) for item in bans}
    picked = {normalize_name(item) for item in already_picked}
    player_games = parse_float(player_entry.get("games"), 0.0)
    player_win_rate = parse_float(player_entry.get("win_rate"), 50.0)

    row: dict[str, Any] = {
        "champion": name,
        "role": role,
        "region": region,
        "tier": tier,
        "priority": int(priority),
        "total_champions": int(total_champions),
        "candidate_rank": int(parse_float(champion.get("rank"), total_champions)),
        "candidate_win_rate": parse_float(champion.get("win_rate"), 50.0),
        "candidate_pick_rate": parse_float(champion.get("pick_rate"), 0.0),
        "candidate_ban_rate": parse_float(champion.get("ban_rate"), 0.0),
        "candidate_games_played": parse_float(champion.get("games_played"), 0.0),
        "player_has_champion": int(normalized_name in pool),
        "player_games": player_games,
        "player_win_rate": player_win_rate,
        "player_missing_pool": int(len(player_pool) == 0),
        "enemy_pick_count": len(enemy_picks),
        "ban_count": len(bans),
        "already_picked_count": len(already_picked),
        "is_banned": int(normalized_name in banned),
        "is_already_picked": int(normalized_name in picked),
    }
    row.update(one_hot_role(role))
    return row


FEATURE_COLUMNS = [
    "priority",
    "total_champions",
    "candidate_rank",
    "candidate_win_rate",
    "candidate_pick_rate",
    "candidate_ban_rate",
    "candidate_games_played",
    "player_has_champion",
    "player_games",
    "player_win_rate",
    "player_missing_pool",
    "enemy_pick_count",
    "ban_count",
    "already_picked_count",
    "is_banned",
    "is_already_picked",
    "role_top",
    "role_jungle",
    "role_mid",
    "role_adc",
    "role_support",
]
```

- [ ] **Step 4: Run feature tests**

Run:

```powershell
python -m pytest test\ml\test_features.py -v
```

Expected: PASS.

---

### Task 3: Build The Expert-Labeled Dataset

**Files:**
- Create: `ml/build_dataset.py`
- Test: `test/ml/test_dataset.py`

- [ ] **Step 1: Write failing dataset tests**

Create `test/ml/test_dataset.py`:

```python
from pathlib import Path

from ml.build_dataset import build_rows_for_context, discover_player_pools


def test_build_rows_for_context_adds_expert_scores():
    stats = [
        {"rank": 1, "name": "Ahri", "win_rate": 51.0, "pick_rate": 7.0, "ban_rate": 2.0, "games_played": "1000"},
        {"rank": 2, "name": "Zed", "win_rate": 49.0, "pick_rate": 6.0, "ban_rate": 20.0, "games_played": "900"},
    ]
    pool = [{"champion": "Ahri", "games": 20, "win_rate": 55.0}]

    rows = build_rows_for_context(
        stats=stats,
        player_pool=pool,
        role="mid",
        region="euw",
        tier="emerald_plus",
        enemy_picks=["Zed"],
        bans=["Zed"],
        priority=50,
    )

    assert len(rows) == 1
    assert rows[0]["champion"] == "Ahri"
    assert "target_total_score" in rows[0]
    assert "expert_meta_score" in rows[0]
    assert rows[0]["target_total_score"] > 0


def test_discover_player_pools_reads_most_played(tmp_path: Path):
    path = tmp_path / "player_euw_demo.json"
    path.write_text(
        '{"most_played":[{"champion":"Kled","games":53,"win_rate":51.0}]}',
        encoding="utf-8",
    )

    pools = discover_player_pools(tmp_path)

    assert pools == [[{"champion": "Kled", "games": 53, "win_rate": 51.0}]]
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
python -m pytest test\ml\test_dataset.py -v
```

Expected: FAIL because `ml.build_dataset` does not exist.

- [ ] **Step 3: Implement dataset builder**

Create `ml/build_dataset.py`:

```python
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import pandas as pd

from recommendation import compute_champion_score

from ml.features import build_candidate_features, filter_candidate_names, load_json
from ml.paths import ARTIFACT_DIR, DATASET_PATH, DATA_DIR, DEFAULT_REGION, DEFAULT_TIER, ROLES


def discover_player_pools(data_dir: Path) -> list[list[dict[str, Any]]]:
    pools: list[list[dict[str, Any]]] = [[]]
    for path in sorted(data_dir.glob("player_*.json")):
        payload = load_json(path)
        most_played = payload.get("most_played", [])
        if isinstance(most_played, list):
            pools.append(most_played)
    return pools


def build_rows_for_context(
    stats: list[dict[str, Any]],
    player_pool: list[dict[str, Any]],
    role: str,
    region: str,
    tier: str,
    enemy_picks: list[str],
    bans: list[str],
    priority: int,
) -> list[dict[str, Any]]:
    total_champions = len(stats)
    legal_names = set(filter_candidate_names(stats, bans=bans, already_picked=enemy_picks))
    rows: list[dict[str, Any]] = []

    for champion in stats:
        name = champion.get("name", "")
        if name not in legal_names:
            continue

        expert = compute_champion_score(
            champion_stats=champion,
            champion_name=name,
            player_pool=player_pool,
            enemy_picks=enemy_picks,
            matchup_data={},
            priority=priority,
            total_champions=total_champions,
        )
        row = build_candidate_features(
            champion=champion,
            role=role,
            region=region,
            tier=tier,
            player_pool=player_pool,
            enemy_picks=enemy_picks,
            bans=bans,
            already_picked=enemy_picks,
            total_champions=total_champions,
            priority=priority,
        )
        row.update(
            {
                "target_total_score": expert["total_score"],
                "expert_meta_score": expert["meta_score"],
                "expert_player_score": expert["player_score"],
                "expert_counter_score": expert["counter_score"],
                "expert_weight_meta": expert["weights"]["meta"],
                "expert_weight_player": expert["weights"]["player"],
                "expert_weight_counter": expert["weights"]["counter"],
            }
        )
        rows.append(row)

    return rows


def enemy_pick_scenarios(stats: list[dict[str, Any]]) -> list[list[str]]:
    names = [item.get("name", "") for item in stats if item.get("name")]
    return [[], names[:1], names[1:3]]


def build_dataset(data_dir: Path = DATA_DIR) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    player_pools = discover_player_pools(data_dir)

    for role in ROLES:
        stats_path = data_dir / f"champion_stats_{DEFAULT_REGION}_{DEFAULT_TIER}_{role}.json"
        if not stats_path.exists():
            continue
        stats = load_json(stats_path)
        if not isinstance(stats, list):
            continue

        for player_pool in player_pools:
            for priority in (25, 50, 75):
                for enemy_picks in enemy_pick_scenarios(stats):
                    bans = enemy_picks[:1]
                    rows.extend(
                        build_rows_for_context(
                            stats=stats,
                            player_pool=player_pool,
                            role=role,
                            region=DEFAULT_REGION,
                            tier=DEFAULT_TIER,
                            enemy_picks=enemy_picks,
                            bans=bans,
                            priority=priority,
                        )
                    )

    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build DraftForMe ML training dataset.")
    parser.add_argument("--output", type=Path, default=DATASET_PATH)
    args = parser.parse_args()

    dataset = build_dataset()
    if dataset.empty:
        raise SystemExit("No training rows were generated from data/*.json.")

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    dataset.to_csv(args.output, index=False)
    print(f"Wrote {len(dataset)} rows to {args.output}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run dataset tests**

Run:

```powershell
python -m pytest test\ml\test_dataset.py -v
```

Expected: PASS.

- [ ] **Step 5: Build the first dataset**

Run:

```powershell
python -m ml.build_dataset
```

Expected: prints `Wrote <number> rows to ...\ml\artifacts\training_dataset.csv`, where `<number>` is greater than 0.

---

### Task 4: Train And Save The Model

**Files:**
- Create: `ml/train.py`

- [ ] **Step 1: Implement training script**

Create `ml/train.py`:

```python
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split

from ml.features import FEATURE_COLUMNS
from ml.paths import ARTIFACT_DIR, DATASET_PATH, METADATA_PATH, MODEL_PATH


def train_model(dataset_path: Path = DATASET_PATH, model_path: Path = MODEL_PATH) -> dict[str, float]:
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}. Run python -m ml.build_dataset first.")

    dataset = pd.read_csv(dataset_path)
    missing = [column for column in FEATURE_COLUMNS + ["target_total_score"] if column not in dataset.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")

    x = dataset[FEATURE_COLUMNS].fillna(0)
    y = dataset["target_total_score"]
    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=42)

    candidates = {
        "hist_gradient_boosting": HistGradientBoostingRegressor(random_state=42),
        "random_forest": RandomForestRegressor(n_estimators=120, random_state=42, n_jobs=-1),
    }

    best_name = ""
    best_model = None
    best_mae = float("inf")
    metrics: dict[str, float] = {}

    for name, model in candidates.items():
        model.fit(x_train, y_train)
        predictions = model.predict(x_test)
        mae = float(mean_absolute_error(y_test, predictions))
        metrics[f"{name}_mae"] = mae
        if mae < best_mae:
            best_name = name
            best_model = model
            best_mae = mae

    if best_model is None:
        raise RuntimeError("No model was trained.")

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": best_model, "feature_columns": FEATURE_COLUMNS}, model_path)
    METADATA_PATH.write_text(
        json.dumps(
            {
                "best_model": best_name,
                "mae": best_mae,
                "rows": int(len(dataset)),
                "feature_columns": FEATURE_COLUMNS,
                "metrics": metrics,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return {"mae": best_mae, "rows": float(len(dataset))}


def main() -> None:
    parser = argparse.ArgumentParser(description="Train DraftForMe champion recommendation model.")
    parser.add_argument("--dataset", type=Path, default=DATASET_PATH)
    parser.add_argument("--model", type=Path, default=MODEL_PATH)
    args = parser.parse_args()

    metrics = train_model(args.dataset, args.model)
    print(f"Trained model with MAE={metrics['mae']:.3f} on {int(metrics['rows'])} rows")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Compile training script**

Run:

```powershell
python -m py_compile ml\train.py
```

Expected: command exits with code 0 and prints no errors.

- [ ] **Step 3: Train model**

Run:

```powershell
python -m ml.train
```

Expected: prints `Trained model with MAE=<value> on <rows> rows` and creates:

- `ml/artifacts/champion_recommender.joblib`
- `ml/artifacts/champion_recommender_metadata.json`

---

### Task 5: Add Prediction API For Local And Space Use

**Files:**
- Create: `ml/predict.py`
- Test: `test/ml/test_predict.py`

- [ ] **Step 1: Write failing prediction tests**

Create `test/ml/test_predict.py`:

```python
from ml.predict import rank_candidates


class FakeModel:
    def predict(self, frame):
        return [100 - rank for rank in frame["candidate_rank"]]


def test_rank_candidates_filters_bans_and_orders_scores():
    stats = [
        {"rank": 1, "name": "Ahri", "win_rate": 51.0, "pick_rate": 7.0, "ban_rate": 2.0, "games_played": "1000"},
        {"rank": 2, "name": "Zed", "win_rate": 49.0, "pick_rate": 6.0, "ban_rate": 20.0, "games_played": "900"},
        {"rank": 3, "name": "Lux", "win_rate": 50.0, "pick_rate": 5.0, "ban_rate": 4.0, "games_played": "800"},
    ]

    result = rank_candidates(
        model=FakeModel(),
        feature_columns=["candidate_rank"],
        stats=stats,
        role="mid",
        region="euw",
        tier="emerald_plus",
        player_pool=[],
        enemy_picks=[],
        bans=["Ahri"],
        priority=50,
        top_n=2,
    )

    assert [item["champion"] for item in result] == ["Zed", "Lux"]
    assert result[0]["score"] > result[1]["score"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
python -m pytest test\ml\test_predict.py -v
```

Expected: FAIL because `ml.predict` does not exist.

- [ ] **Step 3: Implement predictor**

Create `ml/predict.py`:

```python
from __future__ import annotations

import argparse
from typing import Any

import joblib
import pandas as pd

from ml.features import FEATURE_COLUMNS, build_candidate_features, filter_candidate_names, load_json
from ml.paths import DATA_DIR, DEFAULT_REGION, DEFAULT_TIER, MODEL_PATH


def load_artifact(model_path=MODEL_PATH) -> tuple[Any, list[str]]:
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}. Run python -m ml.train first.")
    artifact = joblib.load(model_path)
    return artifact["model"], artifact.get("feature_columns", FEATURE_COLUMNS)


def explanation_for(row: dict[str, Any]) -> list[str]:
    factors: list[str] = []
    if row["player_has_champion"]:
        factors.append(f"Player pool: {int(row['player_games'])} games at {row['player_win_rate']:.1f}% WR")
    else:
        factors.append("Player pool: no established history")
    factors.append(f"Meta: rank #{int(row['candidate_rank'])}, {row['candidate_win_rate']:.1f}% WR")
    if row["enemy_pick_count"]:
        factors.append(f"Draft: {int(row['enemy_pick_count'])} enemy pick(s) included")
    else:
        factors.append("Draft: no enemy picks selected")
    return factors


def rank_candidates(
    model: Any,
    feature_columns: list[str],
    stats: list[dict[str, Any]],
    role: str,
    region: str,
    tier: str,
    player_pool: list[dict[str, Any]],
    enemy_picks: list[str],
    bans: list[str],
    priority: int,
    top_n: int,
) -> list[dict[str, Any]]:
    legal_names = set(filter_candidate_names(stats, bans=bans, already_picked=enemy_picks))
    rows: list[dict[str, Any]] = []

    for champion in stats:
        if champion.get("name") not in legal_names:
            continue
        rows.append(
            build_candidate_features(
                champion=champion,
                role=role,
                region=region,
                tier=tier,
                player_pool=player_pool,
                enemy_picks=enemy_picks,
                bans=bans,
                already_picked=enemy_picks,
                total_champions=len(stats),
                priority=priority,
            )
        )

    if not rows:
        return []

    frame = pd.DataFrame(rows)
    scores = model.predict(frame[feature_columns].fillna(0))
    ranked = []
    for row, score in zip(rows, scores):
        ranked.append(
            {
                "champion": row["champion"],
                "score": round(float(score), 1),
                "factors": explanation_for(row),
            }
        )

    ranked.sort(key=lambda item: item["score"], reverse=True)
    return ranked[:top_n]


def predict_for_role(
    role: str,
    enemy_picks: list[str] | None = None,
    bans: list[str] | None = None,
    player_pool: list[dict[str, Any]] | None = None,
    priority: int = 50,
    top_n: int = 5,
    region: str = DEFAULT_REGION,
    tier: str = DEFAULT_TIER,
) -> list[dict[str, Any]]:
    stats_path = DATA_DIR / f"champion_stats_{region}_{tier}_{role}.json"
    if not stats_path.exists():
        raise FileNotFoundError(f"Stats file not found: {stats_path}")

    model, feature_columns = load_artifact()
    stats = load_json(stats_path)
    return rank_candidates(
        model=model,
        feature_columns=feature_columns,
        stats=stats,
        role=role,
        region=region,
        tier=tier,
        player_pool=player_pool or [],
        enemy_picks=enemy_picks or [],
        bans=bans or [],
        priority=priority,
        top_n=top_n,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict DraftForMe champion recommendations.")
    parser.add_argument("--role", default="mid")
    parser.add_argument("--enemy", nargs="*", default=[])
    parser.add_argument("--bans", nargs="*", default=[])
    parser.add_argument("--priority", type=int, default=50)
    parser.add_argument("--top-n", type=int, default=5)
    args = parser.parse_args()

    recommendations = predict_for_role(
        role=args.role,
        enemy_picks=args.enemy,
        bans=args.bans,
        priority=args.priority,
        top_n=args.top_n,
    )
    for index, item in enumerate(recommendations, start=1):
        print(f"{index}. {item['champion']} - {item['score']}")
        for factor in item["factors"]:
            print(f"   - {factor}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run prediction tests**

Run:

```powershell
python -m pytest test\ml\test_predict.py -v
```

Expected: PASS.

- [ ] **Step 5: Run local prediction**

Run:

```powershell
python -m ml.predict --role mid --enemy Zed --bans Yasuo --top-n 5
```

Expected: prints five recommendations and does not include `Zed` or `Yasuo`.

---

### Task 6: Add Evaluation Script

**Files:**
- Create: `ml/evaluate.py`

- [ ] **Step 1: Implement evaluator**

Create `ml/evaluate.py`:

```python
from __future__ import annotations

import argparse

import pandas as pd
from sklearn.metrics import mean_absolute_error

from ml.features import FEATURE_COLUMNS
from ml.paths import DATASET_PATH
from ml.predict import load_artifact


def top_k_overlap(expert: list[str], predicted: list[str], k: int) -> float:
    if k <= 0:
        return 0.0
    expert_set = set(expert[:k])
    predicted_set = set(predicted[:k])
    return len(expert_set & predicted_set) / k


def evaluate(dataset_path=DATASET_PATH) -> dict[str, float]:
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}. Run python -m ml.build_dataset first.")

    model, feature_columns = load_artifact()
    dataset = pd.read_csv(dataset_path)
    predictions = model.predict(dataset[feature_columns].fillna(0))
    mae = float(mean_absolute_error(dataset["target_total_score"], predictions))

    comparison = dataset[["champion", "target_total_score"]].copy()
    comparison["predicted_score"] = predictions
    expert_order = comparison.sort_values("target_total_score", ascending=False)["champion"].tolist()
    predicted_order = comparison.sort_values("predicted_score", ascending=False)["champion"].tolist()

    return {
        "mae": mae,
        "top_1_overlap": top_k_overlap(expert_order, predicted_order, 1),
        "top_5_overlap": top_k_overlap(expert_order, predicted_order, 5),
        "rows": float(len(dataset)),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate DraftForMe ML model against expert labels.")
    parser.add_argument("--dataset", default=DATASET_PATH)
    args = parser.parse_args()

    metrics = evaluate(args.dataset)
    print(f"Rows: {int(metrics['rows'])}")
    print(f"MAE: {metrics['mae']:.3f}")
    print(f"Top-1 overlap: {metrics['top_1_overlap']:.2f}")
    print(f"Top-5 overlap: {metrics['top_5_overlap']:.2f}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Compile evaluator**

Run:

```powershell
python -m py_compile ml\evaluate.py
```

Expected: command exits with code 0 and prints no errors.

- [ ] **Step 3: Evaluate the trained model**

Run:

```powershell
python -m ml.evaluate
```

Expected: prints rows, MAE, top-1 overlap, and top-5 overlap.

---

### Task 7: Add Hugging Face Gradio Space

**Files:**
- Create: `ml/space/app.py`

- [ ] **Step 1: Implement Space app**

Create `ml/space/app.py`:

```python
from __future__ import annotations

import sys
from pathlib import Path

import gradio as gr

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.predict import predict_for_role


def parse_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def recommend(role: str, enemy_picks: str, bans: str, priority: int, top_n: int) -> str:
    try:
        results = predict_for_role(
            role=role,
            enemy_picks=parse_csv(enemy_picks),
            bans=parse_csv(bans),
            priority=priority,
            top_n=top_n,
        )
    except Exception as exc:
        return f"Unable to load recommendations: {exc}"

    if not results:
        return "No legal recommendation found for this context."

    lines: list[str] = []
    for index, item in enumerate(results, start=1):
        lines.append(f"{index}. {item['champion']} - score {item['score']}")
        for factor in item["factors"]:
            lines.append(f"   - {factor}")
    return "\n".join(lines)


demo = gr.Interface(
    fn=recommend,
    inputs=[
        gr.Dropdown(["top", "jungle", "mid", "adc", "support"], value="mid", label="Role"),
        gr.Textbox(value="Zed", label="Enemy picks, comma-separated"),
        gr.Textbox(value="Yasuo", label="Bans, comma-separated"),
        gr.Slider(0, 100, value=50, step=1, label="Meta priority"),
        gr.Slider(1, 10, value=5, step=1, label="Top N"),
    ],
    outputs=gr.Textbox(label="Recommendations", lines=14),
    title="DraftForMe Champion Recommender",
    description="Hybrid champion recommendation model trained from player profile, draft context, and meta data.",
)


if __name__ == "__main__":
    demo.launch()
```

- [ ] **Step 2: Compile Space app**

Run:

```powershell
python -m py_compile ml\space\app.py
```

Expected: command exits with code 0 and prints no errors.

- [ ] **Step 3: Run the Space locally**

Run:

```powershell
python ml\space\app.py
```

Expected: Gradio starts a local server and shows a URL such as `http://127.0.0.1:7860`.

- [ ] **Step 4: Manually test the Space**

Open the local Gradio URL. Select:

```text
Role: mid
Enemy picks: Zed
Bans: Yasuo
Meta priority: 50
Top N: 5
```

Expected: output lists five champions, excludes `Zed` and `Yasuo`, and includes readable factors.

---

### Task 8: Document Training And Publishing

**Files:**
- Create: `ml/README.md`

- [ ] **Step 1: Create ML README**

Create `ml/README.md`:

```markdown
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
```

- [ ] **Step 2: Verify README renders as plain Markdown**

Run:

```powershell
Get-Content -Raw ml\README.md
```

Expected: the file prints without placeholder text and contains setup, dataset, train, evaluate, predict, and Space sections.

---

### Task 9: Full Verification

**Files:**
- Verify all files from Tasks 1-8.

- [ ] **Step 1: Run Python unit tests**

Run:

```powershell
python -m pytest test\ml -v
```

Expected: all ML tests pass.

- [ ] **Step 2: Build dataset**

Run:

```powershell
python -m ml.build_dataset
```

Expected: writes `ml/artifacts/training_dataset.csv` with more than 0 rows.

- [ ] **Step 3: Train model**

Run:

```powershell
python -m ml.train
```

Expected: writes the joblib model and metadata JSON.

- [ ] **Step 4: Evaluate model**

Run:

```powershell
python -m ml.evaluate
```

Expected: prints MAE and top-k metrics.

- [ ] **Step 5: Verify bans and picks in CLI prediction**

Run:

```powershell
python -m ml.predict --role mid --enemy Zed --bans Yasuo --top-n 5
```

Expected: output contains neither `Zed` nor `Yasuo` as a recommended champion.

- [ ] **Step 6: Compile all ML scripts**

Run:

```powershell
python -m py_compile ml\paths.py ml\features.py ml\build_dataset.py ml\train.py ml\predict.py ml\evaluate.py ml\space\app.py
```

Expected: command exits with code 0 and prints no errors.

---

## Self-Review

- Spec coverage: the plan covers the independent `ml/` pipeline, expert labels, training, local prediction, evaluation, Gradio Space, and documentation. It intentionally leaves Next.js integration for a later V2 plan.
- Placeholder scan: no unresolved placeholder markers are present.
- Type consistency: `FEATURE_COLUMNS`, `build_candidate_features`, `rank_candidates`, `predict_for_role`, and artifact paths are defined before use and reused consistently.
- User constraint: no commit task is included because the user asked not to commit.
