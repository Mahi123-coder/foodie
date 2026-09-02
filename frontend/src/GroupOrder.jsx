import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'https://foodie-1-3b27.onrender.com/api';

function getUserIdFromToken(token) {
  try {
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const base64 = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const padded = base64.padEnd(
      base64.length + (4 - (base64.length % 4)) % 4,
      '='
    );

    const payload = JSON.parse(atob(padded));

    return payload.id || payload._id || payload.userId || null;
  } catch (error) {
    console.error('Could not decode token:', error);
    return null;
  }
}

function GroupOrder() {
  const navigate = useNavigate();

  const [mode, setMode] = useState('home');

  const [restaurant, setRestaurant] = useState('');
  const [address, setAddress] = useState('');

  const [groupCode, setGroupCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [name, setName] = useState('');

  const [group, setGroup] = useState(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const token = localStorage.getItem('token');
  const userId = getUserIdFromToken(token);

  // ---------------------------------------------------------
  // AUTH CHECK
  // ---------------------------------------------------------

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  // ---------------------------------------------------------
  // CREATE GROUP
  // ---------------------------------------------------------

  const createGroup = async () => {
    if (!restaurant.trim()) {
      setMessage('Please enter restaurant ID.');
      return;
    }

    if (!address.trim()) {
      setMessage('Please enter delivery address.');
      return;
    }

    if (!userId) {
      setMessage('Your login session is invalid. Please login again.');
      localStorage.removeItem('token');
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      setMessage('Creating your group...');

      const response = await fetch(
        `${API}/group-orders/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            userId,
            restaurant: restaurant.trim(),
            address: address.trim()
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Could not create group'
        );
      }

      const createdOrder = data.order || data.groupOrder || data;

      if (!createdOrder) {
        throw new Error('Group was created but no order was returned.');
      }

      setGroup(createdOrder);
      setGroupCode(createdOrder.groupCode);
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
    if (!joinCode.trim()) {
      setMessage('Please enter a group code.');
      return;
    }

    if (!name.trim()) {
      setMessage('Please enter your name.');
      return;
    }

    if (!token) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      setMessage('Joining group...');

      const code = joinCode.trim().toUpperCase();

      const response = await fetch(
        `${API}/group-orders/${code}/join`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: name.trim()
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Could not join group'
        );
      }

      const joinedOrder =
        data.order || data.groupOrder || data;

      setGroup(joinedOrder);
      setGroupCode(
        joinedOrder.groupCode || code
      );
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
  // LOAD GROUP
  // ---------------------------------------------------------

  const loadGroup = async (code = groupCode) => {
    if (!code) return;

    try {
      const response = await fetch(
        `${API}/group-orders/${code}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Could not load group'
        );
      }

      const loadedGroup =
        data.order || data.groupOrder || data;

      setGroup(loadedGroup);

    } catch (error) {
      console.error('Load group error:', error);
      setMessage(error.message);
    }
  };

  // ---------------------------------------------------------
  // HOME SCREEN
  // ---------------------------------------------------------

  if (mode === 'home') {
    return (
      <main>

        <h1>Group Order 👥</h1>

        <p>
          Order together with your friends and let everyone
          pay their own share.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '25px',
            marginTop: '30px'
          }}
        >

          {/* CREATE GROUP */}

          <div
            style={{
              padding: '25px',
              border: '1px solid #eee',
              borderRadius: '18px',
              background: '#fff'
            }}
          >

            <h2>Start a Group 🎉</h2>

            <p>
              Create an order and invite your friends.
            </p>

            <input
              placeholder="Restaurant ID"
              value={restaurant}
              onChange={(e) =>
                setRestaurant(e.target.value)
              }
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '12px',
                boxSizing: 'border-box'
              }}
            />

            <textarea
              placeholder="Delivery address"
              value={address}
              onChange={(e) =>
                setAddress(e.target.value)
              }
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '12px',
                boxSizing: 'border-box',
                minHeight: '100px'
              }}
            />

            <button
              className="primary"
              onClick={createGroup}
              disabled={loading}
            >
              {loading
                ? 'Creating...'
                : 'Create Group 🚀'}
            </button>

          </div>


          {/* JOIN GROUP */}

          <div
            style={{
              padding: '25px',
              border: '1px solid #eee',
              borderRadius: '18px',
              background: '#fff'
            }}
          >

            <h2>Join a Group 🤝</h2>

            <p>
              Enter the code shared by your friend.
            </p>

            <input
              placeholder="Group code"
              value={joinCode}
              onChange={(e) =>
                setJoinCode(
                  e.target.value.toUpperCase()
                )
              }
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '12px',
                boxSizing: 'border-box'
              }}
            />

            <input
              placeholder="Your name"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '12px',
                boxSizing: 'border-box'
              }}
            />

            <button
              className="primary"
              onClick={joinGroup}
              disabled={loading}
            >
              {loading
                ? 'Joining...'
                : 'Join Group 👥'}
            </button>

          </div>

        </div>

        {message && (
          <p style={{ marginTop: '20px' }}>
            {message}
          </p>
        )}

      </main>
    );
  }

  // ---------------------------------------------------------
  // GROUP DASHBOARD
  // ---------------------------------------------------------

  return (
    <main>

      <h1>Group Order 👥</h1>

      <div
        style={{
          padding: '20px',
          marginTop: '20px',
          borderRadius: '16px',
          background: '#fff7f2',
          border: '1px solid #eee'
        }}
      >

        <h2>Invite your friends</h2>

        <p>
          Share this group code:
        </p>

        <div
          style={{
            fontSize: '32px',
            fontWeight: '800',
            letterSpacing: '6px',
            margin: '15px 0'
          }}
        >
          {groupCode}
        </div>

        <button
          className="primary"
          onClick={() => {
            navigator.clipboard.writeText(groupCode);
            setMessage('Group code copied! 📋');
          }}
        >
          Copy Code 📋
        </button>

      </div>


      {/* MEMBERS */}

      <section style={{ marginTop: '30px' }}>

        <h2>Group Members</h2>

        {group?.groupMembers?.length ? (
          group.groupMembers.map((member, index) => (

            <div
              key={
                member.user?._id ||
                member.user ||
                index
              }
              style={{
                padding: '15px',
                marginTop: '10px',
                border: '1px solid #eee',
                borderRadius: '12px',
                background: '#fff'
              }}
            >

              <strong>
                {member.name || 'Member'}
              </strong>

              <p>
                Share: ₹{member.shareAmount || 0}
              </p>

              <p>
                Payment:{' '}
                {member.paymentStatus === 'PAID'
                  ? '✅ Paid'
                  : member.paymentStatus === 'FAILED'
                  ? '❌ Failed'
                  : '⏳ Pending'}
              </p>

            </div>

          ))
        ) : (
          <p>
            No members found yet.
          </p>
        )}

      </section>


      {/* TOTAL */}

      <section style={{ marginTop: '30px' }}>

        <h2>
          Total: ₹{group?.total || 0}
        </h2>

        <p>
          {group?.allMembersPaid
            ? '🎉 Everyone has paid!'
            : 'Waiting for everyone to pay...'}
        </p>

      </section>


      {/* REFRESH */}

      <button
        style={{
          marginTop: '20px',
          padding: '12px 18px',
          borderRadius: '10px',
          border: '1px solid #ddd',
          background: '#fff',
          cursor: 'pointer'
        }}
        onClick={() => loadGroup()}
      >
        Refresh Group 🔄
      </button>


      {message && (
        <p style={{ marginTop: '20px' }}>
          {message}
        </p>
      )}

    </main>
  );
}

export default GroupOrder;