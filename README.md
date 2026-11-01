# Yatra Planner API

Yatra Planner is a FastAPI service that combines a destination's weather forecast, a small local list of places to visit, and currency exchange rates. It provides both a regular JSON endpoint and a Server-Sent Events (SSE) endpoint for receiving the results in stages.

## Features

- Validates trip dates and limits requests to trips of 1–14 days.
- Fetches weather and currency data from external APIs.
- Looks up places from a small in-memory destination catalog.
- Runs the three data fetches concurrently for the regular planning endpoint.
- Streams progress and results as named SSE events from the streaming endpoint.
- Caches weather and currency responses in process memory for one hour.
- Provides interactive API documentation through Swagger UI.

## Project layout

```text
app/
├── main.py                 # FastAPI application and router registration
├── routes/
│   ├── model.py            # Request and response models
│   ├── planner.py          # Regular travel-plan endpoint
│   └── stream.py           # SSE travel-plan endpoint
└── services/
    ├── cache.py            # In-memory TTL cache
    ├── currency.py         # Exchange-rate API client
    ├── places.py           # Local places catalog
    └── weather.py          # Weather forecast API client
requirement.txt             # Pinned Python dependencies
```

The route and service imports currently treat `app/` as the Python import root. Start the server from the project root using the command below, which adds `app/` to the import path.

## Requirements and setup

- Python 3.10 or newer
- Internet access for the weather and exchange-rate services

From the project root, create and activate a virtual environment, then install the pinned dependencies:

### Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirement.txt
```

### macOS or Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirement.txt
```

Create a local `.env` from the template and add your provider credentials:

```powershell
Copy-Item .env.example .env
```

Set `WEATHER_API_KEY` and `EXCHANGE_RATE_API_KEY` in `.env`. The application loads this file locally; production deployments should set the same names in the backend host's secret/environment settings. Keep `.env` private and never commit provider keys.

The health endpoint reports whether the backend is reachable and whether each provider key is configured; it never returns key values. If a key is missing or still has the example `your_...` value, trip-planning requests return HTTP `503` with setup instructions instead of failing midway through an SSE stream.

## Run the API

From the project root, run:

```bash
python -m uvicorn main:app --app-dir app --reload
```

By default, the server listens at `http://127.0.0.1:8000`.

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- OpenAPI schema: `http://127.0.0.1:8000/openapi.json`
- Backend health and provider setup: `http://127.0.0.1:8000/health`

## Traveller frontend

The responsive static frontend lives in `frontend/`. It includes trip date validation, streaming progress, weather cards, local place suggestions, a currency converter, and a trip shelf saved in the browser's local storage. It has no frontend build step or package manager requirements.

To try it locally, start the API as shown above and open `frontend/index.html` in a browser. The frontend defaults to `http://127.0.0.1:8000`. To use another API server, set `apiBaseUrl` in `frontend/config.js` to that server's base URL. The API enables CORS for browser clients.

### Deploy the frontend to GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` deploys the static `frontend/` directory to GitHub Pages whenever changes to the frontend are pushed to `main`, or when manually triggered.

1. Deploy the FastAPI backend to a Python-capable host and configure `WEATHER_API_KEY` and `EXCHANGE_RATE_API_KEY` securely in that host's environment.
2. Set `apiBaseUrl` in `frontend/config.js` to the public backend URL (for example, `https://your-api.example.com`, without a trailing slash). Do not use `localhost` for a public Pages deployment.
3. Push the changes to the `main` branch.
4. In the GitHub repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
5. After the workflow succeeds, open the Pages URL shown in the workflow deployment.

The frontend is static; GitHub Pages does not host or run the FastAPI backend. Recent searches are stored only in the visitor's browser and are not synced between devices.

## API

### `GET /`

Returns the application name, version, and a short endpoint description.

### `POST /plan/`

Creates a complete travel plan and returns the collected data as JSON. Weather, places, and currency data are requested concurrently.

#### Request body

```json
{
  "destination": "goa",
  "start_date": "2026-12-01",
  "end_date": "2026-12-05",
  "base_currency": "INR"
}
```

`base_currency` is optional and defaults to `INR`. Dates must use the `YYYY-MM-DD` format.

#### Response shape

```json
{
  "message": "Travel plan successfully",
  "weather_data": [
    {
      "date": "2026-12-01",
      "condition": "Sunny",
      "temperature_high": 30.0,
      "temperature_low": 22.0,
      "humidity": 70.0,
      "rain_chance": 10.0
    }
  ],
  "places_data": [],
  "currency_rates": {}
}
```

Weather and exchange-rate values come from their external providers and vary by request. The places list contains catalog entries only for supported destinations.

### `POST /stream/travel-plan`

Accepts the same request body and returns a `text/event-stream` response. Events are emitted sequentially as each data source is queried:

| Event | Meaning |
|---|---|
| `start` | Aggregation has started |
| `weather` | Weather lookup is starting |
| `weather_complete` | Weather result is available |
| `options` | Places lookup is starting |
| `options_complete` | Places result is available |
| `currency` | Currency lookup is starting |
| `currency_complete` | Currency result is available |
| `complete` | Aggregation has finished |

Each event carries its JSON payload in the SSE `data` field. For example, use `curl -N` to keep the stream open and display events as they arrive:

```bash
curl -N -X POST "http://127.0.0.1:8000/stream/travel-plan" \
  -H "Content-Type: application/json" \
  -d '{"destination":"goa","start_date":"2026-12-01","end_date":"2026-12-05","base_currency":"INR"}'
```

## Request validation

Both planning endpoints apply the same trip-length rules:

- The start date must not be after the end date.
- The trip must span at least one day.
- The trip must not exceed 14 days.

Invalid trip lengths return HTTP `400`. Invalid or missing request fields are rejected by FastAPI/Pydantic with HTTP `422`.

## Data sources and current limitations

- **Weather:** Fetched from WeatherAPI. The result is cached in memory for one hour.
- **Currency:** Exchange rates are fetched from ExchangeRate-API for the requested base currency and cached in memory for one hour.
- **Places:** Read from a hard-coded local catalog. Current destination keys are `goa`, `jaipur`, `manali`, `chhattisgarh`, `hyderabad`, and `mumbai`; matching is case-sensitive. Other destination values return an empty places list.
- **Cache:** The cache is process-local and is lost when the server restarts. There are no public cache statistics or cache-clear routes, even though the root endpoint currently mentions them.
- **Provider configuration:** The weather and exchange-rate credentials are read from `WEATHER_API_KEY` and `EXCHANGE_RATE_API_KEY`. Local development loads them from `.env`; production should use the backend host's secret settings. If previously hard-coded credentials were committed or shared, revoke and rotate them.
- **Tests:** No project-specific test suite is currently included.

## Troubleshooting

- **`ModuleNotFoundError` for `routes` or `services`:** Run Uvicorn from the project root with `--app-dir app` as shown above. The imports expect `app/` to be on Python's module search path.
- **HTTP `422`:** Check that the body is valid JSON and includes `destination`, `start_date`, and `end_date`; use `YYYY-MM-DD` dates.
- **HTTP `400`:** Check that the end date is after the start date and that the trip is no longer than 14 days.
- **External API errors:** Check the server terminal for provider/network errors and verify that the provider credentials configured in the service modules are valid.
- **No places returned:** Use one of the supported destination keys exactly as written in the data-source list.
#
