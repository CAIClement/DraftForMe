import httpx
import pytest

from ml.collect.riot_client import (
    KeyExpiredError,
    NotFoundError,
    RateLimiter,
    RiotClient,
    RiotServerError,
)


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.now += seconds


def make_client(handler, sleeps):
    clock = FakeClock()
    return RiotClient(
        "RGAPI-test",
        transport=httpx.MockTransport(handler),
        limiter=RateLimiter(clock=clock, sleep=clock.sleep),
        sleep=sleeps.append,
    )


def test_an_expired_key_raises():
    client = make_client(lambda request: httpx.Response(401), [])

    with pytest.raises(KeyExpiredError):
        client.match("EUW1_1")


def test_a_forbidden_key_raises_the_same_error():
    client = make_client(lambda request: httpx.Response(403), [])

    with pytest.raises(KeyExpiredError):
        client.match("EUW1_1")


def test_a_missing_match_raises_not_found():
    client = make_client(lambda request: httpx.Response(404), [])

    with pytest.raises(NotFoundError):
        client.match("EUW1_1")


def test_a_rate_limited_request_waits_for_retry_after_then_succeeds():
    responses = iter([httpx.Response(429, headers={"Retry-After": "7"}), httpx.Response(200, json={"ok": True})])
    sleeps: list[float] = []
    client = make_client(lambda request: next(responses), sleeps)

    assert client.match("EUW1_1") == {"ok": True}
    assert sleeps == [7.0]


def test_server_errors_retry_with_backoff_then_give_up():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(503)

    sleeps: list[float] = []
    client = make_client(handler, sleeps)

    with pytest.raises(RiotServerError):
        client.match("EUW1_1")

    assert sleeps == [2.0, 4.0, 8.0]
    assert len(calls) == 4


def test_routes_league_calls_to_the_platform_and_match_calls_to_the_region():
    seen = []

    def handler(request):
        seen.append((request.url.host, request.url.path, dict(request.url.params), request.headers["X-Riot-Token"]))
        if request.url.path.startswith("/lol/league"):
            return httpx.Response(200, json=[{"puuid": "abc"}])
        return httpx.Response(200, json=["EUW1_1"])

    client = make_client(handler, [])

    assert client.league_page("GOLD", "II", 3) == [{"puuid": "abc"}]
    assert client.match_ids("abc") == ["EUW1_1"]

    assert seen[0] == (
        "euw1.api.riotgames.com",
        "/lol/league/v4/entries/RANKED_SOLO_5x5/GOLD/II",
        {"page": "3"},
        "RGAPI-test",
    )
    assert seen[1] == (
        "europe.api.riotgames.com",
        "/lol/match/v5/matches/by-puuid/abc/ids",
        {"queue": "420", "start": "0", "count": "100"},
        "RGAPI-test",
    )


def test_an_apex_tier_reads_its_single_league_listing_on_page_one_only():
    paths = []

    def handler(request):
        paths.append(request.url.path)
        return httpx.Response(200, json={"entries": [{"puuid": "x"}]})

    client = make_client(handler, [])

    assert client.league_page("CHALLENGER", "I", 1) == [{"puuid": "x"}]
    assert client.league_page("CHALLENGER", "I", 2) == []
    assert paths == ["/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5"]


def test_resolve_puuid_uses_the_entry_puuid_without_a_request():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json={})

    client = make_client(handler, [])

    assert client.resolve_puuid({"puuid": "abc", "summonerId": "s-1"}) == "abc"
    assert calls == []


def test_resolve_puuid_converts_a_summoner_id_when_puuid_is_absent():
    paths = []

    def handler(request):
        paths.append(request.url.path)
        return httpx.Response(200, json={"puuid": "converted"})

    client = make_client(handler, [])

    assert client.resolve_puuid({"summonerId": "s-1"}) == "converted"
    assert paths == ["/lol/summoner/v4/summoners/s-1"]
