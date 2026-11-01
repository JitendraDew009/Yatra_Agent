from datetime import date, datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from routes.model import TravelRequestModel
import json

from services.currency import fetch_currency_rates
from services.places import fetch_places
from services.weather import fetch_weather
from services.configuration import provider_configuration_error


router = APIRouter(
    prefix="/stream",
    tags=["Travel plan stream"],
)

def _jsonable(value):
    if isinstance(value, BaseModel):
        return value.model_dump()
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {key: _jsonable(val) for key, val in value.items()}  
    raise TypeError(f"Object of type {type(value)} is not JSON serializable")
    return value

def format_sse(data: str, event: str = None) -> str:
   json_data = json.dumps(data, default=_jsonable)
   return f"data: {json_data}\n\n" if event is None else f"event: {event}\ndata: {json_data}\n\n"

async def stream_generator(travel_request: TravelRequestModel):
    yield format_sse({"message": "Starting travel plan aggregation..."}, event="start")
    yield format_sse({"message": "Fetching weather data..."}, event="weather")
    weather_data = await fetch_weather(
        destination=travel_request.destination,
        start_date=travel_request.start_date,
        end_date=travel_request.end_date,
    )

    yield format_sse({"message": "Weather data fetched successfully.", "data": weather_data}, event="weather_complete")
    yield format_sse({"message": "Fetching places data..."}, event="options")
    
    places_data = await fetch_places(travel_request.destination)    
    
    yield format_sse({"message": "Places data fetched successfully.", "data": places_data}, event="options_complete")
    yield format_sse({"message": "Fetching currency rates..."}, event="currency")
    
    currency_data = await fetch_currency_rates(travel_request.base_currency)
    
    yield format_sse({"message": "Currency rates fetched successfully.", "data": currency_data}, event="currency_complete")
    yield format_sse({"message": "Travel plan aggregation completed."}, event="complete")


@router.post("/travel-plan", response_class=StreamingResponse, summary="Stream a travel plan (SSE)")
async def stream_travel_plan(travel_request: TravelRequestModel):
    if travel_request.start_date > travel_request.end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date cannot be after end date"
        )

    trip_days = (travel_request.end_date - travel_request.start_date).days

    if trip_days < 1:
        raise HTTPException(
            status_code=400,
            detail="Trip duration must be at least 1 day"
        )

    if trip_days > 14:
        raise HTTPException(
            status_code=400,
            detail="Travel plan cannot be longer than 14 days"
        )

    configuration_error = provider_configuration_error()
    if configuration_error:
        raise HTTPException(status_code=503, detail=configuration_error)

    return StreamingResponse(
        stream_generator(travel_request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "connection": "keep-alive"},
    )
