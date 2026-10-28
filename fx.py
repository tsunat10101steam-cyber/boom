"""달러 → 다른 통화 환율 (요금을 원화 등으로 보여줄 때).

1순위 Frankfurter (유럽중앙은행 고시 환율, 키 없음), 안 되면 ExchangeRate-API 무료판.
환율은 하루 한 번쯤 바뀌므로 6시간 캐시한다.
"""
from __future__ import annotations

import json
import time
import urllib.error

from updater import _get

SOURCES = [
    ("Frankfurter (ECB)", "https://api.frankfurter.dev/v1/latest?base=USD&symbols={cur}",
     lambda j, cur: (j["rates"][cur], j.get("date", ""))),
    ("ExchangeRate-API", "https://open.er-api.com/v6/latest/USD",
     lambda j, cur: (j["rates"][cur], j.get("time_last_update_utc", "")[5:16])),
]
_cache: dict[str, tuple[float, dict]] = {}


def usd_to(cur, force=False):
    """{'rate': 1 USD 당 cur, 'date': 기준일, 'source': 출처} 또는 오류 시 {'error': ...}."""
    cur = cur.upper()
    hit = _cache.get(cur)
    if hit and not force and time.time() - hit[0] < 6 * 3600:
        return hit[1]
    last_err = ""
    for name, url, parse in SOURCES:
        try:
            with _get(url.format(cur=cur), timeout=8, headers={"Accept": "application/json"}) as r:
                rate, date = parse(json.load(r), cur)
            data = {"currency": cur, "rate": float(rate), "date": date, "source": name}
            _cache[cur] = (time.time(), data)
            return data
        except (urllib.error.URLError, OSError, ValueError, KeyError) as e:
            last_err = str(e)
    return {"currency": cur, "error": last_err or "unavailable"}
