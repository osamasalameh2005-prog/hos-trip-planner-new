from django.urls import path

from .views import (
    health,
    trip_detail,
    trip_list_create,
)


urlpatterns = [
    path("health/", health),
    path("trips/", trip_list_create),
    path("trips/<int:trip_id>/", trip_detail),
]