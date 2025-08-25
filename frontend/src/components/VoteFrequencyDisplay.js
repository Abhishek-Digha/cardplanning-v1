import React from 'react';
import { useSession } from '../contexts/SessionContext';
import '../styles/VoteFrequencyDisplay.css'; // make sure to import your CSS file

const VoteFrequencyDisplay = () => {
  const { voteFrequency, isRevealed, votes, totalMembers } = useSession();

  if (!isRevealed) return null;

  // Calculate frequency from votes if voteFrequency is empty
  const frequencies =
    voteFrequency && Object.keys(voteFrequency).length > 0
      ? Object.entries(voteFrequency)
      : Object.entries(
          Object.values(votes).reduce((acc, vote) => {
            acc[vote] = (acc[vote] || 0) + 1;
            return acc;
          }, {})
        );

  let majorityVote = null;
  let maxCount = 0;
  let totalVotes = 0;

  frequencies.forEach(([vote, count]) => {
    if (count > maxCount) {
      maxCount = count;
      majorityVote = vote;
    }
    totalVotes += count;
  });

  const sortedFrequencies = frequencies.sort(([a], [b]) => Number(a) - Number(b));

  if (frequencies.length === 0) return null;

  return (
    <div className="vote-frequency">
      {/* Summary */}
      <div className="vote-summary">
        <h3>Vote Summary</h3>
        <div className="summary-stats">
          {majorityVote && (
            <div className="most-common">
              Most Common: {majorityVote} ({maxCount} votes)
            </div>
          )}
          <div className="participation">
            Participation: {totalVotes}/{totalMembers} (
            {Math.round((totalVotes / totalMembers) * 100)}%)
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Max Votes</div>
          <div className="stat-value">{maxCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Different Values</div>
          <div className="stat-value">{frequencies.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Votes</div>
          <div className="stat-value">{totalVotes}</div>
        </div>
      </div>

      {/* Frequency Cards */}
      <div className="frequency-cards">
        {sortedFrequencies.map(([point, count]) => (
          <div
            key={point}
            className={`frequency-card ${
              point === majorityVote ? 'majority' : ''
            }`}
          >
            <div className="card-content">
              <span className="point">{point}</span>
              <span className="count">
                {count} vote{count !== 1 ? 's' : ''}
                <span className="percentage">
                  ({Math.round((count / totalMembers) * 100)}%)
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VoteFrequencyDisplay;
