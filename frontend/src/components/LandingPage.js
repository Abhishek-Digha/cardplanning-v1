import React, { useState } from 'react';
import { sessionAPI } from '../utils/api';
import { getSystemId } from '../utils/systemId'; // ✅ import systemId helper

export default function LandingPage({ onSessionJoined }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState('create');
  const [err, setErr] = useState('');

  const handle = async (e) => {
    e.preventDefault();
    if (!name) return setErr('Enter name');

    try {
      const systemId = getSystemId(); // ✅ generate unique system identity

      const data =
        mode === 'create'
          ? await sessionAPI.createSession(name, systemId) // pass systemId
          : await sessionAPI.joinSession(code, name, systemId); // pass systemId

      onSessionJoined(data);
    } catch (error) {
      console.error("LandingPage handle failed:", error);
      setErr(mode === 'create' ? 'Create failed' : 'Join failed');
    }
  };

  return (
    <div className="landing-page">
      <div className="container">
        <h1>Story Pointing</h1>
        {err && <div className="error-message">{err}</div>}
        <form onSubmit={handle}>
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {mode === 'join' && (
            <input
              placeholder="Session code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          )}
          <button type="submit">
            {mode === 'create' ? 'Create Session' : 'Join Session'}
          </button>
        </form>
        <div className="toggle">
          {mode === 'create' ? (
            <p>
              Already have code?{' '}
              <span
                onClick={() => {
                  setMode('join');
                  setErr('');
                }}
              >
                Join
              </span>
            </p>
          ) : (
            <p>
              Want to create?{' '}
              <span
                onClick={() => {
                  setMode('create');
                  setErr('');
                }}
              >
                Create
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
