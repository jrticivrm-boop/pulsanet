import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { canDispatch, fetchGroups, fetchLiveKitStatus } from '../api';
import { ThemeToggle } from '../theme';
import { usePtt } from '../usePtt';
import { useGpsReporter } from '../useGpsReporter';
import WhatsAppChat from '../WhatsAppChat';
import DirectChat from '../DirectChat';
import { unlockPanicAudio } from '../panicSound';
import { unlockAppNotifyAudio } from '../appNotify';
import { startBackgroundKeepalive, stopBackgroundKeepalive } from '../backgroundKeepalive';
import BrandName from '../BrandName.jsx';

export default function RadioPage({ session, onLogout }) {
  const [groups, setGroups] = useState([]);
  const [group, setGroup] = useState(null);
  const [lkStatus, setLkStatus] = useState(null);
  const [err, setErr] = useState('');
  const [gpsOk, setGpsOk] = useState(false);
  const [panicFlash, setPanicFlash] = useState('');
  const [panicArmed, setPanicArmed] = useState(false);
  const [dmToast, setDmToast] = useState(null);
  const [dmPulse, setDmPulse] = useState(false);
  const panicArmTimer = useRef(null);
  const dmToastTimer = useRef(null);
  const dmPanelRef = useRef(null);
  const gpsRef = useGpsReporter(session.token, setGpsOk);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [g, lk] = await Promise.all([
          fetchGroups(session.token),
          fetchLiveKitStatus(session.token),
        ]);
        if (cancelled) return;
        setGroups(g.groups || []);
        setGroup(g.groups?.[0] || null);
        setLkStatus(lk);
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
  }, [session.token, onLogout]);

  useEffect(() => {
    if (!group?.name && !group?.id) return undefined;
    startBackgroundKeepalive({ channelName: group?.name || 'Canal' }).catch(() => {});
    return () => {
      stopBackgroundKeepalive();
    };
  }, [group?.id, group?.name]);

  useEffect(() => {
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
  }, []);

  function focusDirectos() {
    setDmToast(null);
    setDmPulse(true);
    dmPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    window.setTimeout(() => setDmPulse(false), 1600);
  }

  function onDmToast(payload) {
    setDmToast(payload);
    if (dmToastTimer.current) clearTimeout(dmToastTimer.current);
    dmToastTimer.current = setTimeout(() => setDmToast(null), 6000);
  }

  const ptt = usePtt({ token: session.token, user: session.user, group });

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      ptt.press();
    };
    const onKeyUp = (e) => {
      if (e.code !== 'Space') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      ptt.release();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [ptt.press, ptt.release]);

  const speakerLabel = ptt.holding
    ? 'Tú estás al aire'
    : ptt.speaking
      ? `${ptt.speaking.displayName} habla`
      : 'Canal libre';

  const ready = ptt.livekitReady && ptt.connected;

  useEffect(() => {
    if (ptt.incomingPanic) {
      setPanicFlash(
        `🚨 PÁNICO — ${ptt.incomingPanic.displayName}. Pulsa Enterado para silenciar.`
      );
    }
  }, [ptt.incomingPanic]);

  async function onPanic() {
    if (!group?.id || ptt.panicSending) return;
    unlockPanicAudio().catch(() => {});

    if (!panicArmed) {
      setPanicArmed(true);
      setPanicFlash('Pulsa PÁNICO otra vez para confirmar');
      if (panicArmTimer.current) clearTimeout(panicArmTimer.current);
      panicArmTimer.current = setTimeout(() => {
        setPanicArmed(false);
        setPanicFlash('');
      }, 4000);
      return;
    }

    if (panicArmTimer.current) clearTimeout(panicArmTimer.current);
    setPanicArmed(false);
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
    <div className={`shell channel-shell radio-ops radio-ops--inst ${ptt.holding ? 'on-air' : ''}`}>
      <div className="atmosphere" aria-hidden="true" />

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
          <button type="button" className="btn ghost" onClick={onLogout}>
            Salir
          </button>
        </div>
      </header>

      {dmToast && (
        <button type="button" className="dm-toast" onClick={focusDirectos}>
          <strong>{dmToast.peerName || 'Mensaje'}</strong>
          <span>{dmToast.preview}</span>
        </button>
      )}

      <div className="radio-ops-grid">
        <section className="radio-ops-deck" aria-label="Control de radio">
          <div className="radio-ops-meta">
            <div className="radio-ops-meta-row">
              <label className="group-select">
                Canal
                <select
                  value={group?.id || ''}
                  onChange={(e) => onGroupPick(groups, e.target.value, setGroup)}
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
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
                    <span className="dot" />
                    {m.displayName}
                    {m.userId === session.user.id ? ' (tú)' : ''}
                  </li>
                ))}
                {ptt.online.length > 8 && (
                  <li className="muted">+{ptt.online.length - 8} más</li>
                )}
              </ul>
            </div>

            {ptt.incomingPanic && (
              <div className="panic-ack-bar" role="alert">
                <p>
                  🚨 <strong>{ptt.incomingPanic.displayName}</strong> — alerta activa
                </p>
                <button
                  type="button"
                  className="panic-ack-btn"
                  disabled={ptt.panicAcking}
                  onClick={() => ptt.ackPanic()}
                >
                  {ptt.panicAcking ? '…' : 'Enterado'}
                </button>
              </div>
            )}
            {panicFlash && <p className="panic-flash">{panicFlash}</p>}
            {(ptt.denied || ptt.error || err) && (
              <p className="error">
                {ptt.denied
                  ? ptt.denied.reason === 'solo escucha (sin PTT)'
                    ? 'Solo escucha — sin PTT'
                    : 'Canal ocupado — suelta y espera'
                  : ptt.error || err}
              </p>
            )}
          </div>

          <div className="radio-ops-ptt">
            <button
              type="button"
              className={`ptt-btn radio-ptt ${ptt.holding ? 'holding' : ''}`}
              disabled={!ready}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                ptt.press();
              }}
              onPointerUp={() => ptt.release()}
              onPointerCancel={() => ptt.release()}
              onContextMenu={(e) => e.preventDefault()}
              aria-pressed={ptt.holding}
            >
              <span className="ptt-label">{ptt.holding ? 'AL AIRE' : 'PTT'}</span>
              <span className="ptt-sub">{ready ? 'Espacio' : '…'}</span>
            </button>

            <button
              type="button"
              className={`panic-btn radio-panic${panicArmed ? ' armed' : ''}`}
              disabled={!group?.id || ptt.panicSending}
              onPointerDown={() => {
                unlockPanicAudio().catch(() => {});
              }}
              onClick={onPanic}
              title="Alerta de pánico — pulsa dos veces para confirmar"
            >
              <span className="panic-ico" aria-hidden="true">
                ⚠
              </span>
              <span>
                {ptt.panicSending ? '…' : panicArmed ? 'CONFIRMAR' : 'PÁNICO'}
              </span>
            </button>
          </div>
        </section>

        <section className="radio-ops-group" aria-label="Chat grupal">
          <header className="radio-ops-section-head">
            <h2>Chat grupal</h2>
            <span className="muted">{group?.name || 'Canal'}</span>
          </header>
          <WhatsAppChat
            token={session.token}
            userId={session.user.id}
            userRole={session.user.role}
            groupName={group?.name}
            onlineCount={ptt.online.length}
            typingLabel={ptt.typingLabel}
            messages={ptt.messages}
            chatError={ptt.chatError}
            onSend={(text, opts) => ptt.postChat(text, opts)}
            onSendMedia={(file, opts) => ptt.postMedia(file, opts)}
            onEdit={(id, text) => ptt.editChat(id, text)}
            onDelete={(id) => ptt.deleteChat(id)}
            onReact={(id, emoji) => ptt.reactChat(id, emoji)}
            onSendSticker={(stickerId, opts) => ptt.postSticker(stickerId, opts)}
            onMarkRead={(upToId) => ptt.markRead(upToId)}
            onTyping={ptt.setTyping}
          />
        </section>

        <section
          ref={dmPanelRef}
          className={`radio-ops-dm${dmPulse ? ' pulse' : ''}`}
          id="radio-directos"
          aria-label="Mensajes directos"
        >
          <header className="radio-ops-section-head">
            <h2>Directos</h2>
            <span className="muted">Mensajes y llamadas</span>
          </header>
          <DirectChat session={session} active embedded onDmToast={onDmToast} />
        </section>
      </div>
    </div>
  );
}

function onGroupPick(groups, id, setGroup) {
  setGroup(groups.find((g) => g.id === id) || null);
}
