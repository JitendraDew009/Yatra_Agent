import os


PROVIDER_KEYS = {
    "weather": "WEATHER_API_KEY",
    "currency": "EXCHANGE_RATE_API_KEY",
}


def missing_provider_keys() -> list[str]:
    return [
        key
        for key in PROVIDER_KEYS.values()
        if not (value := os.getenv(key, "").strip())
        or value.lower().startswith("your_")
    ]


def provider_configuration_error() -> str | None:
    missing_keys = missing_provider_keys()
    if not missing_keys:
        return None

    keys = ", ".join(missing_keys)
    return (
        f"Trip planning is not fully configured. Add {keys} to the project-root "
        ".env file, then restart the API."
    )
