import React, { useState, useRef } from 'react';
import './CompetePage.css';
import SignRecognition from '../components/SignRecognition';

export default function CompetePage({ onBack = null }) {
  const [difficulty, setDifficulty] = useState('easy');
  const [isRunning, setIsRunning] = useState(false);
  const [sequence] = useState(['D', 'U', 'K', 'E']);
  const [progress, setProgress] = useState([]); // letters achieved
  const startTimeRef = useRef(null);
  const [totalTime, setTotalTime] = useState(null);
  const [showSummary, setShowSummary] = useState(false);

  // sample leaderboard with real names and shorter times
  const leaderboard = [
    { rank: 1, name: 'Ava', time: '2.12s' },
    { rank: 2, name: 'Noah', time: '2.45s' },
    { rank: 3, name: 'Maya', time: '2.78s' },
    { rank: 4, name: 'Liam', time: '3.01s' },
    { rank: 5, name: 'Zoe', time: '3.29s' },
    { rank: 6, name: 'Kai', time: '3.54s' },
    { rank: 7, name: 'Ivy', time: '3.89s' },
    { rank: 8, name: 'Ethan', time: '4.12s' },
    { rank: 9, name: 'Luna', time: '4.45s' },
    { rank: 10, name: 'Owen', time: '4.98s' },
  ];

  return (
    <div className="compete-page">
      <header className="compete-header">
        <h2>Compete</h2>
        {onBack && (
          <button className="btn-ghost" onClick={onBack}>Back</button>
        )}
      </header>

      <main className="compete-main">
        <aside className="compete-leaderboard">
          <h3>Leaderboard</h3>
          <ol>
            {leaderboard.map((entry) => (
              <li key={entry.rank} className="leader-entry">
                <span className="leader-rank">{entry.rank}</span>
                <span className="leader-name">{entry.name}</span>
                <span className="leader-time">{entry.time}</span>
              </li>
            ))}
          </ol>
        </aside>

        <section className="compete-center">
          <div className="difficulty-box">
            <h3>Select Difficulty</h3>
            <div className="difficulty-options">
              {['easy', 'medium', 'hard', 'expert'].map((d) => (
                <label key={d} className={`diff-option ${difficulty === d ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="difficulty"
                    value={d}
                    checked={difficulty === d}
                    onChange={() => setDifficulty(d)}
                  />
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </label>
              ))}
            </div>
          </div>

          <div className="begin-box">
            <button
              className="btn-begin"
              onClick={() => {
                setProgress([]);
                setTotalTime(null);
                startTimeRef.current = Date.now();
                setIsRunning(true);
              }}
            >
              Begin
            </button>
          </div>
        </section>

        <aside className="compete-spacer" />
      </main>

      {isRunning && (
        <div className="compete-modal" role="dialog" aria-modal="true">
          <div className="compete-modal-inner">
            <div className="compete-modal-header">
              <h3 className="compete-sequence-title">Spell: {sequence.join('')}</h3>
              <div className="sequence-progress">
                {sequence.map((s) => (
                  <span key={s} className={`seq-letter ${progress.includes(s) ? 'done' : ''}`}>
                    {s}
                  </span>
                ))}
              </div>
              <button className="btn-ghost" onClick={() => { setIsRunning(false); setShowSummary(false); }}>Close</button>
            </div>
            <div className="compete-modal-body">
              {/* Use the same SignRecognition usage as the learning flow: no autoStart or external control hooks.
                  This ensures the Start Camera button inside SignRecognition is used and avoids timing glitches. */}
              <SignRecognition
                targetSign={progress.length < sequence.length ? sequence[progress.length] : null}
                onCorrect={() => {
                  // mark current letter achieved and move to next
                  const nextLetter = sequence[progress.length];
                  if (!nextLetter) return;
                  setProgress((p) => {
                    const updated = [...p, nextLetter];
                    // if completed sequence, record total time and show summary
                    if (updated.length === sequence.length) {
                      const total = (Date.now() - startTimeRef.current) / 1000;
                      setTotalTime(total.toFixed(2));
                      setTimeout(() => {
                        setIsRunning(false);
                        setShowSummary(true);
                      }, 600);
                    }
                    return updated;
                  });
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showSummary && (
        <div className="compete-summary" role="dialog" aria-modal="true">
          <div className="compete-summary-inner">
              <h3>Summary</h3>
              <p>Sequence: {sequence.join('')}</p>
              <p>Time: <span className="compete-time">{totalTime}s</span></p>
              <button className="btn-begin" onClick={() => setShowSummary(false)}>Close</button>
            </div>
        </div>
      )}
    </div>
  );
}
