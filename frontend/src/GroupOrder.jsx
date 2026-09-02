import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'https://foodie-1-3b27.onrender.com/api';

function GroupOrder() {
  const navigate = useNavigate();

  const [mode, setMode] = useState('home'); // 'home' | 'dashboard'

  const [restaurant, setRestaurant] = useState('');
  const [address, setAddress] = useState('');

  const [groupCode, setGroupCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [name, setName] = useState('');

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const token = localStorage.getItem('token');

  // ---------------------------------------------------------
  // AUTH CHECK
  // ---------------------------------------------------------
  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  // ---------------------------------------------------------
  // LOAD / REFRESH GROUP
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

  // Auto-refresh when dashboard is active (polls every 4 seconds)
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
  // CREATE GROUP
  // ---------------------------------------------------------
  const createGroup = async () => {
    setMessage('');

    if (!restaurant.trim()) {
      setMessage('Please enter a valid Restaurant ID.');
      return;
    }

    // 24-character hexadecimal check to prevent Mongoose CastError (500)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(restaurant.trim());
    if (!isValidObjectId) {
      setMessage('Restaurant ID must be a valid 24-character MongoDB ID (e.g. from your database).');
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
          restaurant: restaurant.trim(),
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
  // JOIN GROUP
  // ---------------------------------------------------------
  const joinGroup = async () => {
    setMessage('');

    if (!joinCode.trim()) {
      setMessage('Please enter a group code.');
      return;
    }

    if (!name.trim()) {
      setMessage('Please enter your name.');
      return;
    }

    try {
      setLoading(true);
      setMessage('Joining group...');

      const code = joinCode.trim().toUpperCase();

      const response = await fetch(`${API}/group-orders/${code}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not join group');
      }

      const joinedOrder = data.order || data.groupOrder || data;

      setGroup(joinedOrder);
      setGroupCode(joinedOrder.groupCode || code);
      setMode('dashboard');
      setMessage('Joined group successfully! 🎉');
    } catch (error) {
      console.error('Join group error:', error);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // HOME SCREEN (CREATE OR JOIN)
  // ---------------------------------------------------------
  if (mode === 'home') {
    return (
      <main style={{ maxWidth: '900px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
        <h1 style={{ textAlign: 'center' }}>Group Order 👥</h1>
        <p style={{ textAlign: 'center', color: '#666' }}>
          Order together with friends and let everyone pay their own share.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '25px',
            marginTop: '30px'
          }}
        >
          {/* CREATE GROUP */}
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
            <p style={{ color: '#777', fontSize: '14px' }}>Create an order and invite your friends.</p>

            <input
              placeholder="Restaurant ID (24 hex characters)"
              value={restaurant}
              onChange={(e) => setRestaurant(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '12px',
                boxSizing: 'border-box',
                borderRadius: '8px',
                border: '1px solid #ccc'
              }}
            />

            <textarea
              placeholder="Delivery address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '16px',
                boxSizing: 'border-box',
                borderRadius: '8px',
                border: '1px solid #ccc'
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

          {/* JOIN GROUP */}
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
              placeholder="Group code (e.g. 9B3C2A)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '12px',
                boxSizing: 'border-box',
                borderRadius: '8px',
                border: '1px solid #ccc'
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
                border: '1px solid #ccc'
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
  // GROUP DASHBOARD
  // ---------------------------------------------------------
  return (
    <main style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <button
        onClick={() => setMode('home')}
        style={{
          background: 'none',
          border: 'none',
          color: '#ff5722',
          cursor: 'pointer',
          marginBottom: '15px',
          fontWeight: 'bold'
        }}
      >
        ← Back to Create / Join
      </button>

      <h1>Group Order Room</h1>

      {/* INVITE BOX */}
      <div
        style={{
          padding: '25px',
          marginTop: '15px',
          borderRadius: '16px',
          background: '#fff7f2',
          border: '1px solid #ffd8c2',
          textAlign: 'center'
        }}
      >
        <h3 style={{ margin: '0 0 10px 0' }}>Invite Your Friends</h3>
        <p style={{ margin: 0, color: '#666' }}>Share this unique group code:</p>
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

      {/* MEMBERS LIST */}
      <section style={{ marginTop: '30px' }}>
        <h2>Group Members ({group?.groupMembers?.length || 0})</h2>
        {group?.groupMembers?.length ? (
          group.groupMembers.map((member, index) => (
            <div
              key={member.user?._id || member.user || index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '15px 20px',
                marginTop: '12px',
                border: '1px solid #eee',
                borderRadius: '12px',
                background: '#fff'
              }}
            >
              <div>
                <strong>{member.name || 'Member'}</strong>
                <div style={{ color: '#777', fontSize: '13px', marginTop: '4px' }}>
                  {member.items?.length || 0} item(s) ordered
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>₹{member.shareAmount || 0}</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  {member.paymentStatus === 'PAID'
                    ? '✅ Paid'
                    : member.paymentStatus === 'FAILED'
                    ? '❌ Failed'
                    : '⏳ Pending'}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p style={{ color: '#888' }}>No members found yet.</p>
        )}
      </section>

      {/* TOTAL SUMMARY */}
      <section
        style={{
          marginTop: '30px',
          padding: '20px',
          background: '#f9f9f9',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Total: ₹{group?.total || 0}</h2>
          <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
            {group?.allMembersPaid ? '🎉 Everyone has paid!' : 'Waiting for members to settle their share...'}
          </p>
        </div>

        <button
          style={{
            padding: '10px 16px',
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
      </section>

      {message && (
        <div
          style={{
            marginTop: '20px',
            padding: '12px',
            borderRadius: '8px',
            background: '#e8f5e9',
            color: '#2e7d32',
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