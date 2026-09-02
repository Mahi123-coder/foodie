import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'https://foodie-1-3b27.onrender.com/api';

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

    try {
      setLoading(true);
      setMessage('Creating your group...');

      const response = await fetch(`${API}/group-orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          restaurant,
          address
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Could not create group'
        );
      }

      setGroup(data.order);
      setGroupCode(data.order.groupCode);
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

    try {
      setLoading(true);
      setMessage('Joining group...');

      const response = await fetch(
        `${API}/group-orders/${joinCode.trim()}/join`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Could not join group'
        );
      }

      setGroup(data.order);
      setGroupCode(joinCode.trim().toUpperCase());
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

      setGroup(data);

    } catch (error) {
      console.error('Load group error:', error);
      setMessage(error.message);
    }
  };

  // ---------------------------------------------------------
  // CREATE GROUP SCREEN
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

          {/* CREATE */}

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
                marginBottom: '12px'
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
                marginBottom: '12px'
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


          {/* JOIN */}

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
                marginBottom: '12px'
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
                marginBottom: '12px'
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

        {group?.groupMembers?.map((member) => (
          <div
            key={member.user?._id || member.user}
            style={{
              padding: '15px',
              marginTop: '10px',
              border: '1px solid #eee',
              borderRadius: '12px',
              background: '#fff'
            }}
          >
            <strong>
              {member.name}
            </strong>

            <p>
              Share: ₹{member.shareAmount || 0}
            </p>

            <p>
              Payment:{' '}
              {member.paymentStatus === 'PAID'
                ? '✅ Paid'
                : '⏳ Pending'}
            </p>
          </div>
        ))}

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