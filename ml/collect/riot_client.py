"""Riot API access: routing, rate limiting, and mapping HTTP failures to explicit errors."""

from __future__ import annotations

import time
from collections import deque
from collections.abc import Callable
from typing import Any

import httpx

# Development and personal keys: 20 requests every second and 100 every two
# minutes, enforced per region. The windows are padded slightly because the
# Windows clock is coarse and the stamp is taken before the request is sent,
# so the limiter never lets a burst reach Riot's exact edge.
DEFAULT_WINDOWS: tuple[tuple[int, float], ...] = ((20, 1.1), (100, 121.0))

PLATFORM_HOST = "euw1.api.riotgames.com"
REGIONAL_HOST = "europe.api.riotgames.com"
RANKED_SOLO = "RANKED_SOLO_5x5"
RANKED_SOLO_QUEUE_ID = 420
SERVER_ERROR_BACKOFF = (2.0, 4.0, 8.0)
APEX_LEAGUE_PATHS = {
    "MASTER": "masterleagues",
    "GRANDMASTER": "grandmasterleagues",
    "CHALLENGER": "challengerleagues",
}


class KeyExpiredError(RuntimeError):
    """401 or 403: the key expired or is invalid. Collection must stop, not retry."""


class NotFoundError(RuntimeError):
    """404: the resource does not exist. Never retried."""


class RiotServerError(RuntimeError):
    """5xx that persisted through every retry."""


class RateLimiter:
    """Sliding-window limiter, one set of windows per host.

    `acquire` blocks until sending one more request would stay inside every window.
    """

    def __init__(
        self,
        windows: tuple[tuple[int, float], ...] = DEFAULT_WINDOWS,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._windows = windows
        self._clock = clock
        self._sleep = sleep
        self._longest = max(seconds for _, seconds in windows)
        self._sent: dict[str, deque[float]] = {}

    def acquire(self, host: str) -> None:
        sent = self._sent.setdefault(host, deque())
        while True:
            now = self._clock()
            while sent and now - sent[0] >= self._longest:
                sent.popleft()

            wait = 0.0
            for limit, seconds in self._windows:
                in_window = [stamp for stamp in sent if now - stamp < seconds]
                if len(in_window) >= limit:
                    # The request may go once the oldest of the last `limit` leaves the window.
                    wait = max(wait, seconds - (now - in_window[-limit]))

            if wait <= 0:
                sent.append(now)
                return
            self._sleep(wait)


class RiotClient:
    def __init__(
        self,
        api_key: str,
        *,
        transport: httpx.BaseTransport | None = None,
        limiter: RateLimiter | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._http = httpx.Client(headers={"X-Riot-Token": api_key}, transport=transport, timeout=30.0)
        self._limiter = limiter or RateLimiter()
        self._sleep = sleep

    def close(self) -> None:
        self._http.close()

    def get(self, host: str, path: str, params: dict[str, Any] | None = None) -> Any:
        server_errors = 0
        while True:
            self._limiter.acquire(host)
            response = self._http.get(f"https://{host}{path}", params=params)
            status = response.status_code

            if status in (401, 403):
                raise KeyExpiredError(f"{status} on {path}")
            if status == 404:
                raise NotFoundError(path)
            if status == 429:
                self._sleep(float(response.headers.get("Retry-After", "10")))
                continue
            if status >= 500:
                if server_errors >= len(SERVER_ERROR_BACKOFF):
                    raise RiotServerError(f"{status} on {path}")
                self._sleep(SERVER_ERROR_BACKOFF[server_errors])
                server_errors += 1
                continue

            response.raise_for_status()
            return response.json()

    def league_page(self, tier: str, division: str, page: int) -> list[dict[str, Any]]:
        """One page of ranked players. Apex tiers are one listing, served as page 1."""
        if tier in APEX_LEAGUE_PATHS:
            if page != 1:
                return []
            league = self.get(PLATFORM_HOST, f"/lol/league/v4/{APEX_LEAGUE_PATHS[tier]}/by-queue/{RANKED_SOLO}")
            return list(league.get("entries") or [])
        return list(
            self.get(PLATFORM_HOST, f"/lol/league/v4/entries/{RANKED_SOLO}/{tier}/{division}", {"page": page})
        )

    def resolve_puuid(self, entry: dict[str, Any]) -> str:
        """League entries may or may not carry `puuid`; convert a summoner id when they do not."""
        puuid = entry.get("puuid")
        if puuid:
            return str(puuid)
        summoner = self.get(PLATFORM_HOST, f"/lol/summoner/v4/summoners/{entry['summonerId']}")
        return str(summoner["puuid"])

    def match_ids(self, puuid: str, count: int = 100) -> list[str]:
        """Ranked solo match ids, newest first."""
        return list(
            self.get(
                REGIONAL_HOST,
                f"/lol/match/v5/matches/by-puuid/{puuid}/ids",
                {"queue": RANKED_SOLO_QUEUE_ID, "start": 0, "count": count},
            )
        )

    def match(self, match_id: str) -> dict[str, Any]:
        return dict(self.get(REGIONAL_HOST, f"/lol/match/v5/matches/{match_id}"))
