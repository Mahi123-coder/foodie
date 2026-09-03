import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useParams
} from 'react-router-dom';

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents
} from 'react-leaflet';

import L from 'leaflet';

import 'leaflet/dist/leaflet.css';
import './styles.css';

import Admin from './Admin.jsx';
import GroupOrder from './GroupOrder.jsx';

// =========================================================
// API
// =========================================================

const API = 'https://foodie-1-3b27.onrender.com/api';

// =========================================================
// DEFAULT IMAGE
// =========================================================

const img = (seed) =>
  `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=800&q=80`;

// =========================================================
// DEFAULT FOOD IMAGE
// =========================================================

const DEFAULT_FOOD_IMAGE =
  'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80';

// =========================================================
// IMAGE HELPER
// =========================================================

const getImage = (image, fallback = DEFAULT_FOOD_IMAGE) => {
  if (image && typeof image === 'string' && image.trim()) {
    return image;
  }
  return fallback;
};

// =========================================================
// TEXT SANITIZER HELPER (REMOVES RAW MARKDOWN SYMBOLS)
// =========================================================

const sanitizeText = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/#{1,6}\s?/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
};

// =========================================================
// LEAFLET MARKER FIX
// =========================================================

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
});

// =========================================================
// DISTANCE CALCULATION (HAVERSINE FORMULA)
// =========================================================

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// =========================================================
// HELPER: LOAD RAZORPAY SCRIPT
// =========================================================

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

// =========================================================
// APP
// =========================================================

function App() {
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cart') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // ADD TO CART
  const add = (item, restaurant) => {
    setCart((current) => {
      const existing = current.find((i) => i.menuItem === item._id);

      if (existing) {
        return current.map((i) =>
          i.menuItem === item._id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }

      return [
        ...current,
        {
          menuItem: item._id,
          name: item.name,
          price: item.price,
          image: item.image || DEFAULT_FOOD_IMAGE,
          quantity: 1,
          restaurant
        }
      ];
    });
  };

  // REMOVE FROM CART
  const remove = (id) => {
    setCart((current) =>
      current.flatMap((i) => {
        if (i.menuItem !== id) {
          return [i];
        }

        if (i.quantity > 1) {
          return [{ ...i, quantity: i.quantity - 1 }];
        }

        return [];
      })
    );
  };

  return (
    <>
      <Header
        count={cart.reduce((sum, item) => sum + item.quantity, 0)}
      />

      <Routes>
        <Route path="/" element={<Home add={add} cart={cart} />} />
        <Route path="/restaurant/:id" element={<Restaurant add={add} />} />
        <Route
          path="/cart"
          element={<Cart cart={cart} remove={remove} setCart={setCart} />}
        />
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/group-order" element={<GroupOrder />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </>
  );
}

// =========================================================
// HEADER
// =========================================================

function Header({ count }) {
  return (
    <header>
      <Link to="/" className="logo">
        Foodie 🍔
      </Link>

      <nav>
        <Link to="/">Home</Link>
        <Link to="/orders">Orders</Link>
        <Link to="/login">Login</Link>
        <Link to="/group-order">Group Order 👥</Link>
        <Link to="/register">Sign Up</Link>
        <Link className="cart" to="/cart">
          Cart ({count})
        </Link>
      </nav>
    </header>
  );
}

// =========================================================
// LOCATION CONTROL FOR MAP
// =========================================================

function LocateMeControl({ onLocationFound, selectedLocation }) {
  const map = useMap();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const locateUser = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const location = { lat, lng };

        onLocationFound(location);

        map.flyTo([lat, lng], 14, {
          animate: true,
          duration: 1.5
        });

        setLoading(false);
      },
      (error) => {
        setLoading(false);
        if (error.code === 1) {
          setError('Location permission was denied. Please allow location access.');
        } else if (error.code === 2) {
          setError('Your location could not be determined.');
        } else if (error.code === 3) {
          setError('Location request timed out. Please try again.');
        } else {
          setError('Unable to get your location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  return (
    <>
      <div className="locateMeControl">
        <button type="button" onClick={locateUser} disabled={loading}>
          📍 {loading ? 'Locating...' : 'Use My Location'}
        </button>
        {error && <div className="locationError">{error}</div>}
      </div>

      {selectedLocation && (
        <Marker position={[selectedLocation.lat, selectedLocation.lng]}>
          <Popup>
            <div className="userLocationPopup">
              <strong>📍 You are here</strong>
              <p>Restaurants around your location</p>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}

// =========================================================
// MAP CLICK LOCATION PICKER
// =========================================================

function MapLocationPicker({ onLocationFound }) {
  useMapEvents({
    click(e) {
      const location = {
        lat: e.latlng.lat,
        lng: e.latlng.lng
      };
      onLocationFound(location);
    }
  });

  return null;
}

// =========================================================
// RESTAURANT MAP
// =========================================================

function RestaurantMap({ restaurants, selectedLocation, setSelectedLocation }) {
  const validRestaurants = restaurants.filter((restaurant) => {
    const lat = Number(restaurant.latitude);
    const lng = Number(restaurant.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng);
  });

  return (
    <section className="mapSection">
      <div className="mapHeader">
        <div>
          <p className="eyebrow">FIND YOUR FOOD</p>
          <h2>Restaurants near you 📍</h2>
          <p>
            Use your location or click anywhere on the map to find nearby
            restaurants.
          </p>
        </div>
        <div className="mapBadge">📍 {validRestaurants.length} locations</div>
      </div>

      {validRestaurants.length === 0 ? (
        <div className="emptyState">
          <div>📍</div>
          <h3>Restaurant locations unavailable</h3>
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

            <LocateMeControl
              onLocationFound={setSelectedLocation}
              selectedLocation={selectedLocation}
            />

            <MapLocationPicker onLocationFound={setSelectedLocation} />

            {validRestaurants.map((restaurant) => {
              const restaurantLat = Number(restaurant.latitude);
              const restaurantLng = Number(restaurant.longitude);

              let distance = null;
              if (selectedLocation) {
                distance = calculateDistance(
                  selectedLocation.lat,
                  selectedLocation.lng,
                  restaurantLat,
                  restaurantLng
                );
              }

              return (
                <Marker
                  key={restaurant._id}
                  position={[restaurantLat, restaurantLng]}
                >
                  <Popup>
                    <div className="mapPopup">
                      <img
                        src={getImage(
                          restaurant.image,
                          img('1552566626-52f8b828add9')
                        )}
                        alt={restaurant.name}
                      />
                      <h3>{restaurant.name}</h3>
                      <p>⭐ {restaurant.rating}</p>
                      <p>{restaurant.cuisine?.join(', ')}</p>
                      {distance !== null && (
                        <p>📍 {distance.toFixed(1)} km away</p>
                      )}
                      <p>⏱️ {restaurant.deliveryTime} min</p>
                      <Link
                        to={`/restaurant/${restaurant._id}`}
                        className="mapButton"
                      >
                        View Restaurant
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}
    </section>
  );
}

// =========================================================
// HOME (WITH AGENTIC COMMERCE WORKFLOW & SWIGGY-STYLE CARDS)
// =========================================================

function Home({ add, cart }) {
  const [data, setData] = useState([]);
  const [q, setQ] = useState('');

  // AI Agent States
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReply, setAiReply] = useState('');
  const [agentItems, setAgentItems] = useState([]);
  const [proposedAction, setProposedAction] = useState(null);

  // Location States
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [radius, setRadius] = useState(10);
  const [locationMessage, setLocationMessage] = useState(
    'Use your location to discover nearby restaurants 📍'
  );

  const load = async (searchTerm = q) => {
    try {
      const response = await fetch(
        `${API}/restaurants?search=${encodeURIComponent(searchTerm)}`
      );
      if (!response.ok) throw new Error('Failed to load restaurants');
      const result = await response.json();
      setData(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Failed to load restaurants:', error);
      setData([]);
    }
  };

  useEffect(() => {
    load('');
  }, []);

  const chooseCategory = async (category) => {
    setQ(category);
    await load(category);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Geolocation is not supported by your browser.');
      return;
    }

    setLocationMessage('Finding your location... 📍');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setSelectedLocation(location);
        setLocationMessage('Showing restaurants near your location 📍');
      },
      (error) => {
        console.error('Geolocation error:', error);
        if (error.code === 1) {
          setLocationMessage('Location permission denied. Please allow it in your browser.');
        } else if (error.code === 2) {
          setLocationMessage('Could not determine your location.');
        } else if (error.code === 3) {
          setLocationMessage('Location request timed out. Try again.');
        } else {
          setLocationMessage('Unable to get your location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const clearLocation = () => {
    setSelectedLocation(null);
    setLocationMessage('Showing all restaurants 🌎');
  };

  const nearbyRestaurants = data
    .map((restaurant) => {
      const lat = Number(restaurant.latitude);
      const lng = Number(restaurant.longitude);

      if (
        !selectedLocation ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return { ...restaurant, distance: null };
      }

      const distance = calculateDistance(
        selectedLocation.lat,
        selectedLocation.lng,
        lat,
        lng
      );

      return { ...restaurant, distance };
    })
    .filter((restaurant) => {
      if (!selectedLocation || restaurant.distance === null) return true;
      return restaurant.distance <= radius;
    })
    .sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

  // Handle Commerce Agent Submissions cleanly
  // Handle Commerce Agent Submissions cleanly
  // =========================================================
// REPLACE handleAgentSubmit IN main.jsx
// =========================================================
const handleAgentSubmit = async () => {
  const prompt = aiQuery.trim();
  if (!prompt) return;

  try {
    setAiLoading(true);
    setAiReply('');
    setAgentItems([]);
    setProposedAction(null);

    const token = localStorage.getItem('token');

    let response = await fetch(`${API}/ai/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        prompt,
        cart: cart || [],
        activeGroupCode: localStorage.getItem('activeGroupCode') || null
      })
    });

    if (response.status === 404) {
      response = await fetch(`${API}/ai/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: prompt })
      });
    }

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'AI assistant failed to respond.');
    }

    // 1. Sanitize Markdown text
    if (result.reply || result.message) {
      setAiReply(sanitizeText(result.reply || result.message));
    }

    // 2. Extract and normalize catalog items with DB images
    let rawItems = [];
    if (result.proposedActions?.items && Array.isArray(result.proposedActions.items)) {
      setProposedAction(result.proposedActions);
      rawItems = result.proposedActions.items;
    } else if (Array.isArray(result.data) && result.data.length > 0) {
      rawItems = result.data;
    } else if (Array.isArray(result.recommendations)) {
      rawItems = result.recommendations;
    }

    const normalizedItems = rawItems.map((item, index) => ({
      itemId: item.itemId || item.menuItemId || item._id || `item-${index}`,
      name: sanitizeText(item.name || item.menuItemName || 'Recommended Dish'),
      price: item.price || 199,
      isVeg: item.isVeg !== undefined ? Boolean(item.isVeg) : true,
      description: sanitizeText(item.description || item.menuItemDescription || ''),
      restaurantId: item.restaurantId || item.restaurant || null,
      restaurantName: item.restaurantName || 'Partner Restaurant',
      image: item.image || item.restaurantImage || DEFAULT_FOOD_IMAGE
    }));

    setAgentItems(normalizedItems);
  } catch (error) {
    console.error('Agent query error:', error);
    setAiReply(`Could not complete request: ${error.message}`);
  } finally {
    setAiLoading(false);
  }
};

  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">Food delivery, your way</p>
          <h1>Discover food you’ll love.</h1>
          <p>Browse restaurants, explore menus and order your favourites.</p>

          <div className="search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') load();
              }}
              placeholder="Search restaurants or cuisines"
            />
            <button onClick={() => load()}>Search</button>
          </div>
        </div>
      </section>

      {/* =================================================
          AI COMMERCE AGENT SECTION
      ================================================= */}
      <section
        className="aiBox"
        style={{
          background: 'linear-gradient(145deg, #ffffff 0%, #fff8f5 100%)',
          border: '1.5px solid #ffd8c2',
          borderRadius: '20px',
          padding: '28px',
          margin: '30px auto',
          maxWidth: '1400px',
          boxShadow: '0 8px 24px rgba(255, 90, 31, 0.08)'
        }}
      >
        <div className="aiHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span
              className="aiBadge"
              style={{
                background: '#ff5a1f',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: '700',
                fontSize: '12px'
              }}
            >
              🤖 RAZORPAY AGENTIC COMMERCE
            </span>
            <h2 style={{ fontSize: '26px', margin: '10px 0 6px 0', color: '#1a1a1a' }}>
              AI Food Commerce Assistant
            </h2>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
              Ask in plain English: "Dinner for 4 under ₹1500, one veg" or "Optimize my cart to save money".
            </p>
          </div>
          <div style={{ fontSize: '38px' }}>⚡</div>
        </div>

        {/* Natural Language Input */}
        <div className="aiSearch" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <input
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAgentSubmit();
            }}
            placeholder="Try: 'Spicy dinner for 4 people under ₹1500 with 1 veg' or 'Chicken burger'"
            style={{
              flex: 1,
              padding: '14px 18px',
              borderRadius: '12px',
              border: '1.5px solid #ddd',
              fontSize: '15px'
            }}
          />
          <button
            onClick={handleAgentSubmit}
            disabled={aiLoading}
            style={{
              padding: '14px 24px',
              background: '#ff5a1f',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '700',
              cursor: aiLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {aiLoading ? 'Searching... 🧠' : 'Ask Agent ✨'}
          </button>
        </div>

        {/* Clean Explanation Banner */}
        {aiReply && (
          <div
            style={{
              marginTop: '20px',
              padding: '16px 20px',
              background: '#fff',
              border: '1px solid #ffe0d0',
              borderRadius: '12px',
              lineHeight: '1.6',
              color: '#333'
            }}
          >
            <strong>Agent Explanation:</strong>
            <p style={{ margin: '6px 0 0 0' }}>{aiReply}</p>
          </div>
        )}

        {/* Group Plan Approval Card */}
        {proposedAction && proposedAction.type === 'POPULATE_GROUP_ORDER' && (
          <div
            style={{
              marginTop: '18px',
              padding: '20px',
              background: '#e8f5e9',
              borderRadius: '14px',
              border: '1.5px solid #81c784'
            }}
          >
            <h4 style={{ margin: '0 0 8px 0', color: '#2e7d32', fontSize: '16px' }}>
              🛡️ Approval Required: Proposed Group Plan (₹{proposedAction.totalAmount})
            </h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#444' }}>
              The agent selected {proposedAction.items.length} verified catalog dishes matching your constraints.
            </p>
            <ul style={{ margin: '0 0 16px 0', paddingLeft: '20px', fontSize: '14px', color: '#333' }}>
              {proposedAction.items.map((it, idx) => (
                <li key={idx}>
                  {it.isVeg ? '🟢' : '🔴'} <strong>{sanitizeText(it.name)}</strong> — ₹{it.price} ({it.restaurantName})
                </li>
              ))}
            </ul>
            <button
              onClick={() => {
                proposedAction.items.forEach((item) => {
                  add(
                    {
                      _id: item.itemId,
                      name: item.name,
                      price: item.price,
                      image: DEFAULT_FOOD_IMAGE
                    },
                    item.restaurantId
                  );
                });
                setAiReply('Approved! All proposed items added to your cart. ✅');
                setProposedAction(null);
              }}
              style={{
                padding: '10px 20px',
                background: '#2e7d32',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Approve & Add to Cart (₹{proposedAction.totalAmount})
            </button>
          </div>
        )}

        {/* Cart Optimization Card */}
        {proposedAction && proposedAction.type === 'APPLY_CART_OPTIMIZATION' && (
          <div
            style={{
              marginTop: '18px',
              padding: '18px',
              background: '#eef2ff',
              borderRadius: '14px',
              border: '1.5px solid #a5b4fc'
            }}
          >
            <h4 style={{ margin: '0 0 6px 0', color: '#3730a3' }}>
              💡 Cart Optimization Detected: Save ₹{proposedAction.savings}
            </h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#555' }}>
              New total will be ₹{proposedAction.newTotal}. No items will be dropped.
            </p>
            <button
              onClick={() => {
                setAiReply(`Applied discount! Saved ₹${proposedAction.savings} on this checkout. 🎉`);
                setProposedAction(null);
              }}
              style={{
                padding: '8px 18px',
                background: '#4338ca',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Apply ₹{proposedAction.savings} Savings
            </button>
          </div>
        )}

        {/* Modern Recommendation Cards Grid */}
       {/* =================================================
    RECOMMENDATION CARDS GRID IN main.jsx
================================================= */}
{agentItems.length > 0 && (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      gap: '20px',
      marginTop: '20px'
    }}
  >
    {agentItems.map((dish) => {
      const isVeg = Boolean(dish.isVeg);
      return (
        <div
          key={dish.itemId}
          style={{
            background: '#ffffff',
            border: '1px solid #eaeaea',
            borderRadius: '16px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justify: 'space-between',
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
          }}
        >
          <div>
            <div style={{ position: 'relative', width: '100%', height: '150px', backgroundColor: '#f5f5f5' }}>
              <img
                src={dish.image || DEFAULT_FOOD_IMAGE}
                alt={dish.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.src = DEFAULT_FOOD_IMAGE; }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  background: 'rgba(255,255,255,0.95)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: isVeg ? '#2e7d32' : '#c62828'
                }}
              >
                {isVeg ? '🟢 Veg' : '🔴 Non-Veg'}
              </span>
            </div>

            <div style={{ padding: '16px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#111', fontWeight: '700' }}>
                {dish.name}
              </h4>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: '500' }}>
                {dish.restaurantName}
              </div>
              <div style={{ color: '#ff5a1f', fontWeight: '800', fontSize: '16px', marginBottom: '8px' }}>
                ₹{dish.price}
              </div>
              {dish.description && (
                <p style={{ fontSize: '13px', color: '#666', margin: 0, lineHeight: '1.4' }}>
                  {dish.description}
                </p>
              )}
            </div>
          </div>

          <div style={{ padding: '0 16px 16px 16px' }}>
            <button
              onClick={() =>
                add(
                  {
                    _id: dish.itemId,
                    name: dish.name,
                    price: dish.price,
                    image: dish.image || DEFAULT_FOOD_IMAGE
                  },
                  dish.restaurantId
                )
              }
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                background: '#fff7f2',
                color: '#ff5a1f',
                border: '1.5px solid #ff5a1f',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              + Add to Cart
            </button>
          </div>
        </div>
      );
    })}
  </div>
)}
      </section>

      {/* =================================================
          LOCATION DISCOVERY
      ================================================= */}
      <section
        style={{
          margin: '30px auto',
          padding: '25px',
          maxWidth: '1400px',
          background: '#fff',
          borderRadius: '20px',
          border: '1px solid #eee',
          boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <span
              style={{
                display: 'inline-block',
                fontSize: '13px',
                fontWeight: '700',
                color: '#ff5a1f',
                letterSpacing: '1px',
                marginBottom: '8px'
              }}
            >
              📍 LOCATION DISCOVERY
            </span>
            <h2 style={{ margin: '5px 0', fontSize: '28px' }}>
              Find restaurants near you
            </h2>
            <p style={{ margin: '8px 0', color: '#666' }}>{locationMessage}</p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <button className="primary" onClick={useMyLocation} type="button">
              📍 Use My Location
            </button>
            {selectedLocation && (
              <button
                type="button"
                onClick={clearLocation}
                style={{
                  padding: '12px 18px',
                  borderRadius: '10px',
                  border: '1px solid #ddd',
                  background: '#fff',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Show All
              </button>
            )}
          </div>
        </div>

        {selectedLocation && (
          <div
            style={{
              marginTop: '20px',
              padding: '18px',
              background: '#fff7f2',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <strong>📍 Nearby restaurants</strong>
              <p style={{ margin: '5px 0 0', color: '#666' }}>
                Showing restaurants within <strong>{radius} km</strong> of your
                location.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label htmlFor="radius" style={{ fontWeight: '600' }}>
                Radius:
              </label>
              <select
                id="radius"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #ddd',
                  background: '#fff',
                  fontSize: '15px'
                }}
              >
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={25}>25 km</option>
                <option value={50}>50 km</option>
              </select>
            </div>
          </div>
        )}
      </section>

      {/* =================================================
          FOOD CATEGORIES
      ================================================= */}
      <section className="categories">
        <h2>What are you craving?</h2>
        <div className="categoryRow">
          <button onClick={() => chooseCategory('Pizza')}>
            <span className="categoryEmoji">🍕</span>
            <span>Pizza</span>
          </button>
          <button onClick={() => chooseCategory('Burger')}>
            <span className="categoryEmoji">🍔</span>
            <span>Burgers</span>
          </button>
          <button onClick={() => chooseCategory('Chinese')}>
            <span className="categoryEmoji">🍜</span>
            <span>Chinese</span>
          </button>
          <button onClick={() => chooseCategory('Indian')}>
            <span className="categoryEmoji">🍛</span>
            <span>Indian</span>
          </button>
          <button onClick={() => chooseCategory('Healthy')}>
            <span className="categoryEmoji">🥗</span>
            <span>Healthy</span>
          </button>
          <button onClick={() => chooseCategory('Dessert')}>
            <span className="categoryEmoji">🍰</span>
            <span>Desserts</span>
          </button>
        </div>
      </section>

      {/* =================================================
          RESTAURANTS
      ================================================= */}
      <section className="restaurantsSection">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <h2>
              {selectedLocation
                ? 'Restaurants near you'
                : q
                ? `Restaurants for "${q}"`
                : 'Top restaurants'}
            </h2>
            {selectedLocation && (
              <p style={{ marginTop: '-5px', color: '#666' }}>
                Sorted by distance 📍
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {q && (
              <button
                className="primary"
                onClick={() => {
                  setQ('');
                  load('');
                }}
              >
                Clear search
              </button>
            )}
          </div>
        </div>

        {nearbyRestaurants.length === 0 ? (
          <div className="emptyState">
            <div>📍</div>
            <h3>No restaurants found nearby</h3>
            <p>
              Try increasing your search radius or choose another location.
            </p>
            {selectedLocation && (
              <button
                className="primary"
                onClick={() => setRadius(50)}
              >
                Search within 50 km
              </button>
            )}
          </div>
        ) : (
          <div className="grid">
            {nearbyRestaurants.map((r) => (
              <Link
                className="card"
                key={r._id}
                to={`/restaurant/${r._id}`}
              >
                <img
                  src={getImage(r.image, img('1552566626-52f8b828add9'))}
                  alt={r.name}
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_FOOD_IMAGE;
                  }}
                />
                <div>
                  <h3>{r.name}</h3>
                  <p>⭐ {r.rating} · {r.deliveryTime} min</p>
                  <p>{r.cuisine?.join(', ')}</p>
                  {r.distance !== null && (
                    <p
                      style={{
                        fontWeight: '700',
                        color: '#ff5a1f'
                      }}
                    >
                      📍 {r.distance.toFixed(1)} km away
                    </p>
                  )}
                  <small>₹{r.priceForTwo || 400} for two</small>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* =================================================
          RESTAURANT MAP
      ================================================= */}
      <RestaurantMap
        restaurants={nearbyRestaurants}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
      />
    </main>
  );
}

// =========================================================
// RESTAURANT PAGE
// =========================================================

function Restaurant({ add }) {
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`${API}/restaurants/${id}`)
      .then((r) => r.json())
      .then(setData)
      .catch((error) => console.error('Restaurant error:', error));
  }, [id]);

  if (!data) {
    return (
      <main>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main>
      <div className="restaurantHead">
        <div>
          <h1>{data.restaurant.name}</h1>
          <p>
            ⭐ {data.restaurant.rating} · {data.restaurant.cuisine?.join(', ')}
          </p>
          <p>
            {data.restaurant.location} · {data.restaurant.deliveryTime} min
          </p>
        </div>
      </div>

      <h2>Menu</h2>

      <div className="menu">
        {data.menu?.map((m) => (
          <article className="menuItem" key={m._id}>
            <img
              src={getImage(m.image, DEFAULT_FOOD_IMAGE)}
              alt={m.name}
              className="menuItemImage"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_FOOD_IMAGE;
              }}
            />
            <div className="menuItemContent">
              <span className="veg">{m.isVeg ? '🟢' : '🔴'}</span>
              <h3>{m.name}</h3>
              <b>₹{m.price}</b>
              <p>{m.description}</p>
            </div>
            <button
              onClick={() => add(m, data.restaurant._id)}
            >
              ADD
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}

// =========================================================
// CART
// =========================================================

function Cart({ cart, remove, setCart }) {
  const nav = useNavigate();
  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const [address, setAddress] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const place = async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      nav('/login');
      return;
    }

    if (!cart.length) return;

    if (!address.trim()) {
      setMsg('Please enter a delivery address.');
      return;
    }

    try {
      setLoading(true);
      setMsg('Creating order... ⏳');

      const isScriptLoaded = await loadRazorpayScript();
      if (!isScriptLoaded) {
        setLoading(false);
        setMsg('Razorpay SDK failed to load. Please check your internet connection.');
        return;
      }

      const createOrderRes = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          restaurant: cart[0].restaurant,
          items: cart,
          total,
          address
        })
      });

      const createdOrderData = await createOrderRes.json();
      if (!createOrderRes.ok) {
        setLoading(false);
        setMsg(createdOrderData.message || 'Could not create initial order');
        return;
      }

      const orderId = createdOrderData.order?._id || createdOrderData._id;
      setMsg('Opening Razorpay... 💳');

      const razorpayOrderRes = await fetch(`${API}/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orderId })
      });

      const razorpayData = await razorpayOrderRes.json();
      if (!razorpayOrderRes.ok) {
        setLoading(false);
        setMsg(
          razorpayData.message || 'Failed to initialize payment with Razorpay'
        );
        return;
      }

      const options = {
        key: razorpayData.key,
        amount: razorpayData.amount,
        currency: razorpayData.currency || 'INR',
        name: 'Foodie',
        description: `Payment for Order #${orderId}`,
        order_id: razorpayData.razorpayOrderId,
        handler: async function (response) {
          try {
            setMsg('Verifying payment... 🔐');

            const verifyRes = await fetch(`${API}/payments/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderId: razorpayData.orderId
              })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              setMsg(verifyData.message || 'Payment verification failed');
              return;
            }

            setCart([]);
            setMsg('Payment verified! Order placed 🎉');

            setTimeout(() => {
              nav('/orders');
            }, 1500);
          } catch (verifyError) {
            console.error('Verification error:', verifyError);
            setMsg('Payment verification failed. Please check your orders.');
          } finally {
            setLoading(false);
          }
        },
        theme: {
          color: '#ff5a1f'
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            setMsg('Payment was cancelled.');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setLoading(false);
        setMsg(`Payment failed: ${response.error.description}`);
      });

      rzp.open();
    } catch (error) {
      console.error('Checkout error:', error);
      setLoading(false);
      setMsg('Could not process payment. Please try again.');
    }
  };

  return (
    <main>
      <h1>Your cart</h1>

      {cart.length === 0 ? (
        <div className="emptyState">
          <div>🛒</div>
          <h3>Your cart is empty</h3>
          <p>Add something delicious from a restaurant.</p>
          <Link to="/" className="primary">
            Browse restaurants
          </Link>
        </div>
      ) : (
        <>
          <div className="cartList">
            {cart.map((i) => (
              <div className="cartRow" key={i.menuItem}>
                {i.image && (
                  <img
                    src={getImage(i.image)}
                    alt={i.name}
                    style={{
                      width: '60px',
                      height: '60px',
                      objectFit: 'cover',
                      borderRadius: '10px'
                    }}
                  />
                )}
                <span>{i.name}</span>
                <span>₹{i.price} × {i.quantity}</span>
                <button onClick={() => remove(i.menuItem)}>−</button>
              </div>
            ))}
          </div>

          <h2>Total: ₹{total}</h2>

          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Delivery address"
          />

          <button className="primary" onClick={place} disabled={loading}>
            {loading ? 'Processing... 💳' : 'Pay with Razorpay 💳'}
          </button>

          {msg && <p>{msg}</p>}
        </>
      )}
    </main>
  );
}

// =========================================================
// LOGIN / REGISTER
// =========================================================

function Auth({ mode }) {
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const b = await res.json();
      if (!res.ok) {
        setMsg(b.message || 'Authentication failed');
        return;
      }

      localStorage.setItem('token', b.token);
      setMsg(
        mode === 'login'
          ? 'Login successful! 🎉'
          : 'Account created successfully! 🎉'
      );

      setTimeout(() => {
        nav('/');
      }, 1500);
    } catch (error) {
      console.error('Auth error:', error);
      setMsg('Something went wrong. Please try again.');
    }
  };

  return (
    <main className="formPage">
      <form onSubmit={submit}>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
        {mode === 'register' && (
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        )}
        <input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button className="primary">
          {mode === 'login' ? 'Login' : 'Register'}
        </button>
        {msg && <p>{msg}</p>}
      </form>
    </main>
  );
}

// =========================================================
// ORDERS
// =========================================================

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${API}/orders/mine`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((r) => r.json())
      .then((result) => {
        setOrders(Array.isArray(result) ? result : []);
      })
      .catch((error) => console.error('Orders error:', error))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
      <h1>Your orders</h1>

      {loading ? (
        <p style={{ color: '#888' }}>Loading orders...</p>
      ) : !orders.length ? (
        <div className="emptyState">
          <div>📦</div>
          <h3>No orders yet</h3>
          <p>Your previous orders will appear here.</p>
          <Link to="/" className="primary">
            Start ordering
          </Link>
        </div>
      ) : (
        orders.map((o) => (
          <div
            className="order"
            key={o._id}
            style={{
              padding: '20px',
              border: '1px solid #e0e0e0',
              borderRadius: '14px',
              marginBottom: '16px',
              background: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: '10px'
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                {o.restaurant?.name || 'Restaurant'}
              </h3>
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    fontWeight: 'bold',
                    color: o.paymentStatus === 'PAID' ? '#2e7d32' : '#e65100'
                  }}
                >
                  ₹{o.total} · {o.paymentStatus || 'PENDING'}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    color: '#777',
                    marginTop: '2px'
                  }}
                >
                  Status: {o.status || 'PLACED'}
                </span>
              </div>
            </div>

            {o.isGroupOrder ? (
              <div style={{ marginTop: '12px' }}>
                <span
                  style={{
                    background: '#fff3e0',
                    color: '#e65100',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'inline-block',
                    marginBottom: '8px'
                  }}
                >
                  👥 Group Order #{o.groupCode} • Split:{' '}
                  {o.splitMode === 'EQUAL' ? 'Equal' : 'Itemized'}
                </span>

                <div
                  style={{
                    background: '#fafafa',
                    padding: '12px 14px',
                    borderRadius: '8px'
                  }}
                >
                  {o.groupMembers && o.groupMembers.length > 0 ? (
                    o.groupMembers.map((member, idx) => (
                      <div
                        key={idx}
                        style={{
                          marginBottom:
                            idx < o.groupMembers.length - 1 ? '10px' : '0',
                          fontSize: '14px'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontWeight: '600'
                          }}
                        >
                          <span>{member.name}</span>
                          <span>
                            ₹{member.shareAmount || 0} (
                            {member.paymentStatus === 'PAID' ? '✅ Paid' : '⏳ Pending'}
                            )
                          </span>
                        </div>
                        <ul
                          style={{
                            margin: '4px 0 0 0',
                            paddingLeft: '18px',
                            fontSize: '13px',
                            color: '#666'
                          }}
                        >
                          {member.items && member.items.length > 0 ? (
                            member.items.map((item, i) => (
                              <li key={i}>
                                {item.name} × {item.quantity} (₹
                                {item.price * item.quantity})
                              </li>
                            ))
                          ) : (
                            <li>No dishes added</li>
                          )}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>
                      No member items recorded.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '12px' }}>
                <ul
                  style={{
                    margin: '6px 0',
                    paddingLeft: '18px',
                    fontSize: '14px',
                    color: '#555'
                  }}
                >
                  {o.items?.map((item, idx) => (
                    <li key={idx}>
                      {item.name} × {item.quantity} (₹{item.price * item.quantity})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p style={{ margin: '12px 0 0 0', fontSize: '13px', color: '#777' }}>
              📍 <strong>Delivery Address:</strong> {o.address}
            </p>
          </div>
        ))
      )}
    </main>
  );
}

// =========================================================
// START APP
// =========================================================

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);