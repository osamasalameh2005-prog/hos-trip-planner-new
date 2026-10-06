import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import "./App.css";

const API_URL = `${
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
}/api/trips/`;

const NOMINATIM_URL =
  "https://nominatim.openstreetmap.org/search";

function App() {
  const [currentLocation, setCurrentLocation] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [cycleUsed, setCycleUsed] = useState("");

  const [currentSuggestions, setCurrentSuggestions] = useState([]);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function searchLocation(value, setter) {
    if (!value || value.length < 3) {
      setter([]);
      return;
    }

    try {
      const response = await fetch(
        `${NOMINATIM_URL}?q=${encodeURIComponent(
          value
        )}&format=json&limit=5&addressdetails=1`
      );

      const data = await response.json();
      setter(data);
    } catch {
      setter([]);
    }
  }

  function selectSuggestion(item, setter) {
    setter(item.display_name);
  }

  async function createTrip(event) {
    event.preventDefault();

    setError("");
    setTrip(null);
    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_location: currentLocation,
          pickup_location: pickupLocation,
          dropoff_location: dropoffLocation,
          current_cycle_used: Number(cycleUsed),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to create trip."
        );
      }

      setTrip(data);
    } catch (err) {
      setError(
        err.message || "فشل في جلب بيانات الرحلة."
      );
    } finally {
      setLoading(false);
    }
  }

  const mapCenter = useMemo(() => {
    if (
      trip?.route?.locations?.current
    ) {
      return [
        trip.route.locations.current.lat,
        trip.route.locations.current.lon,
      ];
    }

    return [31.95, 35.91];
  }, [trip]);

  function geometryToPositions(geometry) {
    if (!geometry?.coordinates) {
      return [];
    }

    return geometry.coordinates.map(
      ([lon, lat]) => [lat, lon]
    );
  }

  useEffect(() => {
    document.title = "HOS Trip Planner";
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>HOS Trip Planner</h1>
          <p>
            تخطيط المسار والسجلات اليومية الإلكترونية
          </p>
        </div>
      </header>

      <main className="container">
        <section className="card">
          <h2>معلومات الرحلة</h2>

          <form onSubmit={createTrip}>
            <div className="field">
              <label>الموقع الحالي</label>

              <input
                type="text"
                value={currentLocation}
                onChange={(e) => {
                  setCurrentLocation(e.target.value);
                  searchLocation(
                    e.target.value,
                    setCurrentSuggestions
                  );
                }}
                placeholder="مثال: عمان، الأردن"
                required
              />

              {currentSuggestions.length > 0 && (
                <div className="suggestions">
                  {currentSuggestions.map((item) => (
                    <button
                      type="button"
                      key={item.place_id}
                      onClick={() => {
                        selectSuggestion(
                          item,
                          setCurrentLocation
                        );
                        setCurrentSuggestions([]);
                      }}
                    >
                      {item.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="field">
              <label>موقع الاستلام</label>

              <input
                type="text"
                value={pickupLocation}
                onChange={(e) => {
                  setPickupLocation(e.target.value);
                  searchLocation(
                    e.target.value,
                    setPickupSuggestions
                  );
                }}
                placeholder="مثال: الزرقاء، الأردن"
                required
              />

              {pickupSuggestions.length > 0 && (
                <div className="suggestions">
                  {pickupSuggestions.map((item) => (
                    <button
                      type="button"
                      key={item.place_id}
                      onClick={() => {
                        selectSuggestion(
                          item,
                          setPickupLocation
                        );
                        setPickupSuggestions([]);
                      }}
                    >
                      {item.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="field">
              <label>موقع التسليم</label>

              <input
                type="text"
                value={dropoffLocation}
                onChange={(e) => {
                  setDropoffLocation(e.target.value);
                  searchLocation(
                    e.target.value,
                    setDropoffSuggestions
                  );
                }}
                placeholder="مثال: الطفيلة، الأردن"
                required
              />

              {dropoffSuggestions.length > 0 && (
                <div className="suggestions">
                  {dropoffSuggestions.map((item) => (
                    <button
                      type="button"
                      key={item.place_id}
                      onClick={() => {
                        selectSuggestion(
                          item,
                          setDropoffLocation
                        );
                        setDropoffSuggestions([]);
                      }}
                    >
                      {item.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="field">
              <label>
                عدد الساعات المستخدمة في الدورة الحالية
              </label>

              <input
                type="number"
                min="0"
                max="70"
                step="0.1"
                value={cycleUsed}
                onChange={(e) =>
                  setCycleUsed(e.target.value)
                }
                placeholder="مثال: 10"
                required
              />
            </div>

            {error && (
              <div className="error">
                {error}
              </div>
            )}

            <button
              className="submit-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "جاري إنشاء الرحلة..."
                : "إنشاء رحلة"}
            </button>
          </form>
        </section>

        {trip && (
          <>
            <section className="card">
              <h2>ملخص الرحلة</h2>

              <div className="summary-grid">
                <div>
                  <strong>
                    المسافة
                  </strong>
                  <span>
                    {trip.distance_miles} miles
                  </span>
                </div>

                <div>
                  <strong>
                    مدة القيادة
                  </strong>
                  <span>
                    {trip.duration_hours} hours
                  </span>
                </div>

                <div>
                  <strong>
                    الدورة المستخدمة
                  </strong>
                  <span>
                    {trip.current_cycle_used} hours
                  </span>
                </div>
              </div>
            </section>

            <section className="card">
              <h2>الخريطة</h2>

              <div className="map-container">
                <MapContainer
                  center={mapCenter}
                  zoom={7}
                  scrollWheelZoom={true}
                  style={{
                    height: "500px",
                    width: "100%",
                  }}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {trip.route.locations.current && (
                    <Marker
                      position={[
                        trip.route.locations.current.lat,
                        trip.route.locations.current.lon,
                      ]}
                    >
                      <Popup>
                        الموقع الحالي
                        <br />
                        {currentLocation}
                      </Popup>
                    </Marker>
                  )}

                  {trip.route.locations.pickup && (
                    <Marker
                      position={[
                        trip.route.locations.pickup.lat,
                        trip.route.locations.pickup.lon,
                      ]}
                    >
                      <Popup>
                        موقع الاستلام
                        <br />
                        {pickupLocation}
                      </Popup>
                    </Marker>
                  )}

                  {trip.route.locations.dropoff && (
                    <Marker
                      position={[
                        trip.route.locations.dropoff.lat,
                        trip.route.locations.dropoff.lon,
                      ]}
                    >
                      <Popup>
                        موقع التسليم
                        <br />
                        {dropoffLocation}
                      </Popup>
                    </Marker>
                  )}

                  {trip.route.segments?.map(
                    (segment, index) => (
                      <Polyline
                        key={index}
                        positions={geometryToPositions(
                          segment.geometry
                        )}
                      />
                    )
                  )}
                </MapContainer>
              </div>
            </section>

            <section className="card">
              <h2>تعليمات الطريق</h2>

              {trip.route.segments?.map(
                (segment, index) => (
                  <div
                    className="route-section"
                    key={index}
                  >
                    <h3>{segment.name}</h3>

                    <p>
                      المسافة:{" "}
                      {segment.distance_miles} miles
                      {" | "}
                      المدة:{" "}
                      {segment.duration_hours} hours
                    </p>

                    <ol>
                      {segment.steps
                        ?.slice(0, 30)
                        .map((step, stepIndex) => (
                          <li key={stepIndex}>
                            {step.instruction}
                            {" — "}
                            {step.distance_miles} miles
                          </li>
                        ))}
                    </ol>
                  </div>
                )
              )}
            </section>

            <section className="card">
              <h2>
                Daily Log Sheets / ELD Logs
              </h2>

              {trip.plan?.days?.map((day) => (
                <div
                  className="eld-day"
                  key={day.day}
                >
                  <h3>
                    Day {day.day}
                  </h3>

                  {day.restart && (
                    <div className="eld-event">
                      <strong>
                        34-hour restart
                      </strong>

                      <span>
                        34 hours Off Duty
                      </span>
                    </div>
                  )}

                  {day.events?.map(
                    (event, index) => (
                      <div
                        className="eld-event"
                        key={index}
                      >
                        <strong>
                          {event.type}
                        </strong>

                        <span>
                          {event.description ||
                            `${event.hours} hours`}
                        </span>

                        {event.miles !== undefined && (
                          <span>
                            {event.miles} miles
                          </span>
                        )}
                      </div>
                    )
                  )}

                  <div className="day-summary">
                    <span>
                      Driving:{" "}
                      {day.driving_hours} h
                    </span>

                    <span>
                      On Duty:{" "}
                      {day.on_duty_hours} h
                    </span>

                    <span>
                      Miles:{" "}
                      {day.miles}
                    </span>
                  </div>
                </div>
              ))}
            </section>

            <section className="card">
              <h2>الافتراضات</h2>

              <ul>
                <li>
                  الحد الأقصى للدورة: 70 ساعة / 8 أيام
                </li>

                <li>
                  القيادة اليومية: 11 ساعة
                </li>

                <li>
                  نافذة العمل اليومية: 14 ساعة
                </li>

                <li>
                  استراحة 30 دقيقة بعد 8 ساعات قيادة
                </li>

                <li>
                  الاستلام: ساعة واحدة
                </li>

                <li>
                  التسليم: ساعة واحدة
                </li>

                <li>
                  التزود بالوقود كل 1000 ميل
                </li>

                <li>
                  لا توجد ظروف قيادة جوية سيئة
                </li>
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;