from django.db import models


class Trip(models.Model):
    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)

    current_cycle_used = models.FloatField()

    distance_miles = models.FloatField(default=0)
    duration_hours = models.FloatField(default=0)

    route = models.JSONField(default=dict)
    plan = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.current_location} -> {self.dropoff_location}"