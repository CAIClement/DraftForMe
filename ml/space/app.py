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
