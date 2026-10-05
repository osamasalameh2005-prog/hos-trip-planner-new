import math
import requests


OSRM_URL = "https://router.project-osrm.org/route/v1/driving"


def geocode(place):
    """
    Convert a place name into latitude and longitude
    using the free Nominatim API.
    """

    response = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={
            "q": place,
            "format": "json",
            "limit": 1,
        },
        headers={
            "User-Agent": "HOS-Trip-Planner/1.0"
        },
        timeout=15,
    )

    response.raise_for_status()

    results = response.json()

    if not results:
        raise ValueError(
            f"Could not find location: {place}"
        )

    return {
        "lat": float(results[0]["lat"]),
        "lon": float(results[0]["lon"]),
        "display_name": results[0]["display_name"],
    }


def get_route(start, end):
    """
    Get road route between two coordinates
    using the free OSRM routing API.
    """

    url = (
        f"{OSRM_URL}/"
        f"{start['lon']},{start['lat']};"
        f"{end['lon']},{end['lat']}"
    )

    response = requests.get(
        url,
        params={
            "overview": "full",
            "geometries": "geojson",
            "steps": "true",
        },
        timeout=30,
    )

    response.raise_for_status()

    data = response.json()

    if data.get("code") != "Ok":
        raise ValueError(
            "Could not calculate route."
        )

    route = data["routes"][0]

    return route


def build_route(
    current_location,
    pickup_location,
    dropoff_location,
):
    """
    Geocode the three locations and calculate:

    Current -> Pickup
    Pickup -> Dropoff
    """

    current = geocode(current_location)
    pickup = geocode(pickup_location)
    dropoff = geocode(dropoff_location)

    first_route = get_route(
        current,
        pickup,
    )

    second_route = get_route(
        pickup,
        dropoff,
    )

    first_distance = (
        first_route["distance"] / 1609.344
    )

    second_distance = (
        second_route["distance"] / 1609.344
    )

    first_duration = (
        first_route["duration"] / 3600
    )

    second_duration = (
        second_route["duration"] / 3600
    )

    total_distance = (
        first_distance +
        second_distance
    )

    total_duration = (
        first_duration +
        second_duration
    )

    return {
        "locations": {
            "current": current,
            "pickup": pickup,
            "dropoff": dropoff,
        },

        "distance_miles": round(
            total_distance,
            2,
        ),

        "duration_hours": round(
            total_duration,
            2,
        ),

        "segments": [
            {
                "name": "Current → Pickup",
                "distance_miles": round(
                    first_distance,
                    2,
                ),
                "duration_hours": round(
                    first_duration,
                    2,
                ),
                "geometry": first_route[
                    "geometry"
                ],
                "steps": extract_steps(
                    first_route
                ),
            },
            {
                "name": "Pickup → Dropoff",
                "distance_miles": round(
                    second_distance,
                    2,
                ),
                "duration_hours": round(
                    second_duration,
                    2,
                ),
                "geometry": second_route[
                    "geometry"
                ],
                "steps": extract_steps(
                    second_route
                ),
            },
        ],
    }


def extract_steps(route):
    """
    Extract readable driving instructions.
    """

    instructions = []

    for leg in route.get("legs", []):

        for step in leg.get(
            "steps",
            [],
        ):

            name = step.get(
                "name",
                "",
            )

            distance = (
                step.get(
                    "distance",
                    0,
                ) / 1609.344
            )

            maneuver = step.get(
                "maneuver",
                {},
            )

            instruction = maneuver.get(
                "instruction"
            )

            if not instruction:

                instruction = (
                    maneuver.get(
                        "type",
                        "Continue",
                    )
                )

                if name:
                    instruction += (
                        f" on {name}"
                    )

            instructions.append(
                {
                    "instruction": instruction,
                    "distance_miles": round(
                        distance,
                        2,
                    ),
                }
            )

    return instructions


def schedule_hos(
    distance_miles,
    duration_hours,
    current_cycle_used,
    current_location,
    pickup_location,
    dropoff_location,
):
    """
    Build a simplified HOS trip plan.

    Assumptions from the assessment:

    - Property-carrying driver
    - 70 hours / 8 days
    - 11 hours driving
    - 14 hour duty window
    - 30 minute break after 8 hours driving
    - Pickup = 1 hour
    - Dropoff = 1 hour
    - Fuel every 1000 miles
    - No adverse conditions
    """

    MAX_DRIVING_PER_DAY = 11
    MAX_WINDOW_PER_DAY = 14
    MAX_CYCLE = 70
    BREAK_AFTER = 8
    BREAK_DURATION = 0.5
    PICKUP_TIME = 1
    DROPOFF_TIME = 1
    FUEL_EVERY_MILES = 1000
    FUEL_TIME = 0.5

    cycle_remaining = (
        MAX_CYCLE -
        current_cycle_used
    )

    if cycle_remaining <= 0:
        cycle_remaining = 0

    remaining_miles = distance_miles
    remaining_driving = duration_hours

    days = []
    day_number = 1

    total_miles_driven = 0
    total_driving_hours = 0

    while (
        remaining_driving > 0.01
        or remaining_miles > 0.01
        or not days
    ):

        if day_number > 1 and cycle_remaining <= 0:

            days.append(
                {
                    "day": day_number,
                    "restart": True,
                    "events": [
                        {
                            "type": "off_duty",
                            "hours": 34,
                            "description": (
                                "34-hour restart"
                            ),
                        }
                    ],
                    "driving_hours": 0,
                    "on_duty_hours": 0,
                    "miles": 0,
                }
            )

            cycle_remaining = MAX_CYCLE
            day_number += 1
            continue

        available_cycle = min(
            cycle_remaining,
            MAX_WINDOW_PER_DAY,
        )

        driving_today = min(
            remaining_driving,
            MAX_DRIVING_PER_DAY,
            available_cycle,
        )

        miles_today = 0

        if duration_hours > 0:
            miles_today = (
                distance_miles *
                (
                    driving_today /
                    duration_hours
                )
            )

        miles_today = min(
            miles_today,
            remaining_miles,
        )

        events = []

        events.append(
            {
                "type": "driving",
                "hours": round(
                    driving_today,
                    2,
                ),
                "miles": round(
                    miles_today,
                    2,
                ),
            }
        )

        break_count = 0

        if driving_today > BREAK_AFTER:

            break_count = 1

            events.append(
                {
                    "type": "break",
                    "hours": BREAK_DURATION,
                    "description": (
                        "30-minute rest break"
                    ),
                }
            )

        on_duty_hours = driving_today

        if day_number == 1:
            on_duty_hours += PICKUP_TIME

        is_last_day = (
            remaining_driving <= driving_today + 0.01
        )

        if is_last_day:
            on_duty_hours += DROPOFF_TIME

        if miles_today > FUEL_EVERY_MILES:

            fuel_stops = math.floor(
                miles_today /
                FUEL_EVERY_MILES
            )

            for _ in range(fuel_stops):

                events.append(
                    {
                        "type": "fuel",
                        "hours": FUEL_TIME,
                        "description": (
                            "Fuel stop"
                        ),
                    }
                )

                on_duty_hours += FUEL_TIME

        if day_number == 1:

            events.insert(
                0,
                {
                    "type": "pickup",
                    "hours": PICKUP_TIME,
                    "description": (
                        "Pickup operation"
                    ),
                },
            )

        if is_last_day:

            events.append(
                {
                    "type": "dropoff",
                    "hours": DROPOFF_TIME,
                    "description": (
                        "Drop-off operation"
                    ),
                }
            )

        on_duty_hours = min(
            on_duty_hours,
            MAX_WINDOW_PER_DAY,
        )

        days.append(
            {
                "day": day_number,
                "restart": False,
                "events": events,
                "driving_hours": round(
                    driving_today,
                    2,
                ),
                "on_duty_hours": round(
                    on_duty_hours,
                    2,
                ),
                "miles": round(
                    miles_today,
                    2,
                ),
            }
        )

        remaining_driving -= driving_today
        remaining_miles -= miles_today

        cycle_remaining -= on_duty_hours

        total_miles_driven += miles_today
        total_driving_hours += driving_today

        day_number += 1

        if (
            remaining_driving <= 0.01
            and remaining_miles <= 0.01
        ):
            break

    return {
        "assumptions": {
            "cycle_limit_hours": 70,
            "cycle_days": 8,
            "daily_driving_limit": 11,
            "daily_window": 14,
            "break_after_driving_hours": 8,
            "break_duration_hours": 0.5,
            "pickup_hours": 1,
            "dropoff_hours": 1,
            "fuel_interval_miles": 1000,
            "fuel_stop_hours": 0.5,
            "adverse_conditions": False,
        },

        "summary": {
            "distance_miles": round(
                distance_miles,
                2,
            ),
            "estimated_driving_hours": round(
                duration_hours,
                2,
            ),
            "cycle_used_before_trip": round(
                current_cycle_used,
                2,
            ),
            "cycle_remaining_before_trip": round(
                MAX_CYCLE -
                current_cycle_used,
                2,
            ),
        },

        "days": days,
    }