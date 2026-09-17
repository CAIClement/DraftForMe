import pytest

from ml.collect.riot_client import RateLimiter

PLATFORM = "euw1.api.riotgames.com"
REGION = "europe.api.riotgames.com"


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def __call__(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


def test_waits_when_the_per_second_window_is_full():
    clock = FakeClock()
    limiter = RateLimiter(clock=clock, sleep=clock.sleep)

    for _ in range(20):
        limiter.acquire(PLATFORM)
    assert clock.sleeps == []

    limiter.acquire(PLATFORM)

    assert clock.sleeps == [pytest.approx(1.1)]


def test_waits_when_the_two_minute_window_is_full():
    clock = FakeClock()
    limiter = RateLimiter(clock=clock, sleep=clock.sleep)

    for _ in range(100):
        limiter.acquire(REGION)
        clock.now += 0.1
    assert clock.sleeps == []

    limiter.acquire(REGION)

    assert clock.sleeps == [pytest.approx(111.0)]


def test_tracks_each_host_separately():
    clock = FakeClock()
    limiter = RateLimiter(clock=clock, sleep=clock.sleep)

    for _ in range(20):
        limiter.acquire(PLATFORM)
    limiter.acquire(REGION)

    assert clock.sleeps == []
