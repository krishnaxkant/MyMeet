import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  admitAllParticipants,
  admitParticipant,
  endMeeting,
  fetchMeetingToken,
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
  type MeetingMediaToken,
  type MeetingMessage,
} from '../services/api';

type RoomTab = 'people' | 'chat' | 'invite';

interface MeetingRoomScreenProps {
  code: string;
  initialMicEnabled: boolean;
  initialCamEnabled: boolean;
  onExit: () => void;
  onBackToLobby: (code: string) => void;
  onOpenHistory: (code: string) => void;
}

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return '00:00';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

export function MeetingRoomScreen({
  code,
  initialMicEnabled,
  initialCamEnabled,
  onExit,
  onBackToLobby,
  onOpenHistory,
}: MeetingRoomScreenProps) {
  const { session, user } = useAuth();
  const { colors } = useTheme();

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(initialMicEnabled);
  const [camEnabled, setCamEnabled] = useState(initialCamEnabled);
  const [mediaToken, setMediaToken] = useState<MeetingMediaToken | null>(null);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState('00:00');

  const [activeTab, setActiveTab] = useState<RoomTab>('people');
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [lastReadCount, setLastReadCount] = useState(0);

  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sentInvitations, setSentInvitations] = useState<MeetingInvitation[]>([]);

  const showTempNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((prev) => (prev === msg ? null : prev)), 3000);
  };

  const loadRoom = useCallback(async () => {
    if (!session?.access_token) return;
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
      setError(err instanceof Error ? err.message : 'Unable to sync meeting.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, code]);

  useEffect(() => {
    void loadRoom();
    const timer = setInterval(() => {
      void loadRoom();
    }, 2500);
    return () => clearInterval(timer);
  }, [loadRoom]);

  useEffect(() => {
    if (!meeting?.started_at) return;
    setElapsed(formatElapsed(meeting.started_at));
    const tick = setInterval(() => {
      setElapsed(formatElapsed(meeting.started_at));
    }, 1000);
    return () => clearInterval(tick);
  }, [meeting?.started_at]);

  useEffect(() => {
    if (activeTab === 'chat') {
      setLastReadCount(messages.length);
    }
  }, [activeTab, messages.length]);

  useEffect(() => {
    if (!session?.access_token || !meeting || meeting.status !== 'active') return;
    if (!meeting.is_host && meeting.my_status !== 'joined') return;
    if (mediaToken) return;

    let cancelled = false;
    void fetchMeetingToken(session.access_token, meeting.code)
      .then((tok) => {
        if (cancelled) return;
        setMediaToken(tok);
        setMediaNotice(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setMediaNotice(err instanceof Error ? err.message : 'LiveKit media token unavailable.');
      });

    return () => {
      cancelled = true;
    };
  }, [session?.access_token, meeting, mediaToken]);

  useEffect(() => {
    if (!meeting || meeting.status === 'ended') return;
    if (!meeting.is_host && meeting.my_status !== 'joined') {
      onBackToLobby(meeting.code);
    }
  }, [meeting, onBackToLobby]);

  const handleShare = async () => {
    if (!meeting) return;
    await Share.share({
      message: `Join my Meet call "${meeting.title}" using code: ${meeting.code}`,
    }).catch(() => {});
  };

  const handleLeave = async () => {
    if (session?.access_token && meeting) {
      setBusy(true);
      await leaveMeeting(session.access_token, meeting.code).catch(() => {});
    }
    onExit();
  };

  const handleToggleLock = async () => {
    if (!session?.access_token || !meeting) return;
    setBusy(true);
    try {
      const updated = await updateMeetingSettings(session.access_token, meeting.code, {
        is_locked: !meeting.is_locked,
      });
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lock.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleWaitingRoom = async () => {
    if (!session?.access_token || !meeting) return;
    setBusy(true);
    try {
      const updated = await updateMeetingSettings(session.access_token, meeting.code, {
        waiting_room_enabled: !meeting.waiting_room_enabled,
      });
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update waiting room.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdmit = async (userId: string) => {
    if (!session?.access_token || !meeting) return;
    setBusy(true);
    try {
      const updated = await admitParticipant(session.access_token, meeting.code, userId);
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to admit participant.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdmitAll = async () => {
    if (!session?.access_token || !meeting) return;
    setBusy(true);
    try {
      const updated = await admitAllParticipants(session.access_token, meeting.code);
      setMeeting(updated);
      showTempNotice('Admitted all waiting guests.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to admit all guests.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleCoHost = async (targetUserId: string, currentRole: string) => {
    if (!session?.access_token || !meeting) return;
    setBusy(true);
    try {
      const nextRole = currentRole === 'co_host' ? 'participant' : 'co_host';
      const updated = await updateParticipantRole(
        session.access_token,
        meeting.code,
        targetUserId,
        nextRole,
      );
      setMeeting(updated);
      showTempNotice(nextRole === 'co_host' ? 'Promoted to Co-Host.' : 'Removed Co-Host.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change role.');
    } finally {
      setBusy(false);
    }
  };

  const handleMute = async (targetUserId: string, label: string) => {
    if (!session?.access_token || !meeting) return;
    setBusy(true);
    try {
      await muteParticipant(session.access_token, meeting.code, targetUserId);
      showTempNotice(`Muted ${label}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mute participant.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!session?.access_token || !meeting) return;
    setBusy(true);
    try {
      const updated = await removeParticipant(session.access_token, meeting.code, userId);
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove participant.');
    } finally {
      setBusy(false);
    }
  };

  const handleEndForAll = async () => {
    if (!session?.access_token || !meeting) return;
    setBusy(true);
    try {
      const updated = await endMeeting(session.access_token, meeting.code);
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end meeting.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendChat = async () => {
    if (!session?.access_token || !meeting || !chatText.trim()) return;
    setSendingChat(true);
    setError(null);
    try {
      const created = await sendMessage(session.access_token, meeting.code, chatText.trim());
      setMessages((prev) => [...prev, created]);
      setChatText('');
      setLastReadCount((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSendingChat(false);
    }
  };

  const handleSendInvite = async () => {
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
      showTempNotice(emailDelivery?.message || `Invited ${created.invitee_email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation.');
    } finally {
      setSendingInvite(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.subText, { color: colors.textMuted }]}>Joining room...</Text>
      </View>
    );
  }

  if (!meeting || meeting.status === 'ended') {
    return (
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.text }]}>
          {meeting ? 'Meeting Ended' : 'Meeting Unavailable'}
        </Text>
        <Text style={[styles.subText, { color: colors.textMuted, textAlign: 'center' }]}>
          {meeting
            ? `${meeting.title} has ended. Your AI study notes are ready in History.`
            : error ?? 'Unable to load meeting.'}
        </Text>
        {meeting && (
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
            onPress={() => onOpenHistory(meeting.code)}
          >
            <Text style={styles.primaryButtonText}>View AI Study Notes</Text>
          </Pressable>
        )}
        <Pressable
          style={[
            styles.smallBtn,
            { backgroundColor: colors.surface, borderColor: colors.borderStrong, paddingVertical: 11, paddingHorizontal: 20 },
          ]}
          onPress={onExit}
        >
          <Text style={[styles.smallBtnText, { color: colors.text }]}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  const joined = meeting.participants.filter((p) => p.status === 'joined');
  const waiting = meeting.participants.filter((p) => p.status === 'waiting');
  const unreadChat = activeTab === 'chat' ? 0 : Math.max(0, messages.length - lastReadCount);

  return (
    <KeyboardAvoidingView
      style={styles.flex1}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.headerRow}>
            <View style={styles.flex1}>
              <Text style={[styles.title, { color: colors.text }]}>{meeting.title}</Text>
              <Text style={[styles.subText, { color: colors.textMuted }]}>
                {meeting.code} · {elapsed} · {joined.length} in call
              </Text>
            </View>
            <Pressable
              style={[
                styles.smallBtn,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
              onPress={() => void handleShare()}
            >
              <Text style={[styles.smallBtnText, { color: colors.text }]}>Share</Text>
            </Pressable>
          </View>

          <View style={styles.mediaRow}>
            <Pressable
              style={[styles.mediaBtn, micEnabled ? styles.mediaOn : styles.mediaOff]}
              onPress={() => setMicEnabled((p) => !p)}
            >
              <Text style={styles.mediaText}>{micEnabled ? 'Mic On' : 'Muted'}</Text>
            </Pressable>
            <Pressable
              style={[styles.mediaBtn, camEnabled ? styles.mediaOn : styles.mediaOff]}
              onPress={() => setCamEnabled((p) => !p)}
            >
              <Text style={styles.mediaText}>{camEnabled ? 'Cam On' : 'Cam Off'}</Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.rosterRow,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
          >
            <View style={styles.flex1}>
              <Text style={[styles.rosterName, { color: colors.text }]}>LiveKit SFU Media</Text>
              <Text style={[styles.subText, { color: colors.textMuted }]}>
                {mediaToken
                  ? `Token ready (${Math.round(mediaToken.expiresInSeconds / 60)}m). Native video uses an Expo Dev Build.`
                  : mediaNotice ?? 'Requesting LiveKit room token...'}
              </Text>
            </View>
            <StatusBadge
              label={mediaToken ? 'Token Ready' : 'Setup'}
              tone={mediaToken ? 'success' : 'warning'}
            />
          </View>
        </View>

        {error && (
          <View
            style={[
              styles.alert,
              { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
            ]}
          >
            <Text style={{ color: colors.dangerText, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {notice && (
          <View
            style={[
              styles.alert,
              { backgroundColor: colors.successBg, borderColor: colors.successBorder },
            ]}
          >
            <Text style={{ color: colors.successText, fontSize: 13 }}>{notice}</Text>
          </View>
        )}

        <View
          style={[
            styles.tabs,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
        >
          <Pressable
            style={[
              styles.tab,
              activeTab === 'people' && { backgroundColor: colors.surface },
            ]}
            onPress={() => setActiveTab('people')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'people' ? colors.text : colors.textMuted },
              ]}
            >
              People ({joined.length}
              {waiting.length > 0 ? `+${waiting.length}` : ''})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tab,
              activeTab === 'chat' && { backgroundColor: colors.surface },
            ]}
            onPress={() => setActiveTab('chat')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'chat' ? colors.text : colors.textMuted },
              ]}
            >
              Chat{unreadChat > 0 ? ` (${unreadChat})` : ''}
            </Text>
          </Pressable>

          {meeting.can_manage && (
            <Pressable
              style={[
                styles.tab,
                activeTab === 'invite' && { backgroundColor: colors.surface },
              ]}
              onPress={() => setActiveTab('invite')}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'invite' ? colors.text : colors.textMuted },
                ]}
              >
                Invite
              </Text>
            </Pressable>
          )}
        </View>

        {activeTab === 'people' && (
          <>
            {meeting.can_manage && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {meeting.is_host ? 'Host Controls' : 'Co-Host Controls'}
                </Text>
                <View style={styles.hostRow}>
                  <Pressable
                    style={[
                      styles.hostBtn,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong },
                    ]}
                    disabled={busy}
                    onPress={() => void handleToggleLock()}
                  >
                    <Text style={[styles.hostBtnText, { color: colors.text }]}>
                      {meeting.is_locked ? 'Unlock Room' : 'Lock Room'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.hostBtn,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong },
                    ]}
                    disabled={busy}
                    onPress={() => void handleToggleWaitingRoom()}
                  >
                    <Text style={[styles.hostBtnText, { color: colors.text }]}>
                      {meeting.waiting_room_enabled ? 'Waiting: ON' : 'Waiting: OFF'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {meeting.can_manage && waiting.length > 0 && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.headerRow}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Waiting Room ({waiting.length})
                  </Text>
                  <Pressable
                    style={[styles.admitBtn, { backgroundColor: colors.accent }]}
                    disabled={busy}
                    onPress={() => void handleAdmitAll()}
                  >
                    <Text style={styles.admitText}>Admit All</Text>
                  </Pressable>
                </View>

                {waiting.map((p) => (
                  <View
                    key={p.id}
                    style={[
                      styles.rosterRow,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.flex1}>
                      <Text style={[styles.rosterName, { color: colors.text }]}>
                        {p.full_name || p.email}
                      </Text>
                      <Text style={[styles.subText, { color: colors.textMuted }]}>
                        Waiting to join
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.admitBtn, { backgroundColor: colors.accent }]}
                      disabled={busy}
                      onPress={() => void handleAdmit(p.user_id)}
                    >
                      <Text style={styles.admitText}>Admit</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.denyBtn,
                        { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
                      ]}
                      disabled={busy}
                      onPress={() => void handleRemove(p.user_id)}
                    >
                      <Text style={[styles.denyText, { color: colors.dangerText }]}>Deny</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <View
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Participants ({joined.length})
              </Text>
              {joined.map((p) => {
                const isMe = p.user_id === user?.id;
                const label = p.full_name || p.email;
                const isPrimaryHost = p.user_id === meeting.host_id;
                return (
                  <View
                    key={p.id}
                    style={[
                      styles.rosterCardCol,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.headerRow}>
                      <View style={styles.flex1}>
                        <Text style={[styles.rosterName, { color: colors.text }]}>
                          {label} {isMe ? '(You)' : ''}
                        </Text>
                        <Text style={[styles.subText, { color: colors.textMuted }]}>
                          {isPrimaryHost
                            ? 'Host'
                            : p.role === 'co_host'
                              ? 'Co-Host'
                              : 'Participant'}
                        </Text>
                      </View>
                      {isPrimaryHost ? (
                        <StatusBadge label="Host" tone="success" />
                      ) : p.role === 'co_host' ? (
                        <StatusBadge label="Co-Host" tone="warning" />
                      ) : null}
                    </View>

                    {meeting.can_manage && !isMe && !isPrimaryHost && (
                      <View style={styles.actionChipsRow}>
                        <Pressable
                          style={[
                            styles.chipBtn,
                            { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                          ]}
                          disabled={busy}
                          onPress={() => void handleMute(p.user_id, label)}
                        >
                          <Text style={[styles.chipText, { color: colors.text }]}>Mute</Text>
                        </Pressable>
                        {meeting.is_host && (
                          <Pressable
                            style={[
                              styles.chipBtn,
                              { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                            ]}
                            disabled={busy}
                            onPress={() => void handleToggleCoHost(p.user_id, p.role)}
                          >
                            <Text style={[styles.chipText, { color: colors.text }]}>
                              {p.role === 'co_host' ? 'Unset Co-Host' : 'Make Co-Host'}
                            </Text>
                          </Pressable>
                        )}
                        <Pressable
                          style={[
                            styles.denyBtn,
                            { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
                          ]}
                          disabled={busy}
                          onPress={() => void handleRemove(p.user_id)}
                        >
                          <Text style={[styles.denyText, { color: colors.dangerText }]}>
                            Remove
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {activeTab === 'chat' && (
          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>In-Meeting Chat</Text>

            {messages.length === 0 ? (
              <Text style={[styles.subText, { color: colors.textMuted }]}>
                No messages yet. Say hello to everyone in the meeting!
              </Text>
            ) : (
              <View style={styles.chatList}>
                {messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.chatBubble,
                        isMine
                          ? {
                              backgroundColor: colors.accentSoft,
                              borderColor: colors.accentBorder,
                              alignSelf: 'flex-end',
                            }
                          : {
                              backgroundColor: colors.surfaceElevated,
                              borderColor: colors.border,
                              alignSelf: 'flex-start',
                            },
                      ]}
                    >
                      <Text style={[styles.chatMeta, { color: colors.textSubtle }]}>
                        {isMine ? 'You' : msg.sender_name || msg.sender_email} ·{' '}
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      <Text style={[styles.chatText, { color: colors.text }]}>{msg.content}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.chatInputRow}>
              <TextInput
                style={[
                  styles.chatInput,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.borderStrong,
                    color: colors.text,
                  },
                ]}
                value={chatText}
                onChangeText={setChatText}
                placeholder="Type a message..."
                placeholderTextColor={colors.placeholder}
              />
              <Pressable
                style={[
                  styles.sendBtn,
                  { backgroundColor: colors.accent },
                  (sendingChat || !chatText.trim()) && styles.disabledBtn,
                ]}
                disabled={sendingChat || !chatText.trim()}
                onPress={() => void handleSendChat()}
              >
                <Text style={styles.admitText}>Send</Text>
              </Pressable>
            </View>
          </View>
        )}

        {activeTab === 'invite' && meeting.can_manage && (
          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Invite by Email</Text>
            <View style={styles.chatInputRow}>
              <TextInput
                style={[
                  styles.chatInput,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.borderStrong,
                    color: colors.text,
                  },
                ]}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="teammate@example.com"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Pressable
                style={[
                  styles.sendBtn,
                  { backgroundColor: colors.accent },
                  (sendingInvite || !inviteEmail.trim()) && styles.disabledBtn,
                ]}
                disabled={sendingInvite || !inviteEmail.trim()}
                onPress={() => void handleSendInvite()}
              >
                <Text style={styles.admitText}>{sendingInvite ? '...' : 'Invite'}</Text>
              </Pressable>
            </View>

            {sentInvitations.map((inv) => (
              <View
                key={inv.id}
                style={[
                  styles.rosterRow,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <View style={styles.flex1}>
                  <Text style={[styles.rosterName, { color: colors.text }]}>
                    {inv.invitee_email}
                  </Text>
                  <Text style={[styles.subText, { color: colors.textMuted }]}>Invitation sent</Text>
                </View>
                <StatusBadge
                  label={inv.status}
                  tone={
                    inv.status === 'accepted'
                      ? 'success'
                      : inv.status === 'declined'
                        ? 'danger'
                        : 'warning'
                  }
                />
              </View>
            ))}
          </View>
        )}

        <View style={styles.exitRow}>
          <Pressable
            style={[
              styles.leaveBtn,
              { backgroundColor: colors.surface, borderColor: colors.borderStrong },
            ]}
            disabled={busy}
            onPress={() => void handleLeave()}
          >
            <Text style={[styles.leaveText, { color: colors.text }]}>Leave Meeting</Text>
          </Pressable>

          {meeting.is_host && (
            <Pressable
              style={styles.endAllBtn}
              disabled={busy}
              onPress={() => void handleEndForAll()}
            >
              <Text style={styles.endAllText}>End for All</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    gap: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  subText: {
    fontSize: 12,
    marginTop: 2,
  },
  smallBtn: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
  },
  smallBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mediaBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: 'center',
  },
  mediaOn: {
    backgroundColor: '#1e293b',
  },
  mediaOff: {
    backgroundColor: '#dc2626',
  },
  mediaText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  hostRow: {
    flexDirection: 'row',
    gap: 10,
  },
  hostBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  hostBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 11,
    borderWidth: 1,
  },
  rosterCardCol: {
    padding: 12,
    borderRadius: 11,
    borderWidth: 1,
    gap: 8,
  },
  actionChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipBtn: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rosterName: {
    fontSize: 14,
    fontWeight: '600',
  },
  admitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  admitText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  denyBtn: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  denyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chatList: {
    gap: 8,
  },
  chatBubble: {
    padding: 10,
    borderRadius: 11,
    borderWidth: 1,
    maxWidth: '90%',
  },
  chatMeta: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
  },
  chatText: {
    fontSize: 14,
    lineHeight: 19,
  },
  chatInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendBtn: {
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  exitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  leaveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  leaveText: {
    fontSize: 14,
    fontWeight: '700',
  },
  endAllBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  endAllText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  alert: {
    padding: 12,
    borderRadius: 11,
    borderWidth: 1,
  },
});
