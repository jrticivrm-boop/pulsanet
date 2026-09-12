import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { canDispatch, canManageUsers, fetchGroups, fetchLiveKitStatus } from '../api';
import { ThemeToggle } from '../theme';
import { usePtt } from '../usePtt';
import { useGpsReporter } from '../useGpsReporter';
import ChatInbox from '../ChatInbox';
import ChannelMultiSelect from '../ChannelMultiSelect';
import { unlockPanicAudio } from '../panicSound';
import { openPanicLocation, isValidMapCoord } from '../panicMaps';
import { unlockMediaAudio } from '../unlockMediaAudio';
import { startBackgroundKeepalive, stopBackgroundKeepalive } from '../backgroundKeepalive';
import { useDispatchListen } from '../useDispatchListen';
import { openPeoplePalette, openPeerSheet } from '../peerActions';
import BrandName from '../BrandName.jsx';
import { esDeniedReason, esMsg } from '../esMsg';

const LISTEN_KEY = 'tacticalptx_listen_groups';
const GROUP_KEY = 'tacticalptx_dispatch_group';
const TALK_IDS_KEY = 'tacticalptx_talk_groups';
const VIDEO_IDS_KEY = 'tacticalptx_video_groups';
const ALERT_IDS_KEY = 'tacticalptx_alert_groups';
const LISTEN_MODE_KEY = 'tacticalptx_listen_mode';
const TALK_MODE_KEY = 'tacticalptx_talk_mode';
const VIDEO_MODE_KEY = 'tacticalptx_video_mode';
const ALERT_MODE_KEY = 'tacticalptx_alert_mode';
const GROUP_ORDER_KEY = 'tacticalptx_group_order';

function readJsonArray(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(raw) ? raw : null;
  } catch {
    return null;
  }
}

function readMode(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (v === 'individual' || v === 'multiple') return v;
  } catch {
    /* ignore */
  }
  return fallback;
}

function pickTopId(ids, order) {
  const set = new Set(ids || []);
  if (!set.size) return '';
  for (const id of order || []) {
    if (set.has(id)) return id;
  }
  return [...set][0] || '';
}

export default function RadioPage({ session, onLogout, dispatchEmbed = null }) {
  const outletCtx = useOutletContext() || {};
  const dispatchCtx = dispatchEmbed || outletCtx;
  const embedded = Boolean(dispatchCtx.embeddedInDispatch && dispatchCtx.ptt);
  const navigate = useNavigate();
  const location = useLocation();
  const onRadioPage = embedded ? location.pathname.startsWith('/despacho/radio') : true;

  const [localGroups, setLocalGroups] = useState([]);
  const [localGroup, setLocalGroup] = useState(null);
  const [localListenIds, setLocalListenIds] = useState([]);
  const [localTalkIds, setLocalTalkIds] = useState([]);
  const [localVideoIds, setLocalVideoIds] = useState([]);
  const [localAlertIds, setLocalAlertIds] = useState([]);
  const [localListenMode, setLocalListenMode] = useState(() =>
    readMode(LISTEN_MODE_KEY, 'multiple')
  );
  const [localTalkMode, setLocalTalkMode] = useState(() =>
    readMode(TALK_MODE_KEY, 'individual')
  );
  const [localVideoMode, setLocalVideoMode] = useState(() =>
    readMode(VIDEO_MODE_KEY, 'individual')
  );
  const [localAlertMode, setLocalAlertMode] = useState(() =>
    readMode(ALERT_MODE_KEY, 'individual')
  );
  const [localOrder, setLocalOrder] = useState([]);
  const [lkStatus, setLkStatus] = useState(null);
  const [err, setErr] = useState('');
  const [gpsOk, setGpsOk] = useState(false);
  const [panicFlash, setPanicFlash] = useState('');
  const [focusPeerId, setFocusPeerId] = useState(null);
  const [focusGroupId, setFocusGroupId] = useState(null);
  const gpsRef = useGpsReporter(session.token, setGpsOk);

  const groups = embedded ? dispatchCtx.groups || [] : localGroups;
  const group = embedded ? dispatchCtx.group : localGroup;
  const listenIds = embedded ? dispatchCtx.listenIds || [] : localListenIds;
  const talkIds = embedded ? dispatchCtx.talkIds || (group?.id ? [group.id] : []) : localTalkIds;
  const videoIds = embedded ? dispatchCtx.videoIds || [] : localVideoIds;
  const alertIds = embedded ? dispatchCtx.alertIds || [] : localAlertIds;
  const listenMode = embedded ? dispatchCtx.listenMode || 'multiple' : localListenMode;
  const talkMode = embedded ? dispatchCtx.talkMode || 'individual' : localTalkMode;
  const videoMode = embedded ? dispatchCtx.videoMode || 'individual' : localVideoMode;
  const alertMode = embedded ? dispatchCtx.alertMode || 'individual' : localAlertMode;
  const groupOrder = embedded ? dispatchCtx.groupOrder || groups.map((g) => g.id) : localOrder;

  useEffect(() => {
    if (embedded) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [g, lk] = await Promise.all([
          fetchGroups(session.token),
          fetchLiveKitStatus(session.token),
        ]);
        if (cancelled) return;
        const list = g.groups || [];
        setLocalGroups(list);
        setLkStatus(lk);
        const allIds = list.map((x) => x.id);
        let order = readJsonArray(GROUP_ORDER_KEY) || [];
        order = order.filter((id) => allIds.includes(id));
        for (const id of allIds) if (!order.includes(id)) order.push(id);
        setLocalOrder(order);

        const savedListen = readJsonArray(LISTEN_KEY);
        let nextListen = Array.isArray(savedListen)
          ? savedListen.filter((id) => allIds.includes(id))
          : allIds;
        let nextTalk = readJsonArray(TALK_IDS_KEY);
        if (!Array.isArray(nextTalk)) {
          nextTalk = list[0]?.id ? [list[0].id] : [];
        } else {
          nextTalk = nextTalk.filter((id) => allIds.includes(id));
        }
        const modeL = readMode(LISTEN_MODE_KEY, 'multiple');
        const modeT = readMode(TALK_MODE_KEY, 'individual');
        const modeV = readMode(VIDEO_MODE_KEY, 'individual');
        const modeA = readMode(ALERT_MODE_KEY, 'individual');
        setLocalListenMode(modeL);
        setLocalTalkMode(modeT);
        setLocalVideoMode(modeV);
        setLocalAlertMode(modeA);
        if (modeL === 'individual') {
          const one = pickTopId(nextListen, order);
          nextListen = one ? [one] : [];
        }
        if (modeT === 'individual') {
          const one = pickTopId(nextTalk, order);
          nextTalk = one ? [one] : [];
        }
        let nextVideo = readJsonArray(VIDEO_IDS_KEY);
        if (!Array.isArray(nextVideo)) nextVideo = [];
        else nextVideo = nextVideo.filter((id) => allIds.includes(id));
        if (modeV === 'individual') {
          const one = pickTopId(nextVideo, order);
          nextVideo = one ? [one] : [];
        } else {
          nextVideo = order.filter((id) => nextVideo.includes(id));
        }
        let nextAlert = readJsonArray(ALERT_IDS_KEY);
        if (!Array.isArray(nextAlert)) nextAlert = [];
        else nextAlert = nextAlert.filter((id) => allIds.includes(id));
        if (modeA === 'individual') {
          const one = pickTopId(nextAlert, order);
          nextAlert = one ? [one] : [];
        } else {
          nextAlert = order.filter((id) => nextAlert.includes(id));
        }
        for (const id of nextTalk) {
          if (!nextListen.includes(id)) nextListen.push(id);
        }
        setLocalListenIds(nextListen);
        setLocalTalkIds(nextTalk);
        setLocalVideoIds(nextVideo);
        setLocalAlertIds(nextAlert);
        const primary = pickTopId(nextTalk, order);
        setLocalGroup(list.find((x) => x.id === primary) || null);
      } catch (e) {
        if (!cancelled) {
          setErr(e.message);
          if (/token|autoriz/i.test(e.message)) onLogout();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.token, onLogout, embedded]);

  function persistLocalListen(ids) {
    setLocalListenIds(ids);
    try {
      localStorage.setItem(LISTEN_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }

  function persistLocalTalk(ids) {
    const valid = (ids || []).filter((id) => localGroups.some((g) => g.id === id));
    setLocalTalkIds(valid);
    const primary = pickTopId(valid, localOrder);
    setLocalGroup(localGroups.find((g) => g.id === primary) || null);
    try {
      localStorage.setItem(TALK_IDS_KEY, JSON.stringify(valid));
      localStorage.setItem(GROUP_KEY, primary || '');
    } catch {
      /* ignore */
    }
  }

  function persistLocalVideo(ids) {
    const valid = (ids || []).filter((id) => localGroups.some((g) => g.id === id));
    const ordered = localOrder.length
      ? localOrder.filter((id) => valid.includes(id))
      : valid;
    setLocalVideoIds(ordered);
    try {
      localStorage.setItem(VIDEO_IDS_KEY, JSON.stringify(ordered));
    } catch {
      /* ignore */
    }
  }

  function persistLocalAlert(ids) {
    const valid = (ids || []).filter((id) => localGroups.some((g) => g.id === id));
    const ordered = localOrder.length
      ? localOrder.filter((id) => valid.includes(id))
      : valid;
    setLocalAlertIds(ordered);
    try {
      localStorage.setItem(ALERT_IDS_KEY, JSON.stringify(ordered));
    } catch {
      /* ignore */
    }
  }

  function setGroupFromSelect(id) {
    setFocusPeerId(null);
    if (embedded) {
      dispatchCtx.onGroupChange?.(id);
      return;
    }
    persistLocalTalk(id ? [id] : []);
    if (id && !localListenIds.includes(id)) {
      persistLocalListen([...localListenIds, id]);
    }
  }

  /* Si está embebido en despacho, no abrir segundo PTT/LiveKit */
  const localPtt = usePtt({
    token: embedded ? '' : session.token,
    user: session.user,
    group: embedded ? null : localGroup,
    talkGroupIds: embedded ? [] : localTalkIds,
    suppressChatNotify: !embedded,
  });
  const ptt = embedded ? dispatchCtx.ptt : localPtt;

  const listenGroups = groups.filter((g) => listenIds.includes(g.id));
  useDispatchListen({
    token: embedded ? '' : session.token,
    groups: embedded ? [] : listenGroups,
    skipGroupIds: embedded ? [] : talkIds.length ? talkIds : group?.id ? [group.id] : [],
    muted: ptt.listenMuted,
  });

  useEffect(() => {
    if (embedded) return undefined;
    if (!group?.name && !group?.id) return undefined;
    startBackgroundKeepalive({ channelName: group?.name || 'Canal' }).catch(() => {});
    return () => {
      stopBackgroundKeepalive();
    };
  }, [group?.id, group?.name, embedded]);

  useEffect(() => {
    if (embedded) return undefined;
    const unlock = () => {
      unlockMediaAudio().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [embedded]);

  useEffect(() => {
    const st = location.state;
    if (!st?.focusPeerId && !st?.focusGroupId && !st?.openGroupVideo) return;
    if (st.focusPeerId) setFocusPeerId(st.focusPeerId);
    if (st.focusGroupId) {
      setFocusGroupId(st.focusGroupId);
      setGroupFromSelect(st.focusGroupId);
    }
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    /* En despacho el Espacio lo maneja DispatchLayout (todas las pestañas) */
    if (embedded) return undefined;
    const onKeyDown = (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      ptt.toggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [embedded, ptt.toggle]);

  const speakerLabel = ptt.listenMuted
    ? 'Radio silenciada'
    : ptt.holding
      ? 'Tú estás al aire'
      : ptt.speaking
        ? group?.name
          ? `${ptt.speaking.displayName}, ${group.name}`
          : `${ptt.speaking.displayName} habla`
        : 'Canal libre';

  const ready = ptt.livekitReady && ptt.connected;

  useEffect(() => {
    if (ptt.incomingPanic) {
      setPanicFlash(
        `🚨 ALERTA — ${ptt.incomingPanic.displayName}. Pulsa Enterado para silenciar en este equipo.`
      );
    }
  }, [ptt.incomingPanic]);

  async function onPanic() {
    if (!alertIds.length || ptt.panicSending) return;
    unlockPanicAudio().catch(() => {});

    const ordered = groupOrder.length
      ? groupOrder.filter((id) => alertIds.includes(id))
      : alertIds;
    const event = await ptt.sendPanic({
      groupIds: ordered,
      latitude: gpsRef.current.latitude,
      longitude: gpsRef.current.longitude,
      accuracyM: gpsRef.current.accuracyM,
    });
    if (event) {
      setPanicFlash('Alerta de pánico enviada');
      setTimeout(() => setPanicFlash(''), 4000);
    }
  }

  return (
    <div
      className={`shell channel-shell radio-ops radio-ops--inst${embedded ? ' radio-ops--embedded' : ''} ${ptt.holding ? 'on-air' : ''}`}
    >
      {!embedded && <div className="atmosphere" aria-hidden="true" />}

      {!embedded && (
        <header className="topbar radio-topbar">
          <div>
            <p className="cc-product" style={{ margin: 0 }}>
              Radio PTT
            </p>
            <BrandName className="brand radio-brand" withLogo size="md" />
            <p className="user-line">{session.user.displayName}</p>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="btn ghost btn-personas"
              title="Buscar personas (Ctrl+K)"
              onClick={() => openPeoplePalette()}
            >
              Personas
            </button>
            <span className={`gps-pill ${gpsOk ? 'ok' : ''}`}>{gpsOk ? 'GPS activo' : 'GPS…'}</span>
            <ThemeToggle />
            {canDispatch(session.user) && (
              <Link to="/despacho" className="btn ghost">
                Despacho
              </Link>
            )}
            {canManageUsers(session.user) && (
              <button type="button" className="btn ghost" onClick={onLogout}>
                Salir
              </button>
            )}
          </div>
        </header>
      )}

      <div className="radio-ops-grid radio-ops-grid--inbox">
        <section className="radio-ops-deck" aria-label="Control de radio">
          <div className="radio-ops-meta">
            <div className="radio-ops-meta-row">
              <ChannelMultiSelect
                compact
                showVideo
                showAlert
                groups={groups}
                orderIds={groupOrder}
                onOrderChange={(ids) => {
                  if (embedded) {
                    dispatchCtx.onGroupOrderChange?.(ids);
                    return;
                  }
                  setLocalOrder(ids);
                  try {
                    localStorage.setItem(GROUP_ORDER_KEY, JSON.stringify(ids));
                  } catch {
                    /* ignore */
                  }
                  if (localTalkIds.length) {
                    const primary = pickTopId(localTalkIds, ids);
                    setLocalGroup(localGroups.find((g) => g.id === primary) || null);
                  }
                  if (localVideoIds.length) {
                    setLocalVideoIds(ids.filter((id) => localVideoIds.includes(id)));
                  }
                  if (localAlertIds.length) {
                    setLocalAlertIds(ids.filter((id) => localAlertIds.includes(id)));
                  }
                }}
                listenMode={listenMode}
                talkMode={talkMode}
                videoMode={videoMode}
                alertMode={alertMode}
                onListenModeChange={(m) => {
                  if (embedded) {
                    dispatchCtx.onListenModeChange?.(m);
                    return;
                  }
                  setLocalListenMode(m);
                  try {
                    localStorage.setItem(LISTEN_MODE_KEY, m);
                  } catch {
                    /* ignore */
                  }
                }}
                onTalkModeChange={(m) => {
                  if (embedded) {
                    dispatchCtx.onTalkModeChange?.(m);
                    return;
                  }
                  setLocalTalkMode(m);
                  try {
                    localStorage.setItem(TALK_MODE_KEY, m);
                  } catch {
                    /* ignore */
                  }
                }}
                onVideoModeChange={(m) => {
                  if (embedded) {
                    dispatchCtx.onVideoModeChange?.(m);
                    return;
                  }
                  setLocalVideoMode(m);
                  try {
                    localStorage.setItem(VIDEO_MODE_KEY, m);
                  } catch {
                    /* ignore */
                  }
                }}
                onAlertModeChange={(m) => {
                  if (embedded) {
                    dispatchCtx.onAlertModeChange?.(m);
                    return;
                  }
                  setLocalAlertMode(m);
                  try {
                    localStorage.setItem(ALERT_MODE_KEY, m);
                  } catch {
                    /* ignore */
                  }
                }}
                listenIds={listenIds}
                talkIds={talkIds}
                videoIds={videoIds}
                alertIds={alertIds}
                onListenChange={
                  embedded ? dispatchCtx.onListenChange : persistLocalListen
                }
                onTalkChange={
                  embedded ? dispatchCtx.onTalkIdsChange : persistLocalTalk
                }
                onVideoChange={
                  embedded ? dispatchCtx.onVideoIdsChange : persistLocalVideo
                }
                onAlertChange={
                  embedded ? dispatchCtx.onAlertIdsChange : persistLocalAlert
                }
              />
            </div>

            <p className={`speaker radio-ops-speaker ${ptt.holding || ptt.speaking ? 'active' : ''}`}>
              {speakerLabel}
            </p>

            <div className="radio-ops-online">
              <h2>En línea ({ptt.online.length})</h2>
              <ul className="online-list">
                {ptt.online.length === 0 && <li className="muted">Nadie en el canal</li>}
                {ptt.online.map((m) => {
                  const dot = 'active';
                  const title =
                    m.focus === 'service'
                      ? 'En línea (segundo plano)'
                      : m.focus === 'background'
                        ? 'Minimizada'
                        : 'En la app';
                  return (
                  <li key={m.userId} className={m.userId === session.user.id ? 'me' : ''}>
                    <span
                      className={`dot ${dot}`}
                      title={title}
                    />
                    {m.userId === session.user.id ? (
                      <span>
                        {m.displayName} (tú)
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="online-peer-btn"
                        title="Mensaje, llamada o video"
                        onClick={() =>
                          openPeerSheet({
                            id: m.userId,
                            displayName: m.displayName,
                            avatarUrl: m.avatarUrl,
                          })
                        }
                      >
                        {m.displayName}
                      </button>
                    )}
                  </li>
                  );
                })}
              </ul>
            </div>

            {panicFlash && <p className="panic-flash">{panicFlash}</p>}
            {(ptt.denied || ptt.error || err) && (
              <p className="error">
                {ptt.denied ? esDeniedReason(ptt.denied.reason) : esMsg(ptt.error || err)}
              </p>
            )}
          </div>

          <div className="radio-ops-ptt">
            <div className="radio-ops-ptt-side" aria-label="Acciones de radio">
              <button
                type="button"
                className="panic-btn radio-panic radio-ops-side-btn"
                disabled={!alertIds.length || ptt.panicSending}
                onPointerDown={() => {
                  unlockPanicAudio().catch(() => {});
                }}
                onClick={onPanic}
                title={
                  alertIds.length
                    ? alertIds.length > 1
                      ? `Enviar alerta a ${alertIds.length} canales (1 aviso por persona)`
                      : 'Enviar alerta — un clic envía la alerta al canal'
                    : 'Selecciona al menos un canal en Alerta'
                }
              >
                <span className="panic-ico" aria-hidden="true">
                  ⚠
                </span>
                <span>{ptt.panicSending ? '…' : 'Enviar alerta'}</span>
              </button>

              <button
                type="button"
                className={`radio-listen-mute radio-ops-side-btn${ptt.listenMuted ? ' is-muted' : ''}`}
                onClick={() => {
                  ptt.unlockAudio?.().catch(() => {});
                  ptt.setListenMuted(!ptt.listenMuted);
                }}
                disabled={!group}
                aria-pressed={ptt.listenMuted}
                title={
                  ptt.listenMuted
                    ? 'Audio desactivado — toca para oír el canal'
                    : 'Audio activado — toca para dejar de oír el canal'
                }
              >
                <span aria-hidden="true">{ptt.listenMuted ? '🔇' : '🔊'}</span>
                <span>{ptt.listenMuted ? 'Audio desactivado' : 'Audio activado'}</span>
              </button>

              <button
                type="button"
                className="radio-video-call-btn radio-ops-side-btn"
                disabled={!videoIds.length}
                title={
                  videoIds.length > 1
                    ? `Videollamada unificada de ${videoIds.length} canales`
                    : videoIds.length === 1
                      ? 'Videollamada del canal seleccionado (no interrumpe el PTT)'
                      : 'Selecciona al menos un canal en Video'
                }
                onClick={() => {
                  const ordered = groupOrder.length
                    ? groupOrder.filter((id) => videoIds.includes(id))
                    : videoIds;
                  const primary = ordered[0];
                  if (!primary) return;
                  const names = ordered
                    .map((id) => groups.find((g) => g.id === id)?.name)
                    .filter(Boolean);
                  window.dispatchEvent(
                    new CustomEvent('tacticalptx:open-group-video', {
                      detail: {
                        groupId: primary,
                        groupIds: ordered,
                        groupName:
                          names.length > 1 ? names.join(' + ') : names[0] || 'Grupo',
                      },
                    })
                  );
                }}
              >
                <span aria-hidden="true">📹</span>
                <span>Videollamada</span>
              </button>
            </div>

            <button
              type="button"
              className={`ptt-btn radio-ptt ${ptt.holding ? 'holding' : ''}`}
              disabled={!ready}
              onClick={(e) => {
                e.preventDefault();
                ptt.toggle();
              }}
              onContextMenu={(e) => e.preventDefault()}
              aria-pressed={ptt.holding}
              title={ptt.holding ? 'Toca o Espacio para soltar' : 'Toca o Espacio para hablar'}
            >
              <span className="ptt-label">{ptt.holding ? 'AL AIRE' : 'PTT'}</span>
              <span className="ptt-sub">{ready ? (ptt.holding ? 'soltar' : 'tocar') : '…'}</span>
            </button>
          </div>
        </section>

        <section className="radio-ops-inbox" aria-label="Chats">
          <ChatInbox
            session={session}
            groups={groups}
            group={group}
            onSelectGroup={setGroupFromSelect}
            ptt={ptt}
            focusPeerId={focusPeerId}
            focusGroupId={focusGroupId}
            chatPanelVisible={onRadioPage}
          />
        </section>
      </div>

      {!embedded &&
        ptt.incomingPanic &&
        createPortal(
          <div
            className="radio-panic-overlay"
            role="alertdialog"
            aria-modal="true"
            aria-label="Alerta de pánico"
          >
            <div className="radio-panic-modal">
              <h2>ALERTA</h2>
              <p>
                <strong>{ptt.incomingPanic.displayName}</strong> necesita ayuda en este canal.
                <br />
                La alarma suena hasta pulsar Enterado.
              </p>
              {isValidMapCoord(ptt.incomingPanic.latitude, ptt.incomingPanic.longitude) ? (
                <>
                  <p className="radio-panic-meta">
                    {ptt.incomingPanic.accuracyM != null
                      ? `Ubicación registrada (±${Math.round(Number(ptt.incomingPanic.accuracyM))} m)`
                      : 'Ubicación registrada'}
                  </p>
                  <div className="radio-panic-actions">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        ptt.silencePanicAlarm();
                        openPanicLocation({
                          latitude: ptt.incomingPanic.latitude,
                          longitude: ptt.incomingPanic.longitude,
                          navigate: false,
                        });
                      }}
                    >
                      Ver ubicación
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        ptt.silencePanicAlarm();
                        openPanicLocation({
                          latitude: ptt.incomingPanic.latitude,
                          longitude: ptt.incomingPanic.longitude,
                          navigate: true,
                        });
                      }}
                    >
                      Cómo llegar
                    </button>
                  </div>
                </>
              ) : (
                <p className="radio-panic-meta">Sin ubicación GPS del emisor.</p>
              )}
              <button
                type="button"
                className="btn danger radio-panic-ack"
                disabled={ptt.panicAcking}
                onClick={() => ptt.ackPanic()}
              >
                {ptt.panicAcking ? '…' : 'Enterado'}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
