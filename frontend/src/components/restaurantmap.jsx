import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';

// Haversine distance calculator in kilometers
function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Map Click Listener to update user's selected location
function MapLocationPicker({ setSelectedLocation }) {
  useMapEvents({
    click(e) {
      setSelectedLocation({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
    },
  });
  return null;
}

// Locate Me Button
function LocateMeControl({ setSelectedLocation }) {
  const map = useMap();

  const handleLocate = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLoc = { lat: latitude, lng: longitude };

        setSelectedLocation(newLoc);
        map.flyTo([latitude, longitude], 12, { duration: 1.5 });
      },
      (error) => {
        console.error("Error retrieving location:", error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="locateMeControl">
      <button type="button" onClick={handleLocate} title="Find my current location">
        📍 Locate Me
      </button>
    </div>
  );
}

export default function RestaurantMap({
  restaurants = [],
  selectedLocation,
  setSelectedLocation,
}) {
  // FIX 3: Robust Coordinate Validation
  const validRestaurants = restaurants.filter((restaurant) => {
    const lat = Number(restaurant.latitude);
    const lng = Number(restaurant.longitude);

    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  });

  // FIX 2: Map Center Logic (Selected Location > Fallback to Tonk, Rajasthan)
  const mapCenter = selectedLocation
    ? [selectedLocation.lat, selectedLocation.lng]
    : [26.17, 75.79];

  return (
    <section className="mapSection">
      <div className="mapHeader">
        <div>
          <p className="eyebrow">FIND YOUR FOOD</p>
          <h2>Restaurants near you 📍</h2>
          <p>Explore restaurants on the map and choose where you want to order from.</p>
        </div>
        <div className="mapBadge">📍 {validRestaurants.length} locations</div>
      </div>

      <div className="mapWrapper">
        <MapContainer
          center={mapCenter}
          zoom={8}
          scrollWheelZoom={true}
          className="restaurantMap"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapLocationPicker setSelectedLocation={setSelectedLocation} />
          <LocateMeControl setSelectedLocation={setSelectedLocation} />

          {/* User Location Marker */}
          {selectedLocation && (
            <Marker position={[selectedLocation.lat, selectedLocation.lng]}>
              <Popup>
                <div className="userLocationPopup">
                  <strong>📍 Your Selected Location</strong>
                </div>
              </Popup>
            </Marker>
          )}

          {/* FIX 4: Render ALL Valid Restaurant Markers & Show Distance */}
          {validRestaurants.map((restaurant) => {
            const rLat = Number(restaurant.latitude);
            const rLng = Number(restaurant.longitude);

            let distanceFromUser = null;
            if (selectedLocation) {
              distanceFromUser = getHaversineDistance(
                selectedLocation.lat,
                selectedLocation.lng,
                rLat,
                rLng
              );
            }

            return (
              <Marker key={restaurant._id} position={[rLat, rLng]}>
                <Popup>
                  <div className="mapPopup">
                    <img
                      src={
                        restaurant.image ||
                        "https://images.unsplash.com/photo-1552566626-52f8b828add9"
                      }
                      alt={restaurant.name}
                    />
                    <h3>{restaurant.name}</h3>
                    <p>⭐ {restaurant.rating}</p>
                    <p>{restaurant.cuisine?.join(", ")}</p>
                    
                    {distanceFromUser !== null && (
                      <p style={{ fontWeight: "bold", color: "#e65100" }}>
                        📍 {distanceFromUser} km away
                      </p>
                    )}

                    <p>⏱️ {restaurant.deliveryTime} min</p>
                    <Link to={`/restaurant/${restaurant._id}`} className="mapButton">
                      View Restaurant
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </section>
  );
}