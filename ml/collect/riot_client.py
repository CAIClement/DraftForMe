"""Riot API access: routing, rate limiting, and mapping HTTP failures to explicit errors."""

from __future__ import annotations

import time
from collections import deque
from collections.abc import Callable

# Development and personal keys: 20 requests every second and 100 every two
# minutes, enforced per region.
DEFAULT_WINDOWS: tuple[tuple[int, float], ...] = ((20, 1.0), (100, 120.0))


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
