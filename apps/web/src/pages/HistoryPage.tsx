import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChatIcon,
  ClockIcon,
  DownloadIcon,
  RefreshIcon,
  UsersIcon,
} from '../components/Icons';
import { useAuth } from '../hooks/useAuth';
import {
  getHistoryDetail,
  listHistory,
  type MeetingHistoryDetail,
  type MeetingHistoryItem,
} from '../services/api';

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

export function HistoryPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<MeetingHistoryItem[]>([]);
  const [selected, setSelected] = useState<MeetingHistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listHistory(session.access_token);
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load meeting history.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleInspect = async (code: string) => {
    if (!session?.access_token) return;
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await getHistoryDetail(session.access_token, code);
      setSelected(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load meeting details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownloadTranscript = () => {
    if (!selected) return;
    const lines = [
      `Meet Transcript — ${selected.title} (${selected.code})`,
      `Date: ${new Date(selected.created_at).toLocaleString()}`,
      `Duration: ${formatDuration(selected.duration_seconds)}`,
      '',
      '--- Participants ---',
      ...selected.participants.map(
        (p) => `- ${p.full_name || p.email} (${p.role}) · joined ${new Date(p.joined_at).toLocaleTimeString()}`,
      ),
      '',
      '--- Chat Messages ---',
      ...(selected.messages.length === 0
        ? ['(No messages sent during this meeting)']
        : selected.messages.map(
            (m) =>
              `[${new Date(m.created_at).toLocaleTimeString()}] ${m.sender_name || m.sender_email}: ${m.content}`,
          )),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meet-transcript-${selected.code}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="profile-grid">
      <section className="card">
        <div className="card-header">
          <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClockIcon size={18} />
            <span>Meeting History</span>
          </h1>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void loadHistory()}
            disabled={loading}
          >
            <RefreshIcon size={14} />
            <span>{loading ? 'Loading...' : 'Refresh'}</span>
          </button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {items.length === 0 ? (
          <div className="empty-state">
            {loading
              ? 'Loading your past meetings...'
              : 'No meeting history yet. Meetings you host or join will appear here.'}
          </div>
        ) : (
          <div className="meeting-list">
            {items.map((item) => (
              <div
                key={item.id}
                className={`meeting-row ${selected?.code === item.code ? 'meeting-row-selected' : ''}`}
              >
                <div className="meeting-row-main">
                  <div className="meeting-row-title">
                    <span>{item.title}</span>
                    <span
                      className={`badge ${
                        item.status === 'active' ? 'badge-success' : 'badge-neutral'
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="badge badge-neutral">{item.my_role}</span>
                  </div>
                  <div className="meeting-row-meta">
                    <code>{item.code}</code>
                    <span>·</span>
                    <span>{formatDuration(item.duration_seconds)}</span>
                    <span>·</span>
                    <span className="inline-meta">
                      <UsersIcon size={13} />
                      {item.participant_count}
                    </span>
                    <span>·</span>
                    <span className="inline-meta">
                      <ChatIcon size={13} />
                      {item.message_count}
                    </span>
                    <span>·</span>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="meeting-row-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void handleInspect(item.code)}
                  >
                    Summary
                  </button>
                  {item.status === 'active' && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/meet/${item.code}`)}
                    >
                      Rejoin
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Meeting Summary</h2>
          {selected && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadTranscript}
            >
              <DownloadIcon size={14} />
              <span>Export .txt</span>
            </button>
          )}
        </div>

        {detailLoading ? (
          <p className="status-item-desc">Loading meeting summary & chat log...</p>
        ) : !selected ? (
          <div className="empty-state">
            Select <strong>Summary</strong> on any past meeting to inspect participants, duration,
            and saved chat transcript.
          </div>
        ) : (
          <div className="form">
            <div>
              <div className="profile-name">{selected.title}</div>
              <div className="status-item-desc">
                Code: <code>{selected.code}</code> · Duration:{' '}
                <strong>{formatDuration(selected.duration_seconds)}</strong> ·{' '}
                {new Date(selected.created_at).toLocaleString()}
              </div>
            </div>

            <div className="sidebar-section">
              <h3 className="sidebar-title">Participants ({selected.participants.length})</h3>
              <div className="roster-list">
                {selected.participants.map((p) => (
                  <div key={p.id} className="roster-row">
                    <div className="roster-info">
                      <div className="roster-name">{p.full_name || p.email}</div>
                      <div className="roster-sub">
                        Joined {new Date(p.joined_at).toLocaleTimeString()}
                        {p.left_at ? ` · Left ${new Date(p.left_at).toLocaleTimeString()}` : ''}
                      </div>
                    </div>
                    <span className="badge badge-neutral">{p.role}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="sidebar-section">
              <h3 className="sidebar-title">Saved Chat ({selected.messages.length})</h3>
              {selected.messages.length === 0 ? (
                <div className="status-item-desc">No chat messages were sent in this meeting.</div>
              ) : (
                <div className="chat-messages" style={{ maxHeight: 280 }}>
                  {selected.messages.map((m) => (
                    <div key={m.id} className="chat-bubble">
                      <div className="chat-bubble-meta">
                        <span>{m.sender_name || m.sender_email}</span>
                        <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                      </div>
                      <div className="chat-bubble-text">{m.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
