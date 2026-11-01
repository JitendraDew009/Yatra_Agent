from routes.model import PlaceModel
PLACES_DATABASE = {
    "goa": [
        PlaceModel(
            name="Paradise Beach", 
            description="Beautiful beach with clear waters",
            category="Beach",
            rating=4.5,
            estimated_time_hours=3,
            entry_fee=None
        ),
        PlaceModel(
            name="Basilica of Bom Jesus", 
            description="UNESCO World Heritage Site, famous for its baroque architecture",
            category="Historical Site",
            rating=4.7,
            estimated_time_hours=1,
            entry_fee=5.0
        ),
        PlaceModel(
            name="Dudhsagar Falls", 
            description="Spectacular four-tiered waterfall located on the Mandovi River",
            category="Nature",
            rating=4.8,
            estimated_time_hours=2,
            entry_fee=None
        ),
    ]
    ,
    "jaipur": [
        PlaceModel(
            name="Amber Fort", 
            description="Magnificent fort with a blend of Hindu and Mughal architecture",
            category="Historical Site",
            rating=4.6,
            estimated_time_hours=2,
            entry_fee=10.0
        ),
        PlaceModel(
            name="City Palace", 
            description="A beautiful palace complex with museums and courtyards",
            category="Historical Site",
            rating=4.5,
            estimated_time_hours=2,
            entry_fee=8.0
        ),
        PlaceModel(
            name="Hawa Mahal", 
            description="Iconic palace known for its unique honeycomb structure",
            category="Historical Site",
            rating=4.4,
            estimated_time_hours=1,
            entry_fee=3.0
        )
    ]
    ,
    "manali": [
        PlaceModel(
            name="Solang Valley", 
            description="Popular for adventure sports and scenic views",
            category="Nature",
            rating=4.7,
            estimated_time_hours=3,
            entry_fee=None
        ),
        PlaceModel(
            name="Hadimba Temple", 
            description="Ancient cave temple surrounded by cedar forests",
            category="Religious Site",
            rating=4.5,
            estimated_time_hours=1,
            entry_fee=None
        ),
        PlaceModel(
            name="Rohtang Pass", 
            description="High mountain pass offering breathtaking views and snow activities",
            category="Nature",
            rating=4.8,
            estimated_time_hours=4,
            entry_fee=None
        )
    ],
    "chhattisgarh": [
        PlaceModel(
            name="Chitrakote Falls", 
            description="Known as the 'Niagara of India', it's the widest waterfall in India",
            category="Nature",
            rating=4.6,
            estimated_time_hours=2,
            entry_fee=None
        ),
        PlaceModel(
            name="Kanger Valley National Park", 
            description="A national park with rich biodiversity and limestone caves",
            category="Nature",
            rating=4.5,
            estimated_time_hours=3,
            entry_fee=5.0
        ),
        PlaceModel(
            name="Bastar Palace", 
            description="Historical palace showcasing the culture and heritage of Bastar region",
            category="Historical Site",
            rating=4.4,
            estimated_time_hours=1,
            entry_fee=2.0
        )
    ],
    "hyderabad": [
        PlaceModel(
            name="Charminar", 
            description="Iconic monument and mosque, a symbol of Hyderabad",
            category="Historical Site",
            rating=4.7,
            estimated_time_hours=1,
            entry_fee=3.0
        ),
        PlaceModel(
            name="Golconda Fort", 
            description="Historic fort known for its acoustics and architecture",
            category="Historical Site",
            rating=4.6,
            estimated_time_hours=2,
            entry_fee=5.0
        ),
        PlaceModel(
            name="Ramoji Film City", 
            description="Largest film studio complex in the world, offering tours and entertainment",
            category="Entertainment",
            rating=4.5,
            estimated_time_hours=4,
            entry_fee=15.0
        )
    ]
    ,
    "mumbai": [
        PlaceModel(
            name="Gateway of India", 
            description="Iconic arch monument overlooking the Arabian Sea",
            category="Historical Site",
            rating=4.6,
            estimated_time_hours=1,
            entry_fee=None
        ),
        PlaceModel(
            name="Marine Drive", 
            description="Scenic promenade along the coast, popular for evening walks",
            category="Nature",
            rating=4.5,
            estimated_time_hours=2,
            entry_fee=None
        ),
        PlaceModel(
            name="Elephanta Caves", 
            description="Rock-cut caves with ancient sculptures, a UNESCO World Heritage Site",
            category="Historical Site",
            rating=4.7,
            estimated_time_hours=3,
            entry_fee=6.0
        )
    ]

}

async def fetch_places(destination: str) -> list[PlaceModel]:   
    """Fetch places of interest for a given destination from the in-memory database."""
    return PLACES_DATABASE.get(destination, [])