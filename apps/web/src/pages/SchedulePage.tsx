import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  RefreshIcon,
  VideoIcon,
} from '../components/Icons';
import { useAuth } from '../hooks/useAuth';
import {
  buildMeetingInviteUrl,
  createSchedule,
  deleteSchedule,
  listSchedules,
  startSchedule,
  type ScheduledMeeting,
} from '../services/api';

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SchedulePage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const defaultStart = new Date(Date.now() + 30 * 60 * 1000);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startLocal, setStartLocal] = useState(() => toLocalDateTimeInput(defaultStart));
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [inviteEmailsText, setInviteEmailsText] = useState('');

  const [schedules, setSchedules] = useState<ScheduledMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const loadSchedules = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const list = await listSchedules(session.access_token);
      setSchedules(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load scheduled meetings.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setError(null);
    setNotice(null);

    const startDate = new Date(startLocal);
    if (Number.isNaN(startDate.getTime())) {
      setError('Please pick a valid date and time.');
      return;
    }

    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
    const inviteEmails = inviteEmailsText
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      const res = await createSchedule(session.access_token, {
        title: title.trim() || 'Scheduled Meeting',
        description: description.trim() || undefined,
        scheduled_start: startDate.toISOString(),
        scheduled_end: endDate.toISOString(),
        timezone,
        waiting_room_enabled: waitingRoom,
        invite_emails: inviteEmails,
      });

      setSchedules((prev) =>
        [...prev, res.schedule].sort(
          (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
        ),
      );
      setTitle('');
      setDescription('');
      setInviteEmailsText('');
      setNotice(
        `Scheduled "${res.schedule.title}" (${res.schedule.meeting_code})${
          res.invitedCount > 0 ? ` · Sent ${res.invitedCount} invite(s)` : ''
        }.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule meeting.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async (item: ScheduledMeeting) => {
    if (!session?.access_token) return;
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await startSchedule(session.access_token, item.id);
      if (updated.meeting_code) {
        navigate(`/meet/${updated.meeting_code}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start scheduled meeting.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!session?.access_token) return;
    setBusyId(id);
    setError(null);
    try {
      await deleteSchedule(session.access_token, id);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel scheduled meeting.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCopyLink = async (item: ScheduledMeeting) => {
    if (!item.meeting_code) return;
    await navigator.clipboard.writeText(buildMeetingInviteUrl(item.meeting_code)).catch(() => {});
    setCopiedId(item.id);
    setTimeout(() => setCopiedId((p) => (p === item.id ? null : p)), 2000);
  };

  return (
    <div className="profile-grid">
      <section className="card">
        <div className="card-header">
          <h1 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarIcon size={18} />
            <span>Schedule a Meeting</span>
          </h1>
          <span className="badge badge-neutral">{timezone}</span>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {notice && <div className="alert alert-success">{notice}</div>}

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Meeting title</span>
            <input
              type="text"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Weekly Product Sync"
              maxLength={120}
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Agenda / description (optional)</span>
            <input
              type="text"
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Review sprint milestones & launch checklist"
            />
          </label>

          <div className="two-col-fields">
            <label className="field">
              <span className="field-label">Start date & time</span>
              <input
                type="datetime-local"
                className="input"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Duration</span>
              <select
                className="input"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </label>
          </div>

          <label className="field">
            <span className="field-label">Invite emails (comma-separated, optional)</span>
            <input
              type="text"
              className="input"
              value={inviteEmailsText}
              onChange={(e) => setInviteEmailsText(e.target.value)}
              placeholder="alex@example.com, priya@example.com"
            />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={waitingRoom}
              onChange={(e) => setWaitingRoom(e.target.checked)}
            />
            <span>Enable Waiting Room for guests</span>
          </label>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <CalendarIcon size={16} />
            <span>{submitting ? 'Scheduling...' : 'Schedule Meeting'}</span>
          </button>
        </form>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Upcoming Meetings</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void loadSchedules()}
            disabled={loading}
          >
            <RefreshIcon size={14} />
            <span>{loading ? 'Loading...' : 'Refresh'}</span>
          </button>
        </div>

        {schedules.length === 0 ? (
          <div className="empty-state">
            {loading
              ? 'Loading scheduled meetings...'
              : 'No scheduled meetings yet. Use the form on the left to plan your next call.'}
          </div>
        ) : (
          <div className="meeting-list">
            {schedules.map((item) => (
              <div key={item.id} className="meeting-row roster-row-col">
                <div className="roster-top-line">
                  <div className="meeting-row-title">
                    <span>{item.title}</span>
                    {item.is_host ? (
                      <span className="badge badge-success">Host</span>
                    ) : (
                      <span className="badge badge-warning">Invited</span>
                    )}
                    {item.meeting_status === 'active' && (
                      <span className="badge badge-success">Live</span>
                    )}
                  </div>
                </div>

                {item.description && <div className="status-item-desc">{item.description}</div>}

                <div className="meeting-row-meta">
                  <span className="inline-meta">
                    <ClockIcon size={13} />
                    {new Date(item.scheduled_start).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    –{' '}
                    {new Date(item.scheduled_end).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {item.meeting_code && (
                    <>
                      <span>·</span>
                      <code>{item.meeting_code}</code>
                    </>
                  )}
                </div>

                <div className="meeting-row-actions">
                  {item.meeting_code && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void handleCopyLink(item)}
                    >
                      {copiedId === item.id ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                      <span>{copiedId === item.id ? 'Copied' : 'Link'}</span>
                    </button>
                  )}

                  {item.is_host ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busyId === item.id}
                        onClick={() => void handleStart(item)}
                      >
                        <VideoIcon size={14} />
                        <span>{item.meeting_status === 'active' ? 'Rejoin' : 'Start Now'}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger-soft btn-sm"
                        disabled={busyId === item.id}
                        onClick={() => void handleCancel(item.id)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : item.meeting_code ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/meet/${item.meeting_code}`)}
                    >
                      Open Lobby
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
