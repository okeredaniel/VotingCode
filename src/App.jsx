import { useEffect, useState, useCallback } from 'react';
import {
  PlusIcon,
  XIcon,
  CopyIcon,
  CheckIcon,
  Share2Icon,
  BarChart3Icon,
} from 'lucide-react';
import { socket, API_BASE } from './lib/socket';
import { getDeviceId } from './lib/device';
import './App.css';

function useToasts() {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message) => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  return { toasts, push };
}

function CreatePollModal({ onClose, onCreated, pushToast }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function updateOption(index, value) {
    setOptions((opts) => opts.map((o, i) => (i === index ? value : o)));
  }

  function addOption() {
    if (options.length >= 6) return;
    setOptions((opts) => [...opts, '']);
  }

  function removeOption(index) {
    if (options.length <= 2) return;
    setOptions((opts) => opts.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);

    if (!question.trim()) {
      setError('Give the poll a question.');
      return;
    }
    if (cleanOptions.length < 2) {
      setError('Add at least two options.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), options: cleanOptions }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not create the poll.');
      }

      const poll = await res.json();
      onCreated(poll);
      pushToast('Poll created');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>New poll</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Close">
            <XIcon size={18} strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="field">
            <span className="field-label">Question</span>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What should we ship next?"
              autoFocus
            />
          </label>

          <div className="field">
            <span className="field-label">Options</span>
            <div className="option-list">
              {options.map((opt, i) => (
                <div className="option-row" key={i}>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      className="icon-btn ghost small"
                      onClick={() => removeOption(i)}
                      aria-label="Remove option"
                    >
                      <XIcon size={14} strokeWidth={2} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 6 && (
              <button type="button" className="add-option" onClick={addOption}>
                <PlusIcon size={14} strokeWidth={2} />
                Add option
              </button>
            )}
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary full" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create poll'}
          </button>
        </form>
      </div>
    </div>
  );
}

function SharePanel({ pollId, onClose }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(pollId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="share-panel">
      <div className="share-head">
        <span>
          <Share2Icon size={14} strokeWidth={1.75} />
          Share this poll
        </span>
        <button className="icon-btn ghost small" onClick={onClose} aria-label="Close">
          <XIcon size={14} strokeWidth={2} />
        </button>
      </div>
      <div className="share-id">
        <code>{pollId}</code>
        <button className="icon-btn small" onClick={handleCopy} aria-label="Copy poll ID">
          {copied ? <CheckIcon size={14} strokeWidth={2} /> : <CopyIcon size={14} strokeWidth={2} />}
        </button>
      </div>
      <p className="share-hint">Anyone with this ID can load and vote on this poll.</p>
    </div>
  );
}

function PollCard({ poll, onVote, votedOption, onShareClick }) {
  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);

  function pct(votes) {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  }

  return (
    <div className="poll-card">
      <div className="poll-left">
        <span className="poll-eyebrow">
          <span className="live-dot" />
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} &middot; live
        </span>
        <h2>{poll.question}</h2>
        <p>
          {votedOption
            ? 'Your vote is in — results update live as others vote too.'
            : 'Cast your vote and watch the results update instantly.'}
        </p>
        <button className="btn-secondary share-btn" onClick={onShareClick}>
          <Share2Icon size={14} strokeWidth={2} />
          Share poll
        </button>
      </div>

      <div className="poll-right">
        {poll.options.map((o) => {
          const isVoted = votedOption === o._id;
          const percent = pct(o.votes);

          return (
            <div className="vote-group" key={o._id}>
              <button
                className={`vote-btn ${isVoted ? 'is-voted' : ''}`}
                onClick={() => onVote(o._id)}
                disabled={!!votedOption}
              >
                <span className="vote-btn-label">
                  {isVoted && <CheckIcon size={14} strokeWidth={2.5} />}
                  {o.label}
                </span>
                <span className="vote-pct">{percent}%</span>
              </button>
              <div className="bar-track">
                <div
                  className={`bar-fill ${isVoted ? 'is-voted' : ''}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}

        {votedOption && <p className="voted-note">Your vote is in — results update live.</p>}
      </div>
    </div>
  );
}

function App() {
  const [poll, setPoll] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [loadId, setLoadId] = useState('');
  const { toasts, push: pushToast } = useToasts();

  const votedOption = poll?.votedOption ?? null;

  // Connect socket once on mount
  useEffect(() => {
    socket.connect();
    return () => socket.disconnect();
  }, []);

  // Join the poll's room and listen for live results whenever the active poll changes
  useEffect(() => {
    if (!poll?._id) return;

    socket.emit('join-poll', poll._id);

    function handleResults(updated) {
      if (updated._id !== poll._id) return;
      // Broadcasts don't include votedOption (it's per-device), so preserve
      // whatever this client already knows about its own vote.
      setPoll((current) => ({ ...updated, votedOption: current?.votedOption ?? null }));
    }

    socket.on('results', handleResults);
    return () => socket.off('results', handleResults);
  }, [poll?._id]);

  function handleCreated(newPoll) {
    setPoll({ ...newPoll, votedOption: null });
    setShowCreate(false);
    setShowShare(true);
  }

  async function handleVote(optionId) {
    if (votedOption) return;

    // Optimistic update so the UI responds instantly
    setPoll((current) => ({ ...current, votedOption: optionId }));

    try {
      const res = await fetch(`${API_BASE}/polls/${poll._id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId, deviceId: getDeviceId() }),
      });

      const body = await res.json();

      if (res.status === 409) {
        // Already voted from this device or IP — server tells us which option that was
        setPoll({ ...body.poll, votedOption: body.poll.votedOption });
        pushToast('This device has already voted on this poll');
        return;
      }

      if (!res.ok) throw new Error('Vote failed');

      setPoll(body);
      pushToast('Vote cast');
    } catch {
      setPoll((current) => ({ ...current, votedOption: null }));
      pushToast('Could not cast your vote');
    }
  }

  async function handleLoadPoll(e) {
    e.preventDefault();
    if (!loadId.trim()) return;

    try {
      const res = await fetch(
        `${API_BASE}/polls/${loadId.trim()}?deviceId=${getDeviceId()}`
      );
      if (!res.ok) throw new Error('Poll not found');
      const found = await res.json();
      setPoll(found);
      setLoadId('');
      pushToast('Poll loaded');
    } catch {
      pushToast('No poll found with that ID');
    }
  }

  return (
    <div className="dashboard">
      <div className="grid-overlay" aria-hidden="true" />

      <header className="topbar">
        <span className="brand">
          <span className="brand-mark" />
          Pollroom
        </span>

        <div className="topbar-actions">
          <form className="load-form" onSubmit={handleLoadPoll}>
            <input
              type="text"
              placeholder="Load poll by ID"
              value={loadId}
              onChange={(e) => setLoadId(e.target.value)}
            />
          </form>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <PlusIcon size={16} strokeWidth={2} />
            New poll
          </button>
        </div>
      </header>

      <main className="surface">
        {!poll && (
          <div className="empty-state">
            <div className="empty-icon">
              <BarChart3Icon size={22} strokeWidth={2} />
            </div>
            <h1>No poll loaded</h1>
            <p>Create a new poll, or load one with its ID to start voting.</p>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <PlusIcon size={16} strokeWidth={2} />
              Create a poll
            </button>
          </div>
        )}

        {poll && (
          <div className="poll-layer">
            <PollCard
              poll={poll}
              onVote={handleVote}
              votedOption={votedOption}
              onShareClick={() => setShowShare((v) => !v)}
            />
            {showShare && (
              <SharePanel pollId={poll._id} onClose={() => setShowShare(false)} />
            )}
          </div>
        )}
      </main>

      {showCreate && (
        <CreatePollModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          pushToast={pushToast}
        />
      )}

      <div className="toast-layer">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;