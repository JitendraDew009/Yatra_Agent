import httpx
import os
from datetime import date, timedelta
from services.cache import get_cache, set_cache


async def fetch_currency_rates(base_currency: str) -> dict[str, float]:
    """Fetch currency exchange rates from an external API."""
    cache_key = f"currency_rates_{base_currency}"
    cached_data = get_cache(cache_key)

    if cached_data:
        return cached_data

    api_key = os.getenv("EXCHANGE_RATE_API_KEY")
    if not api_key:
        raise RuntimeError("EXCHANGE_RATE_API_KEY is not configured.")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://v6.exchangerate-api.com/v6/{api_key}/latest/{base_currency}"
        )
        response.raise_for_status()
        data = response.json()
        rates = data.get("conversion_rates", {})
        set_cache(cache_key, rates, ttl=3600)  # Cache for 1 hour
        return rates    