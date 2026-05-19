from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from ml.features import FEATURE_COLUMNS, build_candidate_features, filter_candidate_names, load_json
from ml.paths import DATA_DIR, DEFAULT_REGION, DEFAULT_TIER, MODEL_PATH


def load_artifact(model_path: Path = MODEL_PATH) -> tuple[Any, list[str]]:
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
