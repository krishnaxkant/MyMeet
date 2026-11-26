export interface LiveKitStageConfig {
  url: string;
  token: string;
  initialMic: boolean;
  initialCam: boolean;
  localName: string;
  avatars: Record<string, string>;
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
      overflow: hidden;
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
    #media-activate-btn,
    #audio-unlock-btn {
      display: none;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid rgba(56, 189, 248, 0.55);
      background: rgba(56, 189, 248, 0.18);
      color: #7DD3FC;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      flex-shrink: 0;
    }
    #media-activate-btn.show,
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
      flex: 1.5;
      min-height: 0;
    }
    #screen-wrap.show { display: flex; }
    #tiles-grid {
      flex: 1;
      display: grid;
      gap: 10px;
      min-height: 0;
      overflow: hidden;
      align-content: stretch;
    }
    #tiles-grid.count-1 { grid-template-columns: 1fr; grid-auto-rows: minmax(0, 1fr); }
    #tiles-grid.count-2 { grid-template-columns: 1fr; grid-auto-rows: minmax(0, 1fr); }
    #tiles-grid.count-many {
      grid-template-columns: repeat(2, 1fr);
      grid-auto-rows: minmax(0, 1fr);
    }
    .tile {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 0;
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
    .tile.hand-raised {
      border-color: #F59E0B;
      box-shadow: 0 0 0 2.5px rgba(245, 158, 11, 0.78);
    }
    .tile.screen {
      flex: 1;
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
      width: 78px;
      height: 78px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563EB 0%, #4F46E5 55%, #0D9488 100%);
      color: #FFFFFF;
      font-size: 26px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
      border: 2.5px solid rgba(255, 255, 255, 0.18);
      z-index: 1;
    }
    .avatar-circle img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .hand-pill {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 3;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(245, 158, 11, 0.94);
      color: #090D16;
      font-size: 11px;
      font-weight: 800;
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
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
      max-width: 74%;
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
    .muted-icon-chip {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(220, 38, 38, 0.92);
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
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
    <button id="audio-unlock-btn" type="button">Tap to enable live meeting audio</button>
    <button id="media-activate-btn" type="button">Tap to activate Camera & Microphone</button>
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
      let avatarMap = Object.assign({}, CONFIG.avatars || {});
      let desiredMic = Boolean(CONFIG.initialMic);
      let desiredCam = Boolean(CONFIG.initialCam);
      let facingMode = 'user';
      let isRoomReady = false;
      let forceRelayMode = false;
      let relayRetried = false;
      let mediaOpQueue = Promise.resolve();
      let localMicPub = null;
      let localCamPub = null;
      let currentScreenTrackSid = null;
      let currentScreenTrack = null;
      let currentScreenVideoEl = null;
      const handledCmdIds = new Set();
      const tileRecords = new Map();
      const raisedHands = {};

      function withTimeout(promise, ms, label) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(label + ' timed out')), ms);
          Promise.resolve(promise).then(
            (val) => {
              clearTimeout(timer);
              resolve(val);
            },
            (err) => {
              clearTimeout(timer);
              reject(err);
            }
          );
        });
      }

      function enqueueMediaOp(fn) {
        const next = mediaOpQueue.then(fn, fn);
        mediaOpQueue = next.catch(() => {});
        return next;
      }

      const MIC_OFF_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 9.5V11A3 3 0 0 0 13.6 13.54M15 9.8V6A3 3 0 0 0 9.6 4.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M5.5 11.5A6.5 6.5 0 0 0 16.2 16.4M12 18V21.5M9 21.5H15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M3 3L21 21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

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

      function setActivateMediaPrompt(show) {
        const btn = document.getElementById('media-activate-btn');
        if (!btn) return;
        if (show) {
          btn.classList.add('show');
        } else {
          btn.classList.remove('show');
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

      function playHandChime() {
        if (speakerMuted) return;
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.11);
            gain.gain.setValueAtTime(0.09, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.34);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.36);
            setTimeout(() => ctx.close().catch(() => {}), 500);
          }
        } catch (_) {}
      }

      function attachAndPlayVideo(track, mirrored) {
        const videoEl = track.attach();
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('webkit-playsinline', 'true');
        videoEl.muted = true;
        if (mirrored) videoEl.classList.add('mirrored');
        try {
          const p = videoEl.play();
          if (p && p.catch) p.catch(() => {});
        } catch (_) {}
        return videoEl;
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
      document.getElementById('media-activate-btn').addEventListener('click', function () {
        setActivateMediaPrompt(false);
        unlockAudio();
        enqueueMediaOp(async () => {
          if (desiredMic) await applyLocalMicInternal(true);
          if (desiredCam) await applyLocalCamInternal(true);
        });
      });
      document.body.addEventListener('touchstart', unlockAudio, { passive: true });
      document.body.addEventListener('click', unlockAudio, { passive: true });

      function detachVideoSafely(track, videoEl) {
        if (!videoEl) return;
        try {
          if (track && typeof track.detach === 'function') {
            track.detach(videoEl);
          }
        } catch (_) {}
        try {
          videoEl.srcObject = null;
          if (videoEl.parentNode) videoEl.parentNode.removeChild(videoEl);
        } catch (_) {}
      }

      function renderTiles() {
        if (!room) return;
        const grid = document.getElementById('tiles-grid');
        const screenWrap = document.getElementById('screen-wrap');
        if (!grid || !screenWrap) return;

        // Clear initial connecting placeholder if still present
        const connectingBox = grid.querySelector('.connecting-box');
        if (connectingBox) connectingBox.remove();

        const all = [
          { p: room.localParticipant, isLocal: true },
          ...Array.from(room.remoteParticipants.values()).map((p) => ({ p, isLocal: false })),
        ];

        // Active screen share spotlight (reuse video node when trackSid is unchanged)
        let screenTileInfo = null;
        for (const item of all) {
          const sp = item.p.getTrackPublication(window.LivekitClient.Track.Source.ScreenShare);
          if (sp && sp.track && !sp.isMuted) {
            screenTileInfo = {
              p: item.p,
              track: sp.track,
              trackSid: sp.trackSid || sp.track.sid || 'screen',
              isLocal: item.isLocal,
            };
            break;
          }
        }

        if (screenTileInfo) {
          screenWrap.classList.add('show');
          if (currentScreenTrackSid !== screenTileInfo.trackSid) {
            detachVideoSafely(currentScreenTrack, currentScreenVideoEl);
            screenWrap.innerHTML = '';
            const tile = document.createElement('div');
            tile.className = 'tile screen';
            const vid = attachAndPlayVideo(screenTileInfo.track, false);
            tile.appendChild(vid);

            const footer = document.createElement('div');
            footer.className = 'tile-footer';
            const pill = document.createElement('div');
            pill.className = 'name-pill';
            pill.textContent =
              (screenTileInfo.p.name || screenTileInfo.p.identity) + ' · Presenting';
            footer.appendChild(pill);
            tile.appendChild(footer);
            screenWrap.appendChild(tile);

            currentScreenTrackSid = screenTileInfo.trackSid;
            currentScreenTrack = screenTileInfo.track;
            currentScreenVideoEl = vid;
          } else if (currentScreenVideoEl && currentScreenVideoEl.paused) {
            currentScreenVideoEl.play().catch(() => {});
          }
        } else {
          if (currentScreenTrackSid !== null) {
            detachVideoSafely(currentScreenTrack, currentScreenVideoEl);
            currentScreenTrackSid = null;
            currentScreenTrack = null;
            currentScreenVideoEl = null;
            screenWrap.innerHTML = '';
          }
          screenWrap.classList.remove('show');
        }

        // Participant video blocks (in-place DOM diffing so live <video> surfaces are NEVER torn down unnecessarily)
        grid.className =
          all.length <= 1 ? 'count-1' : all.length === 2 ? 'count-2' : 'count-many';

        const activeIdentities = new Set();

        all.forEach(({ p, isLocal }) => {
          const id = p.identity || (isLocal ? '__local__' : '');
          activeIdentities.add(id);

          const camPub = p.getTrackPublication(window.LivekitClient.Track.Source.Camera);
          const micPub = p.getTrackPublication(window.LivekitClient.Track.Source.Microphone);
          const hasVideo = Boolean(camPub && camPub.track && !camPub.isMuted);
          const videoTrack = hasVideo && camPub ? camPub.track : null;
          const videoTrackSid = videoTrack
            ? (camPub.trackSid || videoTrack.sid || 'cam-' + id)
            : null;
          const mirrored = Boolean(isLocal && facingMode === 'user');
          const micOn = Boolean(micPub && !micPub.isMuted);
          const isHandUp = Boolean(raisedHands[p.identity]);
          const isHost = isHostParticipant(p);
          const displayName = p.name || (isLocal ? CONFIG.localName : p.identity) || 'Participant';
          const labelText = isLocal ? displayName + ' (You)' : displayName;
          const photoUrl = avatarMap[p.identity] || '';

          let rec = tileRecords.get(id);
          if (!rec) {
            const tile = document.createElement('div');
            tile.className = 'tile';

            const handPill = document.createElement('div');
            handPill.className = 'hand-pill';
            handPill.textContent = '✋ Hand Raised';
            handPill.style.display = 'none';
            tile.appendChild(handPill);

            const avatar = document.createElement('div');
            avatar.className = 'avatar-circle';
            tile.appendChild(avatar);

            const footer = document.createElement('div');
            footer.className = 'tile-footer';

            const namePill = document.createElement('div');
            namePill.className = 'name-pill';
            footer.appendChild(namePill);

            const badges = document.createElement('div');
            badges.className = 'badges';

            const hostTag = document.createElement('span');
            hostTag.className = 'host-tag';
            hostTag.textContent = 'Host';
            hostTag.style.display = 'none';
            badges.appendChild(hostTag);

            const muteIcon = document.createElement('span');
            muteIcon.className = 'muted-icon-chip';
            muteIcon.innerHTML = MIC_OFF_SVG;
            muteIcon.style.display = 'none';
            badges.appendChild(muteIcon);

            footer.appendChild(badges);
            tile.appendChild(footer);
            grid.appendChild(tile);

            rec = {
              tile,
              handPill,
              avatar,
              namePill,
              hostTag,
              muteIcon,
              videoEl: null,
              videoTrack: null,
              videoTrackSid: null,
              mirrored: false,
              photoUrl: null,
              initials: null,
            };
            tileRecords.set(id, rec);
          }

          rec.tile.className =
            'tile' +
            (isLocal ? ' local' : '') +
            (p.isSpeaking ? ' speaking' : '') +
            (isHandUp ? ' hand-raised' : '');

          rec.handPill.style.display = isHandUp ? 'inline-flex' : 'none';
          rec.namePill.textContent = labelText;
          rec.hostTag.style.display = isHost ? 'inline-block' : 'none';
          rec.muteIcon.style.display = micOn ? 'none' : 'flex';

          // Update avatar only when photoUrl or initials actually change
          const initials = getInitials(displayName);
          if (rec.photoUrl !== photoUrl || (!photoUrl && rec.initials !== initials)) {
            rec.avatar.innerHTML = '';
            if (photoUrl) {
              const img = document.createElement('img');
              img.src = photoUrl;
              img.alt = displayName;
              rec.avatar.appendChild(img);
            } else {
              rec.avatar.textContent = initials;
            }
            rec.photoUrl = photoUrl;
            rec.initials = initials;
          }

          // Update <video> ONLY when camera track actually changes or turns on/off
          if (videoTrack && videoTrackSid) {
            rec.avatar.style.display = 'none';
            if (rec.videoTrackSid !== videoTrackSid || rec.videoTrack !== videoTrack) {
              detachVideoSafely(rec.videoTrack, rec.videoEl);
              const vid = attachAndPlayVideo(videoTrack, mirrored);
              rec.tile.insertBefore(vid, rec.handPill);
              rec.videoEl = vid;
              rec.videoTrack = videoTrack;
              rec.videoTrackSid = videoTrackSid;
              rec.mirrored = mirrored;
            } else if (rec.videoEl) {
              if (rec.mirrored !== mirrored) {
                rec.videoEl.classList.toggle('mirrored', mirrored);
                rec.mirrored = mirrored;
              }
              if (rec.videoEl.paused) {
                rec.videoEl.play().catch(() => {});
              }
            }
          } else {
            rec.avatar.style.display = 'flex';
            if (rec.videoEl) {
              detachVideoSafely(rec.videoTrack, rec.videoEl);
              rec.videoEl = null;
              rec.videoTrack = null;
              rec.videoTrackSid = null;
            }
          }
        });

        // Remove tiles for participants who disconnected
        Array.from(tileRecords.entries()).forEach(([id, rec]) => {
          if (!activeIdentities.has(id)) {
            detachVideoSafely(rec.videoTrack, rec.videoEl);
            if (rec.tile.parentNode) rec.tile.parentNode.removeChild(rec.tile);
            tileRecords.delete(id);
          }
        });

        syncAudioElements();
        updateAudioUnlockButton();
      }

      function isPublishNetworkError(msg) {
        const lower = String(msg || '').toLowerCase();
        return (
          lower.includes('timed out') ||
          lower.includes('timeout') ||
          lower.includes('pc connection') ||
          lower.includes('ice') ||
          lower.includes('negotiation') ||
          lower.includes('network') ||
          lower.includes('signal') ||
          lower.includes('could not establish')
        );
      }

      async function retryWithRelayIfNeeded(errMsg) {
        if (forceRelayMode || relayRetried || !isPublishNetworkError(errMsg)) {
          return false;
        }
        relayRetried = true;
        forceRelayMode = true;
        showStatus('Wi-Fi/firewall blocked direct media — switching to TURN/TLS relay...');
        postNative({
          type: 'error',
          message: 'Switching to TURN/TLS relay for stable audio & video...',
        });
        try {
          if (room) {
            isRoomReady = false;
            await room.disconnect().catch(() => {});
            room = null;
            localMicPub = null;
            localCamPub = null;
          }
          // Reconnect outside mediaOpQueue so initial mic/cam publish never deadlocks
          setTimeout(() => {
            void bootLiveKit();
          }, 80);
          return true;
        } catch (_) {
          return false;
        }
      }

      async function unpublishLocalSource(source, cachedPub) {
        if (!room) return;
        const pub = cachedPub || room.localParticipant.getTrackPublication(source);
        if (pub && pub.track) {
          try {
            await room.localParticipant.unpublishTrack(pub.track, true);
          } catch (_) {}
          try {
            if (pub.track.mediaStreamTrack) pub.track.mediaStreamTrack.stop();
          } catch (_) {}
        }
      }

      async function applyLocalMicInternal(enabled) {
        desiredMic = Boolean(enabled);
        if (!room || !isRoomReady) return;
        const LK = window.LivekitClient;
        try {
          if (desiredMic) {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
              throw new Error('mediaDevices.getUserMedia unavailable in WebView');
            }
            const existing = room.localParticipant.getTrackPublication(LK.Track.Source.Microphone);
            if (existing && existing.track && existing.track.mediaStreamTrack && existing.track.mediaStreamTrack.readyState === 'live') {
              await existing.unmute();
              localMicPub = existing;
            } else {
              showStatus('Opening Android microphone...');
              let stream = null;
              try {
                stream = await withTimeout(
                  navigator.mediaDevices.getUserMedia({
                    audio: {
                      echoCancellation: true,
                      noiseSuppression: true,
                      autoGainControl: true,
                    },
                    video: false,
                  }),
                  5000,
                  'Microphone capture'
                );
              } catch (firstErr) {
                try {
                  stream = await withTimeout(
                    navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
                    5000,
                    'Microphone capture'
                  );
                } catch (secondErr) {
                  let diag = '';
                  try {
                    const devs = await withTimeout(navigator.mediaDevices.enumerateDevices(), 2000, 'enum');
                    const aud = devs.filter((d) => d.kind === 'audioinput').length;
                    const vid = devs.filter((d) => d.kind === 'videoinput').length;
                    diag = ' [sec=' + window.isSecureContext + ', orig=' + location.origin + ', a=' + aud + ', v=' + vid + ']';
                  } catch (_) {
                    diag = ' [sec=' + window.isSecureContext + ', orig=' + location.origin + ']';
                  }
                  const baseMsg = (secondErr && secondErr.message) || (firstErr && firstErr.message) || 'Microphone capture failed';
                  throw new Error(baseMsg + diag);
                }
              }
              const audioTrack = stream.getAudioTracks()[0];
              if (!audioTrack) {
                throw new Error('No microphone track returned by Android');
              }
              audioTrack.onended = () => {
                if (desiredMic && room && isRoomReady) {
                  showStatus('Android stopped the microphone track. Tap Mic to retry.');
                  postNative({
                    type: 'mediaState',
                    micEnabled: false,
                    warning: 'Android stopped the microphone stream unexpectedly.',
                  });
                }
              };
              showStatus('Publishing live audio...');
              localMicPub = await withTimeout(
                room.localParticipant.publishTrack(audioTrack, {
                  source: LK.Track.Source.Microphone,
                  dtx: true,
                  red: true,
                }),
                10000,
                'Publishing audio to server'
              );
            }
          } else {
            await unpublishLocalSource(LK.Track.Source.Microphone, localMicPub);
            localMicPub = null;
          }
          const isNowOn = Boolean(
            room &&
              room.localParticipant.getTrackPublication(LK.Track.Source.Microphone) &&
              !room.localParticipant.getTrackPublication(LK.Track.Source.Microphone).isMuted
          );
          showStatus('');
          setActivateMediaPrompt(false);
          renderTiles();
          postNative({ type: 'mediaState', micEnabled: isNowOn });
        } catch (err) {
          const msg = err && err.message ? err.message : 'Microphone failed';
          const switched = desiredMic ? await retryWithRelayIfNeeded(msg) : false;
          if (switched) return;
          desiredMic = false;
          setActivateMediaPrompt(true);
          showStatus('Mic error: ' + msg);
          postNative({
            type: 'mediaState',
            micEnabled: false,
            warning: 'Mic: ' + msg,
          });
        }
      }

      async function applyLocalCamInternal(enabled) {
        desiredCam = Boolean(enabled);
        if (!room || !isRoomReady) return;
        const LK = window.LivekitClient;
        try {
          if (desiredCam) {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
              throw new Error('mediaDevices.getUserMedia unavailable in WebView');
            }
            const existing = room.localParticipant.getTrackPublication(LK.Track.Source.Camera);
            if (existing && existing.track && existing.track.mediaStreamTrack && existing.track.mediaStreamTrack.readyState === 'live') {
              await existing.unmute();
              localCamPub = existing;
            } else {
              showStatus('Opening Android camera...');
              let stream = null;
              try {
                stream = await withTimeout(
                  navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                      facingMode: facingMode,
                      width: { ideal: 640 },
                      height: { ideal: 480 },
                      frameRate: { ideal: 20, max: 24 },
                    },
                  }),
                  7000,
                  'Camera capture'
                );
              } catch (_) {
                stream = await withTimeout(
                  navigator.mediaDevices.getUserMedia({ audio: false, video: true }),
                  7000,
                  'Camera capture'
                );
              }
              const videoTrack = stream.getVideoTracks()[0];
              if (!videoTrack) {
                throw new Error('No camera track returned by Android');
              }
              videoTrack.onended = () => {
                if (desiredCam && room && isRoomReady) {
                  showStatus('Android stopped the camera track. Tap Camera to retry.');
                  postNative({
                    type: 'mediaState',
                    camEnabled: false,
                    warning: 'Android stopped the camera stream unexpectedly.',
                  });
                }
              };
              showStatus('Publishing live video...');
              localCamPub = await withTimeout(
                room.localParticipant.publishTrack(videoTrack, {
                  source: LK.Track.Source.Camera,
                  simulcast: false,
                  videoCodec: 'vp8',
                  videoEncoding: { maxBitrate: 500000, maxFramerate: 20 },
                }),
                10000,
                'Publishing video to server'
              );
            }
          } else {
            await unpublishLocalSource(LK.Track.Source.Camera, localCamPub);
            localCamPub = null;
          }
          const isNowOn = Boolean(
            room &&
              room.localParticipant.getTrackPublication(LK.Track.Source.Camera) &&
              !room.localParticipant.getTrackPublication(LK.Track.Source.Camera).isMuted
          );
          showStatus('');
          setActivateMediaPrompt(false);
          renderTiles();
          postNative({ type: 'mediaState', camEnabled: isNowOn });
        } catch (err) {
          const msg = err && err.message ? err.message : 'Camera failed';
          const switched = desiredCam ? await retryWithRelayIfNeeded(msg) : false;
          if (switched) return;
          desiredCam = false;
          setActivateMediaPrompt(true);
          showStatus('Camera error: ' + msg);
          postNative({
            type: 'mediaState',
            camEnabled: false,
            warning: 'Camera: ' + msg,
          });
        }
      }

      function applyLocalMic(enabled) {
        desiredMic = Boolean(enabled);
        return enqueueMediaOp(() => applyLocalMicInternal(desiredMic));
      }

      function applyLocalCam(enabled) {
        desiredCam = Boolean(enabled);
        return enqueueMediaOp(() => applyLocalCamInternal(desiredCam));
      }

      function flipCamera() {
        facingMode = facingMode === 'user' ? 'environment' : 'user';
        return enqueueMediaOp(async () => {
          if (room && isRoomReady && desiredCam) {
            await applyLocalCamInternal(false);
            await applyLocalCamInternal(true);
          }
        });
      }

      async function applyHandRaise(raised) {
        if (!room) return;
        const id = room.localParticipant.identity;
        const name = room.localParticipant.name || CONFIG.localName || 'You';
        if (raised) {
          raisedHands[id] = name;
          playHandChime();
        } else {
          delete raisedHands[id];
        }
        renderTiles();
        postNative({ type: 'handEvent', identity: id, name: name, raised: Boolean(raised) });
        try {
          const encoded = new TextEncoder().encode(
            JSON.stringify({ type: 'hand', identity: id, name: name, raised: Boolean(raised) })
          );
          await room.localParticipant.publishData(encoded, { reliable: true });
        } catch (_) {}
      }

      window.handleNativeCommand = function (cmd) {
        if (!cmd || !cmd.type) return;
        if (cmd.cmdId) {
          if (handledCmdIds.has(cmd.cmdId)) return;
          handledCmdIds.add(cmd.cmdId);
          if (handledCmdIds.size > 200) handledCmdIds.clear();
        }
        if (cmd.type === 'setMic') {
          applyLocalMic(Boolean(cmd.value));
        } else if (cmd.type === 'setCam') {
          applyLocalCam(Boolean(cmd.value));
        } else if (cmd.type === 'flipCam') {
          flipCamera();
        } else if (cmd.type === 'setSpeaker') {
          speakerMuted = Boolean(cmd.value);
          syncAudioElements();
        } else if (cmd.type === 'setHand') {
          applyHandRaise(Boolean(cmd.value));
        } else if (cmd.type === 'updateAvatars' && cmd.avatars) {
          avatarMap = Object.assign({}, avatarMap, cmd.avatars);
          renderTiles();
        } else if (cmd.type === 'disconnect') {
          isRoomReady = false;
          if (room) {
            room.disconnect().catch(() => {});
            room = null;
          }
        }
      };

      function handlePostedMessage(ev) {
        try {
          if (!ev || typeof ev.data !== 'string') return;
          const parsed = JSON.parse(ev.data);
          if (parsed && parsed.type) {
            window.handleNativeCommand(parsed);
          }
        } catch (_) {}
      }
      document.addEventListener('message', handlePostedMessage);
      window.addEventListener('message', handlePostedMessage);

      async function bootLiveKit() {
        const LK = window.LivekitClient;
        if (!LK) {
          showStatus('Could not load live video SDK. Check internet connection.');
          postNative({ type: 'error', message: 'LiveKit SDK failed to load.' });
          return;
        }

        try {
          const { Room, RoomEvent } = LK;
          room = new Room({
            adaptiveStream: false,
            dynacast: false,
            stopLocalTrackOnUnpublish: true,
            publishDefaults: {
              simulcast: false,
              stopMicTrackOnMute: false,
              videoCodec: 'vp8',
              videoEncoding: {
                maxBitrate: 550000,
                maxFramerate: 20,
              },
            },
            audioCaptureDefaults: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            videoCaptureDefaults: {
              facingMode: facingMode,
              resolution: { width: 640, height: 480, frameRate: 20 },
            },
          });

          const refresh = () => renderTiles();
          room.on(RoomEvent.ParticipantConnected, refresh);
          room.on(RoomEvent.ParticipantDisconnected, (p) => {
            if (p && p.identity) delete raisedHands[p.identity];
            refresh();
          });
          room.on(RoomEvent.TrackSubscribed, refresh);
          room.on(RoomEvent.TrackUnsubscribed, refresh);
          room.on(RoomEvent.TrackMuted, (pub, participant) => {
            if (participant && room && participant.identity === room.localParticipant.identity) {
              if (pub && pub.source === LK.Track.Source.Microphone) {
                desiredMic = false;
                postNative({ type: 'mediaState', micEnabled: false });
              } else if (pub && pub.source === LK.Track.Source.Camera) {
                desiredCam = false;
                postNative({ type: 'mediaState', camEnabled: false });
              }
            }
            refresh();
          });
          room.on(RoomEvent.TrackUnmuted, (pub, participant) => {
            if (participant && room && participant.identity === room.localParticipant.identity) {
              if (pub && pub.source === LK.Track.Source.Microphone) {
                desiredMic = true;
                postNative({ type: 'mediaState', micEnabled: true });
              } else if (pub && pub.source === LK.Track.Source.Camera) {
                desiredCam = true;
                postNative({ type: 'mediaState', camEnabled: true });
              }
            }
            refresh();
          });
          room.on(RoomEvent.LocalTrackPublished, refresh);
          room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
            if (pub && pub.source === LK.Track.Source.Microphone) {
              postNative({ type: 'mediaState', micEnabled: room ? room.localParticipant.isMicrophoneEnabled : false });
            } else if (pub && pub.source === LK.Track.Source.Camera) {
              postNative({ type: 'mediaState', camEnabled: room ? room.localParticipant.isCameraEnabled : false });
            }
            refresh();
          });
          room.on(RoomEvent.MediaDevicesError, (err) => {
            const msg = err && err.message ? err.message : 'Media device error';
            showStatus('Media error: ' + msg);
            postNative({ type: 'error', message: 'Media: ' + msg });
          });
          room.on(RoomEvent.ActiveSpeakersChanged, refresh);
          room.on(RoomEvent.AudioPlaybackStatusChanged, updateAudioUnlockButton);

          room.on(RoomEvent.DataReceived, (payload, participant) => {
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
              } else if (decoded && decoded.type === 'hand') {
                const idKey = decoded.identity || (participant && participant.identity) || '';
                const name = decoded.name || (participant && participant.name) || 'A participant';
                if (idKey) {
                  if (decoded.raised) {
                    raisedHands[idKey] = name;
                    playHandChime();
                  } else {
                    delete raisedHands[idKey];
                  }
                  renderTiles();
                  postNative({
                    type: 'handEvent',
                    identity: idKey,
                    name: name,
                    raised: Boolean(decoded.raised),
                  });
                }
              }
            } catch (_) {}
          });

          room.on(RoomEvent.Disconnected, () => {
            isRoomReady = false;
            postNative({ type: 'disconnected' });
          });

          const connectOpts = forceRelayMode
            ? { rtcConfig: { iceTransportPolicy: 'relay' } }
            : undefined;
          await room.connect(CONFIG.url, CONFIG.token, connectOpts);
          isRoomReady = true;
          postNative({ type: 'connected' });
          await unlockAudio();
          renderTiles();

          if (desiredMic) {
            await enqueueMediaOp(() => applyLocalMicInternal(true));
          }
          if (desiredCam) {
            await enqueueMediaOp(() => applyLocalCamInternal(true));
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
            showStatus('Unable to load LiveKit client library. Check internet connection.');
            postNative({ type: 'error', message: 'Unable to load LiveKit client library.' });
          }
        };
        document.head.appendChild(s);
      }

      loadSdk(
        'https://cdn.jsdelivr.net/npm/livekit-client@2/dist/livekit-client.umd.js',
        'https://unpkg.com/livekit-client@2/dist/livekit-client.umd.js'
      );
    })();
  </script>
</body>
</html>`;
}
