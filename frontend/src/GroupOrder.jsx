import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'https://foodie-1-3b27.onrender.com/api';

// Helper function to strip raw markdown symbols (*, **, #) from AI text strings
const cleanMarkdownText = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#/g, '')
    .trim();
};

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
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState('');

  // AI Group Planner States
  const [showAiPlanner, setShowAiPlanner] = useState(true);
  const [totalBudget, setTotalBudget] = useState(3000);
  const [memberPrefs, setMemberPrefs] = useState([
    { name: 'Agrani', foodPreference: 'Vegetarian', spicePreference: 'Spicy', cravings: 'Paneer', personalBudget: 650 },
    { name: 'Aarav', foodPreference: 'Non-vegetarian', spicePreference: 'Medium', cravings: 'Biryani', personalBudget: 500 }
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [planResult, setPlanResult] = useState(null);

  const token = localStorage.getItem('token');

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

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchRestaurants = async () => {
      try {
        setLoadingRestaurants(true);
        const res = await fetch(`${API}/restaurants`, {
          headers: { Authorization: `Bearer ${token}` }
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
          headers: { Authorization: `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not load menu');

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

  const loadGroup = useCallback(async (codeToLoad) => {
    const code = codeToLoad || groupCode;
    if (!code || !token) return;

    try {
      const response = await fetch(`${API}/group-orders/${code.toUpperCase()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load group');

      const loadedGroup = data.order || data.groupOrder || data;
      setGroup(loadedGroup);
    } catch (error) {
      console.error('Load group error:', error);
    }
  }, [groupCode, token]);

  useEffect(() => {
    if (mode === 'dashboard' && groupCode) {
      loadGroup(groupCode);
      const interval = setInterval(() => { loadGroup(groupCode); }, 4000);
      return () => clearInterval(interval);
    }
  }, [mode, groupCode, loadGroup]);

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
      if (!response.ok) throw new Error(data.message || 'Could not create group');

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
        body: JSON.stringify({ name: name.trim() || 'Member' })
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

  const handleAddItem = async (menuItemId) => {
    try {
      setAddingItem(true);
      const res = await fetch(`${API}/group-orders/${groupCode}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ menuItemId, quantity: 1 })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add item');

      await loadGroup(groupCode);
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingItem(false);
    }
  };

  // CLEAR PLATE FUNCTIONALITY
  const handleRemoveAllMyItems = async () => {
    try {
      setClearing(true);
      setMessage('Clearing your items from MongoDB... ⏳');
      const res = await fetch(`${API}/group-orders/${groupCode}/clear-my-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to clear items');

      setMessage('Your plate has been cleared! 🎉');
      await loadGroup(groupCode);
    } catch (err) {
      console.error('Clear items error:', err);
      alert(err.message);
    } finally {
      setClearing(false);
    }
  };

  const addMemberField = () => {
    setMemberPrefs([
      ...memberPrefs,
      { name: `Member ${memberPrefs.length + 1}`, foodPreference: 'Anything', spicePreference: 'Medium', cravings: '', personalBudget: 500 }
    ]);
  };

  const updateMemberPref = (index, field, value) => {
    const updated = [...memberPrefs];
    updated[index][field] = value;
    setMemberPrefs(updated);
  };

  const runAiGroupPlanner = async () => {
    if (!groupCode) {
      setMessage('Please join or create an active group room first.');
      return;
    }

    try {
      setAiLoading(true);
      setMessage('');
      setPlanResult(null);

      const response = await fetch(`${API}/ai/group-planner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          groupCode,
          preferences: memberPrefs,
          totalBudget: Number(totalBudget)
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Group planner failed');

      setPlanResult(data);
    } catch (err) {
      console.error('Group Planner error:', err);
      setMessage(`Planner Error: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Find record for current logged in user in groupMembers
  const myMemberRecord = group?.groupMembers?.find((m) => {
    const memberId = m.user?._id || m.user;
    return memberId && currentUserId && memberId.toString() === currentUserId.toString();
  });

  const myShareAmount = myMemberRecord?.shareAmount || 0;
  const isMySharePaid = myMemberRecord?.paymentStatus === 'PAID';

  /**
   * Populates only the logged-in user's recommended item.
   */
  const approveAndAddToGroupOrder = async () => {
    if (!planResult || !groupCode) return;

    try {
      setMessage('Adding your recommended item to your share... ⏳');

      const myCurrentName = (myMemberRecord?.name || name || '').trim().toLowerCase();
      const memberRecs = planResult.memberRecommendations || [];

      if (memberRecs.length === 0) {
        setMessage('No recommendations available in plan.');
        return;
      }

      // 1. Match specific recommendation for logged in user name
      let mySingleRecommendation = memberRecs.find((rec) => {
        const recName = (rec.memberName || '').trim().toLowerCase();
        return recName && myCurrentName && recName === myCurrentName;
      });

      // 2. If no exact name match exists, pick the first recommendation
      if (!mySingleRecommendation) {
        mySingleRecommendation = memberRecs[0];
      }

      if (!mySingleRecommendation?.itemId) {
        setMessage('Could not find a valid menu item for your share.');
        return;
      }

      // 3. Perform request for your single recommended item
      const res = await fetch(`${API}/group-orders/${groupCode}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          menuItemId: mySingleRecommendation.itemId,
          quantity: 1
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add item');

      setMessage('Your recommended dish has been added to your share! 🎉');
      await loadGroup(groupCode);
    } catch (error) {
      console.error('Add to group order error:', error);
      setMessage('Failed to add item to group order.');
    }
  };

  /**
   * Adds ALL plan recommendations directly to group order without duplicating
   */
  const addAllPlanItemsToGroupOrder = async () => {
    if (!planResult || !groupCode) return;

    try {
      setMessage('Adding all plan items and shared add-ons to the room... ⏳');

      const allItems = [
        ...(planResult.memberRecommendations || []),
        ...(planResult.sharedSuggestions || [])
      ];

      for (const item of allItems) {
        if (!item.itemId) continue;

        if (item.isSharedAddOn || item.shared) {
          await fetch(`${API}/group-orders/${groupCode}/add-shared-share`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ menuItemId: item.itemId })
          });
        } else {
          await fetch(`${API}/group-orders/${groupCode}/items`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              menuItemId: item.itemId,
              quantity: 1
            })
          });
        }
      }

      setMessage('Full meal combination added to group room! 🎉');
      await loadGroup(groupCode);
    } catch (error) {
      console.error('Add all items error:', error);
      setMessage('Failed to add all plan items to group order.');
    }
  };

  /**
   * Action for claiming fractional share of a Shared Add-on
   */
  const handleAddSharedAddOnShare = async (item, individualShare) => {
    if (!groupCode || !item?.itemId) return;

    try {
      setMessage(`Adding ₹${individualShare} share to your account... ⏳`);

      const res = await fetch(`${API}/group-orders/${groupCode}/add-shared-share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ menuItemId: item.itemId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add share');

      setMessage(`Added ₹${individualShare} to your share! 🎉`);
      await loadGroup(groupCode);
    } catch (err) {
      alert(err.message);
    }
  };

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
        prefill: { name: myMemberRecord?.name || 'Member' },
        theme: { color: '#ff5722' },
        modal: { ondismiss: () => setPaying(false) }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      alert(err.message);
    } finally {
      setPaying(false);
    }
  };

  const getItemDetails = (itemId) => {
    const matched = menuItems.find((it) => it._id?.toString() === itemId?.toString());
    return {
      image: matched?.image || matched?.imageUrl || null,
      description: matched?.description || '',
      restaurantName: matched?.restaurant?.name || group?.restaurant?.name || 'Partner Restaurant'
    };
  };

  if (mode === 'home') {
    return (
      <main style={{ maxWidth: '900px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
        <h1 style={{ textAlign: 'center' }}>Group Order 👥</h1>
        <p style={{ textAlign: 'center', color: '#666' }}>
          Order together with friends and split the bill seamlessly.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px', marginTop: '30px' }}>
          {/* CREATE CARD */}
          <div style={{ padding: '25px', border: '1px solid #e0e0e0', borderRadius: '16px', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h2>Start a Group 🎉</h2>
            <p style={{ color: '#777', fontSize: '14px' }}>Choose a place and invite your friends.</p>

            <select
              value={selectedRestaurant}
              onChange={(e) => setSelectedRestaurant(e.target.value)}
              disabled={loadingRestaurants}
              style={{ width: '100%', padding: '12px', marginBottom: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #ccc', background: '#fff', fontSize: '14px' }}
            >
              <option value="">{loadingRestaurants ? 'Loading restaurants...' : '-- Select a Restaurant --'}</option>
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
              style={{ width: '100%', padding: '12px', marginBottom: '16px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px' }}
            />

            <button
              onClick={createGroup}
              disabled={loading}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#ff5722', color: '#fff', border: 'none', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Creating...' : 'Create Group 🚀'}
            </button>
          </div>

          {/* JOIN CARD */}
          <div style={{ padding: '25px', border: '1px solid #e0e0e0', borderRadius: '16px', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h2>Join a Group 🤝</h2>
            <p style={{ color: '#777', fontSize: '14px' }}>Enter the code shared by your friend.</p>

            <input
              placeholder="Group code (e.g. EF675AA3)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              style={{ width: '100%', padding: '12px', marginBottom: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px' }}
            />

            <input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: '12px', marginBottom: '16px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px' }}
            />

            <button
              onClick={joinGroup}
              disabled={loading}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#2e7d32', color: '#fff', border: 'none', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Joining...' : 'Join Group 👥'}
            </button>
          </div>
        </div>

        {message && (
          <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', background: message.includes('successfully') ? '#e8f5e9' : '#ffebee', color: message.includes('successfully') ? '#2e7d32' : '#c62828', textAlign: 'center' }}>
            {message}
          </div>
        )}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: '1100px', margin: '30px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <button
        onClick={() => setMode('home')}
        style={{ background: 'none', border: 'none', color: '#ff5722', cursor: 'pointer', marginBottom: '15px', fontWeight: 'bold', fontSize: '15px' }}
      >
        ← Back to Create / Join
      </button>

      <h1>Group Order Room</h1>

      {/* CODE SHARE CARD */}
      <div style={{ padding: '20px 25px', borderRadius: '16px', background: '#fff7f2', border: '1px solid #ffd8c2', textAlign: 'center', marginBottom: '25px' }}>
        <h3 style={{ margin: '0 0 6px 0' }}>Invite Your Friends</h3>
        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>Share this code with your friends to let them join:</p>
        <div style={{ fontSize: '32px', fontWeight: '900', letterSpacing: '8px', margin: '10px 0', color: '#d84315' }}>
          {groupCode || 'LOADING...'}
        </div>
        <button
          onClick={() => {
            if (groupCode) {
              navigator.clipboard.writeText(groupCode);
              setMessage('Group code copied to clipboard! 📋');
            }
          }}
          style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#ff5722', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
        >
          Copy Code 📋
        </button>
      </div>

      {/* PROMINENT AI GROUP ORDER PLANNER INTEGRATION */}
      <section
        style={{
          background: '#f4fbf7',
          border: '2px solid #2e7d32',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '35px',
          boxShadow: '0 8px 24px rgba(46, 125, 50, 0.12)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <span style={{ background: '#2e7d32', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', letterSpacing: '0.5px' }}>
              🤖 AI AGENT FEATURE
            </span>
            <h2 style={{ margin: '8px 0 2px 0', color: '#1b5e20', fontSize: '22px' }}>✨ Let AI Plan Our Group Order</h2>
            <p style={{ color: '#444', margin: 0, fontSize: '14px' }}>
              Analyze member cravings & personal budgets to generate a complete meal combination using REAL menu items.
            </p>
          </div>
          <button
            onClick={() => setShowAiPlanner(!showAiPlanner)}
            style={{ padding: '10px 18px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
          >
            {showAiPlanner ? 'Hide AI Planner ▲' : 'Plan Our Order with AI 🤖'}
          </button>
        </div>

        {showAiPlanner && (
          <div style={{ marginTop: '20px', borderTop: '1px solid #c8e6c9', paddingTop: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
              
              {/* LEFT COLUMN: INPUTS & MEMBER PREFERENCES */}
              <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e0e0e0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px', fontSize: '14px', color: '#222' }}>
                    Total Group Budget (₹):
                  </label>
                  <input
                    type="number"
                    value={totalBudget}
                    onChange={(e) => setTotalBudget(e.target.value)}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box', fontSize: '14px', fontWeight: 'bold', color: '#2e7d32' }}
                  />
                </div>

                <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#333' }}>Member Preferences & Constraints</h4>
                {memberPrefs.map((pref, i) => (
                  <div key={i} style={{ background: '#fafafa', padding: '14px', borderRadius: '12px', border: '1px solid #e0e0e0', marginBottom: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Name</label>
                        <input
                          placeholder="Member Name"
                          value={pref.name}
                          onChange={(e) => updateMemberPref(i, 'name', e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Diet</label>
                        <select
                          value={pref.foodPreference}
                          onChange={(e) => updateMemberPref(i, 'foodPreference', e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', boxSizing: 'border-box', background: '#fff' }}
                        >
                          <option value="Vegetarian">🟢 Vegetarian</option>
                          <option value="Non-vegetarian">🔴 Non-veg</option>
                          <option value="Anything">Anything</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Spice</label>
                        <select
                          value={pref.spicePreference}
                          onChange={(e) => updateMemberPref(i, 'spicePreference', e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', boxSizing: 'border-box', background: '#fff' }}
                        >
                          <option value="Mild">Mild</option>
                          <option value="Medium">Medium</option>
                          <option value="Spicy">🌶️ Spicy</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Craving</label>
                        <input
                          placeholder="e.g. Paneer, Biryani"
                          value={pref.cravings}
                          onChange={(e) => updateMemberPref(i, 'cravings', e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                  <button onClick={addMemberField} style={{ padding: '10px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                    + Add Member
                  </button>
                  <button
                    onClick={runAiGroupPlanner}
                    disabled={aiLoading}
                    style={{ flex: 1, padding: '10px 20px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
                  >
                    {aiLoading ? 'Constructing Plan... 🧠' : 'Generate Group Plan ✨'}
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN: PROPOSED AI GROUP COMBINATION FOOD CARDS */}
              <div>
                {planResult ? (
                  <div style={{ background: '#fff', border: '2px solid #2e7d32', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 16px rgba(46, 125, 50, 0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                      <h3 style={{ color: '#2e7d32', margin: 0, fontSize: '18px' }}>🤖 Proposed AI Group Combination</h3>
                      <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '13px' }}>
                        Total: ₹{planResult.totalSpent} / ₹{planResult.totalBudget}
                      </span>
                    </div>

                    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#666' }}>
                      Budget Remaining: <strong style={{ color: '#2e7d32' }}>₹{planResult.budgetRemaining}</strong>
                    </p>

                    {/* INDIVIDUAL FOOD CARDS GRID */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                      {planResult.memberRecommendations?.map((rec, idx) => {
                        const details = getItemDetails(rec.itemId);
                        const fallbackImg = rec.isVeg
                          ? 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop'
                          : 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=500&auto=format&fit=crop';

                        const isJoined = group?.groupMembers?.some((gm) => gm.name?.trim().toLowerCase() === rec.memberName?.trim().toLowerCase());

                        return (
                          <div key={idx} style={{ border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                            <div style={{ position: 'relative', width: '100%', height: '140px', backgroundColor: '#f0f0f0' }}>
                              <img
                                src={details.image || fallbackImg}
                                alt={rec.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { e.target.src = fallbackImg; }}
                              />
                              <span style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(255,255,255,0.95)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                                {rec.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}
                              </span>
                              <span style={{ position: 'absolute', bottom: '8px', right: '8px', background: isJoined ? '#2e7d32' : 'rgba(0,0,0,0.75)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                                👤 {rec.memberName} {isJoined ? ' (Joined)' : ' (Pending)'}
                              </span>
                            </div>

                            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#222', marginBottom: '2px' }}>{cleanMarkdownText(rec.name)}</div>
                                <div style={{ color: '#ff5722', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>₹{rec.price}</div>
                                <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>{details.restaurantName}</div>
                                <p style={{ fontSize: '12px', color: '#555', margin: 0, lineHeight: '1.3' }}>
                                  {cleanMarkdownText(rec.reason || details.description)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* SHARED ADD-ONS CARDS WITH FRACTIONAL SHARE ALLOCATION */}
                      {planResult.sharedSuggestions?.map((item, idx) => {
                        const details = getItemDetails(item.itemId);
                        const fallbackImg = item.isVeg
                          ? 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop'
                          : 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=500&auto=format&fit=crop';

                        // Dynamic member count from joined room members or input form
                        const memberCount = group?.groupMembers?.length || memberPrefs.length || 1;
                        const individualShare = Math.round(item.price / memberCount);

                        // Check if current logged-in user already claimed their split share
                        const isAlreadyClaimed = myMemberRecord?.items?.some(
                          (it) => ((it.menuItem?._id || it.menuItem)?.toString() === item.itemId?.toString() || it.name?.includes(item.name)) && it.isSharedAddOn
                        );

                        return (
                          <div
                            key={`shared-${idx}`}
                            style={{
                              border: '1px solid #a5d6a7',
                              borderRadius: '12px',
                              overflow: 'hidden',
                              background: '#f1f8e9',
                              display: 'flex',
                              flexDirection: 'column',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                            }}
                          >
                            <div style={{ position: 'relative', width: '100%', height: '140px', backgroundColor: '#e8f5e9' }}>
                              <img
                                src={details.image || fallbackImg}
                                alt={item.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { e.target.src = fallbackImg; }}
                              />
                              <span style={{ position: 'absolute', top: '8px', left: '8px', background: '#2e7d32', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                                👥 Shared Add-on
                              </span>
                            </div>

                            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#1b5e20', marginBottom: '2px' }}>
                                  {cleanMarkdownText(item.name)}
                                </div>
                                <div style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                                  ₹{item.price}
                                </div>
                                <div style={{ fontSize: '12px', color: '#555', marginBottom: '2px' }}>
                                  Shared among <strong>{memberCount}</strong> member{memberCount > 1 ? 's' : ''}
                                </div>
                                <div style={{ fontSize: '13px', color: '#1b5e20', fontWeight: 'bold', marginBottom: '8px' }}>
                                  Your share: ₹{individualShare}
                                </div>
                                <p style={{ fontSize: '12px', color: '#444', margin: '0 0 10px 0', lineHeight: '1.3' }}>
                                  {cleanMarkdownText(item.reason || details.description)}
                                </p>
                              </div>

                              {/* INLINE SHARED SPLIT BUTTON */}
                              <button
                                onClick={() => handleAddSharedAddOnShare(item, individualShare)}
                                disabled={isAlreadyClaimed || isMySharePaid}
                                style={{
                                  width: '100%',
                                  padding: '8px 10px',
                                  background: isAlreadyClaimed ? '#a5d6a7' : '#2e7d32',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontWeight: 'bold',
                                  fontSize: '12px',
                                  cursor: isAlreadyClaimed || isMySharePaid ? 'default' : 'pointer'
                                }}
                              >
                                {isAlreadyClaimed ? `✓ Added ₹${individualShare} to My Share` : `+ Add ₹${individualShare} to My Share`}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* WHY THIS WORKS */}
                    <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', padding: '14px 16px', borderRadius: '12px', marginBottom: '18px' }}>
                      <div style={{ fontWeight: 'bold', color: '#1b5e20', fontSize: '14px', marginBottom: '8px' }}>
                        Why this works
                      </div>
                      <div style={{ fontSize: '13px', color: '#2e7d32', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>✓ Satisfies dietary restrictions for all members</div>
                        <div>✓ Uses real menu items from partner restaurants</div>
                        <div>✓ Stays directly within your specified ₹{totalBudget} group budget</div>
                      </div>
                    </div>

                    {/* AI AGENT AUDIT TRAIL & EXECUTION LOG PANEL */}
                    {planResult.auditTrail && planResult.auditTrail.length > 0 && (
                      <div style={{ marginBottom: '18px', background: '#0f172a', color: '#e2e8f0', padding: '16px', borderRadius: '12px', fontFamily: 'monospace', fontSize: '12px', border: '1px solid #334155' }}>
                        <div style={{ fontWeight: 'bold', color: '#38bdf8', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>🛡️ AI AGENT AUDIT TRAIL & EXECUTION LOG</span>
                          <span style={{ background: '#166534', color: '#4ade80', padding: '2px 8px', borderRadius: '4px', fontSize: '10px' }}>
                            ● EXPLAINED & BOUNDED
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                          {planResult.auditTrail.map((log, i) => (
                            <div key={i} style={{ borderBottom: '1px solid #1e293b', paddingBottom: '4px' }}>
                              <span style={{ color: '#fbbf24' }}>[{log.time}]</span> <strong style={{ color: '#93c5fd' }}>{log.step}:</strong> {log.detail}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ACTION BUTTONS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button
                        onClick={approveAndAddToGroupOrder}
                        style={{ width: '100%', padding: '12px', background: '#ff5722', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 12px rgba(255, 87, 34, 0.25)' }}
                      >
                        ✨ Add My Recommended Dish to My Share
                      </button>

                      {planResult.sharedSuggestions?.length > 0 && (
                        <button
                          onClick={addAllPlanItemsToGroupOrder}
                          style={{ width: '100%', padding: '12px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
                        >
                          🛒 Add Full Plan + Shared Add-ons to Room Order
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#fff', border: '2px dashed #c8e6c9', borderRadius: '16px', padding: '40px 20px', textAlign: 'center', color: '#666' }}>
                    <div style={{ fontSize: '36px', marginBottom: '10px' }}>🥗</div>
                    <h4 style={{ margin: '0 0 6px 0', color: '#2e7d32', fontSize: '16px' }}>Ready to plan your meal?</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#777' }}>
                      Configure your total budget & member cravings on the left, then click <strong>Generate Group Plan</strong> to view AI recommendations.
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </section>

      {/* RESTAURANT MENU ITEMS */}
      <section style={{ marginTop: '35px' }}>
        <h2 style={{ marginBottom: '6px' }}>Add Items From The Menu 🍕</h2>
        <p style={{ color: '#666', fontSize: '14px', margin: '0 0 15px 0' }}>
          Select dishes to add to your personal share in this order.
        </p>

        {loadingMenu ? (
          <p style={{ color: '#888' }}>Loading menu items...</p>
        ) : menuItems.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
            {menuItems.map((item) => (
              <div
                key={item._id}
                style={{ border: '1px solid #e0e0e0', borderRadius: '12px', padding: '16px', background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 5px rgba(0,0,0,0.03)' }}
              >
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '16px' }}>{item.name}</h4>
                  <div style={{ color: '#ff5722', fontWeight: 'bold', fontSize: '15px' }}>₹{item.price}</div>
                  {item.description && (
                    <p style={{ color: '#777', fontSize: '12px', margin: '6px 0 0 0' }}>{item.description}</p>
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
          <div style={{ padding: '20px', background: '#f9f9f9', borderRadius: '8px', color: '#888', textAlign: 'center' }}>
            No menu items found for this restaurant.
          </div>
        )}
      </section>

      {/* SPLIT BILL SELECTOR */}
      <section style={{ marginTop: '35px', padding: '20px', borderRadius: '14px', background: '#fff', border: '1px solid #e0e0e0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
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
            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#222' }}>🧾 Pay for what I ordered</div>
            <div style={{ color: '#666', fontSize: '13px', marginTop: '6px' }}>Each person pays only for the dishes they added to their plate.</div>
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
            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#222' }}>⚖️ Split total amount equally among everyone</div>
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
            const isMe = (member.user?._id || member.user)?.toString() === currentUserId?.toString();

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
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px', color: '#444' }}>
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

                  {/* CLEAR ITEMS BUTTON */}
                  {isMe && member.items && member.items.length > 0 && (
                    <button
                      onClick={handleRemoveAllMyItems}
                      disabled={clearing || isMySharePaid}
                      style={{
                        marginTop: '8px',
                        padding: '4px 10px',
                        background: '#ffebee',
                        color: '#c62828',
                        border: '1px solid #ef9a9a',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: clearing || isMySharePaid ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      {clearing ? 'Clearing...' : '🗑️ Clear My Items'}
                    </button>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#222' }}>₹{member.shareAmount || 0}</div>
                  <div style={{ fontSize: '13px', marginTop: '6px' }}>
                    {member.paymentStatus === 'PAID' ? (
                      <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✅ Paid</span>
                    ) : member.paymentStatus === 'FAILED' ? (
                      <span style={{ color: '#c62828', fontWeight: 'bold' }}>❌ Failed</span>
                    ) : (
                      <span style={{ color: '#ef6c00', fontWeight: 'bold' }}>⏳ Pending</span>
                    )}
                  </div>

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
      <section style={{ marginTop: '35px', padding: '24px', background: '#fafafa', borderRadius: '14px', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
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
              {paying ? 'Opening Razorpay...' : myShareAmount > 0 ? `Pay My Share (₹${myShareAmount}) 💳` : 'Add Items to Pay'}
            </button>
          )}

          {isMySharePaid && (
            <span style={{ padding: '8px 16px', borderRadius: '8px', background: '#e8f5e9', color: '#2e7d32', fontWeight: 'bold', fontSize: '14px' }}>
              Your Share is Paid ✅
            </span>
          )}

          <button
            style={{ padding: '11px 16px', borderRadius: '8px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontWeight: '600' }}
            onClick={() => loadGroup()}
          >
            Refresh 🔄
          </button>
        </div>
      </section>

      {message && (
        <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', background: message.includes('successfully') ? '#e8f5e9' : '#ffebee', color: message.includes('successfully') ? '#2e7d32' : '#c62828', textAlign: 'center' }}>
          {message}
        </div>
      )}
    </main>
  );
}

export default GroupOrder;