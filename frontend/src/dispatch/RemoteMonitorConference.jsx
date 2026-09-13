import { useEffect, useMemo, useState } from 'react';
import { endPrivateCall } from '../api';
import PrivateCallOverlay from '../PrivateCallOverlay';

/**
 * Varias «Ver cámara» en un solo panel tipo conferencia (mosaico).
 * Expandir usa CSS fullscreen — los overlays LiveKit no se desmontan.
 */
export default function RemoteMonitorConference({ monitors = [], sessionToken, onHangupMonitor }) {
  const list = Array.isArray(monitors) ? monitors.filter(Boolean) : [];
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState(list[0]?.callId || null);

  useEffect(() => {
    if (!list.some((m) => String(m.callId) === String(selectedId))) {
      setSelectedId(list[0]?.callId || null);
    }
  }, [list, selectedId]);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const selected = useMemo(
    () => list.find((m) => String(m.callId) === String(selectedId)) || list[0] || null,
    [list, selectedId]
  );

  const gridClass =
    list.length <= 1
      ? 'count-1'
      : list.length === 2
        ? 'count-2'
        : list.length === 3
          ? 'count-3'
          : list.length === 4
            ? 'count-4'
            : list.length <= 6
              ? 'count-6'
              : 'count-many';

  async function hangupOne(mon, opts) {
    try {
      if (mon?.callId && opts?.remote !== true && sessionToken) {
        await endPrivateCall(sessionToken, mon.callId, 'hangup');
      }
    } catch {
      /* ignore — colgar UI igual */
    }
    onHangupMonitor?.(mon);
  }

  async function hangupAll() {
    const copy = [...list];
    await Promise.all(
      copy.map(async (mon) => {
        try {
          if (mon.callId && sessionToken) await endPrivateCall(sessionToken, mon.callId, 'hangup');
        } catch {
          /* ignore */
        }
        onHangupMonitor?.(mon);
      })
    );
  }

  if (list.length === 0) return null;

  return (
    <section
      className={`cc-video-panel rmc-conference size-lg${expanded ? ' is-expanded-fs' : ''}`}
      aria-label="Conferencia de cámaras"
    >
      <header className="cc-video-panel-head">
        <div>
          <h2>Conferencia de cámaras</h2>
          <p className="cc-hint">
            {list.length} dispositivo{list.length === 1 ? '' : 's'} · mosaico tipo videoconferencia
            {selected ? ` · seleccionado: ${selected.peerName}` : ''}
          </p>
        </div>
        <div className="cc-video-panel-tools">
          <button
            type="button"
            className="cc-btn"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Volver al panel' : 'Pantalla completa'}
          >
            {expanded ? 'Reducir' : 'Expandir'}
          </button>
          <button type="button" className="cc-btn danger" onClick={() => void hangupAll()}>
            Colgar todas
          </button>
        </div>
      </header>
      <div className="cc-video-panel-body rmc-body">
        <div className={`rmc-grid ${gridClass}`} role="group" aria-label="Conferencia de cámaras">
          {list.map((mon) => (
            <PrivateCallOverlay
              key={mon.callId}
              call={mon}
              layout="slot"
              selected={String(selected?.callId) === String(mon.callId)}
              onSelect={() => setSelectedId(mon.callId)}
              onHangup={(opts) => hangupOne(mon, opts)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
