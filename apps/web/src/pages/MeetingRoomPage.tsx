import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ConnectionState } from 'livekit-client';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CaptionsIcon,
  ChatIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  HandIcon,
  LockIcon,
  MailIcon,
  MaximizeIcon,
  MicIcon,
  MicOffIcon,
  MinimizeIcon,
  MoreVerticalIcon,
  PhoneOffIcon,
  RecordIcon,
  RefreshIcon,
  ScreenShareIcon,
  SendIcon,
  ShieldIcon,
  SparklesIcon,
  UnlockIcon,
  UsersIcon,
  VideoIcon,
  VideoOffIcon,
  VolumeIcon,
  VolumeOffIcon,
} from '../components/Icons';
import { VideoTile, type VideoEffectMode } from '../components/VideoTile';
import { useAuth } from '../hooks/useAuth';
import { useLiveCaptions } from '../hooks/useLiveCaptions';
import { useLiveKitRoom } from '../hooks/useLiveKitRoom';
import { useMeetingAiAgent } from '../hooks/useMeetingAiAgent';
import { useMeetingRecorder } from '../hooks/useMeetingRecorder';
import {
  admitAllParticipants,
  admitParticipant,
  buildMeetingInviteUrl,
  endMeeting,
  getMeeting,
  leaveMeeting,
  listMeetingInvitations,
  listMessages,
  muteParticipant,
  removeParticipant,
  sendInvitation,
  sendMessage,
  updateMeetingSettings,
  updateParticipantRole,
  type MeetingDetail,
  type MeetingInvitation,
  type MeetingMessage,
} from '../services/api';

type SidebarTab = 'people' | 'chat' | 'invite';

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return '00:00';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

export function MeetingRoomPage() {
  const { code = '' } = useParams<{ code: string }>();
  const { session, user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as { micEnabled?: boolean; camEnabled?: boolean } | null) ?? {};

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('people');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLeaveMenu, setShowLeaveMenu] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [elapsed, setElapsed] = useState('00:00');
  const [videoEffect, setVideoEffect] = useState<VideoEffectMode>('none');
  const [showEffectsBar, setShowEffectsBar] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [myHandRaised, setMyHandRaised] = useState(false);
  const roomShellRef = useRef<HTMLDivElement | null>(null);
  const lastHandEventIdRef = useRef<string | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const leaveMenuRef = useRef<HTMLDivElement | null>(null);

  const myDisplayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    'Participant';

  // Chat state
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [lastReadCount, setLastReadCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Invitations state (for host/co-host)
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sentInvitations, setSentInvitations] = useState<MeetingInvitation[]>([]);

  const isAdmittedAndActive = Boolean(
    meeting &&
      meeting.status === 'active' &&
      (meeting.is_host || meeting.my_status === 'joined'),
  );

  const livekit = useLiveKitRoom({
    meetingCode: meeting?.code ?? code,
    accessToken: session?.access_token ?? null,
    enabled: isAdmittedAndActive,
    initialMicEnabled: navState.micEnabled ?? true,
    initialCamEnabled: navState.camEnabled ?? false,
  });

  const activeScreenSharer =
    livekit.participants.find((p) => Boolean(p.screenShareTrack)) ?? null;
  const localParticipantMedia =
    livekit.participants.find((p) => p.isLocal) ?? null;

  const aiAgent = useMeetingAiAgent({
    meetingCode: meeting?.code ?? code,
    accessToken: session?.access_token ?? null,
    speakerName: myDisplayName,
    enabled: isAdmittedAndActive,
    localAudioTrack: localParticipantMedia?.audioTrack ?? null,
    screenShareTrack: activeScreenSharer?.screenShareTrack ?? null,
    screenSharerName: activeScreenSharer?.name ?? null,
  });

  const recorder = useMeetingRecorder(meeting?.code ?? code);
  const captions = useLiveCaptions(
    (text) => {
      void livekit.broadcastCaption(myDisplayName, text);
    },
    (finalText) => {
      void aiAgent.saveVoiceTranscript(finalText);
    },
  );

  // Automatically start live voice transcription whenever the user is active, AI Notes is on, and mic is unmuted
  const { startCaptions, stopCaptions } = captions;
  useEffect(() => {
    if (isAdmittedAndActive && aiAgent.aiAgentActive && livekit.micEnabled) {
      startCaptions();
    } else {
      stopCaptions();
    }
  }, [isAdmittedAndActive, aiAgent.aiAgentActive, livekit.micEnabled, startCaptions, stopCaptions]);

  const handleToggleRecording = async () => {
    if (recorder.isRecording) {
      recorder.stopRecording();
      await livekit.broadcastRecordingState(false, myDisplayName);
      if (session?.access_token && meeting) {
        void sendMessage(
          session.access_token,
          meeting.code,
          `[Recording stopped by ${myDisplayName}]`,
        ).catch(() => {});
      }
      showTempNotice('Recording stopped. Click Download Recording to save your .webm video.');
    } else {
      const started = await recorder.startRecording();
      if (started) {
        await livekit.broadcastRecordingState(true, myDisplayName);
        if (session?.access_token && meeting) {
          void sendMessage(
            session.access_token,
            meeting.code,
            `[Recording started by ${myDisplayName} — all participants notified]`,
          ).catch(() => {});
        }
      }
    }
  };

  const fetchRoomState = useCallback(async () => {
    if (!session?.access_token || !code) return;
    try {
      const detail = await getMeeting(session.access_token, code);
      setMeeting(detail);
      setError(null);

      if (detail.is_host || detail.my_status === 'joined') {
        const msgs = await listMessages(session.access_token, detail.code).catch(() => null);
        if (msgs) setMessages(msgs);

        if (detail.can_manage) {
          const invs = await listMeetingInvitations(session.access_token, detail.code).catch(
            () => null,
          );
          if (invs) setSentInvitations(invs);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sync meeting room.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, code]);

  useEffect(() => {
    void fetchRoomState();
    const poll = setInterval(() => {
      void fetchRoomState();
    }, 2500);
    return () => clearInterval(poll);
  }, [fetchRoomState]);

  useEffect(() => {
    if (!meeting?.started_at) return;
    setElapsed(formatElapsed(meeting.started_at));
    const tick = setInterval(() => {
      setElapsed(formatElapsed(meeting.started_at));
    }, 1000);
    return () => clearInterval(tick);
  }, [meeting?.started_at]);

  // Mark chat read when chat tab is visible
  useEffect(() => {
    if (showSidebar && sidebarTab === 'chat') {
      setLastReadCount(messages.length);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showSidebar, sidebarTab, messages.length]);

  useEffect(() => {
    if (!meeting || meeting.status === 'ended') return;
    if (!meeting.is_host && meeting.my_status !== 'joined') {
      void livekit.disconnect();
      navigate(`/meet/${meeting.code}`, { replace: true });
    }
  }, [meeting, navigate, livekit]);

  const showTempNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice((prev) => (prev === msg ? null : prev)), 3500);
  };

  // Sync browser Fullscreen state & lock body scroll in Fullscreen Focus Mode
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const target = roomShellRef.current ?? document.documentElement;
        await target.requestFullscreen();
        setShowSidebar(false);
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fallback for browsers without Fullscreen API
      setIsFullscreen((prev) => {
        const next = !prev;
        if (next) setShowSidebar(false);
        return next;
      });
    }
  };

  const handleToggleHandRaise = async () => {
    const next = !myHandRaised;
    setMyHandRaised(next);
    await livekit.broadcastHandRaise(next, myDisplayName, user?.id);
  };

  // Close 3-dots / leave popovers on outside click
  useEffect(() => {
    if (!showMoreMenu && !showLeaveMenu) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showMoreMenu && moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setShowMoreMenu(false);
      }
      if (showLeaveMenu && leaveMenuRef.current && !leaveMenuRef.current.contains(target)) {
        setShowLeaveMenu(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showMoreMenu, showLeaveMenu]);

  // Quiet visual toast ONLY when someone raises their hand (no voice announcement)
  useEffect(() => {
    const evt = livekit.lastHandEvent;
    if (!evt || !evt.raised || lastHandEventIdRef.current === evt.id) return;
    lastHandEventIdRef.current = evt.id;
    showTempNotice(`✋ ${evt.name} raised their hand`);
  }, [livekit.lastHandEvent]);

  const openSidebarTab = (tab: SidebarTab) => {
    if (showSidebar && sidebarTab === tab) {
      setShowSidebar(false);
    } else {
      setSidebarTab(tab);
      setShowSidebar(true);
    }
  };

  const handleCopyLink = async () => {
    if (!meeting) return;
    try {
      await navigator.clipboard.writeText(buildMeetingInviteUrl(meeting.code));
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleLeave = async () => {
    setActionBusy(true);
    try {
      await livekit.disconnect();
      if (session?.access_token && meeting) {
        await leaveMeeting(session.access_token, meeting.code);
      }
    } finally {
      navigate('/', { replace: true });
    }
  };

  const handleToggleLock = async () => {
    if (!session?.access_token || !meeting) return;
    setActionBusy(true);
    setError(null);
    try {
      const updated = await updateMeetingSettings(session.access_token, meeting.code, {
        is_locked: !meeting.is_locked,
      });
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lock status.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleToggleWaitingRoom = async () => {
    if (!session?.access_token || !meeting) return;
    setActionBusy(true);
    setError(null);
    try {
      const updated = await updateMeetingSettings(session.access_token, meeting.code, {
        waiting_room_enabled: !meeting.waiting_room_enabled,
      });
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle waiting room.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAdmit = async (targetUserId: string) => {
    if (!session?.access_token || !meeting) return;
    setActionBusy(true);
    setError(null);
    try {
      const updated = await admitParticipant(session.access_token, meeting.code, targetUserId);
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to admit participant.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAdmitAll = async () => {
    if (!session?.access_token || !meeting) return;
    setActionBusy(true);
    setError(null);
    try {
      const updated = await admitAllParticipants(session.access_token, meeting.code);
      setMeeting(updated);
      showTempNotice('Admitted all waiting guests.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to admit waiting guests.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleToggleCoHost = async (targetUserId: string, currentRole: string) => {
    if (!session?.access_token || !meeting) return;
    setActionBusy(true);
    setError(null);
    try {
      const nextRole = currentRole === 'co_host' ? 'participant' : 'co_host';
      const updated = await updateParticipantRole(
        session.access_token,
        meeting.code,
        targetUserId,
        nextRole,
      );
      setMeeting(updated);
      showTempNotice(nextRole === 'co_host' ? 'Promoted to Co-Host.' : 'Removed Co-Host role.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleMuteParticipant = async (targetUserId: string, name: string) => {
    if (!session?.access_token || !meeting) return;
    setActionBusy(true);
    setError(null);
    try {
      await muteParticipant(session.access_token, meeting.code, targetUserId);
      showTempNotice(`Muted ${name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mute participant.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRemove = async (targetUserId: string) => {
    if (!session?.access_token || !meeting) return;
    setActionBusy(true);
    setError(null);
    try {
      const updated = await removeParticipant(session.access_token, meeting.code, targetUserId);
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove participant.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleEndForAll = async () => {
    if (!session?.access_token || !meeting) return;
    setActionBusy(true);
    setError(null);
    try {
      await livekit.disconnect();
      const updated = await endMeeting(session.access_token, meeting.code);
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end meeting.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSendChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !meeting || !chatInput.trim()) return;
    setSendingChat(true);
    setError(null);
    try {
      const created = await sendMessage(session.access_token, meeting.code, chatInput.trim());
      setMessages((prev) => [...prev, created]);
      setChatInput('');
      setLastReadCount((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSendingChat(false);
    }
  };

  const handleSendInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !meeting || !inviteEmail.trim()) return;
    setSendingInvite(true);
    setError(null);
    try {
      const { invitation: created, emailDelivery } = await sendInvitation(
        session.access_token,
        meeting.code,
        inviteEmail.trim(),
      );
      setSentInvitations((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);
      setInviteEmail('');
      showTempNotice(emailDelivery?.message || `Invitation sent to ${created.invitee_email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation.');
    } finally {
      setSendingInvite(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '32px auto' }}>
        <p className="status-item-desc">Connecting to meeting room...</p>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '32px auto' }}>
        <div className="alert alert-danger">{error ?? 'Meeting not found.'}</div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (meeting.status === 'ended') {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
        <h1 className="auth-title">Meeting Ended</h1>
        <p className="auth-subtitle">
          <strong>{meeting.title}</strong> ({meeting.code}) has been ended by the host.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  const joinedParticipants = meeting.participants.filter((p) => p.status === 'joined');
  const waitingParticipants = meeting.participants.filter((p) => p.status === 'waiting');
  const unreadChatCount =
    showSidebar && sidebarTab === 'chat' ? 0 : Math.max(0, messages.length - lastReadCount);
  const isLiveKitConnected = livekit.connectionState === ConnectionState.Connected;
  const screenShares = livekit.participants.filter((p) => Boolean(p.screenShareTrack));
  const tileParticipantsCount =
    isLiveKitConnected && livekit.participants.length > 0
      ? livekit.participants.length
      : Math.max(1, joinedParticipants.length);
  const gridCountAttr =
    tileParticipantsCount <= 1
      ? '1'
      : tileParticipantsCount === 2
        ? '2'
        : tileParticipantsCount === 3
          ? '3'
          : tileParticipantsCount === 4
            ? '4'
            : 'many';

  const avatarMap = new Map<string, string | null>();
  for (const part of meeting.participants) {
    avatarMap.set(part.user_id, part.avatar_url ?? null);
  }
  if (user?.id && profile?.avatar_url) {
    avatarMap.set(user.id, profile.avatar_url);
  }

  const moreBadgeCount = unreadChatCount + (meeting.can_manage ? waitingParticipants.length : 0);

  return (
    <div
      ref={roomShellRef}
      className={`room-shell room-shell-minimal ${isFullscreen ? 'room-shell-fullscreen' : ''}`}
    >
      {/* Floating lightweight notifications overlay (takes 0px of stage height) */}
      <div className="room-floating-alerts">
        {meeting.can_manage && waitingParticipants.length > 0 && (
          <button
            type="button"
            className="room-floating-pill room-floating-pill-warn"
            onClick={() => openSidebarTab('people')}
          >
            <span>
              {waitingParticipants.length}{' '}
              {waitingParticipants.length === 1 ? 'person' : 'people'} waiting
            </span>
            <strong>Review</strong>
          </button>
        )}
        {error && <div className="room-floating-pill room-floating-pill-danger">{error}</div>}
        {statusNotice && (
          <div className="room-floating-pill room-floating-pill-info">{statusNotice}</div>
        )}
        {recorder.recorderError && (
          <div className="room-floating-pill room-floating-pill-warn">{recorder.recorderError}</div>
        )}
        {livekit.mediaError && (
          <div className="room-floating-pill room-floating-pill-warn">
            <span>{livekit.mediaError}</span>
            <button
              type="button"
              className="room-pill-action"
              onClick={() => void livekit.reconnect()}
            >
              <RefreshIcon size={12} /> Retry
            </button>
          </div>
        )}
        {(recorder.isRecording || livekit.remoteRecording.active) && (
          <div className="room-floating-pill room-floating-pill-danger" role="alert">
            <span className="rec-dot" />
            <span>
              REC ·{' '}
              {recorder.isRecording
                ? `${String(Math.floor(recorder.recordingSeconds / 60)).padStart(2, '0')}:${String(
                    recorder.recordingSeconds % 60,
                  ).padStart(2, '0')}`
                : livekit.remoteRecording.by || 'Host'}
            </span>
          </div>
        )}
        {!recorder.isRecording && recorder.downloadUrl && (
          <button
            type="button"
            className="room-floating-pill room-floating-pill-info"
            onClick={recorder.downloadRecording}
          >
            <DownloadIcon size={13} />
            <span>Download Recording (.webm)</span>
          </button>
        )}
      </div>

      <div className={`room-body ${showSidebar ? '' : 'room-body-full'}`}>
        <section className="room-stage">
          {/* Tiny unobtrusive corner badge inside stage — zero top card clutter */}
          <div className="stage-corner-info">
            <span className={`stage-conn-dot ${isLiveKitConnected ? 'live' : ''}`} />
            <span className="stage-corner-title">{meeting.title}</span>
            <span className="stage-corner-sep">·</span>
            <span className="stage-corner-time">{elapsed}</span>
          </div>

          {screenShares.length > 0 && (
            <div className="screen-share-spotlight">
              {screenShares.map((sharer) => (
                <VideoTile
                  key={`screen-${sharer.identity}`}
                  name={sharer.name}
                  isLocal={sharer.isLocal}
                  videoTrack={sharer.screenShareTrack}
                  isScreenShare
                />
              ))}
            </div>
          )}

          <div
            className={`participant-tiles-grid ${screenShares.length > 0 ? 'has-screen-share' : ''}`}
            data-count={gridCountAttr}
          >
            {isLiveKitConnected && livekit.participants.length > 0
              ? livekit.participants.map((p) => (
                  <VideoTile
                    key={p.identity}
                    name={p.name}
                    avatarUrl={
                      avatarMap.get(p.identity) ??
                      (p.isLocal ? profile?.avatar_url ?? null : null)
                    }
                    isLocal={p.isLocal}
                    isHost={p.isHost || p.identity === meeting.host_id}
                    isSpeaking={p.isSpeaking}
                    micEnabled={p.micEnabled}
                    handRaised={Boolean(
                      livekit.raisedHands[p.identity] || (p.isLocal && myHandRaised),
                    )}
                    videoTrack={p.videoTrack}
                    audioTrack={p.audioTrack}
                    speakerMuted={speakerMuted}
                    videoEffect={p.isLocal ? videoEffect : 'none'}
                  />
                ))
              : joinedParticipants.map((participant) => {
                  const name = participant.full_name || participant.email || 'Participant';
                  const isMe = participant.user_id === user?.id;
                  return (
                    <VideoTile
                      key={participant.id}
                      name={name}
                      avatarUrl={
                        participant.avatar_url ??
                        (isMe ? profile?.avatar_url ?? null : null)
                      }
                      isLocal={isMe}
                      isHost={participant.role === 'host'}
                      micEnabled={isMe ? livekit.micEnabled : true}
                      handRaised={Boolean(
                        livekit.raisedHands[participant.user_id] || (isMe && myHandRaised),
                      )}
                    />
                  );
                })}
          </div>

          {livekit.latestCaption && (captions.captionsEnabled || Date.now() - livekit.latestCaption.timestamp < 8000) && (
            <div className="captions-bar" role="status" aria-live="polite">
              <span className="captions-speaker">{livekit.latestCaption.speaker}:</span>{' '}
              <span>{livekit.latestCaption.text}</span>
            </div>
          )}

          {showEffectsBar && (
            <div className="effects-bar">
              <span className="effects-label">
                <SparklesIcon size={14} /> Camera Effects:
              </span>
              {(
                [
                  ['none', 'None'],
                  ['blur', 'Soft Blur'],
                  ['warm', 'Warm Studio'],
                  ['studio', 'Crisp HD'],
                  ['dim', 'Low Light'],
                ] as Array<[VideoEffectMode, string]>
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`btn btn-xs ${videoEffect === mode ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setVideoEffect(mode)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </section>

        {showSidebar && (
          <aside className="room-sidebar card">
            <div className="sidebar-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={sidebarTab === 'people'}
                className={`sidebar-tab ${sidebarTab === 'people' ? 'active' : ''}`}
                onClick={() => setSidebarTab('people')}
              >
                <UsersIcon size={14} />
                <span>People</span>
                {waitingParticipants.length > 0 && (
                  <span className="unread-pill">{waitingParticipants.length}</span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sidebarTab === 'chat'}
                className={`sidebar-tab ${sidebarTab === 'chat' ? 'active' : ''}`}
                onClick={() => setSidebarTab('chat')}
              >
                <ChatIcon size={14} />
                <span>Chat</span>
                {unreadChatCount > 0 && <span className="unread-pill">{unreadChatCount}</span>}
              </button>
              {meeting.can_manage && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={sidebarTab === 'invite'}
                  className={`sidebar-tab ${sidebarTab === 'invite' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('invite')}
                >
                  <MailIcon size={14} />
                  <span>Invite</span>
                </button>
              )}
              <button
                type="button"
                className="sidebar-tab"
                style={{ flex: '0 0 auto', padding: '8px 10px' }}
                onClick={() => setShowSidebar(false)}
                title="Close panel"
                aria-label="Close panel"
              >
                ×
              </button>
            </div>

            {sidebarTab === 'people' && (
              <>
                {meeting.can_manage && (
                  <div className="sidebar-section">
                    <h2 className="sidebar-title">
                      <ShieldIcon size={15} /> {meeting.is_host ? 'Host Controls' : 'Co-Host Controls'}
                    </h2>
                    <div className="host-controls-stack">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-full"
                        disabled={actionBusy}
                        onClick={() => void handleToggleLock()}
                      >
                        {meeting.is_locked ? <UnlockIcon size={14} /> : <LockIcon size={14} />}
                        <span>{meeting.is_locked ? 'Unlock Meeting' : 'Lock Meeting'}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-full"
                        disabled={actionBusy}
                        onClick={() => void handleToggleWaitingRoom()}
                      >
                        <ShieldIcon size={14} />
                        <span>
                          {meeting.waiting_room_enabled
                            ? 'Disable Waiting Room'
                            : 'Enable Waiting Room'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {meeting.can_manage && waitingParticipants.length > 0 && (
                  <div className="sidebar-section">
                    <div className="card-header" style={{ marginBottom: 4 }}>
                      <h2 className="sidebar-title">Waiting Room ({waitingParticipants.length})</h2>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={actionBusy}
                        onClick={() => void handleAdmitAll()}
                      >
                        Admit All
                      </button>
                    </div>
                    <div className="roster-list">
                      {waitingParticipants.map((p) => (
                        <div key={p.id} className="roster-row">
                          <div className="roster-info">
                            <div className="roster-name">{p.full_name || p.email}</div>
                            <div className="roster-sub">Waiting to join</div>
                          </div>
                          <div className="roster-actions">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={actionBusy}
                              onClick={() => void handleAdmit(p.user_id)}
                            >
                              Admit
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger-soft btn-sm"
                              disabled={actionBusy}
                              onClick={() => void handleRemove(p.user_id)}
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="sidebar-section">
                  <h2 className="sidebar-title">In This Meeting ({joinedParticipants.length})</h2>
                  <div className="roster-list">
                    {joinedParticipants.map((p) => {
                      const isMe = p.user_id === user?.id;
                      const label = p.full_name || p.email;
                      const isPrimaryHost = p.user_id === meeting.host_id;
                      return (
                        <div key={p.id} className="roster-row roster-row-col">
                          <div className="roster-top-line">
                            <div className="roster-info">
                              <div className="roster-name">
                                {label} {isMe ? '(You)' : ''}
                                {Boolean(livekit.raisedHands[p.user_id] || (isMe && myHandRaised)) &&
                                  ' ✋'}
                              </div>
                              <div className="roster-sub">
                                {isPrimaryHost
                                  ? 'Host'
                                  : p.role === 'co_host'
                                    ? 'Co-Host'
                                    : 'Participant'}
                              </div>
                            </div>
                            {isPrimaryHost ? (
                              <span className="badge badge-success">Host</span>
                            ) : p.role === 'co_host' ? (
                              <span className="badge badge-warning">Co-Host</span>
                            ) : null}
                          </div>

                          {meeting.can_manage && !isMe && !isPrimaryHost && (
                            <div className="roster-actions-bar">
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                disabled={actionBusy}
                                onClick={() => void handleMuteParticipant(p.user_id, label)}
                                title="Mute participant microphone"
                              >
                                Mute
                              </button>
                              {meeting.is_host && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  disabled={actionBusy}
                                  onClick={() => void handleToggleCoHost(p.user_id, p.role)}
                                >
                                  {p.role === 'co_host' ? 'Unset Co-Host' : 'Make Co-Host'}
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-danger-soft btn-xs"
                                disabled={actionBusy}
                                onClick={() => void handleRemove(p.user_id)}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {sidebarTab === 'chat' && (
              <div className="chat-panel">
                <div className="chat-messages">
                  {messages.length === 0 ? (
                    <div className="empty-state">
                      No messages yet. Say hello to everyone in the meeting!
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMine = msg.sender_id === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`chat-bubble ${isMine ? 'chat-bubble-mine' : ''}`}
                        >
                          <div className="chat-bubble-meta">
                            <span>{isMine ? 'You' : msg.sender_name || msg.sender_email}</span>
                            <span>
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="chat-bubble-text">{msg.content}</div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form className="chat-form" onSubmit={handleSendChat}>
                  <input
                    type="text"
                    className="input"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Send a message to everyone..."
                    maxLength={2000}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={sendingChat || !chatInput.trim()}
                    title="Send message"
                  >
                    <SendIcon size={15} />
                  </button>
                </form>
              </div>
            )}

            {sidebarTab === 'invite' && meeting.can_manage && (
              <div className="sidebar-section">
                <h2 className="sidebar-title">
                  <MailIcon size={15} /> Invite by Email
                </h2>
                <form className="form" onSubmit={handleSendInvite}>
                  <input
                    type="email"
                    className="input"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@example.com"
                    required
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm btn-full"
                    disabled={sendingInvite || !inviteEmail.trim()}
                  >
                    {sendingInvite ? 'Sending...' : 'Send Meeting Invitation'}
                  </button>
                </form>

                <div className="roster-list" style={{ marginTop: 8 }}>
                  {sentInvitations.length === 0 ? (
                    <div className="status-item-desc">No email invitations sent yet.</div>
                  ) : (
                    sentInvitations.map((inv) => (
                      <div key={inv.id} className="roster-row">
                        <div className="roster-info">
                          <div className="roster-name">{inv.invitee_email}</div>
                          <div className="roster-sub">
                            Sent {new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <span
                          className={`badge ${
                            inv.status === 'accepted'
                              ? 'badge-success'
                              : inv.status === 'declined'
                                ? 'badge-danger'
                                : 'badge-warning'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className="room-dock-minimal">
        <button
          type="button"
          className={`dock-btn ${livekit.micEnabled ? 'dock-btn-neutral' : 'dock-btn-off'}`}
          onClick={() => void livekit.toggleMic()}
          title={livekit.micEnabled ? 'Mute microphone' : 'Unmute microphone'}
          aria-label={livekit.micEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {livekit.micEnabled ? <MicIcon size={20} /> : <MicOffIcon size={20} />}
        </button>

        <button
          type="button"
          className={`dock-btn ${livekit.camEnabled ? 'dock-btn-neutral' : 'dock-btn-off'}`}
          onClick={() => void livekit.toggleCamera()}
          title={livekit.camEnabled ? 'Turn camera off' : 'Turn camera on'}
          aria-label={livekit.camEnabled ? 'Turn camera off' : 'Turn camera on'}
        >
          {livekit.camEnabled ? <VideoIcon size={20} /> : <VideoOffIcon size={20} />}
        </button>

        <button
          type="button"
          className={`dock-btn ${livekit.screenShareEnabled ? 'dock-btn-accent' : 'dock-btn-neutral'}`}
          onClick={() => void livekit.toggleScreenShare()}
          title={livekit.screenShareEnabled ? 'Stop screen share' : 'Share screen'}
          aria-label={livekit.screenShareEnabled ? 'Stop screen share' : 'Share screen'}
        >
          <ScreenShareIcon size={20} />
        </button>

        {/* 3-Dots More Options Popover */}
        <div className="dock-popover-anchor" ref={moreMenuRef}>
          <button
            type="button"
            className={`dock-btn media-btn-badge-wrap ${showMoreMenu ? 'dock-btn-accent' : 'dock-btn-neutral'}`}
            onClick={() => {
              setShowLeaveMenu(false);
              setShowMoreMenu((prev) => !prev);
            }}
            title="More options"
            aria-label="More options"
            aria-expanded={showMoreMenu}
          >
            <MoreVerticalIcon size={20} />
            {moreBadgeCount > 0 && <span className="media-btn-dot">{moreBadgeCount}</span>}
          </button>

          {showMoreMenu && (
            <div className="more-menu-popover" role="menu">
              <div className="more-menu-head">
                <span className="more-menu-code">{meeting.code}</span>
                <button
                  type="button"
                  className="more-menu-copy"
                  onClick={() => void handleCopyLink()}
                >
                  {copiedLink ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                  <span>{copiedLink ? 'Copied' : 'Copy link'}</span>
                </button>
              </div>

              <button
                type="button"
                className="more-menu-item"
                onClick={() => {
                  setShowMoreMenu(false);
                  openSidebarTab('people');
                }}
              >
                <UsersIcon size={16} />
                <span>
                  People ({joinedParticipants.length}
                  {waitingParticipants.length > 0 ? ` + ${waitingParticipants.length} waiting` : ''})
                </span>
              </button>

              <button
                type="button"
                className="more-menu-item"
                onClick={() => {
                  setShowMoreMenu(false);
                  openSidebarTab('chat');
                }}
              >
                <ChatIcon size={16} />
                <span>In-Meeting Chat</span>
                {unreadChatCount > 0 && <span className="unread-pill">{unreadChatCount}</span>}
              </button>

              <button
                type="button"
                className={`more-menu-item ${myHandRaised ? 'active' : ''}`}
                onClick={() => {
                  setShowMoreMenu(false);
                  void handleToggleHandRaise();
                }}
              >
                <HandIcon size={16} />
                <span>{myHandRaised ? 'Lower Hand' : 'Raise Hand'}</span>
              </button>

              <button
                type="button"
                className={`more-menu-item ${speakerMuted ? 'active' : ''}`}
                onClick={() => {
                  setSpeakerMuted((prev) => !prev);
                  setShowMoreMenu(false);
                }}
              >
                {speakerMuted ? <VolumeOffIcon size={16} /> : <VolumeIcon size={16} />}
                <span>{speakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}</span>
              </button>

              <button
                type="button"
                className={`more-menu-item ${captions.captionsEnabled ? 'active' : ''}`}
                onClick={() => {
                  captions.toggleCaptions();
                  setShowMoreMenu(false);
                }}
              >
                <CaptionsIcon size={16} />
                <span>{captions.captionsEnabled ? 'Live Captions: ON' : 'Live Captions: OFF'}</span>
              </button>

              <button
                type="button"
                className={`more-menu-item ${aiAgent.aiAgentActive ? 'active' : ''}`}
                onClick={() => {
                  const next = !aiAgent.aiAgentActive;
                  aiAgent.setAiAgentActive(next);
                  if (next && !captions.captionsEnabled) {
                    captions.startCaptions();
                  }
                  setShowMoreMenu(false);
                }}
              >
                <SparklesIcon size={16} />
                <span>{aiAgent.aiAgentActive ? 'AI Notes: Active' : 'AI Notes: Paused'}</span>
              </button>

              {activeScreenSharer && aiAgent.aiAgentActive && (
                <button
                  type="button"
                  className="more-menu-item"
                  disabled={aiAgent.capturingScreen}
                  onClick={() => {
                    setShowMoreMenu(false);
                    void aiAgent.captureScreenNow();
                  }}
                >
                  <SparklesIcon size={16} />
                  <span>{aiAgent.capturingScreen ? 'Analyzing Screen...' : 'Snap Screen Notes'}</span>
                </button>
              )}

              <button
                type="button"
                className={`more-menu-item ${showEffectsBar || videoEffect !== 'none' ? 'active' : ''}`}
                onClick={() => {
                  setShowEffectsBar((prev) => !prev);
                  setShowMoreMenu(false);
                }}
              >
                <SparklesIcon size={16} />
                <span>Camera Effects</span>
              </button>

              <button
                type="button"
                className={`more-menu-item ${recorder.isRecording ? 'danger' : ''}`}
                onClick={() => {
                  setShowMoreMenu(false);
                  void handleToggleRecording();
                }}
              >
                <RecordIcon size={16} />
                <span>{recorder.isRecording ? 'Stop Recording' : 'Record Meeting'}</span>
              </button>

              <button
                type="button"
                className="more-menu-item"
                onClick={() => {
                  setShowMoreMenu(false);
                  void handleToggleFullscreen();
                }}
              >
                {isFullscreen ? <MinimizeIcon size={16} /> : <MaximizeIcon size={16} />}
                <span>{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Red End / Leave Call Button */}
        <div className="dock-popover-anchor" ref={leaveMenuRef}>
          <button
            type="button"
            className="dock-btn dock-btn-end"
            disabled={actionBusy}
            onClick={() => {
              if (meeting.is_host) {
                setShowMoreMenu(false);
                setShowLeaveMenu((prev) => !prev);
              } else {
                void handleLeave();
              }
            }}
            title={meeting.is_host ? 'Leave or end meeting' : 'Leave meeting'}
            aria-label="Leave or end meeting"
          >
            <PhoneOffIcon size={20} />
          </button>

          {showLeaveMenu && meeting.is_host && (
            <div className="more-menu-popover more-menu-leave" role="menu">
              <button
                type="button"
                className="more-menu-item danger"
                disabled={actionBusy}
                onClick={() => {
                  setShowLeaveMenu(false);
                  void handleEndForAll();
                }}
              >
                <PhoneOffIcon size={16} />
                <span>End Meeting for Everyone</span>
              </button>
              <button
                type="button"
                className="more-menu-item"
                disabled={actionBusy}
                onClick={() => {
                  setShowLeaveMenu(false);
                  void handleLeave();
                }}
              >
                <PhoneOffIcon size={16} />
                <span>Just Leave Call</span>
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
