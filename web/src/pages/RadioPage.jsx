import { useEffect, useMemo, useRef, useState } from 'react';
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
import { unlockAppNotifyAudio } from '../appNotify';
import { startBackgroundKeepalive, stopBackgroundKeepalive } from '../backgroundKeepalive';
import { useDispatchListen } from '../useDispatchListen';
import BrandName from '../BrandName.jsx';
import { esDeniedReason, esMsg } from '../esMsg';

const LISTEN_KEY = 'tacticalptx_listen_groups';

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
  const [lkStatus, setLkStatus] = useState(null);
  const [err, setErr] = useState('');
  const [gpsOk, setGpsOk] = useState(false);
  const [panicFlash, setPanicFlash] = useState('');
  const [focusPeerId, setFocusPeerId] = useState(null);
  const [focusGroupId, setFocusGroupId] = useState(null);
  const gpsRef = useGpsReporter(session.token, setGpsOk);

  const groups = embedded ? dispatchCtx.groups || [] : localGroups;
  const group = embedded ? dispatchCtx.group : localGroup;
  const listenIds = embedded ? dispatchCtx.listenIds || groups.map((g) => g.id) : localListenIds;

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
        setLocalGroup(list[0] || null);
        setLkStatus(lk);
        let savedListen = null;
        try {
          savedListen = JSON.parse(localStorage.getItem(LISTEN_KEY) || 'null');
        } catch {
          savedListen = null;
        }
        const allIds = list.map((x) => x.id);
        const next = Array.isArray(savedListen)
          ? savedListen.filter((id) => allIds.includes(id))
          : allIds;
        if (list[0] && !next.includes(list[0].id)) next.push(list[0].id);
        setLocalListenIds(next.length ? next : allIds);
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

  function setGroupFromSelect(id) {
    setFocusPeerId(null);
    if (embedded) {
      dispatchCtx.onGroupChange?.(id);
      return;
    }
    onGroupPick(localGroups, id, setLocalGroup);
  }

  const scopeGroupIds = useMemo(() => {
    const ids = new Set();
    if (group?.id) ids.add(group.id);
    for (const id of listenIds || []) {
      if (id) ids.add(id);
    }
    return [...ids];
  }, [group?.id, listenIds]);

  /* Si está embebido en despacho, no abrir segundo PTT/LiveKit */
  const localPtt = usePtt({
    token: embedded ? '' : session.token,
    user: session.user,
    group: embedded ? null : localGroup,
    suppressChatNotify: !embedded,
  });
  const ptt = embedded ? dispatchCtx.ptt : localPtt;

  const listenGroups = groups.filter((g) => listenIds.includes(g.id));
  useDispatchListen({
    token: embedded ? '' : session.token,
    groups: embedded ? [] : listenGroups,
    skipGroupId: embedded ? null : group?.id,
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
      unlockPanicAudio().catch(() => {});
      unlockAppNotifyAudio().catch(() => {});
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
        `🚨 PÁNICO — ${ptt.incomingPanic.displayName}. Pulsa Enterado para silenciar en este equipo.`
      );
    }
  }, [ptt.incomingPanic]);

  async function onPanic() {
    if (!group?.id || ptt.panicSending) return;
    unlockPanicAudio().catch(() => {});

    const event = await ptt.sendPanic({
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
              {embedded ? (
                <label className="group-select">
                  Hablar en
                  <select
                    value={group?.id || ''}
                    onChange={(e) => setGroupFromSelect(e.target.value)}
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <ChannelMultiSelect
                  groups={groups}
                  talkGroupId={group?.id}
                  listenIds={listenIds}
                  onTalkChange={setGroupFromSelect}
                  onListenChange={
                    embedded ? dispatchCtx.onListenChange : persistLocalListen
                  }
                  label="Canales"
                />
              )}
              <button
                type="button"
                className="btn ghost radio-group-video-btn"
                disabled={!group?.id}
                title="Transmisión de video del canal activo (no interrumpe el PTT)"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('tacticalptx:open-group-video', {
                      detail: { groupId: group.id, groupName: group.name },
                    })
                  )
                }
              >
                Video en vivo
              </button>
              <ul className="status-list">
                <li className={ptt.connected ? 'ok' : ''}>
                  {ptt.connected ? 'Enlace ok' : 'Enlace…'}
                </li>
                <li className={ptt.livekitReady ? 'ok' : ''}>
                  {ptt.livekitReady
                    ? 'Audio ok'
                    : lkStatus?.configured === false
                      ? 'Sin audio'
                      : 'Audio…'}
                </li>
                {embedded && (
                  <li className={gpsOk ? 'ok' : ''}>{gpsOk ? 'GPS ok' : 'GPS…'}</li>
                )}
              </ul>
            </div>

            <p className={`speaker radio-ops-speaker ${ptt.holding || ptt.speaking ? 'active' : ''}`}>
              {speakerLabel}
            </p>

            <div className="radio-ops-online">
              <h2>En línea ({ptt.online.length})</h2>
              <ul className="online-list">
                {ptt.online.length === 0 && <li className="muted">Nadie en el canal</li>}
                {ptt.online.slice(0, 8).map((m) => (
                  <li key={m.userId} className={m.userId === session.user.id ? 'me' : ''}>
                    <span
                      className={`dot ${m.focus === 'background' ? 'away' : 'active'}`}
                      title={m.focus === 'background' ? 'En segundo plano' : 'En la app'}
                    />
                    {m.userId === session.user.id ? (
                      <span>
                        {m.displayName} (tú)
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="online-peer-btn"
                        title="Mensaje o llamada personal"
                        onClick={() => setFocusPeerId(m.userId)}
                      >
                        {m.displayName}
                      </button>
                    )}
                  </li>
                ))}
                {ptt.online.length > 8 && (
                  <li className="muted">+{ptt.online.length - 8} más</li>
                )}
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

            <button
              type="button"
              className="panic-btn radio-panic"
              disabled={!group?.id || ptt.panicSending}
              onPointerDown={() => {
                unlockPanicAudio().catch(() => {});
              }}
              onClick={onPanic}
              title="Alerta de pánico — un clic envía la alerta"
            >
              <span className="panic-ico" aria-hidden="true">
                ⚠
              </span>
              <span>{ptt.panicSending ? '…' : 'PÁNICO'}</span>
            </button>

            <button
              type="button"
              className={`radio-listen-mute${ptt.listenMuted ? ' is-muted' : ''}`}
              onClick={() => {
                ptt.unlockAudio?.().catch(() => {});
                ptt.setListenMuted(!ptt.listenMuted);
              }}
              disabled={!group}
              aria-pressed={ptt.listenMuted}
              title={
                ptt.listenMuted
                  ? 'Activar audio del radio'
                  : 'Silenciar radio — no oír a quien habla'
              }
            >
              <span aria-hidden="true">{ptt.listenMuted ? '🔇' : '🔊'}</span>
              <span>{ptt.listenMuted ? 'MUTE' : 'Silenciar'}</span>
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
            scopeGroupIds={scopeGroupIds}
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
              <h2>ALERTA DE PÁNICO</h2>
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

function onGroupPick(groups, id, setGroup) {
  setGroup(groups.find((g) => g.id === id) || null);
}
