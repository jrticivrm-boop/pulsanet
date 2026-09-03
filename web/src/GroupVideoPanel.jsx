import { createPortal } from 'react-dom';
import VideoConferenceMosaic from './VideoConferenceMosaic';
import { useGroupVideo } from './useGroupVideo';

/**
 * Panel flotante de transmisión grupal (paralelo al PTT de audio).
 */
export default function GroupVideoPanel({
  token,
  groupId,
  groupName,
  onClose,
  onRemoteEnded,
  layout = 'overlay',
}) {
  const gv = useGroupVideo({
    token,
    groupId,
    groupName,
    enabled: Boolean(token && groupId),
    onRemoteEnded,
  });

  const handleLeave = async () => {
    await gv.disconnect();
    onClose?.();
  };

  const handleEnd = async () => {
    await gv.stopBroadcast();
    onClose?.();
  };

  const isConsole = layout === 'console';

  const panel = (
    <div
      className={`group-video-panel${isConsole ? ' console' : ''}${gv.active ? ' active' : ''}`}
      role="dialog"
      aria-label="Transmisión grupal"
    >
      <header className="group-video-header">
        <div className="group-video-meta">
          <span className="group-video-badge">EN VIVO</span>
          <strong>{groupName || 'Grupo'}</strong>
          <small>
            {gv.status || 'Conectando…'}
            {gv.participantCount > 0 ? ` · ${gv.participantCount} en transmisión` : ''}
          </small>
        </div>
        <div className="group-video-header-actions">
          {!isConsole && (
            <button type="button" className="wa-icon-btn" onClick={handleLeave} title="Salir">
              ✕
            </button>
          )}
        </div>
      </header>

      <div className="group-video-stage">
        <VideoConferenceMosaic tiles={gv.tiles} compact={isConsole} />
      </div>

      <footer className="group-video-controls">
        <button
          type="button"
          className={`wa-call-btn${gv.muted ? ' off' : ''}`}
          onClick={gv.toggleMute}
          title={gv.muted ? 'Activar micrófono' : 'Silenciar'}
        >
          {isConsole ? (gv.muted ? 'Mic off' : 'Mic') : gv.muted ? '🎤✕' : '🎤'}
        </button>
        <button
          type="button"
          className={`wa-call-btn${gv.cameraOn ? '' : ' off'}${isConsole ? ' cam-toggle' : ''}`}
          onClick={gv.toggleCamera}
          title={gv.cameraOn ? 'Apagar cámara web' : 'Activar cámara web'}
        >
          {isConsole
            ? gv.cameraOn
              ? 'Apagar cámara'
              : 'Activar cámara web'
            : gv.cameraOn
              ? '📷'
              : '📷✕'}
        </button>
        {gv.cameraOn && (
          <button
            type="button"
            className="wa-call-btn"
            onClick={gv.switchCamera}
            title={gv.facingMode === 'user' ? 'Cámara trasera' : 'Cámara frontal'}
          >
            {isConsole
              ? gv.facingMode === 'user'
                ? 'Cámara trasera'
                : 'Cámara frontal'
              : `🔄 ${gv.facingMode === 'user' ? 'Trasera' : 'Frontal'}`}
          </button>
        )}
        <button type="button" className="wa-call-btn hangup" onClick={handleLeave} title="Salir">
          {isConsole ? 'Salir' : '📞'}
        </button>
        {gv.active && (
          <button type="button" className="wa-call-btn danger" onClick={handleEnd} title="Terminar transmisión">
            {isConsole ? 'Terminar' : '⏹'}
          </button>
        )}
      </footer>
    </div>
  );

  if (isConsole) return panel;
  return createPortal(panel, document.body);
}
