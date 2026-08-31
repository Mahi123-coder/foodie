/* =========================================================
   LOCATE ME BUTTON
========================================================= */

function LocateMe() {
  const map = useMap();

  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  const locateUser = () => {
    if (!navigator.geolocation) {
      setError("Location is not supported by your browser.");
      return;
    }

    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setLocation([lat, lng]);

        map.flyTo([lat, lng], 15, {
          duration: 1.5,
        });

        setLocating(false);
      },

      (error) => {
        setLocating(false);

        if (error.code === 1) {
          setError(
            "Location permission was denied. Please allow location access."
          );
        } else if (error.code === 2) {
          setError("Your location could not be determined.");
        } else {
          setError("Unable to get your location. Please try again.");
        }
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <>
      {/* LOCATE ME BUTTON */}
      <div className="locateMeControl">
        <button
          type="button"
          onClick={locateUser}
          disabled={locating}
          title="Find my current location"
        >
          {locating ? "⏳ Locating..." : "📍 Locate Me"}
        </button>

        {error && (
          <div className="locationError">
            {error}
          </div>
        )}
      </div>

      {/* USER LOCATION */}
      {location && (
        <Marker position={location}>
          <Popup>
            <div className="userLocationPopup">
              <strong>📍 You are here</strong>

              <p>
                This is your current location.
              </p>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}


/* =========================================================
   RESTAURANT MAP
========================================================= */

function RestaurantMap({ restaurants }) {

  const validRestaurants = restaurants.filter((restaurant) => {
    const lat = Number(restaurant.latitude);
    const lng = Number(restaurant.longitude);

    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    );
  });

  return (
    <section className="mapSection">

      {/* MAP HEADER */}
      <div className="mapHeader">

        <div>
          <p className="eyebrow">
            FIND YOUR FOOD
          </p>

          <h2>
            Restaurants near you 📍
          </h2>

          <p>
            Explore restaurants on the map and choose where you want to order from.
          </p>
        </div>

        <div className="mapBadge">
          📍 {validRestaurants.length} locations
        </div>

      </div>


      {/* MAP */}
      {validRestaurants.length === 0 ? (

        <div className="emptyState">

          <div>
            📍
          </div>

          <h3>
            Restaurant locations unavailable
          </h3>

          <p>
            Make sure your restaurants have latitude and longitude values.
          </p>

        </div>

      ) : (

        <div className="mapWrapper">

          <MapContainer
            center={[12.9716, 77.5946]}
            zoom={12}
            scrollWheelZoom={true}
            className="restaurantMap"
          >

            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />


            {/* LOCATE ME */}
            <LocateMe />


            {/* RESTAURANT MARKERS */}
            {validRestaurants.map((restaurant) => (

              <Marker
                key={restaurant._id}
                position={[
                  Number(restaurant.latitude),
                  Number(restaurant.longitude),
                ]}
              >

                <Popup>

                  <div className="mapPopup">

                    <img
                      src={
                        restaurant.image ||
                        img("1552566626-52f8b828add9")
                      }
                      alt={restaurant.name}
                    />

                    <h3>
                      {restaurant.name}
                    </h3>

                    <p>
                      ⭐ {restaurant.rating}
                    </p>

                    <p>
                      {restaurant.cuisine?.join(", ")}
                    </p>

                    <p>
                      ⏱️ {restaurant.deliveryTime} min
                    </p>

                    <Link
                      to={`/restaurant/${restaurant._id}`}
                      className="mapButton"
                    >
                      View Restaurant
                    </Link>

                  </div>

                </Popup>

              </Marker>

            ))}

          </MapContainer>

        </div>

      )}

    </section>
  );
}