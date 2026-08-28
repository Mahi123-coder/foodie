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
import './styles.css';
import Admin from './Admin.jsx';

const API ='https://foodie-pdft.onrender.com/api';

const img = (seed) =>
  `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=800&q=80`;

/* =========================
   APP
========================= */

function App() {
  const [cart, setCart] = useState(() =>
    JSON.parse(localStorage.getItem('cart') || '[]')
  );

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const add = (item, restaurant) =>
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
          quantity: 1,
          restaurant
        }
      ];
    });

  const remove = (id) =>
    setCart((current) =>
      current.flatMap((i) =>
        i.menuItem === id
          ? i.quantity > 1
            ? [{ ...i, quantity: i.quantity - 1 }]
            : []
          : [i]
      )
    );

  return (
    <>
      <Header count={cart.reduce((s, i) => s + i.quantity, 0)} />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/restaurant/:id"
          element={<Restaurant add={add} />}
        />
        <Route
          path="/cart"
          element={
            <Cart
              cart={cart}
              remove={remove}
              setCart={setCart}
            />
          }
        />
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </>
  );
}

/* =========================
   HEADER
========================= */

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
        <Link to="/register">Sign Up</Link>


        <Link className="cart" to="/cart">
          Cart ({count})
        </Link>
      </nav>
    </header>
  );
}

/* =========================
   HOME
========================= */

function Home() {
  const [data, setData] = useState([]);
  const [q, setQ] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [aiResults, setAiResults] = useState([]);
  const [aiMessage, setAiMessage] = useState('');

  const load = async (searchTerm = q) => {
    try {
      const response = await fetch(
        `${API}/restaurants?search=${encodeURIComponent(searchTerm)}`
      );

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to load restaurants:', error);
    }
  };

  useEffect(() => {
    load('');
  }, []);

  const chooseCategory = async (category) => {
    setQ(category);
    await load(category);
  };

  /* =========================
     AI FOOD ASSISTANT
  ========================= */

  const askAI = async () => {
  const query = aiQuery.trim();

  if (!query) {
    setAiMessage('Tell me what you are craving 😋');
    setAiResults([]);
    return;
  }

  try {
    setAiMessage('Foodie AI is thinking... 🤖✨');
    setAiResults([]);

    const response = await fetch(`${API}/ai/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || 'AI recommendation failed'
      );
    }

    setAiMessage(
      result.message || 'Here are some recommendations for you! 🍽️'
    );

    const recommendations = result.recommendations || [];

    const restaurantResponse = await fetch(
      `${API}/restaurants`
    );

    const restaurants = await restaurantResponse.json();

    const formattedResults = recommendations
      .map((recommendation) => {
        const restaurant = restaurants.find(
          (r) =>
            String(r._id) ===
            String(recommendation.restaurantId)
        );

        if (!restaurant) return null;

        return {
          ...restaurant,
          aiMenuItem: recommendation.menuItemName,
          aiPrice: recommendation.price,
          aiReason: recommendation.reason,
        };
      })
      .filter(Boolean);

    setAiResults(formattedResults);
  } catch (error) {
    console.error('AI error:', error);

    setAiResults([]);

    setAiMessage(
      error.message ||
        'Sorry, I could not get recommendations right now. 😭'
    );
  }
};

  return (
    <main>

      {/* HERO */}

      <section className="hero">
        <div>
          <p className="eyebrow">
            Food delivery, your way
          </p>

          <h1>
            Discover food you’ll love.
          </h1>

          <p>
            Browse restaurants, explore menus and
            order your favourites.
          </p>

          <div className="search">
            <input
              value={q}
              onChange={(e) =>
                setQ(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  load();
                }
              }}
              placeholder="Search restaurants or cuisines"
            />

            <button onClick={() => load()}>
              Search
            </button>
          </div>
        </div>
      </section>

      {/* AI FOOD ASSISTANT */}

      <section className="aiBox">

        <div className="aiHeader">
          <div>
            <span className="aiBadge">
              ✨ AI FOOD ASSISTANT
            </span>

            <h2>
              What should I eat?
            </h2>

            <p>
              Tell me what you're craving and I'll
              find something for you.
            </p>
          </div>

          <div className="aiIcon">
            🤖
          </div>
        </div>

        <div className="aiSearch">
          <input
            value={aiQuery}
            onChange={(e) =>
              setAiQuery(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                askAI();
              }
            }}
            placeholder="Try: spicy food under ₹300"
          />

          <button onClick={askAI}>
            Ask AI ✨
          </button>
        </div>

        {aiMessage && (
          <p className="aiMessage">
            {aiMessage}
          </p>
        )}

        {aiResults.length > 0 && (
          <div className="aiResults">
            {aiResults.map((r) => (
              <Link
                key={r._id}
                to={`/restaurant/${r._id}`}
                className="aiCard"
              >
                <img
                  src={
                    r.image ||
                    img(
                      '1552566626-52f8b828add9'
                    )
                  }
                  alt={r.name}
                />

                <div>
                  <h3>{r.name}</h3>
                  {r.aiMenuItem && (
  <p>
    🍽️ <strong>{r.aiMenuItem}</strong> · ₹{r.aiPrice}
  </p>
)}

{r.aiReason && (
  <p className="aiReason">
    💡 {r.aiReason}
  </p>
)}

                  <p>
                    ⭐ {r.rating} ·{' '}
                    {r.deliveryTime} min
                  </p>

                  <p>
                    {r.cuisine?.join(', ')}
                  </p>

                  <small>
                    ₹{r.priceForTwo || 400} for two
                  </small>
                </div>
              </Link>
            ))}
          </div>
        )}

      </section>

      {/* FOOD CATEGORIES */}

      <section className="categories">
        <h2>
          What are you craving?
        </h2>

        <div className="categoryRow">

          <button
            onClick={() =>
              chooseCategory('Pizza')
            }
          >
            <span className="categoryEmoji">
              🍕
            </span>

            <span>Pizza</span>
          </button>

          <button
            onClick={() =>
              chooseCategory('Burger')
            }
          >
            <span className="categoryEmoji">
              🍔
            </span>

            <span>Burgers</span>
          </button>

          <button
            onClick={() =>
              chooseCategory('Chinese')
            }
          >
            <span className="categoryEmoji">
              🍜
            </span>

            <span>Chinese</span>
          </button>

          <button
            onClick={() =>
              chooseCategory('Indian')
            }
          >
            <span className="categoryEmoji">
              🍛
            </span>

            <span>Indian</span>
          </button>

          <button
            onClick={() =>
              chooseCategory('Healthy')
            }
          >
            <span className="categoryEmoji">
              🥗
            </span>

            <span>Healthy</span>
          </button>

          <button
            onClick={() =>
              chooseCategory('Dessert')
            }
          >
            <span className="categoryEmoji">
              🍰
            </span>

            <span>Desserts</span>
          </button>

        </div>
      </section>

      {/* RESTAURANTS */}

      <section>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h2>
            {q
              ? `Restaurants for "${q}"`
              : 'Top restaurants'}
          </h2>

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

        {data.length === 0 ? (
          <div className="emptyState">
            <div>🍽️</div>

            <h3>
              No restaurants found
            </h3>

            <p>
              Try another restaurant name
              or cuisine.
            </p>
          </div>
        ) : (
          <div className="grid">
            {data.map((r) => (
              <Link
                className="card"
                key={r._id}
                to={`/restaurant/${r._id}`}
              >
                <img
                  src={
                    r.image ||
                    img(
                      '1552566626-52f8b828add9'
                    )
                  }
                  alt={r.name}
                />

                <div>
                  <h3>{r.name}</h3>

                  <p>
                    ⭐ {r.rating} ·{' '}
                    {r.deliveryTime} min
                  </p>

                  <p>
                    {r.cuisine?.join(', ')}
                  </p>

                  <small>
                    ₹{r.priceForTwo || 400} for two
                  </small>
                </div>
              </Link>
            ))}
          </div>
        )}

      </section>

    </main>
  );
}

/* =========================
   RESTAURANT
========================= */

function Restaurant({ add }) {
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`${API}/restaurants/${id}`)
      .then((r) => r.json())
      .then(setData);
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
          <h1>
            {data.restaurant.name}
          </h1>

          <p>
            ⭐ {data.restaurant.rating} ·{' '}
            {data.restaurant.cuisine.join(', ')}
          </p>

          <p>
            {data.restaurant.location} ·{' '}
            {data.restaurant.deliveryTime} min
          </p>
        </div>
      </div>

      <h2>Menu</h2>

      <div className="menu">
        {data.menu.map((m) => (
          <article
            className="menuItem"
            key={m._id}
          >
            <div>
              <span className="veg">
                {m.isVeg ? '🟢' : '🔴'}
              </span>

              <h3>{m.name}</h3>

              <b>₹{m.price}</b>

              <p>
                {m.description}
              </p>
            </div>

            <button
              onClick={() =>
                add(m, data.restaurant._id)
              }
            >
              ADD
            </button>
          </article>
        ))}
      </div>

    </main>
  );
}

/* =========================
   CART
========================= */

function Cart({ cart, remove, setCart }) {
  const nav = useNavigate();

  const total = cart.reduce(
    (s, i) => s + i.price * i.quantity,
    0
  );

  const [address, setAddress] = useState('');
  const [msg, setMsg] = useState('');

  const place = async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      return nav('/login');
    }

    if (!cart.length) {
      return;
    }

    const res = await fetch(`${API}/orders`, {
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

    const body = await res.json();

    if (!res.ok) {
      return setMsg(
        body.message || 'Could not place order'
      );
    }

    setCart([]);
    setMsg('Order placed! 🎉');
  };

  return (
    <main>
      <h1>Your cart</h1>

      {cart.length === 0 ? (
        <div className="emptyState">
          <div>🛒</div>
          <h3>Your cart is empty</h3>
          <p>
            Add something delicious from a restaurant.
          </p>

          <Link
            to="/"
            className="primary"
          >
            Browse restaurants
          </Link>
        </div>
      ) : (
        <>
          <div className="cartList">
            {cart.map((i) => (
              <div
                className="cartRow"
                key={i.menuItem}
              >
                <span>{i.name}</span>

                <span>
                  ₹{i.price} × {i.quantity}
                </span>

                <button
                  onClick={() =>
                    remove(i.menuItem)
                  }
                >
                  −
                </button>
              </div>
            ))}
          </div>

          <h2>
            Total: ₹{total}
          </h2>

          <textarea
            value={address}
            onChange={(e) =>
              setAddress(e.target.value)
            }
            placeholder="Delivery address"
          />

          <button
            className="primary"
            onClick={place}
          >
            Place order
          </button>

          {msg && <p>{msg}</p>}
        </>
      )}
    </main>
  );
}

/* =========================
   LOGIN / REGISTER
========================= */

function Auth({ mode }) {
  const nav = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: ''
  });

  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();

    const res = await fetch(
      `${API}/auth/${mode}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      }
    );

    const b = await res.json();

    if (!res.ok) {
      return setMsg(b.message);
    }

    localStorage.setItem(
  'token',
  b.token
);

setMsg(
  mode === 'login'
    ? 'Login successful! 🎉'
    : 'Account created successfully! 🎉'
);

setTimeout(() => {
  nav('/');
}, 1500);
  };

  return (
    <main className="formPage">
      <form onSubmit={submit}>

        <h1>
          {mode === 'login'
            ? 'Welcome back'
            : 'Create account'}
        </h1>

        {mode === 'register' && (
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value
              })
            }
          />
        )}

        <input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) =>
            setForm({
              ...form,
              email: e.target.value
            })
          }
        />

        <input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) =>
            setForm({
              ...form,
              password: e.target.value
            })
          }
        />

        <button className="primary">
          {mode === 'login'
            ? 'Login'
            : 'Register'}
        </button>

        {msg && <p>{msg}</p>}

      </form>
    </main>
  );
}

/* =========================
   ORDERS
========================= */

function Orders() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const token =
      localStorage.getItem('token');

    if (token) {
      fetch(`${API}/orders/mine`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
        .then((r) => r.json())
        .then(setOrders);
    }
  }, []);

  return (
    <main>

      <h1>Your orders</h1>

      {!orders.length ? (
        <div className="emptyState">
          <div>📦</div>
          <h3>No orders yet</h3>
          <p>
            Your previous orders will appear here.
          </p>

          <Link
            to="/"
            className="primary"
          >
            Start ordering
          </Link>
        </div>
      ) : (
        orders.map((o) => (
          <div
            className="order"
            key={o._id}
          >
            <h3>
              {o.restaurant?.name}
            </h3>

            <p>
              ₹{o.total} · {o.status}
            </p>

            <p>
              {o.address}
            </p>
          </div>
        ))
      )}

    </main>
  );
}

/* =========================
   START APP
========================= */

createRoot(
  document.getElementById('root')
).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);