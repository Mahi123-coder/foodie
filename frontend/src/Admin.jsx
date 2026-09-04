import React, { useEffect, useState } from 'react';

const API = 'https://foodie-1-3b27.onrender.com/api';

const emptyForm = {
  name: '',
  cuisine: '',
  rating: 4,
  deliveryTime: 30,
  image: '',
  location: '',
  latitude: 26.8530,
  longitude: 75.8046,
  priceForTwo: 400,
  isVeg: false
};

const emptyMenuForm = {
  restaurant: '',
  name: '',
  description: '',
  price: 0,
  category: '',
  image: '',
  isVeg: false
};

function Admin() {
  const [stats, setStats] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [menuItems, setMenuItems] = useState([]);
  const [menuForm, setMenuForm] = useState(emptyMenuForm);
  const [orders, setOrders] = useState([]);

  const [editingMenuId, setEditingMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setMessage('');

      const [
        statsResponse,
        restaurantResponse,
        menuResponse,
        ordersResponse
      ] = await Promise.all([
        fetch(`${API}/admin/stats`, { headers }),
        fetch(`${API}/admin/restaurants`, { headers }),
        fetch(`${API}/admin/menu-items`, { headers }),
        fetch(`${API}/admin/orders`, { headers })
      ]);

      const statsData = await statsResponse.json();
      const restaurantData = await restaurantResponse.json();
      const menuData = await menuResponse.json();
      const ordersData = await ordersResponse.json();

      if (!statsResponse.ok) {
        throw new Error(statsData.message || 'Could not load dashboard statistics');
      }

      if (!restaurantResponse.ok) {
        throw new Error(restaurantData.message || 'Could not load restaurants');
      }

      if (!menuResponse.ok) {
        throw new Error(menuData.message || 'Could not load menu items');
      }

      if (!ordersResponse.ok) {
        throw new Error(ordersData.message || 'Could not load orders');
      }

      const restaurantList = Array.isArray(restaurantData)
        ? restaurantData
        : restaurantData.restaurants || restaurantData.data || [];

      const menuList = Array.isArray(menuData)
        ? menuData
        : menuData.menuItems || menuData.items || menuData.data || [];

      const orderList = Array.isArray(ordersData)
        ? ordersData
        : ordersData.orders || ordersData.data || [];

      const statsObject = statsData?.stats || statsData?.data || statsData;

      setStats(statsObject);
      setRestaurants(restaurantList);
      setMenuItems(menuList);
      setOrders(orderList);

    } catch (error) {
      console.error('Admin dashboard error:', error);
      setMessage(error.message || 'Could not load admin dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setMessage('Please log in as an admin.');
      setLoading(false);
      return;
    }

    loadDashboard();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const saveRestaurant = async (e) => {
    e.preventDefault();

    try {
      setMessage('');

      const payload = {
        ...form,
        cuisine: form.cuisine
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),

        rating: Number(form.rating),
        deliveryTime: Number(form.deliveryTime),
        priceForTwo: Number(form.priceForTwo),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude)
      };

      const url = editingId
        ? `${API}/admin/restaurants/${editingId}`
        : `${API}/admin/restaurants`;

      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not save restaurant');
      }

      setMessage(
        editingId
          ? 'Restaurant updated successfully! 🎉'
          : 'Restaurant added successfully! 🎉'
      );

      setForm(emptyForm);
      setEditingId(null);

      await loadDashboard();

    } catch (error) {
      console.error('Save restaurant error:', error);
      setMessage(error.message || 'Could not save restaurant');
    }
  };

  const editRestaurant = (restaurant) => {
    setEditingId(restaurant._id);

    setForm({
      name: restaurant.name || '',
      cuisine: Array.isArray(restaurant.cuisine)
        ? restaurant.cuisine.join(', ')
        : restaurant.cuisine || '',
      rating: restaurant.rating ?? 4,
      deliveryTime: restaurant.deliveryTime ?? 30,
      image: restaurant.image || '',
      location: restaurant.location || '',
      latitude: restaurant.latitude ?? 26.8530,
      longitude: restaurant.longitude ?? 75.8046,
      priceForTwo: restaurant.priceForTwo ?? 400,
      isVeg: Boolean(restaurant.isVeg)
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteRestaurant = async (id) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this restaurant?'
    );

    if (!confirmed) return;

    try {
      setMessage('');

      const response = await fetch(`${API}/admin/restaurants/${id}`, {
        method: 'DELETE',
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not delete restaurant');
      }

      setMessage('Restaurant deleted successfully! 🗑️');
      await loadDashboard();

    } catch (error) {
      console.error('Delete restaurant error:', error);
      setMessage(error.message || 'Could not delete restaurant');
    }
  };

  const handleMenuChange = (e) => {
    const { name, value, type, checked } = e.target;

    setMenuForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const saveMenuItem = async (e) => {
    e.preventDefault();

    try {
      setMessage('');

      const payload = {
        ...menuForm,
        price: Number(menuForm.price)
      };

      const url = editingMenuId
        ? `${API}/admin/menu-items/${editingMenuId}`
        : `${API}/admin/menu-items`;

      const method = editingMenuId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not save menu item');
      }

      setMessage(
        editingMenuId
          ? 'Menu item updated successfully! 🎉'
          : 'Menu item added successfully! 🎉'
      );

      setMenuForm(emptyMenuForm);
      setEditingMenuId(null);

      await loadDashboard();

    } catch (error) {
      console.error('Save menu item error:', error);
      setMessage(error.message || 'Could not save menu item');
    }
  };

  const editMenuItem = (item) => {
    setEditingMenuId(item._id);

    setMenuForm({
      restaurant: item.restaurant?._id || item.restaurant || '',
      name: item.name || '',
      description: item.description || '',
      price: item.price ?? 0,
      category: item.category || '',
      image: item.image || '',
      isVeg: Boolean(item.isVeg)
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteMenuItem = async (id) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this menu item?'
    );

    if (!confirmed) return;

    try {
      setMessage('');

      const response = await fetch(`${API}/admin/menu-items/${id}`, {
        method: 'DELETE',
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not delete menu item');
      }

      setMessage('Menu item deleted successfully! 🗑️');
      await loadDashboard();

    } catch (error) {
      console.error('Delete menu item error:', error);
      setMessage(error.message || 'Could not delete menu item');
    }
  };

  const cancelMenuEdit = () => {
    setEditingMenuId(null);
    setMenuForm(emptyMenuForm);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setMessage('');
  };

  if (loading) {
    return (
      <main>
        <h1>Admin Dashboard</h1>
        <p>Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="adminPage">

      <div className="adminHeader">
        <div>
          <p className="eyebrow">Foodie Management</p>
          <h1>Admin Dashboard</h1>
          <p>Manage your food delivery platform.</p>
        </div>
      </div>

      {message && <div className="adminMessage">{message}</div>}

      {/* STATS */}
      <div className="adminStats">
        <div className="statCard">
          <span>🍽️</span>
          <p>Restaurants</p>
          <h2>{stats?.restaurants ?? restaurants.length}</h2>
        </div>

        <div className="statCard">
          <span>🥘</span>
          <p>Menu Items</p>
          <h2>{stats?.menuItems ?? menuItems.length}</h2>
        </div>

        <div className="statCard">
          <span>👥</span>
          <p>Users</p>
          <h2>{stats?.users ?? 0}</h2>
        </div>

        <div className="statCard">
          <span>📦</span>
          <p>Orders</p>
          <h2>{stats?.orders ?? orders.length}</h2>
        </div>

        <div className="statCard revenueCard">
          <span>💰</span>
          <p>Total Revenue</p>
          <h2>₹{stats?.revenue ?? 0}</h2>
        </div>
      </div>

      {/* ADD / EDIT RESTAURANT */}
      <section className="adminSection">
        <h2>{editingId ? 'Edit Restaurant' : 'Add Restaurant'}</h2>

        <form className="restaurantForm" onSubmit={saveRestaurant}>
          <input
            name="name"
            placeholder="Restaurant name"
            value={form.name}
            onChange={handleChange}
            required
          />

          <input
            name="cuisine"
            placeholder="Cuisine (e.g. Indian, Chinese)"
            value={form.cuisine}
            onChange={handleChange}
            required
          />

          <input
            name="rating"
            type="number"
            min="0"
            max="5"
            step="0.1"
            placeholder="Rating"
            value={form.rating}
            onChange={handleChange}
          />

          <input
            name="deliveryTime"
            type="number"
            min="1"
            placeholder="Delivery time"
            value={form.deliveryTime}
            onChange={handleChange}
          />

          <input
            name="priceForTwo"
            type="number"
            min="0"
            placeholder="Price for two"
            value={form.priceForTwo}
            onChange={handleChange}
          />

          <input
            name="location"
            placeholder="Location"
            value={form.location}
            onChange={handleChange}
          />

          <input
            name="latitude"
            type="number"
            step="any"
            placeholder="Latitude (e.g. 26.8530)"
            value={form.latitude}
            onChange={handleChange}
            required
          />

          <input
            name="longitude"
            type="number"
            step="any"
            placeholder="Longitude (e.g. 75.8046)"
            value={form.longitude}
            onChange={handleChange}
            required
          />

          <input
            name="image"
            placeholder="Image URL"
            value={form.image}
            onChange={handleChange}
          />

          <label className="checkboxRow">
            <input
              name="isVeg"
              type="checkbox"
              checked={form.isVeg}
              onChange={handleChange}
            />
            Vegetarian restaurant
          </label>

          <div className="formButtons">
            <button className="primary" type="submit">
              {editingId ? 'Update Restaurant' : 'Add Restaurant'}
            </button>

            {editingId && (
              <button
                type="button"
                className="cancelButton"
                onClick={cancelEdit}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {/* RESTAURANT LIST */}
      <section className="adminSection">
        <div className="sectionTitle">
          <h2>Manage Restaurants</h2>
          <span>{restaurants.length} restaurants</span>
        </div>

        <div className="adminRestaurantList">
          {restaurants.length === 0 ? (
            <p>No restaurants found.</p>
          ) : (
            restaurants.map((restaurant) => (
              <div className="adminRestaurant" key={restaurant._id}>
                <img
                  src={
                    restaurant.image ||
                    'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=500&q=80'
                  }
                  alt={restaurant.name}
                />

                <div className="restaurantInfo">
                  <h3>{restaurant.name}</h3>
                  <p>
                    ⭐ {restaurant.rating ?? 0} · {restaurant.deliveryTime ?? 0} min
                  </p>
                  <p>
                    {Array.isArray(restaurant.cuisine)
                      ? restaurant.cuisine.join(', ')
                      : restaurant.cuisine || 'Cuisine not added'}
                  </p>
                  <small>
                    {restaurant.location || 'Location not added'}
                  </small>
                </div>

                <div className="restaurantActions">
                  <button onClick={() => editRestaurant(restaurant)}>
                    Edit
                  </button>

                  <button
                    className="deleteButton"
                    onClick={() => deleteRestaurant(restaurant._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* MENU MANAGEMENT */}
      <section className="adminSection">
        <h2>{editingMenuId ? 'Edit Menu Item' : 'Add Menu Item'}</h2>

        <form className="restaurantForm" onSubmit={saveMenuItem}>
          <select
            name="restaurant"
            value={menuForm.restaurant}
            onChange={handleMenuChange}
            required
          >
            <option value="">Select restaurant</option>
            {restaurants.map((restaurant) => (
              <option key={restaurant._id} value={restaurant._id}>
                {restaurant.name}
              </option>
            ))}
          </select>

          <input
            name="name"
            placeholder="Menu item name"
            value={menuForm.name}
            onChange={handleMenuChange}
            required
          />

          <input
            name="price"
            type="number"
            min="0"
            placeholder="Price"
            value={menuForm.price}
            onChange={handleMenuChange}
            required
          />

          <input
            name="category"
            placeholder="Category (e.g. Pizza)"
            value={menuForm.category}
            onChange={handleMenuChange}
          />

          <input
            name="description"
            placeholder="Description"
            value={menuForm.description}
            onChange={handleMenuChange}
          />

          <input
            name="image"
            placeholder="Image URL"
            value={menuForm.image}
            onChange={handleMenuChange}
          />

          <label className="checkboxRow">
            <input
              name="isVeg"
              type="checkbox"
              checked={menuForm.isVeg}
              onChange={handleMenuChange}
            />
            Vegetarian item
          </label>

          <div className="formButtons">
            <button className="primary" type="submit">
              {editingMenuId ? 'Update Menu Item' : 'Add Menu Item'}
            </button>

            {editingMenuId && (
              <button
                type="button"
                className="cancelButton"
                onClick={cancelMenuEdit}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {/* MENU ITEM LIST */}
      <section className="adminSection">
        <div className="sectionTitle">
          <h2>Manage Menu Items</h2>
          <span>{menuItems.length} menu items</span>
        </div>

        <div className="adminRestaurantList">
          {menuItems.length === 0 ? (
            <p>No menu items found.</p>
          ) : (
            menuItems.map((item) => (
              <div className="adminRestaurant" key={item._id}>
                <div className="restaurantInfo">
                  <h3>{item.name}</h3>
                  <p>
                    🍽️ {item.restaurant?.name || 'Restaurant'}
                  </p>
                  <p>
                    ₹{item.price} · {item.category || 'Uncategorized'}
                  </p>
                  <small>
                    {item.description || 'No description'}
                  </small>
                </div>

                <div className="restaurantActions">
                  <button onClick={() => editMenuItem(item)}>
                    Edit
                  </button>

                  <button
                    className="deleteButton"
                    onClick={() => deleteMenuItem(item._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ORDERS */}
      <section className="adminSection">
        <div className="sectionTitle">
          <h2>Manage Orders</h2>
          <span>{orders.length} orders</span>
        </div>

        <div className="adminRestaurantList">
          {orders.length === 0 ? (
            <p>No orders yet.</p>
          ) : (
            orders.map((order) => (
              <div className="adminRestaurant" key={order._id}>
                <div className="restaurantInfo">
                  <h3>{order.restaurant?.name || 'Restaurant'}</h3>
                  <p>👤 {order.user?.name || 'User'}</p>
                  <p>📧 {order.user?.email || 'No email'}</p>
                  <p>💰 ₹{order.total ?? 0} · {order.status || 'UNKNOWN'}</p>
                  <small>📍 {order.address || 'Address not available'}</small>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

    </main>
  );
}

export default Admin;