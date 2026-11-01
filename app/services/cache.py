import time
_cache: dict[str, dict] = {}

def get_cache(key:str) -> dict | None:
    if key not in _cache:
        return None
    entry = _cache[key]
    if time.time() - entry["timestamp"] > entry['ttl']:
        del _cache[key]
        return None
    return entry['data']

def set_cache(key: str, data: dict, ttl: int) -> None:
    _cache[key] = {
        "data" : data,
        "timestamp": time.time(),
        "ttl": ttl,

    }

def clear_cache() -> None:
    _cache.clear()