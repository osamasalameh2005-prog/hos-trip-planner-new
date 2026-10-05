import { useEffect, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";


const API_URL = "http://127.0.0.1:8000/api/trips/";

const defaultCenter = [31.95, 35.91];


function MapUpdater({ locations }) {
  const map = useMap();

  useEffect(() => {
    const points = [
      locations?.current,
      locations?.pickup,
      locations?.dropoff,
    ].filter(Boolean);

    if (points.length === 0) {
      return;
    }

    const bounds = L.latLngBounds(
      points.map((point) => [
        point.lat,
        point.lon,
      ])
    );

    map.fitBounds(bounds, {
      padding: [40, 40],
    });
  }, [locations, map]);

  return null;
}


function LocationInput({
  label,
  value,
  onChange,
  onSelect,
  selected,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!value || value.length < 3 || selected) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);

        const url =
          "https://nominatim.openstreetmap.org/search?" +
          new URLSearchParams({
            q: value,
            format: "json",
            addressdetails: "1",
            limit: "5",
          });

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Location search failed.");
        }

        const data = await response.json();

        setSuggestions(data);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [value, selected]);

  return (
    <div className="location-field">
      <label>{label}</label>

      <input
        value={value}
        placeholder={`Search ${label}`}
        onChange={(event) => {
          onChange(event.target.value);
          onSelect(null);
        }}
        onFocus={() => {
          if (selected) {
            onChange("");
            onSelect(null);
          }
        }}
      />

      {loading && (
        <div className="suggestion-status">
          Searching...
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="suggestions">
          {suggestions.map((item) => (
            <button
              type="button"
              className="suggestion"
              key={item.place_id}
              onClick={() => {
                onChange(item.display_name);
                onSelect(item);
                setSuggestions([]);
              }}
            >
              {item.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


function ELDGraph({ day }) {
  const events = day.events || [];

  return (
    <div className="eld-card">
      <h3>
        Day {day.day}
        {day.restart ? " - 34 Hour Restart" : ""}
      </h3>

      <div className="eld-details">

        {events.length === 0 && (
          <p>No events recorded.</p>
        )}

        {events.map((event, index) => (
          <div
            className="eld-log"
            key={index}
          >
            <strong>
              {event.type
                .replaceAll("_", " ")
                .toUpperCase()}
            </strong>

            <span>
              {event.hours} hours
            </span>

            <small>
              {event.description || ""}
            </small>
          </div>
        ))}

      </div>

      <div className="summary-grid">

        <div>
          <span>Driving</span>
          <strong>
            {day.driving_hours} hours
          </strong>
        </div>

        <div>
          <span>On Duty</span>
          <strong>
            {day.on_duty_hours} hours
          </strong>
        </div>

        <div>
          <span>Miles</span>
          <strong>
            {day.miles} miles
          </strong>
        </div>

      </div>
    </div>
  );
}


function App() {

  const [currentLocation, setCurrentLocation] =
    useState("");

  const [pickupLocation, setPickupLocation] =
    useState("");

  const [dropoffLocation, setDropoffLocation] =
    useState("");

  const [currentSelected, setCurrentSelected] =
    useState(null);

  const [pickupSelected, setPickupSelected] =
    useState(null);

  const [dropoffSelected, setDropoffSelected] =
    useState(null);

  const [cycleUsed, setCycleUsed] =
    useState("");

  const [result, setResult] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  async function createTrip(event) {

    event.preventDefault();

    setError("");
    setResult(null);

    if (!currentSelected) {
      setError(
        "Please select Current Location from the suggestions."
      );
      return;
    }

    if (!pickupSelected) {
      setError(
        "Please select Pickup Location from the suggestions."
      );
      return;
    }

    if (!dropoffSelected) {
      setError(
        "Please select Dropoff Location from the suggestions."
      );
      return;
    }

    if (cycleUsed === "") {
      setError(
        "Please enter Current Cycle Used."
      );
      return;
    }

    const cycle = Number(cycleUsed);

    if (
      Number.isNaN(cycle) ||
      cycle < 0 ||
      cycle > 70
    ) {
      setError(
        "Current Cycle Used must be between 0 and 70."
      );
      return;
    }


    try {

      setLoading(true);

      const response = await fetch(
        API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            current_location:
              currentSelected.display_name,

            pickup_location:
              pickupSelected.display_name,

            dropoff_location:
              dropoffSelected.display_name,

            current_cycle_used:
              cycle,
          }),
        }
      );


      const data =
        await response.json();


      if (!response.ok) {
        throw new Error(
          data.error ||
          "Could not create trip."
        );
      }


      setResult(data);

    } catch (requestError) {

      setError(
        requestError.message ||
        "Something went wrong."
      );

    } finally {

      setLoading(false);

    }
  }


  const locations =
    result?.route?.locations || {};

  const segments =
    result?.route?.segments || [];

  const plan =
    result?.plan || {};

  const days =
    plan.days || [];

  const assumptions =
    plan.assumptions || {};

  const summary =
    plan.summary || {};


  const currentToPickup =
    segments.find(
      (segment) =>
        segment.name === "Current → Pickup"
    );

  const pickupToDropoff =
    segments.find(
      (segment) =>
        segment.name === "Pickup → Dropoff"
    );


  return (
    <div className="app">

      <header className="header">

        <div>

          <h1>
            HOS Trip Planner
          </h1>

          <p>
            Route planning and ELD daily logs
          </p>

        </div>

      </header>


      <main className="container">


        {/* Trip Form */}

        <section className="panel">

          <h2>
            Trip Information
          </h2>


          <form onSubmit={createTrip}>


            <LocationInput
              label="Current Location"
              value={currentLocation}
              onChange={setCurrentLocation}
              onSelect={setCurrentSelected}
              selected={currentSelected}
            />


            <LocationInput
              label="Pickup Location"
              value={pickupLocation}
              onChange={setPickupLocation}
              onSelect={setPickupSelected}
              selected={pickupSelected}
            />


            <LocationInput
              label="Dropoff Location"
              value={dropoffLocation}
              onChange={setDropoffLocation}
              onSelect={setDropoffSelected}
              selected={dropoffSelected}
            />


            <div className="field">

              <label>
                Current Cycle Used (hours)
              </label>

              <input
                type="number"
                min="0"
                max="70"
                step="0.01"
                value={cycleUsed}
                placeholder="Example: 10"
                onChange={(event) =>
                  setCycleUsed(
                    event.target.value
                  )
                }
              />

            </div>


            {error && (
              <div className="error">
                {error}
              </div>
            )}


            <button
              className="primary-button"
              type="submit"
              disabled={loading}
            >

              {loading
                ? "Calculating..."
                : "Create Trip"}

            </button>


          </form>

        </section>



        {/* Result */}

        {result && (

          <>


            <section className="panel">

              <h2>
                Trip Result
              </h2>


              <div className="summary-grid">


                <div>

                  <span>
                    Current Cycle Used
                  </span>

                  <strong>
                    {result.current_cycle_used}
                    {" "}hours
                  </strong>

                </div>


                <div>

                  <span>
                    Cycle Remaining
                  </span>

                  <strong>
                    {summary.cycle_remaining_before_trip}
                    {" "}hours
                  </strong>

                </div>


                <div>

                  <span>
                    Total Distance
                  </span>

                  <strong>
                    {result.distance_miles}
                    {" "}miles
                  </strong>

                </div>


                <div>

                  <span>
                    Estimated Driving
                  </span>

                  <strong>
                    {result.duration_hours}
                    {" "}hours
                  </strong>

                </div>


                <div>

                  <span>
                    Current → Pickup
                  </span>

                  <strong>
                    {currentToPickup
                      ? currentToPickup.distance_miles
                      : 0}
                    {" "}miles
                  </strong>

                  <small>
                    {currentToPickup
                      ? currentToPickup.duration_hours
                      : 0}
                    {" "}hours
                  </small>

                </div>


                <div>

                  <span>
                    Pickup → Dropoff
                  </span>

                  <strong>
                    {pickupToDropoff
                      ? pickupToDropoff.distance_miles
                      : 0}
                    {" "}miles
                  </strong>

                  <small>
                    {pickupToDropoff
                      ? pickupToDropoff.duration_hours
                      : 0}
                    {" "}hours
                  </small>

                </div>


                <div>

                  <span>
                    Trip Days
                  </span>

                  <strong>
                    {days.length}
                  </strong>

                </div>


              </div>

            </section>



            {/* Map */}

            <section className="panel">

              <h2>
                Route Map
              </h2>


              <div className="map-container">

                <MapContainer
                  center={defaultCenter}
                  zoom={7}
                  scrollWheelZoom={true}
                  className="map"
                >


                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />


                  <MapUpdater
                    locations={locations}
                  />


                  {locations.current && (

                    <Marker
                      position={[
                        locations.current.lat,
                        locations.current.lon,
                      ]}
                    >

                      <Popup>

                        <strong>
                          Current Location
                        </strong>

                        <br />

                        {
                          locations.current
                            .display_name
                        }

                      </Popup>

                    </Marker>

                  )}


                  {locations.pickup && (

                    <Marker
                      position={[
                        locations.pickup.lat,
                        locations.pickup.lon,
                      ]}
                    >

                      <Popup>

                        <strong>
                          Pickup
                        </strong>

                        <br />

                        {
                          locations.pickup
                            .display_name
                        }

                      </Popup>

                    </Marker>

                  )}


                  {locations.dropoff && (

                    <Marker
                      position={[
                        locations.dropoff.lat,
                        locations.dropoff.lon,
                      ]}
                    >

                      <Popup>

                        <strong>
                          Dropoff
                        </strong>

                        <br />

                        {
                          locations.dropoff
                            .display_name
                        }

                      </Popup>

                    </Marker>

                  )}


                  {currentToPickup && (

                    <Polyline
                      positions={
                        currentToPickup.geometry.coordinates.map(
                          ([lon, lat]) => [
                            lat,
                            lon,
                          ]
                        )
                      }

                      pathOptions={{
                        color: "#2563eb",
                        weight: 5,
                      }}
                    />

                  )}


                  {pickupToDropoff && (

                    <Polyline
                      positions={
                        pickupToDropoff.geometry.coordinates.map(
                          ([lon, lat]) => [
                            lat,
                            lon,
                          ]
                        )
                      }

                      pathOptions={{
                        color: "#16a34a",
                        weight: 5,
                      }}
                    />

                  )}


                </MapContainer>

              </div>

            </section>



            {/* Route Instructions */}

            <section className="panel">

              <h2>
                Route Instructions
              </h2>


              {segments.map(
                (segment) => (

                  <div key={segment.name}>

                    <h3>
                      {segment.name}
                    </h3>


                    <ol>

                      {segment.steps.map(
                        (step, index) => (

                          <li key={index}>

                            {step.instruction}

                            {" — "}

                            {step.distance_miles}
                            {" "}miles

                          </li>

                        )
                      )}

                    </ol>

                  </div>

                )
              )}

            </section>



            {/* ELD */}

            <section className="panel">

              <h2>
                ELD Daily Logs
              </h2>


              {days.map(
                (day) => (

                  <ELDGraph
                    key={day.day}
                    day={day}
                  />

                )
              )}

            </section>



            {/* HOS Assumptions */}

            <section className="panel">

              <h2>
                HOS Assumptions
              </h2>


              <div className="summary-grid">


                <div>
                  <span>
                    Driving Limit / Day
                  </span>

                  <strong>
                    {assumptions.daily_driving_limit}
                    {" "}hours
                  </strong>
                </div>


                <div>
                  <span>
                    Duty Window
                  </span>

                  <strong>
                    {assumptions.daily_window}
                    {" "}hours
                  </strong>
                </div>


                <div>
                  <span>
                    Break After
                  </span>

                  <strong>
                    {assumptions.break_after_driving_hours}
                    {" "}hours
                  </strong>
                </div>


                <div>
                  <span>
                    Pickup
                  </span>

                  <strong>
                    {assumptions.pickup_hours}
                    {" "}hour
                  </strong>
                </div>


                <div>
                  <span>
                    Dropoff
                  </span>

                  <strong>
                    {assumptions.dropoff_hours}
                    {" "}hour
                  </strong>
                </div>


                <div>
                  <span>
                    Fuel Interval
                  </span>

                  <strong>
                    {assumptions.fuel_interval_miles}
                    {" "}miles
                  </strong>
                </div>


              </div>

            </section>


          </>

        )}

      </main>

    </div>
  );
}


export default App;