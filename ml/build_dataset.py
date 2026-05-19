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

        for pool_index, player_pool in enumerate(player_pools):
            for priority in (25, 50, 75):
                for scenario_index, enemy_picks in enumerate(enemy_pick_scenarios(stats)):
                    bans = enemy_picks[:1]
                    context_id = f"{role}:pool-{pool_index}:priority-{priority}:scenario-{scenario_index}"
                    context_rows = build_rows_for_context(
                        stats=stats,
                        player_pool=player_pool,
                        role=role,
                        region=DEFAULT_REGION,
                        tier=DEFAULT_TIER,
                        enemy_picks=enemy_picks,
                        bans=bans,
                        priority=priority,
                    )
                    for row in context_rows:
                        row["context_id"] = context_id
                    rows.extend(context_rows)

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
