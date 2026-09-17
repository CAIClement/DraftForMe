import httpx
import pytest

from collect_fixtures import world
from ml.collect.riot_client import KeyExpiredError, RiotServerError
from ml.collect.run import detect_patch, main, parse_args
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
            raise KeyExpiredError("403 on /lol/league/v4/entries")

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
    assert any("403 on /lol/league/v4/entries" in line for line in outputs)


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


def test_a_patch_mismatch_on_resume_names_the_stored_patch(tmp_path):
    db_dir = tmp_path / "elsewhere"
    db = str(db_dir / "m.sqlite")

    first_code = main(
        ["--target", "20", "--db", db],
        env={"RIOT_API_KEY": "RGAPI-test"},
        client_factory=lambda key: world(),
        patch_detector=lambda: "16.18",
        out=lambda line: None,
    )
    assert first_code == 0

    outputs: list[str] = []
    code = main(
        ["--target", "20", "--db", db],
        env={"RIOT_API_KEY": "RGAPI-test"},
        client_factory=lambda key: world(),
        patch_detector=lambda: "16.19",
        out=outputs.append,
    )

    assert code == 5
    assert any("--patch 16.18" in line for line in outputs)
    suggested = str(db_dir / "matches-16.19.sqlite")
    assert any(suggested in line for line in outputs)


def test_the_patch_argument_is_normalised_to_major_minor():
    assert parse_args(["--target", "20", "--patch", "16.08"]).patch == "16.8"
    assert parse_args(["--target", "20", "--patch", "16.18.1"]).patch == "16.18"
    with pytest.raises(SystemExit):
        parse_args(["--target", "20", "--patch", "abc"])


def test_a_target_below_the_tier_count_is_rejected():
    with pytest.raises(SystemExit):
        parse_args(["--target", "5"])


def test_a_patch_detection_failure_stops_before_any_file_is_created(tmp_path):
    db_path = tmp_path / "m.sqlite"

    def failing_detector():
        raise httpx.ConnectError("offline")

    outputs: list[str] = []

    code = main(
        ["--target", "20", "--db", str(db_path)],
        env={"RIOT_API_KEY": "RGAPI-test"},
        client_factory=lambda key: world(),
        patch_detector=failing_detector,
        out=outputs.append,
    )

    assert code == 5
    assert not db_path.exists()


def test_interrupting_patch_detection_stops_cleanly(tmp_path):
    def interrupting_detector():
        raise KeyboardInterrupt()

    outputs: list[str] = []

    code = main(
        ["--target", "20", "--db", str(tmp_path / "m.sqlite")],
        env={"RIOT_API_KEY": "RGAPI-test"},
        client_factory=lambda key: world(),
        patch_detector=interrupting_detector,
        out=outputs.append,
    )

    assert code == 130


def test_interrupting_collection_still_closes_the_client(tmp_path):
    class InterruptingSource:
        def __init__(self):
            self.closed = False

        def league_page(self, tier, division, page):
            raise KeyboardInterrupt()

        def close(self):
            self.closed = True

    created: list[InterruptingSource] = []

    def factory(key):
        source = InterruptingSource()
        created.append(source)
        return source

    outputs: list[str] = []

    code = main(
        ["--target", "20", "--db", str(tmp_path / "m.sqlite")],
        env={"RIOT_API_KEY": "RGAPI-test"},
        client_factory=factory,
        patch_detector=lambda: "16.18",
        out=outputs.append,
    )

    assert code == 130
    assert created[0].closed is True


def test_a_database_path_that_is_a_directory_reports_a_sqlite_error(tmp_path):
    outputs: list[str] = []

    code = main(
        ["--target", "20", "--db", str(tmp_path)],
        env={"RIOT_API_KEY": "RGAPI-test"},
        client_factory=lambda key: world(),
        patch_detector=lambda: "16.18",
        out=outputs.append,
    )

    assert code == 6
