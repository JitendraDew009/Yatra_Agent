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
requirements.txt            # Pinned Python dependencies
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
python -m pip install -r requirements.txt
```

### macOS or Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
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

## Architecture and request flow

The project is split into a static browser client and an API:

1. `frontend/index.html` provides the trip form and result panels. `frontend/styles.css` contains the responsive day/night themes, and `frontend/app.js` handles validation, API calls, streaming updates, and browser storage.
2. The browser sends the destination, dates, and base currency to `POST /stream/travel-plan`.
3. The FastAPI route validates the trip dates and checks that provider keys are configured before starting the stream.
4. The stream requests weather, places, and currency information in order, sending a progress event before and after each lookup.
5. The frontend updates the weather cards, places list, and currency converter as each result arrives.

The non-streaming `POST /plan/` route requests weather, places, and currency concurrently and returns one JSON response instead.

## Health and provider configuration

`GET /health` is intended for deployment checks and the frontend's connection indicator. Example response when the server is running but keys are missing:

```json
{
  "status": "needs_configuration",
  "providers": {
    "weather_configured": false,
    "currency_configured": false
  },
  "missing_configuration": [
    "WEATHER_API_KEY",
    "EXCHANGE_RATE_API_KEY"
  ]
}
```

With valid configured values, `status` is `ok`, both provider flags are `true`, and `missing_configuration` is empty. The endpoint reports only whether values are present; it never returns the values themselves. A reachable API with missing provider settings is different from an offline API.

Planning endpoints return HTTP `503 Service Unavailable` with setup instructions when keys are absent or still have the example `your_...` value. Add real keys to the project-root `.env` for local use, or to the backend host's secret environment settings in production. Restart the backend after changing local environment settings.

## Frontend behavior and browser storage

- **Day/night theme:** The first visit follows the browser's system color preference. A theme explicitly selected with the header toggle is remembered as `yatra-theme` in local storage.
- **Recent trips:** The trip shelf stores up to four recent searches under `yatra-recent-trips`. Selecting one restores its destination, dates, and currency. This data is local to the current browser and is not uploaded or synchronized.
- **Currency estimate:** After rates arrive, the converter multiplies the entered amount by the returned rate for the chosen target currency. It is an estimate, not a payment or card exchange quote.
- **Connection status:** The header checks `GET /health`. It distinguishes an offline API from an API that is reachable but needs provider configuration.
- **Live results:** The streaming endpoint uses a `fetch` request with a readable response body because the request includes a JSON body. It is not a browser `EventSource` connection.

## SSE event payloads

Each event is sent as `event: <name>` followed by one JSON `data:` line. Progress-only events contain a `message`; completed lookup events contain both a message and a `data` value.

For example:

```text
event: weather_complete
data: {"message":"Weather data fetched successfully.","data":[{"date":"2026-12-01","condition":"Sunny","temperature_high":30.0,"temperature_low":22.0,"humidity":70.0,"rain_chance":10.0}]}
```

The `weather_complete` value is a list of forecast objects, `options_complete` is a list of place objects, and `currency_complete` is an object keyed by target currency code. `complete` signals that all three lookups finished. Provider and network failures can interrupt the stream; check the backend terminal logs if a request reaches the server but cannot finish.

## Deployment notes

### FastAPI backend on Render

For a Render Web Service connected to this repository, use:

- **Root directory:** leave blank (repository root)
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn main:app --app-dir app --host 0.0.0.0 --port $PORT`
- **Environment variables:** `WEATHER_API_KEY` and `EXCHANGE_RATE_API_KEY`

After deployment, open `https://<your-api-host>/health` and confirm that it returns `"status": "ok"`. Provider keys belong in the host's environment settings, not in `frontend/config.js`, the Pages workflow, or committed source files.

### GitHub Pages frontend workflow

The workflow uploads only the contents of `frontend/`; the API code is not deployed to Pages. It runs on pushes to `main` that change `frontend/**` or the Pages workflow itself, and can also be started manually from the repository's **Actions** tab. README-only commits do not trigger this workflow.

Set the repository's Pages deployment source to **GitHub Actions** in **Settings → Pages**. Set `apiBaseUrl` in `frontend/config.js` to the public HTTPS backend URL before publishing. The browser sends requests directly to that URL, so the API must allow cross-origin browser requests and be publicly reachable over HTTPS.

### Run the frontend locally

From the repository root, start the API in one terminal. In a second terminal, serve the static frontend:

```bash
python -m http.server 5173 --directory frontend
```

Then open `http://127.0.0.1:5173/`. Serving the directory over HTTP (instead of opening the file directly) gives the browser a consistent local origin for requests and local storage.

## Security and privacy reminders

- `.env` is excluded by `.gitignore`; keep real API keys there locally and in the backend host's secret settings in production.
- `frontend/config.js` is public client-side configuration. It should contain only the API base URL, never provider secrets.
- The frontend stores recent trip searches and the theme choice in the visitor's browser local storage. Avoid using this browser storage on a shared device if the saved destinations or dates are sensitive.
- Rotate provider credentials if they were ever committed to Git or shared publicly.
#
