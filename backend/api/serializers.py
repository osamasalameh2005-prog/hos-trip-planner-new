from rest_framework import serializers
from .models import Trip


class TripSerializer(serializers.ModelSerializer):

    class Meta:
        model = Trip
        fields = "__all__"

        read_only_fields = (
            "distance_miles",
            "duration_hours",
            "route",
            "plan",
            "created_at",
        )