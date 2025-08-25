import React, { useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { sessionAPI } from '../utils/api';
import VoteFrequencyDisplay from './VoteFrequencyDisplay';

const POINTS = [1, 2, 3, 5, 8, 13, 21, '?'];

export default function VotingBoard() {
  const {
    session,
    user,
    activeStory,
    votes,
    isRevealed,
    voteCount,
    totalMembers,
    voteFrequency,
    stories
  } = useSession();

  const [sel, setSel] = useState(null);
  const prevStoryId = React.useRef(activeStory?.id);

  // Clear selection when story changes
  React.useEffect(() => {
    if (activeStory?.id !== prevStoryId.current) {
      setSel(null);
      prevStoryId.current = activeStory?.id;
    }
  }, [activeStory?.id]);

  const { dispatch } = useSession();

  const vote = async p => {
    if (!activeStory || isRevealed) return; // ✅ Prevent voting after reveal
    setSel(p);
    const alreadyVoted = votes[user.id] !== undefined;
    const newVotes = { ...votes, [user.id]: p };
    const newVoteCount = alreadyVoted ? voteCount : voteCount + 1;
    dispatch({ type: 'SET', payload: { votes: newVotes, voteCount: newVoteCount } });
    try {
      await sessionAPI.vote(session.id, user.id, activeStory.id, p);
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  const avg = (() => {
    const nums = Object.values(votes).filter(v => typeof v === 'number');
    return nums.length
      ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)
      : 0;
  })();

  if (!activeStory) {
    return (
      <div className="voting-board">
        <h2>No Active Story</h2>
      </div>
    );
  }

  // Find card number (index+1) for active story in stories array
  let cardNumber = null;
  if (activeStory && stories && stories.length > 0) {
    const idx = stories.findIndex(s => s.id === activeStory.id);
    if (idx !== -1) cardNumber = idx + 1;
  }

  return (
    <div className="voting-board">
      <div
        style={{
          fontWeight: 600,
          fontSize: '1.1rem',
          color: '#1976d2',
          marginBottom: 6
        }}
      >
        Card Name: {activeStory.title}
      </div>
      {activeStory.description && <p>{activeStory.description}</p>}

      {/* ✅ Updated conditional block */}
      {!isRevealed ? (
        <div className="cards">
          {POINTS.map(p => (
            <button
              key={p}
              className={sel === p ? 'selected' : ''}
              onClick={() => vote(p)}
              disabled={votes[user.id] !== undefined} // disable if already voted
              style={{
                opacity: votes[user.id] !== undefined ? 0.5 : 1,
                cursor: votes[user.id] !== undefined ? 'not-allowed' : 'pointer'
              }}
            >
              {p}
            </button>
          ))}
        </div>
      ) : (

          <div className="voting-results">
            <VoteFrequencyDisplay />
            <div className="voting-results-table">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Vote</th>
                  </tr>
                </thead>
                <tbody>
                  {session.members.map((m, idx) => (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>{votes[m.id] !== undefined ? votes[m.id] : 'No vote'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

      )}
    </div>
  );
}
