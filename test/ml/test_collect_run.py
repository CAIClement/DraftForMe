from collect_fixtures import world
from ml.collect.riot_client import KeyExpiredError, RiotServerError
from ml.collect.run import detect_patch, main
from ml.collect.sampling import TIERS


def test_a_missing_key_exits_before_any_request(tmp_path):
    outputs: list[str] = []
    created: list[str] = []

    code = main(
        ["--target", "20", "--db", str(tmp_path / "m.sqlite")],
        env={},
        client_factory=created.append,
        patch_detector=lambda: "16.18",
        out=outputs.append,
    )

    assert code == 2
    assert created == []
    assert "RIOT_API_KEY" in outputs[0]


def test_the_patch_is_detected_from_the_newest_data_dragon_version():
    assert detect_patch(lambda url: ["16.18.1", "16.17.1"]) == "16.18"


def test_a_forced_patch_skips_detection(tmp_path):
    def must_not_detect():
        raise AssertionError("patch detection must not run when --patch is given")

    outputs: list[str] = []

    code = main(
        ["--target", "20", "--patch", "16.18", "--db", str(tmp_path / "m.sqlite")],
        env={"RIOT_API_KEY": "RGAPI-test"},
        client_factory=lambda key: world(),
        patch_detector=must_not_detect,
        out=outputs.append,
    )

    assert code == 0
    assert "Patch visé : 16.18" in outputs


def test_an_expired_key_stops_cleanly_with_instructions(tmp_path):
    class ExpiredSource:
        def league_page(self, tier, division, page):
            raise KeyExpiredError("expired")

        def close(self):
            pass

    outputs: list[str] = []

    code = main(
        ["--target", "20", "--db", str(tmp_path / "m.sqlite")],
        env={"RIOT_API_KEY": "RGAPI-test"},
        client_factory=lambda key: ExpiredSource(),
        patch_detector=lambda: "16.18",
        out=outputs.append,
    )

    assert code == 3
    assert any("expirée" in line for line in outputs)


def test_a_persistent_riot_server_error_stops_cleanly_and_stays_resumable(tmp_path):
    class DownSource:
        def league_page(self, tier, division, page):
            raise RiotServerError("503 on league")

        def close(self):
            pass

    outputs: list[str] = []

    code = main(
        ["--target", "20", "--db", str(tmp_path / "m.sqlite")],
        env={"RIOT_API_KEY": "RGAPI-test"},
        client_factory=lambda key: DownSource(),
        patch_detector=lambda: "16.18",
        out=outputs.append,
    )

    assert code == 4
    assert any("relance" in line for line in outputs)


def test_the_summary_reports_each_tier_and_names_the_short_ones(tmp_path):
    outputs: list[str] = []

    code = main(
        ["--target", "20", "--db", str(tmp_path / "m.sqlite")],
        env={"RIOT_API_KEY": "RGAPI-test"},
        client_factory=lambda key: world(tiers=[tier for tier in TIERS if tier != "CHALLENGER"]),
        patch_detector=lambda: "16.18",
        out=outputs.append,
    )

    assert code == 0
    assert any(line.startswith("  CHALLENGER") and line.endswith("0 / 2") for line in outputs)
    assert any(line.startswith("  GOLD") and line.endswith("2 / 2") for line in outputs)
    assert any(line.startswith("Déséquilibre") and "CHALLENGER" in line for line in outputs)
