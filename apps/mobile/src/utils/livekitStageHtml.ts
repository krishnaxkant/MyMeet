export interface LiveKitStageConfig {
  url: string;
  token: string;
  initialMic: boolean;
  initialCam: boolean;
  localName: string;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

export function buildLiveKitStageHtml(config: LiveKitStageConfig): string {
  const cfgJson = safeJson(config);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: #070B14;
      color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      -webkit-user-select: none;
      user-select: none;
    }
    #app {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 10px;
      gap: 10px;
      overflow-y: auto;
    }
    #status-bar {
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 12px;
      background: rgba(245, 158, 11, 0.14);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #FDE68A;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }
    #status-bar.show { display: flex; }
    #audio-unlock-btn {
      display: none;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid rgba(56, 189, 248, 0.55);
      background: rgba(56, 189, 248, 0.16);
      color: #7DD3FC;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      flex-shrink: 0;
    }
    #audio-unlock-btn.show { display: flex; }
    #recording-banner {
      display: none;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 12px;
      background: rgba(220, 38, 38, 0.18);
      border: 1px solid rgba(239, 68, 68, 0.45);
      color: #FCA5A5;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
    }
    #recording-banner.show { display: flex; }
    .rec-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #EF4444;
    }
    #screen-wrap {
      display: none;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }
    #screen-wrap.show { display: flex; }
    #tiles-grid {
      flex: 1;
      display: grid;
      gap: 10px;
      min-height: 0;
      align-content: stretch;
    }
    #tiles-grid.count-1 { grid-template-columns: 1fr; grid-auto-rows: 1fr; }
    #tiles-grid.count-2 { grid-template-columns: 1fr; grid-auto-rows: 1fr; }
    #tiles-grid.count-many {
      grid-template-columns: repeat(2, 1fr);
      grid-auto-rows: minmax(175px, 1fr);
    }
    .tile {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 168px;
      border-radius: 18px;
      overflow: hidden;
      background: radial-gradient(circle at 30% 25%, #1E293B 0%, #0F172A 100%);
      border: 1.5px solid rgba(255, 255, 255, 0.09);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }
    .tile.local { border-color: rgba(59, 130, 246, 0.55); }
    .tile.speaking {
      border-color: #22C55E;
      box-shadow: 0 0 0 2.5px rgba(34, 197, 94, 0.78);
    }
    .tile.screen {
      min-height: 220px;
      aspect-ratio: 16 / 9;
      border-color: #3B82F6;
      background: #020617;
    }
    .tile video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: #020617;
    }
    .tile video.mirrored { transform: scaleX(-1); }
    .tile.screen video { object-fit: contain; }
    .avatar-circle {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563EB 0%, #4F46E5 55%, #0D9488 100%);
      color: #FFFFFF;
      font-size: 24px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
      z-index: 1;
    }
    .tile-footer {
      position: absolute;
      left: 10px;
      right: 10px;
      bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      z-index: 2;
    }
    .name-pill {
      max-width: 78%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(7, 11, 20, 0.78);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #F8FAFC;
      font-size: 12px;
      font-weight: 700;
    }
    .badges { display: flex; align-items: center; gap: 5px; }
    .host-tag {
      padding: 3px 7px;
      border-radius: 999px;
      background: rgba(34, 197, 94, 0.2);
      border: 1px solid rgba(34, 197, 94, 0.45);
      color: #4ADE80;
      font-size: 10px;
      font-weight: 800;
    }
    .muted-tag {
      padding: 4px 7px;
      border-radius: 999px;
      background: rgba(220, 38, 38, 0.9);
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 800;
    }
    #caption-bar {
      display: none;
      padding: 8px 12px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.14);
      font-size: 12.5px;
      line-height: 1.4;
      color: #F8FAFC;
      flex-shrink: 0;
    }
    #caption-bar.show { display: block; }
    .caption-speaker { color: #93C5FD; font-weight: 700; }
    .connecting-box {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: #94A3B8;
      font-size: 13px;
      font-weight: 600;
    }
    #audio-sink { position: fixed; width: 0; height: 0; overflow: hidden; opacity: 0; pointer-events: none; }
  </style>
</head>
<body>
  <div id="app">
    <button id="audio-unlock-btn" type="button">🔊 Tap here to hear live meeting audio</button>
    <div id="status-bar"></div>
    <div id="recording-banner"><span class="rec-dot"></span><span id="rec-text"></span></div>
    <div id="screen-wrap"></div>
    <div id="tiles-grid" class="count-1">
      <div class="connecting-box">Connecting to live audio & video room...</div>
    </div>
    <div id="caption-bar"></div>
  </div>
  <div id="audio-sink"></div>

  <script>
    (function () {
      const CONFIG = ${cfgJson};
      let room = null;
      let speakerMuted = false;
      let captionTimer = null;

      function postNative(payload) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        } catch (_) {}
      }

      function showStatus(msg) {
        const el = document.getElementById('status-bar');
        if (!el) return;
        if (!msg) {
          el.classList.remove('show');
          el.textContent = '';
        } else {
          el.textContent = msg;
          el.classList.add('show');
        }
      }

      function getInitials(name) {
        const parts = String(name || 'M').trim().split(/\\s+/).filter(Boolean);
        if (parts.length === 0) return 'M';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }

      function isHostParticipant(p) {
        try {
          const meta = JSON.parse(p.metadata || '{}');
          return meta.role === 'host';
        } catch (_) {
          return false;
        }
      }

      function syncAudioElements() {
        const sink = document.getElementById('audio-sink');
        if (!sink || !room) return;
        const activeIds = new Set();

        room.remoteParticipants.forEach((participant) => {
          participant.audioTrackPublications.forEach((pub) => {
            if (pub.track && pub.isSubscribed && !pub.isMuted) {
              const id = 'audio-' + pub.trackSid;
              activeIds.add(id);
              let el = document.getElementById(id);
              if (!el) {
                el = pub.track.attach();
                el.id = id;
                el.autoplay = true;
                el.playsInline = true;
                sink.appendChild(el);
              }
              el.muted = speakerMuted;
              el.volume = speakerMuted ? 0 : 1;
              try {
                const playPromise = el.play();
                if (playPromise && playPromise.catch) {
                  playPromise.catch(() => updateAudioUnlockButton());
                }
              } catch (_) {}
            }
          });
        });

        Array.from(sink.children).forEach((child) => {
          if (!activeIds.has(child.id)) {
            child.remove();
          }
        });
      }

      function updateAudioUnlockButton() {
        const btn = document.getElementById('audio-unlock-btn');
        if (!btn || !room) return;
        if (room.canPlaybackAudio === false) {
          btn.classList.add('show');
        } else {
          btn.classList.remove('show');
        }
      }

      async function unlockAudio() {
        if (!room) return;
        try {
          await room.startAudio();
          syncAudioElements();
          updateAudioUnlockButton();
        } catch (_) {}
      }

      document.getElementById('audio-unlock-btn').addEventListener('click', unlockAudio);
      document.body.addEventListener('touchstart', unlockAudio, { passive: true });
      document.body.addEventListener('click', unlockAudio, { passive: true });

      function renderTiles() {
        if (!room) return;
        const grid = document.getElementById('tiles-grid');
        const screenWrap = document.getElementById('screen-wrap');
        if (!grid || !screenWrap) return;

        const all = [
          { p: room.localParticipant, isLocal: true },
          ...Array.from(room.remoteParticipants.values()).map((p) => ({ p, isLocal: false })),
        ];

        // Check active screen share
        let screenTileInfo = null;
        for (const item of all) {
          const sp = item.p.getTrackPublication(window.LivekitClient.Track.Source.ScreenShare);
          if (sp && sp.track && !sp.isMuted) {
            screenTileInfo = { p: item.p, track: sp.track, isLocal: item.isLocal };
            break;
          }
        }

        screenWrap.innerHTML = '';
        if (screenTileInfo) {
          screenWrap.classList.add('show');
          const tile = document.createElement('div');
          tile.className = 'tile screen';
          const videoEl = screenTileInfo.track.attach();
          videoEl.autoplay = true;
          videoEl.playsInline = true;
          videoEl.muted = true;
          tile.appendChild(videoEl);

          const footer = document.createElement('div');
          footer.className = 'tile-footer';
          const pill = document.createElement('div');
          pill.className = 'name-pill';
          pill.textContent = (screenTileInfo.p.name || screenTileInfo.p.identity) + ' · Presenting';
          footer.appendChild(pill);
          tile.appendChild(footer);
          screenWrap.appendChild(tile);
        } else {
          screenWrap.classList.remove('show');
        }

        // Render participant video blocks
        grid.innerHTML = '';
        grid.className =
          all.length <= 1 ? 'count-1' : all.length === 2 ? 'count-2' : 'count-many';

        all.forEach(({ p, isLocal }) => {
          const camPub = p.getTrackPublication(window.LivekitClient.Track.Source.Camera);
          const micPub = p.getTrackPublication(window.LivekitClient.Track.Source.Microphone);
          const hasVideo = Boolean(camPub && camPub.track && !camPub.isMuted);
          const micOn = Boolean(micPub && !micPub.isMuted);
          const displayName = p.name || (isLocal ? CONFIG.localName : p.identity) || 'Participant';

          const tile = document.createElement('div');
          tile.className =
            'tile' +
            (isLocal ? ' local' : '') +
            (p.isSpeaking ? ' speaking' : '');

          if (hasVideo && camPub && camPub.track) {
            const videoEl = camPub.track.attach();
            videoEl.autoplay = true;
            videoEl.playsInline = true;
            videoEl.muted = true;
            if (isLocal) videoEl.classList.add('mirrored');
            tile.appendChild(videoEl);
          } else {
            const avatar = document.createElement('div');
            avatar.className = 'avatar-circle';
            avatar.textContent = getInitials(displayName);
            tile.appendChild(avatar);
          }

          const footer = document.createElement('div');
          footer.className = 'tile-footer';

          const namePill = document.createElement('div');
          namePill.className = 'name-pill';
          namePill.textContent = isLocal ? displayName + ' (You)' : displayName;
          footer.appendChild(namePill);

          const badges = document.createElement('div');
          badges.className = 'badges';
          if (isHostParticipant(p)) {
            const hostTag = document.createElement('span');
            hostTag.className = 'host-tag';
            hostTag.textContent = 'Host';
            badges.appendChild(hostTag);
          }
          if (!micOn) {
            const muteTag = document.createElement('span');
            muteTag.className = 'muted-tag';
            muteTag.textContent = 'Muted';
            badges.appendChild(muteTag);
          }
          footer.appendChild(badges);
          tile.appendChild(footer);
          grid.appendChild(tile);
        });

        syncAudioElements();
        updateAudioUnlockButton();
      }

      async function applyLocalMic(enabled) {
        if (!room) return;
        try {
          await room.localParticipant.setMicrophoneEnabled(Boolean(enabled));
          showStatus('');
          renderTiles();
          postNative({ type: 'mediaState', micEnabled: Boolean(enabled) });
        } catch (err) {
          const msg = err && err.message ? err.message : 'Microphone permission unavailable';
          showStatus('Mic unavailable (' + msg + ') — you can still hear everyone live.');
          postNative({ type: 'mediaState', micEnabled: false, warning: msg });
        }
      }

      async function applyLocalCam(enabled) {
        if (!room) return;
        try {
          await room.localParticipant.setCameraEnabled(Boolean(enabled));
          showStatus('');
          renderTiles();
          postNative({ type: 'mediaState', camEnabled: Boolean(enabled) });
        } catch (err) {
          const msg = err && err.message ? err.message : 'Camera permission unavailable';
          showStatus('Camera unavailable (' + msg + ') — remote video still works.');
          postNative({ type: 'mediaState', camEnabled: false, warning: msg });
        }
      }

      window.handleNativeCommand = function (cmd) {
        if (!cmd || !cmd.type) return;
        if (cmd.type === 'setMic') {
          applyLocalMic(Boolean(cmd.value));
        } else if (cmd.type === 'setCam') {
          applyLocalCam(Boolean(cmd.value));
        } else if (cmd.type === 'setSpeaker') {
          speakerMuted = Boolean(cmd.value);
          syncAudioElements();
        } else if (cmd.type === 'disconnect') {
          if (room) {
            room.disconnect().catch(() => {});
            room = null;
          }
        }
      };

      async function bootLiveKit() {
        const LK = window.LivekitClient;
        if (!LK) {
          showStatus('Could not load live video SDK. Check internet connection.');
          postNative({ type: 'error', message: 'LiveKit SDK failed to load.' });
          return;
        }

        try {
          const { Room, RoomEvent } = LK;
          room = new Room({ adaptiveStream: true, dynacast: true });

          const refresh = () => renderTiles();
          room.on(RoomEvent.ParticipantConnected, refresh);
          room.on(RoomEvent.ParticipantDisconnected, refresh);
          room.on(RoomEvent.TrackSubscribed, refresh);
          room.on(RoomEvent.TrackUnsubscribed, refresh);
          room.on(RoomEvent.TrackMuted, refresh);
          room.on(RoomEvent.TrackUnmuted, refresh);
          room.on(RoomEvent.LocalTrackPublished, refresh);
          room.on(RoomEvent.LocalTrackUnpublished, refresh);
          room.on(RoomEvent.ActiveSpeakersChanged, refresh);
          room.on(RoomEvent.AudioPlaybackStatusChanged, updateAudioUnlockButton);

          room.on(RoomEvent.DataReceived, (payload) => {
            try {
              const decoded = JSON.parse(new TextDecoder().decode(payload));
              if (decoded && decoded.type === 'caption' && decoded.text) {
                const bar = document.getElementById('caption-bar');
                if (bar) {
                  bar.innerHTML = '';
                  const sp = document.createElement('span');
                  sp.className = 'caption-speaker';
                  sp.textContent = (decoded.speaker || 'Speaker') + ': ';
                  const txt = document.createElement('span');
                  txt.textContent = decoded.text;
                  bar.appendChild(sp);
                  bar.appendChild(txt);
                  bar.classList.add('show');
                  if (captionTimer) clearTimeout(captionTimer);
                  captionTimer = setTimeout(() => bar.classList.remove('show'), 6000);
                }
              } else if (decoded && decoded.type === 'recording') {
                const banner = document.getElementById('recording-banner');
                const recText = document.getElementById('rec-text');
                if (banner && recText) {
                  if (decoded.active) {
                    recText.textContent = (decoded.by || 'Host') + ' is recording this meeting';
                    banner.classList.add('show');
                  } else {
                    banner.classList.remove('show');
                  }
                }
              }
            } catch (_) {}
          });

          room.on(RoomEvent.Disconnected, () => {
            postNative({ type: 'disconnected' });
          });

          await room.connect(CONFIG.url, CONFIG.token);
          postNative({ type: 'connected' });
          await unlockAudio();
          renderTiles();

          if (CONFIG.initialMic) {
            await applyLocalMic(true);
          }
          if (CONFIG.initialCam) {
            await applyLocalCam(true);
          }
        } catch (err) {
          const msg = err && err.message ? err.message : 'Unable to connect to live room.';
          showStatus(msg);
          postNative({ type: 'error', message: msg });
        }
      }

      function loadSdk(src, fallbackSrc) {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => bootLiveKit();
        s.onerror = () => {
          if (fallbackSrc) {
            loadSdk(fallbackSrc, null);
          } else {
            showStatus('Unable to load LiveKit client library.');
          }
        };
        document.head.appendChild(s);
      }

      loadSdk(
        'https://cdn.jsdelivr.net/npm/livekit-client@2/dist/livekit-client.umd.min.js',
        'https://unpkg.com/livekit-client@2/dist/livekit-client.umd.min.js'
      );
    })();
  </script>
</body>
</html>`;
}
