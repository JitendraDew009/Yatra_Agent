from fastapi import APIRouter
import asyncio
from services.currency import fetch_currency_rates
from services.places import fetch_places
from routes.model import TravelRequestModel
from fastapi import HTTPException
from services.weather import fetch_weather
from services.configuration import provider_configuration_error

router = APIRouter(
    prefix="/plan",
    tags=["Travel plan"],
)


@router.post("/")
async def create_travel_plan(
    travel_request: TravelRequestModel,
    
):
    """Aggregate Weather, Currency, and Places data into a single plan."""
    
    
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

    # Here, you would typically call the services to aggregate the travel data
    # Weather data, Currency Rates, and Places data would be fetched and aggregate
    weather_data, places_data, currency_rates = await asyncio.gather(
         fetch_weather(
            destination=travel_request.destination,
            start_date=travel_request.start_date,
            end_date=travel_request.end_date,
        ),
        fetch_places(travel_request.destination),
        fetch_currency_rates(travel_request.base_currency)
    )

    
    return {
        "message": "Travel plan successfully",
        "weather_data": weather_data,
        "places_data": places_data,
        "currency_rates": currency_rates
    }