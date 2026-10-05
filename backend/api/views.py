from django.http import JsonResponse

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .models import Trip
from .serializers import TripSerializer
from .services import build_route, schedule_hos


@api_view(["GET"])
def health(request):
    return JsonResponse({
        "status": "ok",
        "service": "HOS Trip Planner API"
    })


@api_view(["GET", "POST"])
def trip_list_create(request):

    if request.method == "GET":

        trips = Trip.objects.order_by("-created_at")[:20]

        return Response(
            TripSerializer(trips, many=True).data
        )

    data = request.data

    required = [
        "current_location",
        "pickup_location",
        "dropoff_location",
        "current_cycle_used",
    ]

    missing = [
        field
        for field in required
        if data.get(field) in (None, "")
    ]

    if missing:

        return Response(
            {
                "error": (
                    "Missing fields: "
                    + ", ".join(missing)
                )
            },
            status=400,
        )

    try:

        cycle = float(
            data["current_cycle_used"]
        )

        if not 0 <= cycle <= 70:
            raise ValueError

    except (TypeError, ValueError):

        return Response(
            {
                "error": (
                    "Current Cycle Used must be "
                    "a number from 0 to 70."
                )
            },
            status=400,
        )

    try:

        route = build_route(
            data["current_location"],
            data["pickup_location"],
            data["dropoff_location"],
        )

        plan = schedule_hos(
            route["distance_miles"],
            route["duration_hours"],
            cycle,
            data["current_location"],
            data["pickup_location"],
            data["dropoff_location"],
        )

        trip = Trip.objects.create(

            current_location=data[
                "current_location"
            ],

            pickup_location=data[
                "pickup_location"
            ],

            dropoff_location=data[
                "dropoff_location"
            ],

            current_cycle_used=cycle,

            distance_miles=route[
                "distance_miles"
            ],

            duration_hours=route[
                "duration_hours"
            ],

            route=route,

            plan=plan,
        )

        return Response(
            TripSerializer(trip).data,
            status=status.HTTP_201_CREATED,
        )

    except Exception as exc:

        return Response(
            {
                "error": str(exc)
            },
            status=502,
        )


@api_view(["GET"])
def trip_detail(request, trip_id):

    try:

        trip = Trip.objects.get(
            pk=trip_id
        )

    except Trip.DoesNotExist:

        return Response(
            {
                "error": "Trip not found."
            },
            status=404,
        )

    return Response(
        TripSerializer(trip).data
    )