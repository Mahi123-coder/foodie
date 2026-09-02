import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'https://foodie-1-3b27.onrender.com/api';

function GroupOrder() {
  const navigate = useNavigate();

  const [mode, setMode] = useState('home'); // 'home' | 'dashboard'

  // Restaurant & Menu Data
  const [restaurantsList, setRestaurantsList] = useState([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);

  // Form Inputs
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [address, setAddress] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [name, setName] = useState('');

  // Room State
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState('');

  const token = localStorage.getItem('token');

  // Decode user ID safely across various JWT payload formats
  const getLoggedInUserId = () => {
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      return payload.id || payload._id || payload.userId || payload.user?._id || payload.user?.id;
    } catch {
      return null;
    }
  };

  const currentUserId = getLoggedInUserId();

  // ---------------------------------------------------------
  // 1. AUTH CHECK & INITIAL RESTAURANTS LIST
  // ---------------------------------------------------------
  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchRestaurants = async () => {
      try {
        setLoadingRestaurants(true);
        const res = await fetch(`${API}/restaurants`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.restaurants || [];
        setRestaurantsList(list);
      } catch (err) {
        console.error('Failed to load restaurants:', err);
      } finally {
        setLoadingRestaurants(false);
      }
    };

    fetchRestaurants();
  }, [token, navigate]);

  // ---------------------------------------------------------
  // 2. FETCH MENU (Locks once loaded to stop polling flickers)
  // ---------------------------------------------------------
  const restaurantId =
    typeof group?.restaurant === 'object'
      ? group?.restaurant?._id?.toString()
      : group?.restaurant?.toString();

  useEffect(() => {
    if (!restaurantId || !token || mode !== 'dashboard') return;
    if (menuItems.length > 0) return;

    const fetchMenu = async () => {
      try {
        setLoadingMenu(true);
        const res = await fetch(`${API}/restaurants/${restaurantId}/menu`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Could not load menu');
        }

        const items = Array.isArray(data) ? data : data.menuItems || data.items || [];
        setMenuItems(items);
      } catch (err) {
        console.error('Failed to load menu items:', err);
      } finally {
        setLoadingMenu(false);
      }
    };

    fetchMenu();
  }, [restaurantId, token, mode, menuItems.length]);

  // ---------------------------------------------------------
  // 3. LOAD & REFRESH GROUP DETAILS (Polling)
  // ---------------------------------------------------------
  const loadGroup = useCallback(async (codeToLoad) => {
    const code = codeToLoad || groupCode;
    if (!code || !token) return;

    try {
      const response = await fetch(`${API}/group-orders/${code.toUpperCase()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Could not load group');
      }

      const loadedGroup = data.order || data.groupOrder || data;
      setGroup(loadedGroup);
    } catch (error) {
      console.error('Load group error:', error);
    }
  }, [groupCode, token]);

  useEffect(() => {
    if (mode === 'dashboard' && groupCode) {
      loadGroup(groupCode);
      const interval = setInterval(() => {
        loadGroup(groupCode);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [mode, groupCode, loadGroup]);

  // ---------------------------------------------------------
  // 4. CREATE GROUP
  // ---------------------------------------------------------
  const createGroup = async () => {
    setMessage('');

    if (!selectedRestaurant) {
      setMessage('Please select a restaurant from the dropdown.');
      return;
    }

    if (!address.trim()) {
      setMessage('Please enter a delivery address.');
      return;
    }

    try {
      setLoading(true);
      setMessage('Creating group order...');

      const response = await fetch(`${API}/group-orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          restaurant: selectedRestaurant,
          address: address.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Could not create group');
      }

      const createdOrder = data.order || data.groupOrder || data;
      const code = createdOrder.groupCode || data.groupCode;

      setGroup(createdOrder);
      setGroupCode(code);
      setMenuItems([]);
      setMode('dashboard');
      setMessage('Group created successfully! 🎉');
    } catch (error) {
      console.error('Create group error:', error);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // 5. CHANGE SPLIT MODE
  // ---------------------------------------------------------
  const handleSplitModeChange = async (newMode) => {
    try {
      const res = await fetch(`${API}/group-orders/${groupCode}/split-mode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ splitMode: newMode })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not change split mode');

      loadGroup(groupCode);
    } catch (err) {
      alert(err.message);
    }
  };

  // ---------------------------------------------------------
  // 6. JOIN GROUP (Handles Re-entry)
  // ---------------------------------------------------------
  const joinGroup = async () => {
    setMessage('');

    if (!joinCode.trim()) {
      setMessage('Please enter a group code.');
      return;
    }

    const code = joinCode.trim().toUpperCase();

    try {
      setLoading(true);
      setMessage('Entering group...');

      const response = await fetch(`${API}/group-orders/${code}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim() || 'Member'
        })
      });

      const data = await response.json();

      if (response.ok || data.message?.includes('already joined') || data.message?.includes('Welcome back')) {
        setGroupCode(code);
        setMenuItems([]);
        await loadGroup(code);
        setMode('dashboard');
        setMessage(response.ok ? 'Entered group room! 🎉' : 'Reconnected to group room! 👋');
        return;
      }

      throw new Error(data.message || 'Could not join group');
    } catch (error) {
      console.error('Join group error:', error);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // 7. ADD ITEM TO GROUP ORDER
  // ---------------------------------------------------------
  const handleAddItem = async (menuItemId) => {
    try {
      setAddingItem(true);
      const res = await fetch(`${API}/group-orders/${groupCode}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          menuItemId,
          quantity: 1
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to add item');
      }

      loadGroup(groupCode);
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingItem(false);
    }
  };

  // ---------------------------------------------------------
  // 8. OPEN RAZORPAY MODAL FOR CURRENT MEMBER SHARE
  // ---------------------------------------------------------
  const handlePayShare = async () => {
    if (!window.Razorpay) {
      alert('Razorpay SDK failed to load. Make sure the checkout script is in index.html.');
      return;
    }

    try {
      setPaying(true);

      const res = await fetch(`${API}/group-orders/${groupCode}/create-razorpay-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const orderData = await res.json();
      if (!res.ok) throw new Error(orderData.message || 'Failed to create payment order');

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Foodie Group Order',
        description: `Group Share for Room ${groupCode}`,
        order_id: orderData.orderId,
        handler: async (response) => {
          try {
            const verifyRes = await fetch(`${API}/group-orders/${groupCode}/verify-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.message || 'Payment signature check failed');

            setMessage('Payment verified successfully! 🎉');
            loadGroup(groupCode);
          } catch (err) {
            alert(err.message);
          }
        },
        prefill: {
          name: myMemberRecord?.name || 'Member'
        },
        theme: {
          color: '#ff5722'
        },
        modal: {
          ondismiss: () => setPaying(false)
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      alert(err.message);
    } finally {
      setPaying(false);
    }
  };

  // Find the logged-in member record
  const myMemberRecord = group?.groupMembers?.find((m) => {
    const memberId = m.user?._id || m.user;
    return memberId && currentUserId && memberId.toString() === currentUserId.toString();
  });

  const myShareAmount = myMemberRecord?.shareAmount || 0;
  const isMySharePaid = myMemberRecord?.paymentStatus === 'PAID';

  // ---------------------------------------------------------
  // RENDER: HOME SCREEN
  // ---------------------------------------------------------
  if (mode === 'home') {
    return (
      <main style={{ maxWidth: '900px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
        <h1 style={{ textAlign: 'center' }}>Group Order 👥</h1>
        <p style={{ textAlign: 'center', color: '#666' }}>
          Order together with friends and split the bill seamlessly.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '25px',
            marginTop: '30px'
          }}
        >
          {/* CREATE CARD */}
          <div
            style={{
              padding: '25px',
              border: '1px solid #e0e0e0',
              borderRadius: '16px',
              background: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}
          >
            <h2>Start a Group 🎉</h2>
            <p style={{ color: '#777', fontSize: '14px' }}>Choose a place and invite your friends.</p>

            <select
              value={selectedRestaurant}
              onChange={(e) => setSelectedRestaurant(e.target.value)}
              disabled={loadingRestaurants}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '12px',
                boxSizing: 'border-box',
                borderRadius: '8px',
                border: '1px solid #ccc',
                background: '#fff',
                fontSize: '14px'
              }}
            >
              <option value="">
                {loadingRestaurants ? 'Loading restaurants...' : '-- Select a Restaurant --'}
              </option>
              {restaurantsList.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name} {r.cuisine ? `(${Array.isArray(r.cuisine) ? r.cuisine.join(', ') : r.cuisine})` : ''}
                </option>
              ))}
            </select>

            <textarea
              placeholder="Delivery address (e.g. Room 204, Block B)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '16px',
                boxSizing: 'border-box',
                borderRadius: '8px',
                border: '1px solid #ccc',
                fontSize: '14px'
              }}
            />

            <button
              onClick={createGroup}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#ff5722',
                color: '#fff',
                border: 'none',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Creating...' : 'Create Group 🚀'}
            </button>
          </div>

          {/* JOIN CARD */}
          <div
            style={{
              padding: '25px',
              border: '1px solid #e0e0e0',
              borderRadius: '16px',
              background: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}
          >
            <h2>Join a Group 🤝</h2>
            <p style={{ color: '#777', fontSize: '14px' }}>Enter the code shared by your friend.</p>

            <input
              placeholder="Group code (e.g. EF675AA3)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '12px',
                boxSizing: 'border-box',
                borderRadius: '8px',
                border: '1px solid #ccc',
                fontSize: '14px'
              }}
            />

            <input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '16px',
                boxSizing: 'border-box',
                borderRadius: '8px',
                border: '1px solid #ccc',
                fontSize: '14px'
              }}
            />

            <button
              onClick={joinGroup}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#2e7d32',
                color: '#fff',
                border: 'none',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Joining...' : 'Join Group 👥'}
            </button>
          </div>
        </div>

        {message && (
          <div
            style={{
              marginTop: '20px',
              padding: '12px',
              borderRadius: '8px',
              background: message.includes('successfully') ? '#e8f5e9' : '#ffebee',
              color: message.includes('successfully') ? '#2e7d32' : '#c62828',
              textAlign: 'center'
            }}
          >
            {message}
          </div>
        )}
      </main>
    );
  }

  // ---------------------------------------------------------
  // RENDER: DASHBOARD SCREEN
  // ---------------------------------------------------------
  return (
    <main style={{ maxWidth: '850px', margin: '30px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <button
        onClick={() => setMode('home')}
        style={{
          background: 'none',
          border: 'none',
          color: '#ff5722',
          cursor: 'pointer',
          marginBottom: '15px',
          fontWeight: 'bold',
          fontSize: '15px'
        }}
      >
        ← Back to Create / Join
      </button>

      <h1>Group Order Room</h1>

      {/* CODE SHARE CARD */}
      <div
        style={{
          padding: '25px',
          borderRadius: '16px',
          background: '#fff7f2',
          border: '1px solid #ffd8c2',
          textAlign: 'center'
        }}
      >
        <h3 style={{ margin: '0 0 10px 0' }}>Invite Your Friends</h3>
        <p style={{ margin: 0, color: '#666' }}>Share this code with your friends to let them join:</p>
        <div
          style={{
            fontSize: '36px',
            fontWeight: '900',
            letterSpacing: '8px',
            margin: '15px 0',
            color: '#d84315'
          }}
        >
          {groupCode}
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(groupCode);
            setMessage('Group code copied to clipboard! 📋');
          }}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: '#ff5722',
            color: '#fff',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Copy Code 📋
        </button>
      </div>

      {/* RESTAURANT MENU ITEMS */}
      <section style={{ marginTop: '35px' }}>
        <h2 style={{ marginBottom: '6px' }}>Add Items From The Menu 🍕</h2>
        <p style={{ color: '#666', fontSize: '14px', margin: '0 0 15px 0' }}>
          Select dishes to add to your personal share in this order.
        </p>

        {loadingMenu ? (
          <p style={{ color: '#888' }}>Loading menu items...</p>
        ) : menuItems.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '16px'
            }}
          >
            {menuItems.map((item) => (
              <div
                key={item._id}
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  padding: '16px',
                  background: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
                }}
              >
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '16px' }}>{item.name}</h4>
                  <div style={{ color: '#ff5722', fontWeight: 'bold', fontSize: '15px' }}>
                    ₹{item.price}
                  </div>
                  {item.description && (
                    <p style={{ color: '#777', fontSize: '12px', margin: '6px 0 0 0' }}>
                      {item.description}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleAddItem(item._id)}
                  disabled={addingItem || isMySharePaid}
                  style={{
                    marginTop: '14px',
                    padding: '8px 12px',
                    backgroundColor: isMySharePaid ? '#ccc' : '#ff5722',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: addingItem || isMySharePaid ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isMySharePaid ? 'Share Paid' : '+ Add Item'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: '20px',
              background: '#f9f9f9',
              borderRadius: '8px',
              color: '#888',
              textAlign: 'center'
            }}
          >
            No menu items found for this restaurant.
          </div>
        )}
      </section>

      {/* SPLIT BILL SELECTOR */}
      <section
        style={{
          marginTop: '35px',
          padding: '20px',
          borderRadius: '14px',
          background: '#fff',
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}
      >
        <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>How do you want to split the bill?</h3>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 16px 0' }}>
          Choose how individual payment shares are calculated for this room.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div
            onClick={() => handleSplitModeChange('ITEMIZED')}
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: (!group?.splitMode || group?.splitMode === 'ITEMIZED') ? '2px solid #ff5722' : '1px solid #ddd',
              background: (!group?.splitMode || group?.splitMode === 'ITEMIZED') ? '#fff7f2' : '#fafafa',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#222' }}>
              🧾 Pay for what I ordered
            </div>
            <div style={{ color: '#666', fontSize: '13px', marginTop: '6px' }}>
              Each person pays only for the dishes they added to their plate.
            </div>
          </div>

          <div
            onClick={() => handleSplitModeChange('EQUAL')}
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: group?.splitMode === 'EQUAL' ? '2px solid #ff5722' : '1px solid #ddd',
              background: group?.splitMode === 'EQUAL' ? '#fff7f2' : '#fafafa',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#222' }}>
              ⚖️ Split total amount equally among everyone
            </div>
            <div style={{ color: '#666', fontSize: '13px', marginTop: '6px' }}>
              Total ₹{group?.total || 0} divided equally (₹{group?.groupMembers?.length ? Math.round((group.total || 0) / group.groupMembers.length) : 0} / person).
            </div>
          </div>
        </div>
      </section>

      {/* MEMBERS, SELECTIONS, AND SPLIT BREAKDOWN */}
      <section style={{ marginTop: '35px' }}>
        <h2>Group Members ({group?.groupMembers?.length || 0})</h2>
        {group?.groupMembers?.length ? (
          group.groupMembers.map((member, index) => {
            const isMe =
              (member.user?._id || member.user)?.toString() === currentUserId?.toString();

            return (
              <div
                key={member.user?._id || member.user || index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  padding: '16px 20px',
                  marginTop: '12px',
                  border: isMe ? '2px solid #ff5722' : '1px solid #e0e0e0',
                  borderRadius: '12px',
                  background: '#fff'
                }}
              >
                <div>
                  <strong style={{ fontSize: '16px' }}>
                    {member.name || 'Member'} {isMe && '(You)'}
                  </strong>

                  {member.items && member.items.length > 0 ? (
                    <ul
                      style={{
                        margin: '8px 0 0 0',
                        paddingLeft: '20px',
                        fontSize: '13px',
                        color: '#444'
                      }}
                    >
                      {member.items.map((it, i) => (
                        <li key={i} style={{ marginBottom: '3px' }}>
                          {it.name} × {it.quantity} (₹{it.price * it.quantity})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ color: '#999', fontSize: '13px', marginTop: '6px' }}>
                      No items selected yet
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#222' }}>
                    ₹{member.shareAmount || 0}
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '6px' }}>
                    {member.paymentStatus === 'PAID' ? (
                      <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✅ Paid</span>
                    ) : member.paymentStatus === 'FAILED' ? (
                      <span style={{ color: '#c62828', fontWeight: 'bold' }}>❌ Failed</span>
                    ) : (
                      <span style={{ color: '#ef6c00', fontWeight: 'bold' }}>⏳ Pending</span>
                    )}
                  </div>

                  {/* DIRECT PAY BUTTON FOR CURRENT MEMBER */}
                  {isMe && member.paymentStatus !== 'PAID' && (
                    <button
                      onClick={handlePayShare}
                      disabled={paying || (member.shareAmount || 0) <= 0}
                      style={{
                        marginTop: '8px',
                        padding: '6px 14px',
                        backgroundColor: (member.shareAmount || 0) > 0 ? '#2e7d32' : '#aaa',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        cursor: paying || (member.shareAmount || 0) <= 0 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {paying ? 'Opening Razorpay...' : `Pay ₹${member.shareAmount || 0} 💳`}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p style={{ color: '#888' }}>No members have joined yet.</p>
        )}
      </section>

      {/* GRAND TOTAL & PAYMENT CONTROL CARD */}
      <section
        style={{
          marginTop: '35px',
          padding: '24px',
          background: '#fafafa',
          borderRadius: '14px',
          border: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px'
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '22px' }}>Total Order: ₹{group?.total || 0}</h2>
          <p style={{ margin: '6px 0 0 0', color: '#666', fontSize: '14px' }}>
            {group?.allMembersPaid
              ? '🎉 Everyone has paid! Order is placed and confirmed.'
              : `Your Share: ₹${myShareAmount} • ${isMySharePaid ? 'Paid ✅' : 'Payment Pending ⏳'}`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {!isMySharePaid && (
            <button
              onClick={handlePayShare}
              disabled={paying || myShareAmount <= 0}
              style={{
                padding: '12px 22px',
                borderRadius: '8px',
                backgroundColor: myShareAmount > 0 ? '#2e7d32' : '#aaa',
                color: '#fff',
                border: 'none',
                fontWeight: 'bold',
                cursor: paying || myShareAmount <= 0 ? 'not-allowed' : 'pointer',
                fontSize: '15px'
              }}
            >
              {paying
                ? 'Opening Razorpay...'
                : myShareAmount > 0
                ? `Pay My Share (₹${myShareAmount}) 💳`
                : 'Add Items to Pay'}
            </button>
          )}

          {isMySharePaid && (
            <span
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: '#e8f5e9',
                color: '#2e7d32',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              Your Share is Paid ✅
            </span>
          )}

          <button
            style={{
              padding: '11px 16px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: '600'
            }}
            onClick={() => loadGroup()}
          >
            Refresh 🔄
          </button>
        </div>
      </section>

      {message && (
        <div
          style={{
            marginTop: '20px',
            padding: '12px',
            borderRadius: '8px',
            background: message.includes('successfully') ? '#e8f5e9' : '#ffebee',
            color: message.includes('successfully') ? '#2e7d32' : '#c62828',
            textAlign: 'center'
          }}
        >
          {message}
        </div>
      )}
    </main>
  );
}

export default GroupOrder;