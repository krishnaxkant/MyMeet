import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type RefObject,
} from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  CamSymbol,
  ChatSymbol,
  EndCallSymbol,
  FlipCamSymbol,
  InviteSymbol,
  MicSymbol,
  MoreDotsSymbol,
  PeopleSymbol,
  SpeakerSymbol,
} from '../components/MediaIcons';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  admitAllParticipants,
  admitParticipant,
  buildMeetingInviteUrl,
  buildMeetingShareMessage,
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
import { buildLiveKitStageHtml } from '../utils/livekitStageHtml';
import {
  NativeLiveKitStage,
  type NativeStageEvent,
  type NativeStageHandle,
} from '../components/NativeLiveKitStage';
import { isNativeLiveKitAvailable } from '../utils/nativeLiveKit';

type SheetTab = 'more' | 'people' | 'chat' | 'invite' | 'leave' | null;

interface WebViewHandle {
  injectJavaScript: (script: string) => void;
  postMessage?: (data: string) => void;
}

const StageWebView = WebView as unknown as ComponentType<Record<string, unknown>>;
const ORIGIN_WHITELIST = ['*'];

interface MemoizedStageWebViewProps {
  webViewRef: RefObject<WebViewHandle | null>;
  source: { html: string; baseUrl: string };
  onMessage: (event: { nativeEvent?: { data?: string } }) => void;
}

/**
 * Memoized so 1-second elapsed timer ticks and 2.5-second room polls NEVER re-render
 * react-native-webview (which otherwise rebuilds `newSource` and calls `loadDataWithBaseURL`,
 * reloading the entire WebView and killing active Android mic/camera tracks every few seconds).
 */
const MemoizedStageWebView = memo(function MemoizedStageWebView({
  webViewRef,
  source,
  onMessage,
}: MemoizedStageWebViewProps) {
  return (
    <StageWebView
      ref={webViewRef}
      source={source}
      style={styles.stageWebView}
      originWhitelist={ORIGIN_WHITELIST}
      androidLayerType="hardware"
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="grant"
      mixedContentMode="compatibility"
      onMessage={onMessage}
      scrollEnabled={false}
    />
  );
});

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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function MeetingRoomScreen({
  code,
  initialMicEnabled,
  initialCamEnabled,
  onExit,
  onBackToLobby,
  onOpenHistory,
}: MeetingRoomScreenProps) {
  const { session, user, profile } = useAuth();
  const { colors } = useTheme();
  const useNativeLiveKit = useMemo(() => isNativeLiveKitAvailable(), []);
  const webViewRef = useRef<WebViewHandle | null>(null);
  const nativeStageRef = useRef<NativeStageHandle | null>(null);

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [micEnabled, setMicEnabled] = useState(initialMicEnabled);
  const [camEnabled, setCamEnabled] = useState(initialCamEnabled);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Record<string, string>>({});
  const [focusFullscreen, setFocusFullscreen] = useState(false);

  const [permissionsReady, setPermissionsReady] = useState(Platform.OS !== 'android');
  const [permissionsDenied, setPermissionsDenied] = useState(false);
  const [permDetail, setPermDetail] = useState<string>('');
  const [mediaToken, setMediaToken] = useState<MeetingMediaToken | null>(null);
  const [mediaConnected, setMediaConnected] = useState(false);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState('00:00');
  const speakerMutedRef = useRef(false);
  speakerMutedRef.current = speakerMuted;

  const [activeSheet, setActiveSheet] = useState<SheetTab>(null);
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [lastReadCount, setLastReadCount] = useState(0);

  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sentInvitations, setSentInvitations] = useState<MeetingInvitation[]>([]);

  const myDisplayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    'You';

  const showTempNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((prev) => (prev === msg ? null : prev)), 3500);
  };

  const requestAndroidMediaPermissions = useCallback(async (openSettingsIfDenied = false) => {
    if (Platform.OS !== 'android') {
      setPermissionsReady(true);
      setPermissionsDenied(false);
      return;
    }
    try {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ]);
      const micGranted =
        results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
          PermissionsAndroid.RESULTS.GRANTED ||
        (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO));
      const camGranted =
        results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED ||
        (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA));

      setPermDetail(`OS Mic: ${micGranted ? 'OK' : 'DENIED'} · Cam: ${camGranted ? 'OK' : 'DENIED'}`);
      const denied = !micGranted || !camGranted;
      setPermissionsDenied(denied);
      if (denied && openSettingsIfDenied) {
        await Linking.openSettings().catch(() => {});
      }
    } catch {
      setPermissionsDenied(true);
      if (openSettingsIfDenied) {
        await Linking.openSettings().catch(() => {});
      }
    } finally {
      setPermissionsReady(true);
    }
  }, []);

  // Request Android runtime mic & camera permissions BEFORE mounting live WebView stage
  useEffect(() => {
    void requestAndroidMediaPermissions(false);
    if (Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void requestAndroidMediaPermissions(false);
      }
    });
    return () => sub.remove();
  }, [requestAndroidMediaPermissions]);

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

  // Step-by-step Android hardware/swipe Back inside active meeting:
  // 1) If a sub-sheet (people/chat/invite) is open, go back to 'more' or close it
  // 2) If 'more' or 'leave' sheet is open, close it
  // 3) If on main stage, open Leave/End confirmation sheet (never abruptly kill the call!)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeSheet === 'people' || activeSheet === 'chat' || activeSheet === 'invite') {
        setActiveSheet('more');
        return true;
      }
      if (activeSheet !== null) {
        setActiveSheet(null);
        return true;
      }
      setActiveSheet('leave');
      return true;
    });
    return () => sub.remove();
  }, [activeSheet]);

  useEffect(() => {
    if (activeSheet === 'chat') {
      setLastReadCount(messages.length);
    }
  }, [activeSheet, messages.length]);

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

  // Build avatar map from meeting participants + local profile
  const avatarsRecord = useMemo(() => {
    const map: Record<string, string> = {};
    if (meeting?.participants) {
      for (const p of meeting.participants) {
        if (p.avatar_url) {
          map[p.user_id] = p.avatar_url;
        }
      }
    }
    if (user?.id && profile?.avatar_url) {
      map[user.id] = profile.avatar_url;
    }
    return map;
  }, [meeting?.participants, user?.id, profile?.avatar_url]);

  const initialConfigRef = useRef({
    mic: initialMicEnabled,
    cam: initialCamEnabled,
    name: myDisplayName,
    avatars: {} as Record<string, string>,
  });
  if (
    Object.keys(initialConfigRef.current.avatars).length === 0 &&
    Object.keys(avatarsRecord).length > 0
  ) {
    initialConfigRef.current.avatars = avatarsRecord;
  }

  // Build HTML strictly ONCE per mediaToken so WebView NEVER reloads mid-meeting (Expo Go fallback)
  const stageHtml = useMemo(() => {
    if (useNativeLiveKit || !mediaToken) return null;
    return buildLiveKitStageHtml({
      url: mediaToken.url,
      token: mediaToken.token,
      initialMic: initialConfigRef.current.mic,
      initialCam: initialConfigRef.current.cam,
      localName: initialConfigRef.current.name,
      avatars: initialConfigRef.current.avatars,
    });
  }, [mediaToken, useNativeLiveKit]);

  const stageSource = useMemo(
    () => (stageHtml ? { html: stageHtml, baseUrl: 'https://localhost' } : null),
    [stageHtml],
  );

  const cmdSeqRef = useRef(0);
  const sendStageCommand = useCallback(
    (payload: Record<string, unknown>) => {
      if (useNativeLiveKit) {
        const stage = nativeStageRef.current;
        if (!stage) return;
        if (payload.type === 'setMic') {
          stage.setMic(Boolean(payload.value));
        } else if (payload.type === 'setCam') {
          stage.setCam(Boolean(payload.value));
        } else if (payload.type === 'flipCam') {
          stage.flipCam();
        } else if (payload.type === 'setSpeaker') {
          stage.setSpeakerMuted(Boolean(payload.value));
        } else if (payload.type === 'setHand') {
          stage.setHand(Boolean(payload.value));
        } else if (payload.type === 'disconnect') {
          stage.disconnect();
        }
        return;
      }

      cmdSeqRef.current += 1;
      const envelope = { ...payload, cmdId: `c-${cmdSeqRef.current}` };
      const serialized = JSON.stringify(envelope);
      try {
        webViewRef.current?.postMessage?.(serialized);
      } catch {
        // Fall back to injectJavaScript below
      }
      const js = `window.handleNativeCommand && window.handleNativeCommand(${serialized}); true;`;
      webViewRef.current?.injectJavaScript(js);
    },
    [useNativeLiveKit],
  );

  // Push updated participant profile photos ONLY when the avatar map actually changes (WebView fallback)
  const lastSentAvatarsJsonRef = useRef<string>('');
  useEffect(() => {
    if (useNativeLiveKit || !mediaConnected || Object.keys(avatarsRecord).length === 0) return;
    const serialized = JSON.stringify(avatarsRecord);
    if (serialized === lastSentAvatarsJsonRef.current) return;
    lastSentAvatarsJsonRef.current = serialized;
    sendStageCommand({ type: 'updateAvatars', avatars: avatarsRecord });
  }, [useNativeLiveKit, mediaConnected, avatarsRecord, sendStageCommand]);

  const handleToggleMic = () => {
    const next = !micEnabled;
    setMicEnabled(next);
    sendStageCommand({ type: 'setMic', value: next });
  };

  const handleToggleCam = () => {
    const next = !camEnabled;
    setCamEnabled(next);
    sendStageCommand({ type: 'setCam', value: next });
  };

  const handleToggleSpeaker = () => {
    const next = !speakerMuted;
    setSpeakerMuted(next);
    sendStageCommand({ type: 'setSpeaker', value: next });
  };

  const handleToggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    sendStageCommand({ type: 'setHand', value: next });
  };

  const processStageEvent = (msg: NativeStageEvent) => {
    if (msg.type === 'connected') {
      setMediaConnected(true);
      setMediaNotice(null);
    } else if (msg.type === 'disconnected') {
      setMediaConnected(false);
    } else if (msg.type === 'mediaState') {
      if (typeof msg.micEnabled === 'boolean') setMicEnabled(msg.micEnabled);
      if (typeof msg.camEnabled === 'boolean') setCamEnabled(msg.camEnabled);
      if (msg.warning) {
        setMediaNotice(msg.warning);
      } else {
        setMediaNotice(null);
      }
    } else if (msg.type === 'handEvent' && msg.identity) {
      const who = msg.name || 'A participant';
      setRaisedHands((prev) => {
        const next = { ...prev };
        if (msg.raised) {
          next[msg.identity!] = who;
        } else {
          delete next[msg.identity!];
        }
        return next;
      });
      if (msg.raised) {
        showTempNotice(`✋ ${who} raised their hand`);
      }
    } else if (msg.type === 'error' && msg.message) {
      setMediaNotice(msg.message);
    }
  };

  const handleStageMessage = (event: { nativeEvent?: { data?: string } }) => {
    try {
      const raw = event.nativeEvent?.data;
      if (!raw) return;
      const msg = JSON.parse(raw) as NativeStageEvent;
      if (msg && msg.type) {
        processStageEvent(msg);
      }
    } catch {
      // Ignore malformed stage messages
    }
  };

  const stageMessageHandlerRef = useRef(handleStageMessage);
  stageMessageHandlerRef.current = handleStageMessage;
  const stableOnStageMessage = useCallback(
    (event: { nativeEvent?: { data?: string } }) => {
      stageMessageHandlerRef.current(event);
    },
    [],
  );

  const nativeStageEventHandlerRef = useRef(processStageEvent);
  nativeStageEventHandlerRef.current = processStageEvent;
  const stableOnNativeStageEvent = useCallback((event: NativeStageEvent) => {
    nativeStageEventHandlerRef.current(event);
  }, []);

  const handleShare = async () => {
    if (!meeting) return;
    await Share.share({
      title: `Join ${meeting.title} on MyMeet`,
      message: buildMeetingShareMessage(meeting.title, meeting.code),
      url: buildMeetingInviteUrl(meeting.code),
    }).catch(() => {});
  };

  const handleLeave = async () => {
    setActiveSheet(null);
    sendStageCommand({ type: 'disconnect' });
    if (session?.access_token && meeting) {
      setBusy(true);
      await leaveMeeting(session.access_token, meeting.code).catch(() => {});
    }
    onExit();
  };

  const handleEndForAll = async () => {
    if (!session?.access_token || !meeting) return;
    setActiveSheet(null);
    sendStageCommand({ type: 'disconnect' });
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
        <Text style={[styles.subText, { color: colors.textMuted }]}>Entering meeting room...</Text>
      </View>
    );
  }

  if (!meeting || meeting.status === 'ended') {
    return (
      <View style={styles.center}>
        <Text style={[styles.endedTitle, { color: colors.text }]}>
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
            styles.outlineBtn,
            { backgroundColor: colors.surface, borderColor: colors.borderStrong },
          ]}
          onPress={onExit}
        >
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  const joined = meeting.participants.filter((p) => p.status === 'joined');
  const waiting = meeting.participants.filter((p) => p.status === 'waiting');
  const unreadChat = activeSheet === 'chat' ? 0 : Math.max(0, messages.length - lastReadCount);
  const moreBadgeCount = unreadChat + (meeting.can_manage ? waiting.length : 0);

  return (
    <View style={styles.roomShell}>
      {/* Waiting Room Quick Banner for Host/Co-Host */}
      {meeting.can_manage && waiting.length > 0 && (
        <Pressable style={styles.waitingAlertBar} onPress={() => setActiveSheet('people')}>
          <Text style={styles.waitingAlertText}>
            {waiting.length} {waiting.length === 1 ? 'person is' : 'people are'} waiting to join
          </Text>
          <Text style={styles.waitingAlertAction}>Review</Text>
        </Pressable>
      )}

      {permissionsDenied && (
        <Pressable
          style={styles.waitingAlertBar}
          onPress={() => void requestAndroidMediaPermissions(true)}
        >
          <Text style={styles.waitingAlertText}>
            Allow Camera & Mic in Android Settings ({permDetail || 'denied'})
          </Text>
          <Text style={styles.waitingAlertAction}>Open Settings</Text>
        </Pressable>
      )}

      {notice && (
        <View style={styles.toastBar}>
          <Text style={styles.toastText}>{notice}</Text>
        </View>
      )}

      {(error || mediaNotice) && (
        <View style={styles.errorBar}>
          <Text style={styles.errorBarText}>{error || mediaNotice}</Text>
        </View>
      )}

      {/* Full-Height Video Stage (Zero Top Card Clutter) */}
      <View style={styles.stageContainer}>
        {/* Tiny unobtrusive corner pill floating inside top-left (takes 0px of stage height) */}
        <View style={styles.floatingCornerPill} pointerEvents="none">
          <View style={[styles.liveDot, !mediaConnected && styles.liveDotWarn]} />
          <Text style={styles.floatingCornerTitle} numberOfLines={1}>
            {meeting.title}
          </Text>
          <Text style={styles.floatingCornerTime}>· {elapsed}</Text>
        </View>

        {/* Top-Right Floating Camera Flip Button (symmetrical with top-left pill) */}
        {camEnabled && (
          <Pressable
            style={styles.floatingFlipBtn}
            onPress={() => sendStageCommand({ type: 'flipCam' })}
            accessibilityLabel="Switch front and back camera"
          >
            <FlipCamSymbol color="#FFFFFF" />
          </Pressable>
        )}

        {useNativeLiveKit && mediaToken && permissionsReady ? (
          <NativeLiveKitStage
            ref={nativeStageRef}
            url={mediaToken.url}
            token={mediaToken.token}
            initialMic={initialConfigRef.current.mic}
            initialCam={initialConfigRef.current.cam}
            localName={initialConfigRef.current.name}
            avatars={avatarsRecord}
            onStageEvent={stableOnNativeStageEvent}
          />
        ) : !useNativeLiveKit && stageSource && permissionsReady ? (
          <MemoizedStageWebView
            webViewRef={webViewRef}
            source={stageSource}
            onMessage={stableOnStageMessage}
          />
        ) : (
          /* Fallback native participant blocks grid with Profile Photos while connecting */
          <ScrollView contentContainerStyle={styles.fallbackBlocksGrid}>
            {joined.map((p) => {
              const isMe = p.user_id === user?.id;
              const name = p.full_name || p.email;
              const photo = p.avatar_url || (isMe ? profile?.avatar_url : null);
              return (
                <View key={p.id} style={[styles.fallbackTile, isMe && styles.fallbackTileMe]}>
                  <View style={styles.fallbackAvatar}>
                    {photo ? (
                      <Image source={{ uri: photo }} style={styles.fallbackAvatarImg} />
                    ) : (
                      <Text style={styles.fallbackAvatarText}>{getInitials(name)}</Text>
                    )}
                  </View>
                  <View style={styles.fallbackFooter}>
                    <Text style={styles.fallbackName} numberOfLines={1}>
                      {isMe ? `${name} (You)` : name}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Ultra-Clean 4-Button Minimal Control Dock (Mic, Cam, 3-Dots, End) */}
      <View style={styles.controlDock}>
        <Pressable
          style={[styles.dockCircleBtn, !micEnabled && styles.dockBtnDanger]}
          onPress={handleToggleMic}
          accessibilityLabel={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          <MicSymbol color="#FFFFFF" muted={!micEnabled} />
        </Pressable>

        <Pressable
          style={[styles.dockCircleBtn, !camEnabled && styles.dockBtnDanger]}
          onPress={handleToggleCam}
          accessibilityLabel={camEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          <CamSymbol color="#FFFFFF" muted={!camEnabled} />
        </Pressable>

        <Pressable
          style={[styles.dockCircleBtn, activeSheet === 'more' && styles.dockBtnAccent]}
          onPress={() => setActiveSheet('more')}
          accessibilityLabel="More meeting options"
        >
          <MoreDotsSymbol color="#FFFFFF" />
          {moreBadgeCount > 0 && (
            <View style={[styles.dockBadge, styles.dockBadgeAlert]}>
              <Text style={styles.dockBadgeText}>{moreBadgeCount}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={styles.dockEndCircle}
          disabled={busy}
          onPress={() => (meeting.is_host ? setActiveSheet('leave') : void handleLeave())}
          accessibilityLabel="Leave or end meeting"
        >
          <EndCallSymbol color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Slide-Up Bottom Sheet for People / Host Controls / Chat / Invite / Leave */}
      <Modal
        visible={activeSheet !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveSheet(null)}
      >
        <KeyboardAvoidingView
          style={styles.sheetOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.sheetBackdropTap} onPress={() => setActiveSheet(null)} />
          <View
            style={[
              styles.sheetCard,
              { backgroundColor: colors.surface, borderColor: colors.borderStrong },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {activeSheet === 'more'
                  ? `Options · ${meeting.code}`
                  : activeSheet === 'people'
                    ? `People (${joined.length})`
                    : activeSheet === 'chat'
                      ? 'In-Meeting Chat'
                      : activeSheet === 'invite'
                        ? 'Invite by Email'
                        : 'Leave or End Meeting'}
              </Text>
              <Pressable
                style={[
                  styles.closeSheetBtn,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
                onPress={() => setActiveSheet(null)}
              >
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>Close</Text>
              </Pressable>
            </View>

            {activeSheet === 'more' ? (
              <View style={styles.moreGrid}>
                <Pressable
                  style={[
                    styles.moreTile,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  ]}
                  onPress={() => setActiveSheet('people')}
                >
                  <PeopleSymbol color={colors.text} />
                  <Text style={[styles.moreTileLabel, { color: colors.text }]}>
                    People ({joined.length}
                    {waiting.length > 0 ? `+${waiting.length}` : ''})
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.moreTile,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  ]}
                  onPress={() => setActiveSheet('chat')}
                >
                  <ChatSymbol color={colors.text} />
                  <Text style={[styles.moreTileLabel, { color: colors.text }]}>
                    Chat{unreadChat > 0 ? ` (${unreadChat})` : ''}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.moreTile,
                    {
                      backgroundColor: handRaised ? 'rgba(245, 158, 11, 0.2)' : colors.surfaceElevated,
                      borderColor: handRaised ? '#F59E0B' : colors.border,
                    },
                  ]}
                  onPress={() => {
                    handleToggleHand();
                    setActiveSheet(null);
                  }}
                >
                  <Text style={styles.handEmoji}>✋</Text>
                  <Text style={[styles.moreTileLabel, { color: colors.text }]}>
                    {handRaised ? 'Lower Hand' : 'Raise Hand'}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.moreTile,
                    {
                      backgroundColor: speakerMuted ? 'rgba(245, 158, 11, 0.2)' : colors.surfaceElevated,
                      borderColor: speakerMuted ? '#F59E0B' : colors.border,
                    },
                  ]}
                  onPress={() => {
                    handleToggleSpeaker();
                    setActiveSheet(null);
                  }}
                >
                  <SpeakerSymbol color={colors.text} muted={speakerMuted} />
                  <Text style={[styles.moreTileLabel, { color: colors.text }]}>
                    {speakerMuted ? 'Speaker Off' : 'Speaker On'}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.moreTile,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    setActiveSheet(null);
                    void handleShare();
                  }}
                >
                  <InviteSymbol color={colors.text} />
                  <Text style={[styles.moreTileLabel, { color: colors.text }]}>Share Link</Text>
                </Pressable>

                {meeting.can_manage && (
                  <Pressable
                    style={[
                      styles.moreTile,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                    ]}
                    onPress={() => setActiveSheet('invite')}
                  >
                    <InviteSymbol color={colors.accent} />
                    <Text style={[styles.moreTileLabel, { color: colors.text }]}>Invite Email</Text>
                  </Pressable>
                )}
              </View>
            ) : activeSheet === 'leave' ? (
              <View style={styles.leaveSheetBody}>
                {meeting.is_host && (
                  <Pressable
                    style={styles.endAllBtn}
                    disabled={busy}
                    onPress={() => void handleEndForAll()}
                  >
                    <Text style={styles.endAllBtnText}>End Meeting for Everyone</Text>
                  </Pressable>
                )}
                <Pressable
                  style={[
                    meeting.is_host ? styles.justLeaveBtn : styles.endAllBtn,
                    meeting.is_host && {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.borderStrong,
                    },
                  ]}
                  disabled={busy}
                  onPress={() => void handleLeave()}
                >
                  <Text
                    style={
                      meeting.is_host
                        ? { color: colors.text, fontSize: 14, fontWeight: '700' }
                        : styles.endAllBtnText
                    }
                  >
                    {meeting.is_host ? 'Just Leave Meeting' : 'Leave Meeting'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.justLeaveBtn,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  ]}
                  onPress={() => setActiveSheet(null)}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 13.5, fontWeight: '700' }}>
                    Stay in Meeting
                  </Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {activeSheet === 'people' && (
                  <>
                    {meeting.can_manage && (
                      <View style={styles.hostRow}>
                        <Pressable
                          style={[
                            styles.hostBtn,
                            {
                              backgroundColor: colors.surfaceElevated,
                              borderColor: colors.borderStrong,
                            },
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
                            {
                              backgroundColor: colors.surfaceElevated,
                              borderColor: colors.borderStrong,
                            },
                          ]}
                          disabled={busy}
                          onPress={() => void handleToggleWaitingRoom()}
                        >
                          <Text style={[styles.hostBtnText, { color: colors.text }]}>
                            {meeting.waiting_room_enabled ? 'Waiting: ON' : 'Waiting: OFF'}
                          </Text>
                        </Pressable>
                      </View>
                    )}

                    {meeting.can_manage && waiting.length > 0 && (
                      <View style={styles.sheetSection}>
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
                              {
                                backgroundColor: colors.surfaceElevated,
                                borderColor: colors.border,
                              },
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
                                {
                                  backgroundColor: colors.dangerBg,
                                  borderColor: colors.dangerBorder,
                                },
                              ]}
                              disabled={busy}
                              onPress={() => void handleRemove(p.user_id)}
                            >
                              <Text style={[styles.denyText, { color: colors.dangerText }]}>
                                Deny
                              </Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.sheetSection}>
                      {joined.map((p) => {
                        const isMe = p.user_id === user?.id;
                        const label = p.full_name || p.email;
                        const isPrimaryHost = p.user_id === meeting.host_id;
                        const isHandUp = Boolean(raisedHands[p.user_id] || (isMe && handRaised));
                        return (
                          <View
                            key={p.id}
                            style={[
                              styles.rosterCardCol,
                              {
                                backgroundColor: colors.surfaceElevated,
                                borderColor: colors.border,
                              },
                            ]}
                          >
                            <View style={styles.headerRow}>
                              <View style={styles.flex1}>
                                <Text style={[styles.rosterName, { color: colors.text }]}>
                                  {label} {isMe ? '(You)' : ''} {isHandUp ? '✋' : ''}
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
                                    {
                                      backgroundColor: colors.surface,
                                      borderColor: colors.borderStrong,
                                    },
                                  ]}
                                  disabled={busy}
                                  onPress={() => void handleMute(p.user_id, label)}
                                >
                                  <Text style={[styles.chipText, { color: colors.text }]}>
                                    Mute
                                  </Text>
                                </Pressable>
                                {meeting.is_host && (
                                  <Pressable
                                    style={[
                                      styles.chipBtn,
                                      {
                                        backgroundColor: colors.surface,
                                        borderColor: colors.borderStrong,
                                      },
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
                                    {
                                      backgroundColor: colors.dangerBg,
                                      borderColor: colors.dangerBorder,
                                    },
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

                {activeSheet === 'chat' && (
                  <>
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
                              <Text style={[styles.chatText, { color: colors.text }]}>
                                {msg.content}
                              </Text>
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
                  </>
                )}

                {activeSheet === 'invite' && meeting.can_manage && (
                  <>
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
                          {
                            backgroundColor: colors.surfaceElevated,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.rosterName, { color: colors.text, flex: 1 }]}>
                          {inv.invitee_email}
                        </Text>
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
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  endedTitle: { fontSize: 22, fontWeight: '800' },
  primaryButton: {
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  outlineBtn: {
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },

  // Full-screen Dark Google-Meet Room Shell
  roomShell: {
    flex: 1,
    backgroundColor: '#070B14',
  },
  roomTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  topRightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roomTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
  },
  roomSub: {
    color: '#94A3B8',
    fontSize: 11.5,
    marginTop: 2,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  liveChipConnecting: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  liveDotWarn: {
    backgroundColor: '#F59E0B',
  },
  liveChipText: {
    color: '#E2E8F0',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  topShareBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  topShareText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  waitingAlertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.45)',
  },
  waitingAlertText: { color: '#DBEAFE', fontSize: 12, fontWeight: '600' },
  waitingAlertAction: { color: '#60A5FA', fontSize: 12, fontWeight: '800' },
  toastBar: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.48)',
  },
  toastText: { color: '#FDE68A', fontSize: 12.5, fontWeight: '700' },
  errorBar: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  errorBarText: { color: '#FCA5A5', fontSize: 12, fontWeight: '600' },

  // Live Video Blocks Stage
  stageContainer: {
    flex: 1,
    backgroundColor: '#070B14',
    position: 'relative',
  },
  exitFocusPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15, 23, 42, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageWebView: {
    flex: 1,
    backgroundColor: '#070B14',
  },
  fallbackBlocksGrid: {
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fallbackTile: {
    width: '48%',
    minHeight: 170,
    borderRadius: 18,
    backgroundColor: '#111827',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  fallbackTileMe: {
    borderColor: 'rgba(59, 130, 246, 0.55)',
  },
  fallbackAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fallbackAvatarImg: {
    width: '100%',
    height: '100%',
  },
  fallbackAvatarText: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  fallbackFooter: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(7, 11, 20, 0.78)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  fallbackName: { color: '#F8FAFC', fontSize: 11.5, fontWeight: '700' },

  // Symbol-Only Circular Control Dock
  controlDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  dockCircleBtn: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.11)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  dockBtnDanger: {
    backgroundColor: '#DC2626',
    borderColor: '#EF4444',
  },
  dockBtnWarn: {
    backgroundColor: '#B45309',
    borderColor: '#D97706',
  },
  dockBtnHand: {
    backgroundColor: '#F59E0B',
    borderColor: '#FBBF24',
  },
  dockEndCircle: {
    width: 48,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  handEmoji: { fontSize: 18 },
  dockBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockBadgeAlert: {
    backgroundColor: '#EF4444',
  },
  dockBadgeText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' },

  // Slide-Up Bottom Sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetBackdropTap: { flex: 1 },
  sheetCard: {
    maxHeight: '78%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 18,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800' },
  closeSheetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
  },
  sheetScroll: { maxHeight: 440 },
  sheetScrollContent: { gap: 12, paddingBottom: 16 },
  sheetSection: { gap: 8 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800' },
  subText: { fontSize: 12 },
  hostRow: { flexDirection: 'row', gap: 8 },
  hostBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  hostBtnText: { fontSize: 12.5, fontWeight: '700' },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  rosterCardCol: {
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  rosterName: { fontSize: 14, fontWeight: '700' },
  actionChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: { fontSize: 11.5, fontWeight: '700' },
  admitBtn: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8 },
  admitText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  denyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  denyText: { fontSize: 11.5, fontWeight: '700' },
  chatList: { gap: 8 },
  chatBubble: {
    maxWidth: '88%',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
  },
  chatMeta: { fontSize: 10.5, fontWeight: '600' },
  chatText: { fontSize: 13.5, lineHeight: 19 },
  chatInputRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  sendBtn: {
    paddingHorizontal: 16,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: { opacity: 0.45 },
  leaveSheetBody: { gap: 10, paddingBottom: 12 },
  endAllBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  endAllBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  justLeaveBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  floatingCornerPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(7, 11, 20, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxWidth: '72%',
  },
  floatingCornerTitle: {
    color: '#F1F5F9',
    fontSize: 11.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  floatingCornerTime: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  floatingFlipBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockBtnAccent: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  moreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 14,
  },
  moreTile: {
    width: '47.5%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  moreTileLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
  },
});
