import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  CrossIcon,
  CrownIcon,
  KeyboardIcon,
  LockIcon,
  MailIcon,
  RefreshIcon,
  ShieldIcon,
  SparklesIcon,
  UsersIcon,
  VideoIcon,
} from '../components/Icons';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import {
  buildMeetingInviteUrl,
  createMeeting,
  extractMeetingCode,
  listMeetings,
  listMyInvitations,
  listSchedules,
  respondToInvitation,
  startSchedule,
  type MeetingInvitation,
  type MeetingSummary,
  type ScheduledMeeting,
} from '../services/api';

interface SpotlightSlide {
  id: string;
  badge: string;
  isProFeature?: boolean;
  theme: 'ocean' | 'emerald' | 'royal' | 'cosmic' | 'slate';
  title: string;
  copy: string;
  chips: string[];
  ctaLabel?: string;
  ctaAction?: 'upgrade' | 'mcq' | 'history';
}

const SPOTLIGHT_SLIDES: SpotlightSlide[] = [
  {
    id: 'instant-rooms',
    badge: 'Instant HD Rooms',
    theme: 'ocean',
    title: 'Launch encrypted meetings in seconds',
    copy: 'Generate a room link with one click, preview your camera in the lobby, share your screen full-stage with Host PiP, and scale smoothly up to 100 participants.',
    chips: ['Full-Stage Screen Share', 'Waiting Room', '100-User Ready'],
  },
  {
    id: 'free-ai-notes',
    badge: 'AI Visual Notes · Free',
    theme: 'emerald',
    title: 'Automatic study slides after every call',
    copy: 'Included free on every Basic meeting — MyMeet AI listens to key concepts, filters out small talk, and creates black-canvas visual notes ready for PDF & PNG download.',
    chips: ['Included Free', 'PDF & PNG Export', '2 Free Regenerates'],
    ctaLabel: 'Open Notes History',
    ctaAction: 'history',
  },
  {
    id: 'pro-master-notes',
    badge: 'MYMEET PRO · From ₹9',
    isProFeature: true,
    theme: 'royal',
    title: 'Pro Master Notes with code, derivations & exam traps',
    copy: 'Upgrade any class to rich Master Notes with deep step-by-step explanations, comparison tables, interview traps & a 1-min cheat sheet. Start at ₹9 (1 class only) or ₹49 (15 classes).',
    chips: ['Code & Derivations', 'Exam Traps', '1-Min Cheat Sheet'],
    ctaLabel: 'Compare Pro Plans',
    ctaAction: 'upgrade',
  },
  {
    id: 'pro-mcq-tests',
    badge: 'PRO UNLIMITED · ₹349/mo+',
    isProFeature: true,
    theme: 'cosmic',
    title: '20-Question Session Mastery MCQ Tests',
    copy: 'Turn every lecture into an interactive 20-question exam quiz (Easy → Hard) with sequential lock, instant explanations & weak-topic review. Included in Pro Monthly & Yearly.',
    chips: ['20 Exam MCQs', 'Instant Explanations', 'Unlimited Notes'],
    ctaLabel: 'Unlock MCQs & Unlimited',
    ctaAction: 'mcq',
  },
  {
    id: 'cross-platform',
    badge: 'Web & Android Synced',
    theme: 'slate',
    title: 'Built for privacy, synced everywhere you work',
    copy: 'Host from your laptop or join from Android with one synced account — complete with Co-Host controls, one-click meeting lock, live chat, and cloud AI study notes.',
    chips: ['Co-Host Controls', 'Meeting Lock', 'Web + Android'],
  },
];

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomePage() {
  const { session, user, profile } = useAuth();
  const { subscription, isPro, isUnlimited, openUpgradeModal } = useSubscription();
  const navigate = useNavigate();

  const [meetingCode, setMeetingCode] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [schedules, setSchedules] = useState<ScheduledMeeting[]>([]);
  const [invitations, setInvitations] = useState<MeetingInvitation[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(true);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);

  const firstName = (
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'there'
  ).split(' ')[0];

  const todayFormatted = new Date().toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Gentle auto-advance on spotlight feature showcase
  useEffect(() => {
    if (carouselPaused) return;
    const timer = setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % SPOTLIGHT_SLIDES.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [carouselPaused]);

  const loadDashboardData = useCallback(async () => {
    if (!session?.access_token) return;
    setMeetingsLoading(true);
    try {
      const [list, invites, upcoming] = await Promise.all([
        listMeetings(session.access_token),
        listMyInvitations(session.access_token).catch(() => []),
        listSchedules(session.access_token).catch(() => []),
      ]);
      setMeetings(list);
      setInvitations(invites);
      setSchedules(upcoming);
    } catch (err) {
      console.warn('[meetings] Failed to load dashboard data:', err);
    } finally {
      setMeetingsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const handleCreateMeeting = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!session?.access_token) return;

    setActionError(null);
    setCreating(true);
    try {
      const created = await createMeeting(session.access_token, {
        title: newTitle.trim() || `${firstName}'s Meeting`,
        waiting_room_enabled: waitingRoom,
      });
      setShowCreateForm(false);
      setNewTitle('');
      navigate(`/meet/${created.code}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to create meeting.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCode = (e: FormEvent) => {
    e.preventDefault();
    setActionError(null);
    const normalized = extractMeetingCode(meetingCode);
    if (!normalized || normalized.length < 4) {
      setActionError('Enter a valid meeting code (e.g. k9m4-x7p2-q3r8) or full meeting link.');
      return;
    }
    navigate(`/meet/${normalized}`);
  };

  const handleRespondInvite = async (
    invitation: MeetingInvitation,
    action: 'accepted' | 'declined',
  ) => {
    if (!session?.access_token) return;
    setInviteBusyId(invitation.id);
    setActionError(null);
    try {
      const updated = await respondToInvitation(session.access_token, invitation.id, action);
      setInvitations((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      if (action === 'accepted') {
        navigate(`/meet/${invitation.meeting_code}`);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to respond to invitation.');
    } finally {
      setInviteBusyId(null);
    }
  };

  const handleStartScheduled = async (sched: ScheduledMeeting) => {
    if (!session?.access_token) return;
    try {
      const started = await startSchedule(session.access_token, sched.id);
      if (started.meeting_code) navigate(`/meet/${started.meeting_code}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to start scheduled meeting.');
    }
  };

  const handleCopyInvite = async (code: string) => {
    try {
      await navigator.clipboard.writeText(buildMeetingInviteUrl(code));
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((prev) => (prev === code ? null : prev)), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleSlideCta = (slide: SpotlightSlide) => {
    if (slide.ctaAction === 'upgrade') {
      openUpgradeModal({ highlightMcq: false });
    } else if (slide.ctaAction === 'mcq') {
      openUpgradeModal({ highlightMcq: true });
    } else if (slide.ctaAction === 'history') {
      navigate('/history');
    }
  };

  const pendingInvites = invitations.filter(
    (inv) => inv.status === 'pending' && inv.meeting_status !== 'ended',
  );
  const nextSchedule = schedules.find((s) => s.meeting_status !== 'ended') ?? null;
  const activeSlide = SPOTLIGHT_SLIDES[slideIdx];
  const expiryLabel = subscription?.expires_at
    ? new Date(subscription.expires_at).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
      })
    : null;

  return (
    <div className={`hero-grid ${isPro ? 'hero-grid-pro' : 'hero-grid-basic'}`}>
      <div className="hero-left-col">
        {/* Dual-tier Greeting Bar: Casual Date Pill (Basic) vs Luxury VIP Ribbon (Pro) */}
        <div className="hero-eyebrow-row">
          {isPro ? (
            <>
              <span className="greeting-pill greeting-pill-pro">
                <CrownIcon size={13} />
                <span>MYMEET PRO · {subscription?.plan_name}</span>
              </span>
              <span className="greeting-pill-meta">
                {isUnlimited
                  ? `∞ Unlimited Notes · 20-MCQ Active${expiryLabel ? ` · Till ${expiryLabel}` : ''}`
                  : `${subscription?.credits_remaining ?? 0} Pro credit${
                      subscription?.credits_remaining === 1 ? '' : 's'
                    } left${expiryLabel ? ` · Valid till ${expiryLabel}` : ''}`}
              </span>
            </>
          ) : (
            <>
              <span className="greeting-pill">
                <ShieldIcon size={14} />
                <span>{todayFormatted}</span>
              </span>
              <span className="greeting-pill-meta">Basic Plan · Free AI Notes</span>
            </>
          )}
        </div>

        <h1 className={`hero-title ${isPro ? 'hero-title-pro' : ''}`}>
          {getTimeGreeting()}, <span className={isPro ? 'hero-name-gold' : ''}>{firstName}.</span>
        </h1>

        <p className="hero-subtitle">
          {isPro
            ? isUnlimited
              ? 'Your MyMeet Pro workspace is unlocked — host HD meetings, auto-generate Pro Master Notes, and master every lecture with 20-question MCQ tests.'
              : 'Your Pro credits are active — launch crystal-clear meetings and upgrade your most important sessions into deep Master Notes.'
            : 'Start a crystal-clear video meeting, schedule ahead with your team, or join an existing room with a code or link.'}
        </p>

        <form className="launch-bar" onSubmit={handleJoinByCode}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={creating}
            onClick={() => setShowCreateForm((prev) => !prev)}
          >
            <VideoIcon size={18} />
            <span>{creating ? 'Creating...' : 'New Meeting'}</span>
          </button>

          <Link to="/schedule" className="btn btn-secondary">
            <CalendarIcon size={16} />
            <span>Schedule</span>
          </Link>

          {/* Prominent Home Page Upgrade / Pro Manage Action */}
          <button
            type="button"
            className={`btn ${isPro ? 'btn-pro-subtle' : 'btn-pro-gold'}`}
            onClick={() => openUpgradeModal()}
          >
            {isPro ? <CrownIcon size={15} /> : <SparklesIcon size={15} />}
            <span>
              {isPro
                ? isUnlimited
                  ? 'Pro Workspace'
                  : 'Add Credits / Unlimited'
                : 'Upgrade to Pro'}
            </span>
          </button>

          <div className="join-capsule">
            <span className="join-capsule-icon">
              <KeyboardIcon size={17} />
            </span>
            <input
              type="text"
              className="join-capsule-input"
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value)}
              placeholder="Enter code or link"
              aria-label="Meeting code or link"
            />
            <button type="submit" className="btn btn-ghost btn-sm" disabled={!meetingCode.trim()}>
              Join
            </button>
          </div>
        </form>

        {actionError && <div className="alert alert-danger">{actionError}</div>}

        {showCreateForm && (
          <form className="card create-meeting-panel" onSubmit={handleCreateMeeting}>
            <div className="card-header" style={{ marginBottom: 14 }}>
              <h2 className="card-title">Start a New Meeting</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCreateForm(false)}
              >
                Close
              </button>
            </div>
            <div className="form">
              <label className="field">
                <span className="field-label">Meeting title (optional)</span>
                <input
                  type="text"
                  className="input"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={`${firstName}'s Meeting`}
                  maxLength={120}
                />
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={waitingRoom}
                  onChange={(e) => setWaitingRoom(e.target.checked)}
                />
                <span>
                  <strong>Enable Waiting Room</strong> — Approve guests before they join
                </span>
              </label>

              <div className="actions-row">
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  <VideoIcon size={16} />
                  <span>{creating ? 'Creating room...' : 'Create & Open Lobby'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {pendingInvites.length > 0 && (
          <section className="card invite-highlight-card" style={{ marginTop: 22 }}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MailIcon size={17} />
                <span>Meeting Invitations</span>
              </h2>
              <span className="badge badge-warning">{pendingInvites.length} pending</span>
            </div>

            <div className="meeting-list">
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="meeting-row">
                  <div className="meeting-row-main">
                    <div className="meeting-row-title">
                      <span>{inv.meeting_title}</span>
                      <span className="badge badge-success">Invited</span>
                    </div>
                    <div className="meeting-row-meta">
                      <span>
                        From <strong>{inv.inviter_name || inv.inviter_email || 'Host'}</strong>
                      </span>
                      <span>·</span>
                      <code>{inv.meeting_code}</code>
                    </div>
                  </div>
                  <div className="meeting-row-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={inviteBusyId === inv.id}
                      onClick={() => void handleRespondInvite(inv, 'accepted')}
                    >
                      Accept &amp; Join
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-soft btn-sm"
                      disabled={inviteBusyId === inv.id}
                      onClick={() => void handleRespondInvite(inv, 'declined')}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="card home-recent-card" style={{ marginTop: 22 }}>
          <div className="card-header">
            <h2 className="card-title">Recent Meetings</h2>
            <div className="actions-row">
              <Link to="/history" className="text-link">
                View all history
              </Link>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void loadDashboardData()}
                disabled={meetingsLoading}
                title="Refresh meetings"
              >
                <RefreshIcon size={14} />
              </button>
            </div>
          </div>

          {meetingsLoading && meetings.length === 0 ? (
            <p className="status-item-desc">Loading your meetings...</p>
          ) : meetings.length === 0 ? (
            <div className="empty-state">
              No meetings yet. Click <strong>New Meeting</strong> to start your first room.
            </div>
          ) : (
            <div className="meeting-list">
              {meetings.slice(0, 5).map((m) =>
                m.status === 'ended' ? (
                  <button
                    key={m.id}
                    type="button"
                    className="meeting-row meeting-row-clickable"
                    onClick={() => navigate(`/history?code=${encodeURIComponent(m.code)}`)}
                  >
                    <div className="meeting-row-main">
                      <div className="meeting-row-title">
                        <span>{m.title}</span>
                      </div>
                      <div className="meeting-row-meta">
                        <code>{m.code}</code>
                        {m.my_role === 'host' && (
                          <>
                            <span>·</span>
                            <span>Host</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{new Date(m.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="meeting-row-actions">
                      <span className="home-notes-cue">
                        <SparklesIcon size={12} />
                        <span>{isUnlimited ? 'Pro Notes' : 'Notes'}</span>
                      </span>
                      <span className="badge badge-warning">Ended</span>
                    </div>
                  </button>
                ) : (
                  <div key={m.id} className="meeting-row">
                    <div className="meeting-row-main">
                      <div className="meeting-row-title">
                        <span>{m.title}</span>
                        <span
                          className={`badge ${
                            m.status === 'active' ? 'badge-success' : 'badge-warning'
                          }`}
                        >
                          {m.status}
                        </span>
                        {m.is_locked && (
                          <span className="inline-icon-tag" title="Meeting locked">
                            <LockIcon size={13} />
                          </span>
                        )}
                      </div>
                      <div className="meeting-row-meta">
                        <code>{m.code}</code>
                        <span>·</span>
                        <span className="inline-meta">
                          <UsersIcon size={13} />
                          {m.joined_count} in call
                        </span>
                        {m.my_role === 'host' && (
                          <>
                            <span>·</span>
                            <span>Host</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{new Date(m.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="meeting-row-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void handleCopyInvite(m.code)}
                        title="Copy invite link"
                      >
                        {copiedCode === m.code ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                        <span>{copiedCode === m.code ? 'Copied' : 'Link'}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/meet/${m.code}`)}
                      >
                        Open
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      </div>

      {/* Right Column: Flagship Feature Carousel + Plan Snapshot Card + Up Next */}
      <div className="right-stack">
        <section
          className={`card spotlight-card ${isPro ? 'spotlight-card-pro' : ''}`}
          onMouseEnter={() => setCarouselPaused(true)}
          onMouseLeave={() => setCarouselPaused(false)}
        >
          <div className={`spotlight-visual spotlight-theme-${activeSlide.theme}`}>
            <div className="spotlight-top-row">
              <span
                className={`spotlight-badge ${activeSlide.isProFeature ? 'spotlight-badge-pro' : ''}`}
              >
                {activeSlide.isProFeature ? <CrownIcon size={12} /> : <SparklesIcon size={12} />}
                <span>{activeSlide.badge}</span>
              </span>
              <span className="spotlight-step">
                {slideIdx + 1} / {SPOTLIGHT_SLIDES.length}
              </span>
            </div>

            <div className="spotlight-body">
              <h2 className="spotlight-heading">{activeSlide.title}</h2>
              <p className="spotlight-copy">{activeSlide.copy}</p>

              <div className="spotlight-chips">
                {activeSlide.chips.map((chip) => (
                  <span key={chip} className="spotlight-chip">
                    {chip}
                  </span>
                ))}
              </div>

              {activeSlide.ctaLabel && (
                <button
                  type="button"
                  className="spotlight-cta-btn"
                  onClick={() => handleSlideCta(activeSlide)}
                >
                  <span>{activeSlide.ctaLabel}</span>
                  <ArrowRightIcon size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="carousel-controls">
            <div className="carousel-dots" role="tablist" aria-label="MyMeet features">
              {SPOTLIGHT_SLIDES.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  className={`carousel-dot ${idx === slideIdx ? 'active' : ''}`}
                  aria-label={s.badge}
                  onClick={() => setSlideIdx(idx)}
                />
              ))}
            </div>
            <div className="carousel-arrow-group">
              <button
                type="button"
                className="carousel-arrow-btn carousel-arrow-prev"
                aria-label="Previous highlight"
                onClick={() =>
                  setSlideIdx((prev) => (prev - 1 + SPOTLIGHT_SLIDES.length) % SPOTLIGHT_SLIDES.length)
                }
              >
                <ChevronLeftIcon size={16} />
              </button>
              <button
                type="button"
                className="carousel-arrow-btn carousel-arrow-next"
                aria-label="Next highlight"
                onClick={() => setSlideIdx((prev) => (prev + 1) % SPOTLIGHT_SLIDES.length)}
              >
                <ChevronRightIcon size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* Home Plan Snapshot Card: Pro VIP Status for Subscribers OR Transparent ₹9 vs Unlimited Teaser for Basic */}
        {isPro && isUnlimited ? (
          <section className="card home-pro-vip-card">
            <div className="home-pro-vip-head">
              <span className="pro-pill-badge">
                <CrownIcon size={12} /> {subscription?.plan_name}
              </span>
              <span className="badge badge-success">Active</span>
            </div>
            <h3 className="home-pro-vip-title">All Pro Perks Unlocked</h3>
            <div className="home-pro-vip-grid">
              <div className="home-pro-vip-item">
                <CheckIcon size={14} />
                <span>Unlimited Master Notes</span>
              </div>
              <div className="home-pro-vip-item">
                <CheckIcon size={14} />
                <span>20-MCQ Session Tests</span>
              </div>
              <div className="home-pro-vip-item">
                <CheckIcon size={14} />
                <span>Unlimited Regenerates</span>
              </div>
              <div className="home-pro-vip-item">
                <CheckIcon size={14} />
                <span>Priority AI + HD PDF</span>
              </div>
            </div>
            <div className="home-pro-vip-footer">
              <Link to="/history" className="btn btn-pro-gold btn-sm">
                <SparklesIcon size={14} />
                <span>Open Pro Notes &amp; MCQs</span>
              </Link>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => openUpgradeModal()}
              >
                Manage Plan
              </button>
            </div>
          </section>
        ) : (
          <section className="card home-upgrade-card">
            <div className="home-upgrade-head">
              <div>
                <span className="pro-pill-badge">
                  <SparklesIcon size={11} /> MYMEET PRO PLANS
                </span>
                <h3 className="home-upgrade-title">
                  {isPro
                    ? `You have ${subscription?.credits_remaining ?? 0} Pro credit${
                        subscription?.credits_remaining === 1 ? '' : 's'
                      } left`
                    : 'Level up your study & meeting notes'}
                </h3>
              </div>
            </div>

            <div className="home-mini-tiers">
              <div className="home-mini-tier">
                <div className="home-mini-tier-top">
                  <strong>₹9 · Single Class</strong>
                  <span className="home-mini-tag">Try Once</span>
                </div>
                <div className="home-mini-line yes">
                  <CheckIcon size={12} /> <span>1 class Pro Master Notes only (30d)</span>
                </div>
                <div className="home-mini-line no">
                  <CrossIcon size={11} /> <span>No Quick 20-MCQ revision test</span>
                </div>
              </div>

              <div className="home-mini-tier home-mini-tier-highlight">
                <div className="home-mini-tier-top">
                  <strong>₹349/mo · ₹899/yr</strong>
                  <span className="home-mini-tag gold">Save 78%</span>
                </div>
                <div className="home-mini-line yes">
                  <CheckIcon size={12} /> <span>Unlimited Pro Master Notes</span>
                </div>
                <div className="home-mini-line yes">
                  <CheckIcon size={12} /> <span>Quick 20-MCQ Session Revision Tests</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-pro-gold btn-full"
              onClick={() => openUpgradeModal()}
            >
              <CrownIcon size={15} />
              <span>Compare All 4 Plans (₹9 · ₹49 · ₹349 · ₹899)</span>
            </button>
          </section>
        )}

        <section className="card">
          <div className="card-header" style={{ marginBottom: 14 }}>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarIcon size={17} />
              <span>Up Next</span>
            </h2>
            <Link to="/schedule" className="text-link">
              Manage schedule
            </Link>
          </div>

          {nextSchedule ? (
            <div className="meeting-row roster-row-col">
              <div className="roster-top-line">
                <div className="meeting-row-title">{nextSchedule.title}</div>
                <span className="badge badge-success">
                  {nextSchedule.is_host ? 'Host' : 'Invited'}
                </span>
              </div>
              <div className="meeting-row-meta">
                <span className="inline-meta">
                  <ClockIcon size={13} />
                  {new Date(nextSchedule.scheduled_start).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {nextSchedule.meeting_code && (
                  <>
                    <span>·</span>
                    <code>{nextSchedule.meeting_code}</code>
                  </>
                )}
              </div>
              <div className="actions-row" style={{ marginTop: 4 }}>
                {nextSchedule.is_host ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void handleStartScheduled(nextSchedule)}
                  >
                    <VideoIcon size={14} />
                    <span>Start Meeting</span>
                  </button>
                ) : nextSchedule.meeting_code ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/meet/${nextSchedule.meeting_code}`)}
                  >
                    Open Lobby
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              No upcoming scheduled calls.{' '}
              <Link to="/schedule" className="text-link">
                Schedule one now
              </Link>
              .
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
