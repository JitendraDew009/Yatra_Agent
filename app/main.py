from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from routes.planner import router as planner_router
from routes.stream import router as stream_router
from services.configuration import PROVIDER_KEYS, missing_provider_keys

app = FastAPI(
    title = "Yatra Planner API",
    description = "Aggregate travel data from multiple sources to provide single plan with SSE support",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "app": "Yatra Planner API",
        "version": "1.0.0",
        "endpoints": {
            "POST /plan": "Create a travel plan (Aggregated)",
            "GET /plan/stream" : "Stream a travel plan (SSE)",
            "GET/ plan/cache-stats": "View Cache statistics for travel plans",
            "DELETE /plan/cache": "Clear Cache for travel plans"
        }
    }


@app.get("/health")
async def health():
    missing_keys = missing_provider_keys()
    return {
        "status": "ok" if not missing_keys else "needs_configuration",
        "providers": {
            f"{provider}_configured": key not in missing_keys
            for provider, key in PROVIDER_KEYS.items()
        },
        "missing_configuration": missing_keys,
    }


app.include_router(planner_router)
app.include_router(stream_router)