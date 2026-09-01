import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { RoomEvent, Track, createLocalAudioTrack, AudioPresets } from 'livekit-client';
import { createEncryptedRoom } from './livekitE2ee';
import { publicLiveKitUrl } from './livekitUrl';
import {
  fetchLiveKitToken,
  fetchMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  sendSticker,
  markMessagesRead,
  uploadGroupMedia,
  uploadPttRecording,
  triggerPanic,
  patchPanicEvent,
} from './api';
import { socketIoOptions, socketUrl } from './socketConfig';
import { assertMediaDevices, createVoiceRecorder, VOICE_AUDIO_CONSTRAINTS } from './voiceRecord';
import { playPanicAlarm, startPanicAlarm, stopPanicAlarm, unlockPanicAudio } from './panicSound';
import { notifyBackgroundChat, notifyBackgroundPtt } from './backgroundKeepalive';
import { playChannelFreeTone } from './appNotify';
import { esMsg } from './esMsg';

const SOCKET_URL = socketUrl();

/**
 * Socket.IO (floor + presencia + chat) + LiveKit (audio).
 */
export function usePtt({ token, user, group, suppressChatNotify = false }) {
  const [connected, setConnected] = useState(false);
  const [livekitReady, setLivekitReady] = useState(false);
  const [speaking, setSpeaking] = useState(null);
  const [holding, setHolding] = useState(false);
  const [denied, setDenied] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('idle');
  const [online, setOnline] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatError, setChatError] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [panicSending, setPanicSending] = useState(false);
  const [lastPanicAt, setLastPanicAt] = useState(null);
  const [incomingPanic, setIncomingPanic] = useState(null);
  const [panicAcking, setPanicAcking] = useState(false);

  const socketRef = useRef(null);
  const roomRef = useRef(null);
  const micRef = useRef(null);
  const holdingRef = useRef(false);
  const groupIdRef = useRef(group?.id);
  const tokenRef = useRef(token);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordStartedAtRef = useRef(0);
  const listenMutedRef = useRef(false);
  const [listenMuted, setListenMutedState] = useState(() => {
    try {
      return localStorage.getItem('tacticalptx_radio_mute') === '1';
    } catch {
      return false;
    }
  });
  listenMutedRef.current = listenMuted;

  const applyListenMute = useCallback((muted) => {
    document.querySelectorAll('[data-lk-audio]').forEach((el) => {
      el.muted = muted;
      el.volume = muted ? 0 : 1;
    });
    const room = roomRef.current;
    if (!room) return;
    room.remoteParticipants.forEach((p) => {
      p.audioTrackPublications.forEach((pub) => {
        const t = pub.track;
        if (t && typeof t.setVolume === 'function') {
          t.setVolume(muted ? 0 : 1);
        }
      });
    });
  }, []);

  const setListenMuted = useCallback(
    (muted) => {
      const next = Boolean(muted);
      listenMutedRef.current = next;
      setListenMutedState(next);
      applyListenMute(next);
      try {
        localStorage.setItem('tacticalptx_radio_mute', next ? '1' : '0');
      } catch {
        /* ignore */
      }
    },
    [applyListenMute]
  );

  const unlockAudio = useCallback(async () => {
    try {
      await roomRef.current?.startAudio();
    } catch {
      /* ignore */
    }
    applyListenMute(listenMutedRef.current);
    document.querySelectorAll('[data-lk-audio]').forEach((el) => {
      el.play().catch(() => {});
    });
  }, [applyListenMute]);

  groupIdRef.current = group?.id;
  tokenRef.current = token;

  const stopRecorderAndUpload = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') {
      recorderRef.current = null;
      return;
    }
    const started = recordStartedAtRef.current;
    const durationMs = Math.max(0, Date.now() - started);
    const blob = await new Promise((resolve) => {
      rec.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' }));
      };
      try {
        rec.stop();
      } catch {
        resolve(null);
      }
    });
    recorderRef.current = null;
    chunksRef.current = [];

    const tok = tokenRef.current;
    const gid = groupIdRef.current;
    if (!blob || !tok || !gid) return;
    if (blob.size < 800 || durationMs < 450) return;
    try {
      await uploadPttRecording(tok, gid, blob, durationMs);
    } catch (e) {
      console.warn('PTT recording upload:', e.message);
    }
  }, []);

  const startRecorder = useCallback((mic) => {
    try {
      if (!window.MediaRecorder || !mic?.mediaStreamTrack) return;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      const stream = new MediaStream([mic.mediaStreamTrack]);
      const rec = createVoiceRecorder(stream);
      chunksRef.current = [];
      recordStartedAtRef.current = Date.now();
      rec.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data);
      };
      // Timeslice moderado: evita buffer infinito en PTT largo sin fragmentar Opus en trozos minúsculos
      rec.start(1000);
      recorderRef.current = rec;
    } catch (e) {
      console.warn('PTT recorder:', e.message);
    }
  }, []);

  const muteMic = useCallback(async () => {
    // Subir grabación en paralelo: no retrasar el mute (siguiente PTT más ágil)
    void stopRecorderAndUpload();
    const mic = micRef.current;
    if (!mic) return;
    try {
      await mic.mute();
    } catch {
      /* ignore */
    }
  }, [stopRecorderAndUpload]);

  const teardownMic = useCallback(async () => {
    await stopRecorderAndUpload();
    const room = roomRef.current;
    const mic = micRef.current;
    micRef.current = null;
    if (!mic) return;
    try {
      await room?.localParticipant?.unpublishTrack(mic);
    } catch {
      /* ignore */
    }
    try {
      mic.stop();
    } catch {
      /* ignore */
    }
  }, [stopRecorderAndUpload]);

  /** Publica el mic muteado al entrar al canal (el grant solo hace unmute). */
  const ensureMicReady = useCallback(async () => {
    const room = roomRef.current;
    if (!room || room.state !== 'connected') return;
    if (micRef.current) return;
    try {
      assertMediaDevices();
      const mic = await createLocalAudioTrack({
        echoCancellation: VOICE_AUDIO_CONSTRAINTS.echoCancellation,
        noiseSuppression: VOICE_AUDIO_CONSTRAINTS.noiseSuppression,
        autoGainControl: VOICE_AUDIO_CONSTRAINTS.autoGainControl,
        channelCount: VOICE_AUDIO_CONSTRAINTS.channelCount,
      });
      await mic.mute();
      micRef.current = mic;
      await room.localParticipant.publishTrack(mic, {
        source: Track.Source.Microphone,
        dtx: false,
        red: false,
        audioPreset: AudioPresets.speech,
        stopMicTrackOnMute: false,
      });
    } catch (err) {
      setError(esMsg(err.message || err.name, 'No se pudo activar el micrófono'));
      throw err;
    }
  }, []);

  const startPublishing = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    if (!micRef.current) {
      await ensureMicReady();
    }
    const mic = micRef.current;
    if (!mic) return;
    try {
      await mic.unmute();
    } catch {
      /* ignore */
    }
    startRecorder(mic);
  }, [ensureMicReady, startRecorder]);

  const ensureLiveKit = useCallback(async () => {
    const gid = groupIdRef.current;
    const tok = tokenRef.current;
    if (!gid || !tok) return;
    if (roomRef.current?.state === 'connected') {
      setLivekitReady(true);
      try {
        await ensureMicReady();
      } catch {
        /* mic bloqueado: se oye; PTT pedirá permiso al hablar */
      }
      return;
    }
    const lk = await fetchLiveKitToken(tok, gid);
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch {
        /* ignore */
      }
    }
    const room = await createEncryptedRoom(
      {
        adaptiveStream: false,
        dynacast: false,
        audioCaptureDefaults: {
          echoCancellation: VOICE_AUDIO_CONSTRAINTS.echoCancellation,
          noiseSuppression: VOICE_AUDIO_CONSTRAINTS.noiseSuppression,
          autoGainControl: VOICE_AUDIO_CONSTRAINTS.autoGainControl,
          channelCount: VOICE_AUDIO_CONSTRAINTS.channelCount,
        },
        publishDefaults: {
          audioPreset: AudioPresets.speech,
          dtx: false,
          red: false,
          stopMicTrackOnMute: false,
        },
      },
      lk.e2eeKey
    );
    roomRef.current = room;
    const attachRemote = (track) => {
      if (track.kind !== Track.Kind.Audio) return;
      if (track.attachedElements?.length) return;
      const el = track.attach();
      el.dataset.lkAudio = '1';
      el.playsInline = true;
      el.autoplay = true;
      try {
        el.preload = 'auto';
      } catch {
        /* ignore */
      }
      const muted = listenMutedRef.current;
      el.muted = muted;
      el.volume = muted ? 0 : 1;
      if (typeof track.setVolume === 'function') {
        track.setVolume(muted ? 0 : 1);
      }
      document.body.appendChild(el);
      if (!muted) el.play().catch(() => {});
    };
    const kickRemoteAudio = () => {
      document.querySelectorAll('[data-lk-audio]').forEach((el) => {
        if (listenMutedRef.current) return;
        el.muted = false;
        el.volume = 1;
        el.play().catch(() => {});
      });
      try {
        room.startAudio().catch(() => {});
      } catch {
        /* ignore */
      }
    };
    room.on(RoomEvent.TrackSubscribed, attachRemote);
    room.on(RoomEvent.TrackUnmuted, kickRemoteAudio);
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((el) => el.remove());
    });
    room.on(RoomEvent.Disconnected, () => {
      setLivekitReady(false);
    });
    await room.connect(publicLiveKitUrl(lk.url), lk.token);
    setLivekitReady(true);
    setStatus((s) => (s === 'talking' ? s : 'ready'));
    try {
      await room.startAudio();
    } catch {
      /* el navegador pide gesto; el layout lo desbloquea */
    }
    room.remoteParticipants.forEach((p) => {
      p.audioTrackPublications.forEach((pub) => {
        if (pub.track) attachRemote(pub.track);
      });
    });
    applyListenMute(listenMutedRef.current);
    kickRemoteAudio();
    try {
      await ensureMicReady();
    } catch {
      /* mic bloqueado: canal listo para escuchar */
    }
  }, [ensureMicReady, applyListenMute]);

  useEffect(() => {
    if (!token || !group?.id) return undefined;

    let cancelled = false;
    setError(null);
    setChatError(null);
    setStatus('connecting');
    setMessages([]);
    setOnline([]);

    fetchMessages(token, group.id)
      .then((data) => {
        if (!cancelled) setMessages(data.messages || []);
      })
      .catch((err) => {
        if (!cancelled) setChatError(esMsg(err.message));
      });

    const socket = io(SOCKET_URL, {
      auth: { token },
      ...socketIoOptions,
    });
    socketRef.current = socket;

    const presenceFocus = () =>
      typeof document !== 'undefined' && document.hidden ? 'background' : 'foreground';

    const joinChannel = () => {
      socket.emit('ptt:join', { groupId: group.id, focus: presenceFocus() });
      if (['root', 'admin', 'zone_admin', 'unit_admin', 'dispatcher'].includes(user?.role)) {
        socket.emit('dispatch:join');
      }
    };

    const onVisibility = () => {
      if (socket.connected) {
        socket.emit('presence:ping', { groupId: group.id, focus: presenceFocus() });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    socket.on('connect', async () => {
      setConnected(true);
      // Limpia banners residuales (p. ej. "xhr poll error" tras reconectar)
      setError(null);
      joinChannel();
      if (holdingRef.current) {
        holdingRef.current = false;
        setHolding(false);
        await muteMic();
      }
      try {
        await ensureLiveKit();
      } catch (err) {
        if (!cancelled) {
          setError(esMsg(err.message || 'Error de audio'));
          setStatus('error');
        }
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setStatus((s) => (s === 'talking' ? 'reconnecting' : s));
    });
    socket.on('connect_error', (err) => {
      if (cancelled) return;
      // Solo mostrar si aún no hay enlace (evita flash rojo al reconectar)
      setError((prev) => {
        if (socket.connected) return prev;
        return esMsg(err.message, 'Error de conexión');
      });
    });

    socket.on('ptt:state', ({ groupId, speaker }) => {
      if (groupId !== group.id) return;
      setSpeaking(
        speaker
          ? { userId: speaker.userId, displayName: speaker.displayName, groupId }
          : null
      );
    });

    socket.on('presence:update', ({ groupId, members }) => {
      if (groupId !== group.id) return;
      setOnline(members || []);
    });

    socket.on('ptt:granted', async ({ groupId }) => {
      if (groupId !== group.id) return;
      setDenied(null);
      setHolding(true);
      holdingRef.current = true;
      setStatus('talking');
      try {
        // Mic ya debería estar publicado muteado; solo unmute
        await startPublishing();
      } catch (err) {
        setError(esMsg(err.message || 'No se pudo publicar audio'));
        socket.emit('ptt:release', { groupId: group.id });
      }
    });

    socket.on('ptt:denied', ({ groupId, reason }) => {
      if (groupId !== group.id) return;
      setDenied({
        reason:
          reason === 'listen_only' ? 'solo escucha (sin PTT)' : 'ocupado',
      });
      setHolding(false);
      holdingRef.current = false;
      setStatus('listening');
    });

    socket.on('ptt:speaker', ({ groupId, userId, displayName }) => {
      if (groupId !== group.id) return;
      setSpeaking({ userId, displayName, groupId });
      if (userId !== user?.id) {
        notifyBackgroundPtt({ speakerName: displayName });
      }
    });

    socket.on('dispatch:speaker', (p) => {
      if (!p?.userId) return;
      setSpeaking({
        userId: p.userId,
        displayName: p.displayName,
        groupId: p.groupId,
      });
    });

    socket.on('dispatch:released', (p) => {
      setSpeaking((cur) => {
        if (!cur) return null;
        if (p?.groupId && cur.groupId && cur.groupId !== p.groupId) return cur;
        return null;
      });
    });

    socket.on('ptt:released', async ({ groupId }) => {
      if (groupId !== group.id) return;
      const wasMe = holdingRef.current;
      setSpeaking(null);
      if (wasMe) {
        holdingRef.current = false;
        setHolding(false);
        await muteMic();
      } else {
        playChannelFreeTone({ soft: !document.hidden });
      }
      setStatus('ready');
    });

    socket.on('ptt:error', ({ error: msg }) => setError(esMsg(msg)));

    socket.on('chat:message', (msg) => {
      if (msg.groupId !== group.id) return;
      setMessages((prev) => {
        const withoutLocal = prev.filter(
          (m) =>
            !(
              m._local &&
              (m.clientMsgId === msg.clientMsgId ||
                (msg.clientMsgId && m.id === msg.clientMsgId))
            )
        );
        if (withoutLocal.some((m) => m.id === msg.id)) return withoutLocal;
        return [...withoutLocal, msg];
      });
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[msg.senderId];
        return next;
      });
      if (msg.senderId !== user?.id && !suppressChatNotify) {
        notifyBackgroundChat({
          title: msg.displayName || group.name || 'Canal',
          body: msg.body || msg.type || 'Nuevo mensaje',
          tag: `chat-${msg.id}`,
        });
      }
    });

    socket.on('chat:edited', (msg) => {
      if (msg.groupId !== group.id) return;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    });

    socket.on('chat:deleted', (msg) => {
      if (msg.groupId !== group.id) return;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    });

    socket.on('chat:reaction', (payload) => {
      if (payload.groupId !== group.id || !payload.messageId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId ? { ...m, reactions: payload.reactions || [] } : m
        )
      );
    });

    socket.on('panic:alert', (event) => {
      if (event.groupId !== group.id) return;
      setLastPanicAt(event.createdAt || new Date().toISOString());
      // Emisor: confirmación corta en sendPanic; receptores: sirena hasta Enterado
      if (event.userId && event.userId === user?.id) return;
      setIncomingPanic({
        id: event.id,
        displayName: event.displayName || 'Operador',
        createdAt: event.createdAt,
        latitude: event.latitude,
        longitude: event.longitude,
        accuracyM: event.accuracyM,
      });
      startPanicAlarm();
    });

    socket.on('panic:update', (event) => {
      if (event.groupId && event.groupId !== group.id) return;
      if (!event?.status || event.status === 'active') return;
      // «acked» = otro dispositivo se dio por enterado: no silenciar aquí.
      // Solo resolved/cancelled cierran la alerta en todos.
      if (event.status === 'acked') return;
      setIncomingPanic((prev) => {
        if (!prev || prev.id !== event.id) return prev;
        stopPanicAlarm();
        return null;
      });
    });

    socket.on('chat:receipts', (payload) => {
      if (payload.groupId !== group.id || !payload.updates?.length) return;
      const map = new Map(payload.updates.map((u) => [u.messageId, u]));
      setMessages((prev) =>
        prev.map((m) => {
          const u = map.get(m.id);
          if (!u) return m;
          return {
            ...m,
            readCount: u.readCount,
            readFully: u.readFully,
          };
        })
      );
    });

    socket.on('chat:typing', ({ groupId, userId, displayName, typing }) => {
      if (groupId !== group.id || userId === user?.id) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (typing) next[userId] = displayName || 'Alguien';
        else delete next[userId];
        return next;
      });
    });

    socket.on('chat:error', ({ error: msg, clientMsgId }) => {
      setChatError(esMsg(msg));
      if (clientMsgId) {
        setMessages((prev) =>
          prev.filter((m) => !(m._local && (m.clientMsgId === clientMsgId || m.id === clientMsgId)))
        );
      }
    });

    const ping = setInterval(() => {
      if (socket.connected) {
        socket.emit('presence:ping', {
          groupId: group.id,
          focus: typeof document !== 'undefined' && document.hidden ? 'background' : 'foreground',
        });
      }
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(ping);
      document.removeEventListener('visibilitychange', onVisibility);
      holdingRef.current = false;
      socket.emit('ptt:leave', { groupId: group.id });
      socket.disconnect();
      socketRef.current = null;
      teardownMic();
      roomRef.current?.disconnect();
      roomRef.current = null;
      document.querySelectorAll('[data-lk-audio]').forEach((el) => el.remove());
      stopPanicAlarm();
      setIncomingPanic(null);
      setConnected(false);
      setLivekitReady(false);
      setSpeaking(null);
      setHolding(false);
      setOnline([]);
      setStatus('idle');
    };
  }, [token, group?.id, startPublishing, muteMic, teardownMic, ensureLiveKit, ensureMicReady, user?.id, user?.role]);

  const press = useCallback(() => {
    if (!socketRef.current?.connected || !group?.id || holdingRef.current) return;
    unlockPanicAudio();
    setDenied(null);
    // Precalentar mic en paralelo al request de floor (no await)
    void ensureMicReady().catch(() => {
      /* error ya en setError vía ensureMicReady */
    });
    socketRef.current.emit('ptt:request', { groupId: group.id });
  }, [group?.id, ensureMicReady]);

  const release = useCallback(async () => {
    if (!socketRef.current || !group?.id) return;
    if (holdingRef.current) {
      holdingRef.current = false;
      setHolding(false);
      await muteMic();
      socketRef.current.emit('ptt:release', { groupId: group.id });
      setStatus('ready');
    }
  }, [group?.id, muteMic]);

  /** Toque / Espacio: 1.º al aire, 2.º libera. */
  const toggle = useCallback(() => {
    if (holdingRef.current) {
      void release();
    } else {
      press();
    }
  }, [press, release]);

  const postChat = useCallback(
    async (body, { replyToId } = {}) => {
      if (!token || !group?.id || !body.trim()) return;
      setChatError(null);
      const text = body.trim();
      try {
        if (socketRef.current?.connected) {
          const clientMsgId =
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `local-${Date.now()}`;
          const optimistic = {
            id: clientMsgId,
            clientMsgId,
            _local: true,
            groupId: group.id,
            senderId: user?.id,
            displayName: user?.displayName || 'Tú',
            type: 'text',
            body: text,
            replyToId: replyToId || null,
            reply: null,
            reactions: [],
            readCount: 0,
            peerCount: 0,
            readFully: false,
            isDeleted: false,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, optimistic]);
          socketRef.current.emit('chat:send', {
            groupId: group.id,
            body: text,
            replyToId: replyToId || undefined,
            clientMsgId,
          });
        } else {
          const data = await sendMessage(token, group.id, text, { replyToId });
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      } catch (err) {
        setChatError(esMsg(err.message));
      }
    },
    [token, group?.id, user?.id, user?.displayName]
  );

  const postMedia = useCallback(
    async (file, { type, body, replyToId } = {}) => {
      if (!token || !group?.id || !file) return;
      setChatError(null);
      try {
        const kind =
          type ||
          (file.type?.startsWith('image/')
            ? 'image'
            : file.type?.startsWith('audio/')
              ? 'audio'
              : 'file');
        const data = await uploadGroupMedia(token, group.id, file, {
          type: kind,
          body,
          replyToId,
        });
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      } catch (err) {
        setChatError(esMsg(err.message));
      }
    },
    [token, group?.id]
  );

  const setTyping = useCallback(
    (typing) => {
      if (!socketRef.current?.connected || !group?.id) return;
      socketRef.current.emit('chat:typing', { groupId: group.id, typing: Boolean(typing) });
    },
    [group?.id]
  );

  const editChat = useCallback(
    async (messageId, body) => {
      if (!token || !group?.id || !messageId || !body?.trim()) return;
      setChatError(null);
      try {
        if (socketRef.current?.connected) {
          socketRef.current.emit('chat:edit', {
            groupId: group.id,
            messageId,
            body: body.trim(),
          });
        } else {
          const data = await editMessage(token, group.id, messageId, body.trim());
          setMessages((prev) => prev.map((m) => (m.id === data.message.id ? data.message : m)));
        }
      } catch (err) {
        setChatError(esMsg(err.message));
      }
    },
    [token, group?.id]
  );

  const deleteChat = useCallback(
    async (messageId) => {
      if (!token || !group?.id || !messageId) return;
      setChatError(null);
      try {
        if (socketRef.current?.connected) {
          socketRef.current.emit('chat:delete', { groupId: group.id, messageId });
        } else {
          const data = await deleteMessage(token, group.id, messageId);
          setMessages((prev) => prev.map((m) => (m.id === data.message.id ? data.message : m)));
        }
      } catch (err) {
        setChatError(esMsg(err.message));
      }
    },
    [token, group?.id]
  );

  const reactChat = useCallback(
    async (messageId, emoji) => {
      if (!token || !group?.id || !messageId || !emoji) return;
      setChatError(null);
      try {
        if (socketRef.current?.connected) {
          socketRef.current.emit('chat:react', { groupId: group.id, messageId, emoji });
        } else {
          const data = await reactToMessage(token, group.id, messageId, emoji);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.messageId ? { ...m, reactions: data.reactions || [] } : m
            )
          );
        }
      } catch (err) {
        setChatError(esMsg(err.message));
      }
    },
    [token, group?.id]
  );

  const postSticker = useCallback(
    async (stickerId, { replyToId } = {}) => {
      if (!token || !group?.id || !stickerId) return;
      setChatError(null);
      try {
        if (socketRef.current?.connected) {
          socketRef.current.emit('chat:sticker', {
            groupId: group.id,
            stickerId,
            replyToId: replyToId || undefined,
          });
        } else {
          const data = await sendSticker(token, group.id, stickerId, { replyToId });
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      } catch (err) {
        setChatError(esMsg(err.message));
      }
    },
    [token, group?.id]
  );

  const sendPanic = useCallback(
    async ({ latitude, longitude, accuracyM, note } = {}) => {
      if (!token || !group?.id || panicSending) return null;
      setPanicSending(true);
      setChatError(null);
      // Confirmación corta al emisor (no bucle; los demás sí hasta Enterado)
      playPanicAlarm({ loops: 3 });
      unlockPanicAudio().catch(() => {});
      try {
        const data = await triggerPanic(token, {
          groupId: group.id,
          latitude,
          longitude,
          accuracyM,
          note,
        });
        if (data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
        return data.event;
      } catch (err) {
        setChatError(esMsg(err.message));
        return null;
      } finally {
        setPanicSending(false);
      }
    },
    [token, group?.id, panicSending]
  );

  const markRead = useCallback(
    async (upToMessageId) => {
      if (!token || !group?.id || !upToMessageId) return;
      try {
        if (socketRef.current?.connected) {
          socketRef.current.emit('chat:read', { groupId: group.id, upToMessageId });
        } else {
          const data = await markMessagesRead(token, group.id, upToMessageId);
          if (data.updates?.length) {
            const map = new Map(data.updates.map((u) => [u.messageId, u]));
            setMessages((prev) =>
              prev.map((m) => {
                const u = map.get(m.id);
                if (!u) return m;
                return { ...m, readCount: u.readCount, readFully: u.readFully };
              })
            );
          }
        }
      } catch {
        /* ignore */
      }
    },
    [token, group?.id]
  );

  const ackPanic = useCallback(async () => {
    if (!token || !incomingPanic?.id || panicAcking) return false;
    setPanicAcking(true);
    const panicId = incomingPanic.id;
    // Silencio solo en este dispositivo / pestaña
    stopPanicAlarm();
    setIncomingPanic(null);
    try {
      // Auditoría en servidor; no debe apagar la sirena de los demás
      await patchPanicEvent(token, panicId, 'acked');
      return true;
    } catch (err) {
      setChatError(esMsg(err.message));
      return false;
    } finally {
      setPanicAcking(false);
    }
  }, [token, incomingPanic?.id, panicAcking]);

  const dismissPanicLocal = useCallback(() => {
    stopPanicAlarm();
    setIncomingPanic(null);
  }, []);

  const silencePanicAlarm = useCallback(() => {
    stopPanicAlarm();
  }, []);

  const typingLabel = Object.values(typingUsers).length
    ? `${Object.values(typingUsers).slice(0, 2).join(', ')} escribiendo…`
    : '';

  return {
    connected,
    livekitReady,
    speaking,
    holding,
    denied,
    error,
    status,
    online,
    messages,
    chatError,
    typingLabel,
    press,
    release,
    toggle,
    postChat,
    postMedia,
    postSticker,
    sendPanic,
    panicSending,
    lastPanicAt,
    incomingPanic,
    ackPanic,
    dismissPanicLocal,
    silencePanicAlarm,
    panicAcking,
    markRead,
    editChat,
    deleteChat,
    reactChat,
    setTyping,
    isMeSpeaking: holding && speaking?.userId === user?.id,
    listenMuted,
    setListenMuted,
    unlockAudio,
  };
}
